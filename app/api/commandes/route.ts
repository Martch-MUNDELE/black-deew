import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendOrderNotification } from '@/lib/notifications'
import { loadVipSettings, phonesMatch } from '@/lib/vip-server'
import { readVipSessionPhone } from '@/lib/vip-session'
import { applyPromotions, filterRulesForPromoCode, findPromoCodeRule, checkPromoCodeUsage } from '@/lib/promotions'
import { loadActivePromotionRules, validatePromotionRule } from '@/lib/promotion-rules'
import { applyClientOffersToRules, markClientOffersUsed } from '@/lib/client-offers'
import type { PromotionCartLine, PromotionProductCandidate } from '@/lib/types/promotion'

type CommandeItemInput = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  isVip?: boolean
  selected_variants?: unknown
  variant_price_extra?: number
  variant_name?: string | null
  variant_price?: number | null
  line_type?: 'classic' | 'vip' | 'promotion_gift'
  original_unit_price?: number | null
  discount_percent?: number | null
  discount_amount?: number | null
  is_promotion_gift?: boolean
  promotion_rule_id?: string | null
  promotion_label?: string | null
  can_trigger_promotion?: boolean
}

type CommandeRequestBody = {
  name?: string
  phone?: string
  address?: string
  note?: string | null
  slot_id?: string
  items?: CommandeItemInput[]
  lat?: number | null
  lng?: number | null
  geo_address?: string | null
  email?: string | null
  wantFacture?: boolean
  delivery_mode?: string | null
  delivery_fee?: number | null
  distance_km?: number | null
  promo_code?: string | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getRequestBaseUrl(req: Request) {
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const forwardedHost = req.headers.get('x-forwarded-host')
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`
  return new URL(req.url).origin
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CommandeRequestBody

  const { data: shopStatus } = await supabase.from('settings').select('value').eq('key', 'status').single()
  if (shopStatus?.value === 'closed') {
    return NextResponse.json({ error: 'Le shop est actuellement fermé' }, { status: 403 })
  }
  const { data: currencyRow } = await supabase.from('settings').select('value').eq('key', 'currency').single()
  const currency = currencyRow?.value || 'USD'
  const { data: siteNameRow } = await supabase.from('settings').select('value').eq('key', 'site_name').single()
  const siteName = siteNameRow?.value || 'Black Deew'
  const { data: adminEmailRow } = await supabase.from('settings').select('value').eq('key', 'notification_email').single()
  const adminEmail = adminEmailRow?.value || undefined
  const { name, phone, address, note, slot_id, lat, lng, geo_address, email, wantFacture, delivery_mode } = body
  const rawItems = Array.isArray(body.items) ? body.items : []
  if (!name || !String(name).trim() || !phone || !String(phone).trim() || rawItems.length === 0) {
    return NextResponse.json({ error: 'Commande incomplète : nom, téléphone et articles requis' }, { status: 400 })
  }
  if (rawItems.some((i) => !i || typeof i.product_id !== 'string' || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)) {
    return NextResponse.json({ error: 'Articles invalides' }, { status: 400 })
  }
  // A15 : prix recalcules cote serveur depuis la base, jamais depuis le client
  const productIds = Array.from(new Set(rawItems.map((i) => i.product_id)))
  const { data: dbProducts, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, discount, variants, is_vip, active')
    .in('id', productIds)
  if (productsError || !dbProducts) {
    return NextResponse.json({ error: 'Erreur lecture produits' }, { status: 500 })
  }
  const productById = new Map<string, { id: string; name: string; price: number; discount: number | null; variants: { type: string; prices?: Record<string, number> }[] | null; is_vip: boolean | null; active: boolean | null }>(
    dbProducts.map((p) => [p.id as string, p as never])
  )
  let items: CommandeItemInput[] = []
  for (const raw of rawItems) {
    const prod = productById.get(raw.product_id)
    if (!prod || prod.active === false) {
      return NextResponse.json({ error: `Produit indisponible : ${raw.product_name ?? raw.product_id}` }, { status: 400 })
    }
    const selected = (raw.selected_variants && typeof raw.selected_variants === 'object')
      ? (raw.selected_variants as Record<string, string>)
      : null
    let variantExtra = 0
    if (selected && Array.isArray(prod.variants)) {
      for (const vt of prod.variants) {
        const chosen = selected[vt.type]
        if (chosen && vt.prices && vt.prices[chosen] !== undefined) variantExtra += Number(vt.prices[chosen]) || 0
      }
    }
    const basePrice = (prod.discount ?? 0) > 0
      ? Math.ceil(prod.price * (1 - (prod.discount ?? 0) / 100))
      : prod.price
    items.push({
      ...raw,
      product_name: prod.name,
      unit_price: Math.ceil(basePrice + variantExtra),
      variant_price_extra: variantExtra,
      variant_price: variantExtra > 0 ? variantExtra : null,
      isVip: prod.is_vip === true,
    })
  }
  // A4 : controle VIP cote serveur, base sur products.is_vip et sur le numero du cookie de session signee (jamais le numero declare dans le corps)
  const vipItems = items.filter((i) => i.isVip)
  if (vipItems.length > 0) {
    const sessionPhone = readVipSessionPhone(req)
    if (!sessionPhone) {
      return NextResponse.json({ error: 'Cette commande contient des articles VIP : veuillez vous reconnecter à l’espace VIP (session expirée ou absente) puis réessayer.' }, { status: 401 })
    }
    const vipSettings = await loadVipSettings(supabase)
    if (!vipSettings) {
      return NextResponse.json({ error: 'Vérification VIP indisponible. Réessayez dans quelques instants.' }, { status: 500 })
    }
    const authorized = vipSettings.enabled && vipSettings.allowedPhones.length > 0 && phonesMatch(sessionPhone, vipSettings.allowedPhones)
    if (!authorized) {
      return NextResponse.json({ error: 'Cette commande contient des articles VIP : votre accès VIP n’est plus autorisé. Reconnectez-vous ou contactez la boutique.' }, { status: 403 })
    }
  }
  const vipTotal = vipItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  // BLAC-P2-013 : promotions recalculees cote serveur (le client ne decide jamais du prix)
  const promoCodeInput = typeof body.promo_code === 'string' ? body.promo_code.trim() : ''
  // BLAC-P3-008 : une regle aux valeurs invalides est ignoree (defense cote serveur)
  const loadedRules = (await loadActivePromotionRules(supabase)).filter((r) => validatePromotionRule(r).ok)
  // BLAC-P2-023 : offres personnelles du client (telephone de la commande)
  const { rules: allRules, offers: clientOffers } = await applyClientOffersToRules(supabase, loadedRules, String(phone))
  const filtered = filterRulesForPromoCode(allRules, promoCodeInput)
  if (!filtered.codeValid) {
    return NextResponse.json({ error: 'Code promo invalide ou expiré' }, { status: 400 })
  }
  const usedCodeRule = findPromoCodeRule(allRules, promoCodeInput)
  const usageCheck = checkPromoCodeUsage(usedCodeRule)
  if (!usageCheck.ok) {
    return NextResponse.json({ error: usageCheck.error }, { status: 409 })
  }
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
      is_vip: i.isVip === true,
      line_type: i.isVip ? 'vip' : 'classic',
      can_trigger_promotion: true,
    }
  })
  const promoResult = applyPromotions(promoLines, promoCatalog, eligibleRules, { vipEnabled: true })
  // BLAC-P3-008 : limite d'usage par client (identifiant choisi par la regle, telephone par defaut).
  // Comptage a partir des lignes de commande deja enregistrees ; si le comptage est impossible
  // (colonnes de promotion absentes), la commande n'est pas bloquee et le journal ne contient aucune donnee client.
  const appliedRuleIds = Array.from(new Set(promoResult.applied.map((a) => a.promotion_id).filter(Boolean)))
  for (const ruleId of appliedRuleIds) {
    const limitedRule = eligibleRules.find((r) => r.id === ruleId)
    const perCustomerLimit = limitedRule?.usage_limit_per_customer
    if (!limitedRule || typeof perCustomerLimit !== 'number' || perCustomerLimit <= 0) continue
    const identifierColumn = limitedRule.customer_identifier_type === 'email' && email ? 'customer_email' : 'customer_phone'
    const identifierValue = identifierColumn === 'customer_email' ? String(email).trim() : String(phone).trim()
    const { data: customerOrders, error: customerOrdersError } = await supabase.from('orders').select('id').eq(identifierColumn, identifierValue)
    if (customerOrdersError || !customerOrders) {
      console.error('[commandes] limite par client non appliquee : comptage impossible', { code: (customerOrdersError as { code?: string } | null)?.code ?? null })
      continue
    }
    const orderIds = customerOrders.map((o) => o.id as string)
    if (orderIds.length === 0) continue
    const { data: usedLines, error: usedLinesError } = await supabase.from('order_items').select('order_id').eq('promotion_rule_id', limitedRule.id).in('order_id', orderIds)
    if (usedLinesError || !usedLines) {
      console.error('[commandes] limite par client non appliquee : colonnes de promotion absentes', { code: (usedLinesError as { code?: string } | null)?.code ?? null })
      continue
    }
    const previousUses = new Set(usedLines.map((l) => l.order_id as string)).size
    if (previousUses >= perCustomerLimit) {
      return NextResponse.json({ error: 'Vous avez déjà utilisé cette promotion : la limite par client est atteinte.' }, { status: 409 })
    }
  }
  const baseCount = items.length
  items = promoResult.items.map((line, idx): CommandeItemInput => {
    if (idx < baseCount) {
      return {
        ...items[idx],
        unit_price: line.unit_price,
        line_type: items[idx].isVip ? 'vip' : 'classic',
        original_unit_price: line.original_unit_price ?? items[idx].unit_price,
        discount_percent: line.discount_percent ?? null,
        discount_amount: line.discount_amount ?? null,
        is_promotion_gift: false,
        promotion_rule_id: line.promotion_rule_id ?? null,
        promotion_label: line.promotion_label ?? null,
        can_trigger_promotion: true,
      }
    }
    return {
      product_id: line.product_id,
      product_name: line.product_name,
      quantity: line.quantity,
      unit_price: 0,
      isVip: false,
      line_type: 'promotion_gift',
      original_unit_price: line.original_unit_price ?? 0,
      is_promotion_gift: true,
      promotion_rule_id: line.promotion_rule_id ?? null,
      promotion_label: line.promotion_label ?? null,
      can_trigger_promotion: false,
    }
  })
  const fixedDiscountTotal = promoResult.applied
    .filter((a) => a.benefit_type === 'fixed_discount')
    .reduce((sum, a) => sum + a.amount, 0)
  const promoFreeDelivery = promoResult.free_delivery_applied === true
  // A15 : frais de livraison recalcules cote serveur (meme logique que le panier : retrait, zones, distance, gratuite au-dessus d'un seuil)
  const { data: deliverySettingRows } = await supabase.from('settings').select('key, value').like('key', 'delivery_%')
  const dset: Record<string, string> = {}
  for (const r of deliverySettingRows ?? []) dset[r.key as string] = (r.value as string | null) ?? ''
  const dMode = ['all', 'delivery_only', 'pickup_only'].includes(dset.delivery_mode) ? dset.delivery_mode : 'all'
  const shopLat = dset.delivery_shop_lat ? parseFloat(dset.delivery_shop_lat) : null
  const shopLng = dset.delivery_shop_lng ? parseFloat(dset.delivery_shop_lng) : null
  const maxRadius = parseFloat(dset.delivery_max_radius) || 10
  const tolerance = parseFloat(dset.delivery_tolerance) || 0.3
  const freeAbove = parseFloat(dset.delivery_free_above) || 0
  const itemsSubtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  let safeDeliveryFee = 0
  let serverDistanceKm: number | null = null
  const isPickup = delivery_mode === 'pickup' && dMode !== 'delivery_only'
  if (!isPickup && dMode !== 'pickup_only' && shopLat && shopLng) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Adresse de livraison géolocalisée requise' }, { status: 400 })
    }
    const distance = haversine(shopLat, shopLng, lat, lng)
    serverDistanceKm = distance
    if (distance > maxRadius + tolerance) {
      return NextResponse.json({ error: 'Adresse hors de la zone de livraison' }, { status: 400 })
    }
    const { data: zoneRows } = await supabase.from('delivery_zones').select('min_km, max_km, price, active').eq('active', true).order('min_km', { ascending: true })
    const matched = (zoneRows ?? []).find((z) => distance >= Number(z.min_km) && distance < Number(z.max_km) + tolerance)
    if (matched && !(freeAbove > 0 && itemsSubtotal >= freeAbove)) safeDeliveryFee = Number(matched.price) || 0
  }

  if (promoFreeDelivery) safeDeliveryFee = 0

  const { data: slot } = await supabase.from('delivery_slots').select('*').eq('id', slot_id).single()
  if (!slot || slot.blocked || slot.booked >= slot.capacity) {
    return NextResponse.json({ error: 'Créneau non disponible' }, { status: 400 })
  }

  // Verification stock si module actif
  const { data: stockEnabledRow } = await supabase.from('settings').select('value').eq('key', 'stock_enabled').single()
  if (stockEnabledRow?.value === 'true') {
    for (const item of items) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single()
      if (prod && prod.stock !== null) {
        if (prod.stock <= 0) {
          return NextResponse.json({ error: `${item.product_name} est epuise` }, { status: 409 })
        }
        if (prod.stock < item.quantity) {
          return NextResponse.json({ error: `Stock insuffisant pour ${item.product_name} (${prod.stock} disponible(s))`, stock: prod.stock }, { status: 409 })
        }
      }
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const calculatedTotal = Math.max(0, subtotal - fixedDiscountTotal) + safeDeliveryFee

  const today = new Date().toISOString().split('T')[0]
  const dateKey = today.replace(/-/g, '')
  const { data: seqData, error: seqError } = await supabase.rpc('get_next_invoice_seq', { p_date_key: dateKey })
  if (seqError || seqData == null) {
    return NextResponse.json({ error: 'Erreur generation numero de commande' }, { status: 500 })
  }
  const seqNum = String(seqData).padStart(4, '0')
  const invoice_number = `BD-${dateKey}-${seqNum}`

  const { data: order, error } = await supabase.from('orders').insert({
    customer_name: name, customer_phone: phone, customer_address: address,
    customer_note: note, slot_id, total: calculatedTotal, payment_method: 'livraison', status: 'nouvelle',
    lat: lat || null, lng: lng || null, geo_address: geo_address || null,
    customer_email: (wantFacture && email) ? email : null,
    delivery_mode: delivery_mode || null, delivery_fee: safeDeliveryFee, distance_km: serverDistanceKm,
    invoice_number,
  }).select().single()

  if (error || !order) { return NextResponse.json({ error: 'Erreur création commande' }, { status: 500 }) }

  // BLAC-P2-023 : marque utilisees les offres client effectivement appliquees (une seule fois) ; n'echoue jamais la commande
  try {
    const usedRuleIds = new Set(promoResult.applied.map((x) => x.promotion_id).filter(Boolean))
    const offerIdsToMark = clientOffers.filter((o) => usedRuleIds.has(o.promotion_id)).map((o) => o.id)
    if (offerIdsToMark.length > 0) await markClientOffersUsed(supabase, offerIdsToMark, String(order.id))
  } catch { console.error('[commandes] marquage des offres client impossible') }

  // BF-P2-013 : tracking connexion - commande classique
  supabase.from('platform_connexions').insert({
    type: 'classique_commande',
    client_phone: phone || null,
    shop_id: null,
  }).then(() => {}, () => {})

  // BF-P2-013 : point de depart du funnel statuts
  supabase.from('order_status_history').insert({
    order_id: order.id,
    from_status: null,
    to_status: 'nouvelle',
  }).then(() => {}, () => {})

  // BLAC-P2-014 : compteur d'usage du code (concurrence optimiste, best effort)
  if (usedCodeRule && typeof usedCodeRule.usage_limit_total === 'number') {
    await supabase.from('promotion_rules').update({ usage_count: Number(usedCodeRule.usage_count ?? 0) + 1 }).eq('id', usedCodeRule.id).eq('usage_count', Number(usedCodeRule.usage_count ?? 0))
  }
  // BLAC-P3-006 : compatibilite base de production sans migration promotions.
  // Les colonnes de promotion ne sont envoyees que si une promotion s'applique reellement a la ligne.
  const hasPromotionOnLine = (item: CommandeItemInput) =>
    item.is_promotion_gift === true ||
    item.line_type === 'promotion_gift' ||
    item.promotion_rule_id != null ||
    Number(item.discount_percent ?? 0) > 0 ||
    Number(item.discount_amount ?? 0) > 0
  const baseItemRows = items.map((item) => ({ order_id: order.id, product_id: item.product_id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, is_vip: item.isVip ?? false, selected_variants: item.selected_variants ?? null, variant_price_extra: item.variant_price_extra ?? 0, variant_name: item.variant_name ?? null, variant_price: item.variant_price ?? null }))
  const itemRows = items.map((item, i) => hasPromotionOnLine(item)
    ? { ...baseItemRows[i], line_type: item.line_type ?? (item.isVip ? 'vip' : 'classic'), original_unit_price: item.original_unit_price ?? null, discount_percent: item.discount_percent ?? null, discount_amount: item.discount_amount ?? null, is_promotion_gift: item.is_promotion_gift ?? false, promotion_rule_id: item.promotion_rule_id ?? null, promotion_label: item.promotion_label ?? null, can_trigger_promotion: item.can_trigger_promotion ?? true }
    : baseItemRows[i])
  let itemsError = (await supabase.from('order_items').insert(itemRows)).error
  if (itemsError && items.some(hasPromotionOnLine)) {
    const errInfo = itemsError as { code?: string; message?: string }
    const unknownColumn = errInfo.code === '42703' || errInfo.code === 'PGRST204' || /column|schema cache/i.test(errInfo.message ?? '')
    if (unknownColumn) {
      // Journal sans donnee client : uniquement le code d'erreur
      console.error('[commandes] colonnes promotion absentes en base, nouvel essai avec les colonnes d\'origine', { code: errInfo.code ?? null })
      itemsError = (await supabase.from('order_items').insert(baseItemRows)).error
    }
  }
  if (itemsError) {
    // A15 : ne jamais laisser une commande sans lignes
    await supabase.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Erreur enregistrement des articles de la commande' }, { status: 500 })
  }
  await supabase.from('delivery_slots').update({ booked: slot.booked + 1 }).eq('id', slot_id)

  // Decrementation stock si module actif
  if (stockEnabledRow?.value === 'true') {
    for (const item of items) {
      await supabase.rpc('decrement_stock', { product_id: item.product_id, qty: item.quantity })
    }
  }
  await sendOrderNotification({ ...order, items, slot, vipItems, vipTotal }, currency, siteName, adminEmail)

  // Push notification PWA
  try {
    const hasVip = items.some((i: CommandeItemInput) => i.isVip)
    await fetch(`${getRequestBaseUrl(req)}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: hasVip ? '⭐ Nouvelle commande VIP !' : '🛒 Nouvelle commande !',
        body: `${body.name || 'Client'} — ${items.length} article(s)`,
        tag: 'nouvelle-commande',
        url: '/admin/commandes'
      })
    })
  } catch (e) { console.error('[Push commande]', e) }

  if (wantFacture && email) {
    try {
      await fetch(`${getRequestBaseUrl(req)}/api/facture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, excludeVip: true })
      })
    } catch (e) { console.error('Facture error:', e) }
  }

  return NextResponse.json(order)
}
