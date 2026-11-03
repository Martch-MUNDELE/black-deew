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

// ---------------------------------------------------------------------------
// BLAC-P2-024 : creation / annulation d'offres personnelles depuis l'admin Marketing.
// Logique pure (sans next/server) pour etre testee sur base simulee ; la route ne fait que l'appeler.
// Aucune donnee client dans les journaux. Table absente ou en erreur : 200 + unavailable true.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = { from: (table: string) => any }

export type AdminCheckLike =
  | { ok: true; email: string; role: string | null }
  | { ok: false; status: number; error: string }

export type OfferActionResult = { status: number; body: Record<string, unknown> }

export const OFFERS_UNAVAILABLE_MESSAGE =
  "Les offres personnelles ne sont pas encore disponibles : la table des offres n'existe pas encore sur la base. Elle sera activée après validation de la migration."

const OFFER_COLUMNS =
  'id, phone, promotion_id, campaign_label, reason, status, starts_at, ends_at, used_at, used_order_id, created_at'

// Meme normalisation que app/api/admin/vip-approve/route.ts
export function normalizeOfferPhone(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  if (raw.startsWith('00')) return '+' + raw.slice(2).replace(/[^\d]/g, '')
  return '+' + raw.replace(/[^\d]/g, '')
}

function offersUnavailable(): OfferActionResult {
  return { status: 200, body: { unavailable: true, message: OFFERS_UNAVAILABLE_MESSAGE, offers: [], rules: [] } }
}

function badRequest(error: string): OfferActionResult {
  return { status: 400, body: { error } }
}

function parseOptionalDate(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return { ok: false }
  return { ok: true, value: new Date(ms).toISOString() }
}

async function loadRuleOptions(db: AdminDb): Promise<{ id: string; name: string }[] | null> {
  const { data, error } = await db.from('promotion_rules').select('id, name, status').eq('status', 'active')
  if (error || !Array.isArray(data)) return null
  return data
    .filter((r: { id?: unknown }) => typeof r.id === 'string')
    .map((r: { id: string; name?: string | null }) => ({ id: r.id, name: String(r.name ?? r.id) }))
}

export async function runClientOffersAction(input: {
  check: AdminCheckLike
  db: AdminDb
  method: string
  rules?: boolean
  body?: unknown
}): Promise<OfferActionResult> {
  const { check, db, method } = input
  if (!check.ok) return { status: check.status, body: { error: check.error } }

  try {
    if (method === 'GET') {
      const { data, error } = await db
        .from('client_offers')
        .select(OFFER_COLUMNS)
        .order('created_at', { ascending: false })
      if (error || !Array.isArray(data)) return offersUnavailable()
      const offers = [...data].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      const body: Record<string, unknown> = { offers }
      if (input.rules) body.rules = (await loadRuleOptions(db)) ?? []
      return { status: 200, body }
    }

    const payload = (input.body && typeof input.body === 'object' ? input.body : {}) as Record<string, unknown>

    if (method === 'POST') {
      const phone = normalizeOfferPhone(typeof payload.phone === 'string' ? payload.phone : '')
      if (phone.replace(/[^\d]/g, '').length < 7) return badRequest('Numéro de téléphone invalide')
      const promotionId = typeof payload.promotion_id === 'string' ? payload.promotion_id.trim() : ''
      if (!promotionId) return badRequest('Promotion manquante')
      const label = typeof payload.campaign_label === 'string' ? payload.campaign_label.trim().slice(0, 120) : ''
      const starts = parseOptionalDate(payload.starts_at)
      const ends = parseOptionalDate(payload.ends_at)
      if (!starts.ok || !ends.ok) return badRequest('Date invalide')
      if (starts.value && ends.value && Date.parse(ends.value) <= Date.parse(starts.value)) {
        return badRequest('La date de fin doit être postérieure à la date de début')
      }

      const { data: rule, error: ruleErr } = await db
        .from('promotion_rules')
        .select('id, name, status')
        .eq('id', promotionId)
        .maybeSingle()
      if (ruleErr) return offersUnavailable()
      if (!rule) return badRequest('Promotion introuvable')
      if (rule.status !== 'active') return badRequest("Cette promotion n'est pas active")

      const row = {
        id: globalThis.crypto.randomUUID(),
        phone,
        promotion_id: promotionId,
        campaign_label: label || null,
        reason: 'manual',
        status: 'active',
        starts_at: starts.value,
        ends_at: ends.value,
        created_at: new Date().toISOString(),
      }
      const { data, error } = await db.from('client_offers').insert(row).select().single()
      if (error) return offersUnavailable()
      return { status: 201, body: { ok: true, offer: data ?? row } }
    }

    if (method === 'PATCH') {
      const id = typeof payload.id === 'string' ? payload.id.trim() : ''
      if (!id) return badRequest('Identifiant de l’offre manquant')
      const { data: current, error: readErr } = await db
        .from('client_offers')
        .select(OFFER_COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (readErr) return offersUnavailable()
      if (!current) return { status: 404, body: { error: 'Offre introuvable' } }
      if (current.status !== 'active') return { status: 409, body: { error: 'Seule une offre active peut être annulée' } }
      const { error: updErr } = await db
        .from('client_offers')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'active')
      if (updErr) return offersUnavailable()
      return { status: 200, body: { ok: true, offer: { ...current, status: 'cancelled' } } }
    }

    return { status: 405, body: { error: 'Méthode non autorisée' } }
  } catch {
    // Pas de detail (peut contenir des donnees client) : message fixe.
    console.warn('[client-offers] base indisponible pour les offres personnelles')
    return offersUnavailable()
  }
}
