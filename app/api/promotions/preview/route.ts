import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { loadVipSettings, phonesMatch } from '@/lib/vip-server'
import { readVipSessionPhone } from '@/lib/vip-session'
import { applyPromotions, filterRulesForPromoCode } from '@/lib/promotions'
import { loadActivePromotionRules, validatePromotionRule } from '@/lib/promotion-rules'
import { applyClientOffersToRules } from '@/lib/client-offers'
import type { PromotionCartLine, PromotionProductCandidate } from '@/lib/types/promotion'

// BLAC-P3-009 : apercu serveur, lecture seule. Aucune ecriture, aucun compteur d'usage modifie.
// Le serveur releve produits et prix dans la base ; les prix envoyes par le client sont ignores.

type PreviewItemInput = {
  product_id: string
  quantity: number
  selected_variants?: unknown
}

type DbProduct = {
  id: string
  name: string
  price: number
  discount: number | null
  variants: { type: string; prices?: Record<string, number> }[] | null
  is_vip: boolean | null
  active: boolean | null
}

const EMPTY = { discount_total: 0, gifts: [] as { product_id: string; product_name: string; quantity: number }[], labels: [] as string[], free_delivery: false }

function empty() {
  return NextResponse.json(EMPTY)
}

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return empty()
    const supabase = createClient(url, key)

    const body = (await req.json().catch(() => null)) as { items?: PreviewItemInput[]; promo_code?: string | null; phone?: string | null } | null
    const rawItems = Array.isArray(body?.items) ? body!.items! : []
    if (rawItems.length === 0) return empty()
    if (rawItems.some((i) => !i || typeof i.product_id !== 'string' || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)) return empty()

    const productIds = Array.from(new Set(rawItems.map((i) => i.product_id)))
    const { data: dbProducts, error } = await supabase
      .from('products')
      .select('id, name, price, discount, variants, is_vip, active')
      .in('id', productIds)
    if (error || !dbProducts) return empty()
    const productById = new Map<string, DbProduct>(dbProducts.map((p) => [p.id as string, p as unknown as DbProduct]))

    type Line = { product_id: string; product_name: string; quantity: number; unit_price: number; isVip: boolean }
    const items: Line[] = []
    for (const raw of rawItems) {
      const prod = productById.get(raw.product_id)
      if (!prod || prod.active === false) return empty()
      const selected = raw.selected_variants && typeof raw.selected_variants === 'object' ? (raw.selected_variants as Record<string, string>) : null
      let variantExtra = 0
      if (selected && Array.isArray(prod.variants)) {
        for (const vt of prod.variants) {
          const chosen = selected[vt.type]
          if (chosen && vt.prices && vt.prices[chosen] !== undefined) variantExtra += Number(vt.prices[chosen]) || 0
        }
      }
      const basePrice = (prod.discount ?? 0) > 0 ? Math.ceil(prod.price * (1 - (prod.discount ?? 0) / 100)) : prod.price
      items.push({ product_id: raw.product_id, product_name: prod.name, quantity: raw.quantity, unit_price: Math.ceil(basePrice + variantExtra), isVip: prod.is_vip === true })
    }

    // Meme controle VIP que la commande : sans acces VIP valide, la commande serait refusee, donc aucun apercu
    if (items.some((i) => i.isVip)) {
      const sessionPhone = readVipSessionPhone(req)
      if (!sessionPhone) return empty()
      const vipSettings = await loadVipSettings(supabase)
      if (!vipSettings) return empty()
      const authorized = vipSettings.enabled && vipSettings.allowedPhones.length > 0 && phonesMatch(sessionPhone, vipSettings.allowedPhones)
      if (!authorized) return empty()
    }

    const promoCodeInput = typeof body?.promo_code === 'string' ? body.promo_code.trim() : ''
    const loadedRules = (await loadActivePromotionRules(supabase)).filter((r) => validatePromotionRule(r).ok)
    // BLAC-P2-023 : offres personnelles du telephone (facultatif), lecture seule
    const offerPhone = typeof body?.phone === 'string' ? body.phone.trim() : ''
    const { rules: allRules } = await applyClientOffersToRules(supabase, loadedRules, offerPhone)
    const filtered = filterRulesForPromoCode(allRules, promoCodeInput)
    if (!filtered.codeValid) return empty()
    const eligibleRules = filtered.rules as typeof allRules

    const giftIds = new Set<string>()
    for (const r of eligibleRules) {
      ;(r.gift_product_ids ?? []).forEach((id) => giftIds.add(id))
      ;(r.benefits ?? []).forEach((b) => { if (b.benefit_type === 'gift_product' && b.product_id) giftIds.add(b.product_id) })
    }
    const missingGiftIds = Array.from(giftIds).filter((id) => !productById.has(id))
    let giftProducts: unknown[] = []
    if (missingGiftIds.length > 0) {
      const { data: gp } = await supabase.from('products').select('id, name, price, discount, is_vip, active, stock').in('id', missingGiftIds)
      giftProducts = gp ?? []
    }
    const promoCatalog = [...dbProducts, ...giftProducts] as unknown as PromotionProductCandidate[]
    const promoLines: PromotionCartLine[] = items.map((i) => {
      const prod = productById.get(i.product_id)!
      return {
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        original_unit_price: i.unit_price,
        product: { id: prod.id, name: prod.name, price: prod.price, discount: prod.discount, active: prod.active, is_vip: prod.is_vip },
        is_vip: i.isVip,
        line_type: i.isVip ? 'vip' : 'classic',
        can_trigger_promotion: true,
      }
    })
    const result = applyPromotions(promoLines, promoCatalog, eligibleRules, { vipEnabled: true })

    const baseCount = items.length
    let discountTotal = 0
    result.items.slice(0, baseCount).forEach((line, idx) => {
      const original = items[idx].unit_price
      discountTotal += Math.max(0, (original - line.unit_price) * items[idx].quantity)
    })
    discountTotal += result.applied.filter((a) => a.benefit_type === 'fixed_discount').reduce((s, a) => s + a.amount, 0)
    const gifts = result.items.slice(baseCount).map((g) => ({ product_id: g.product_id, product_name: g.product_name, quantity: g.quantity }))
    const labels = Array.from(new Set(result.applied.map((a) => (a as { label?: string; promotion_name?: string }).label ?? (a as { promotion_name?: string }).promotion_name).filter((l): l is string => typeof l === 'string' && l.length > 0)))
    return NextResponse.json({ discount_total: Math.round(discountTotal * 100) / 100, gifts, labels, free_delivery: result.free_delivery_applied === true })
  } catch {
    return empty()
  }
}
