import { phonesMatch } from '@/lib/vip-server'
import { isRuleActiveAt } from '@/lib/promotion-rules'
import type { PromotionRuleWithBenefits } from '@/lib/types/promotion'

// BLAC-P2-023 : offres personnelles d'un client (table client_offers), reconnu par son telephone.
// Tolerant : table absente ou requete en echec = aucune offre, jamais d'exception.

type OfferRow = {
  id: string
  phone: string
  promotion_id: string
  status?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

type OfferClient = { from: (table: string) => unknown }

type SelectResult = { data: OfferRow[] | null; error: unknown }

async function selectOffers(supabase: OfferClient, status?: string): Promise<OfferRow[]> {
  try {
    const table = supabase.from('client_offers') as {
      select: (c: string) => PromiseLike<SelectResult> & { eq: (c: string, v: string) => PromiseLike<SelectResult> }
    }
    const query = table.select('id, phone, promotion_id, status, starts_at, ends_at')
    const { data, error } = status ? await query.eq('status', status) : await query
    if (error || !Array.isArray(data)) return []
    return data
  } catch {
    return []
  }
}

// Identifiants des regles rattachees a au moins une offre client (quel que soit l'etat de l'offre).
export async function loadOfferLinkedRuleIds(supabase: OfferClient): Promise<Set<string>> {
  const rows = await selectOffers(supabase)
  return new Set(rows.map((r) => r.promotion_id).filter((id): id is string => typeof id === 'string'))
}

// Offres actives d'un telephone a un instant donne (status active, fenetre starts_at / ends_at).
export async function loadActiveOffersForPhone(
  supabase: OfferClient,
  phone: string,
  now: number = Date.now(),
): Promise<OfferRow[]> {
  if (!phone || !phone.trim()) return []
  const rows = await selectOffers(supabase, 'active')
  return rows.filter((r) => r.status === 'active' && phonesMatch(phone, [String(r.phone ?? '')]) && isRuleActiveAt(r, now))
}

// Renvoie les regles rattachees a une offre active de ce telephone.
export async function loadClientOfferRules(
  supabase: OfferClient,
  phone: string,
  allRules: PromotionRuleWithBenefits[],
  now: number = Date.now(),
): Promise<PromotionRuleWithBenefits[]> {
  const offers = await loadActiveOffersForPhone(supabase, phone, now)
  const ids = new Set(offers.map((o) => o.promotion_id))
  return allRules.filter((r) => ids.has(r.id))
}

// Liste eligible : regles generales sans celles liees a une offre, puis celles du telephone courant.
export async function applyClientOffersToRules(
  supabase: OfferClient,
  allRules: PromotionRuleWithBenefits[],
  phone: string | null | undefined,
  now: number = Date.now(),
): Promise<{ rules: PromotionRuleWithBenefits[]; offers: OfferRow[] }> {
  const linked = await loadOfferLinkedRuleIds(supabase)
  if (linked.size === 0) return { rules: allRules, offers: [] }
  const general = allRules.filter((r) => !linked.has(r.id))
  const offers = phone ? await loadActiveOffersForPhone(supabase, phone, now) : []
  const offerRuleIds = new Set(offers.map((o) => o.promotion_id))
  const personal = allRules.filter((r) => linked.has(r.id) && offerRuleIds.has(r.id))
  return { rules: [...general, ...personal], offers }
}

// Marque les offres utilisees (une offre ne sert qu'une fois : mise a jour conditionnee a status active).
// Ne leve jamais d'erreur ; renvoie le nombre d'offres marquees.
export async function markClientOffersUsed(
  supabase: OfferClient,
  offerIds: string[],
  orderId: string,
  now: number = Date.now(),
): Promise<number> {
  let marked = 0
  for (const id of offerIds) {
    try {
      const table = supabase.from('client_offers') as {
        update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> } }
      }
      const { error } = await table
        .update({ status: 'used', used_at: new Date(now).toISOString(), used_order_id: orderId })
        .eq('id', id)
        .eq('status', 'active')
      if (error) console.error('[client-offers] marquage utilise impossible')
      else marked += 1
    } catch {
      console.error('[client-offers] marquage utilise impossible')
    }
  }
  return marked
}
