// BLAC-P3-014 : resultats d'une campagne (envoyes, refus, commandes dans les 7 jours).
// Logique pure (sans next/server), testee sur base simulee. Aucune donnee client dans les journaux :
// seuls des totaux sont renvoyes. Table absente ou en erreur : unavailable true, jamais d'exception.
import type { AdminCheckLike, CampaignActionResult } from '@/lib/campaigns'
import { getPhoneDigits } from '@/lib/phone-links'
import { phonesMatch } from '@/lib/vip-server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = { from: (table: string) => any }
type Row = Record<string, unknown>

export const RESULTS_WINDOW_DAYS = 7
export const RESULTS_WINDOW_MS = RESULTS_WINDOW_DAYS * 24 * 60 * 60 * 1000
export const CAMPAIGN_RESULTS_UNAVAILABLE_MESSAGE =
  "Les résultats ne sont pas encore disponibles : les tables nécessaires n'existent pas encore sur la base. Ils seront activés après validation de la migration."

export type CampaignResults = {
  unavailable: false
  sent: number
  refused: number
  orders: number
  revenue: number
  conversionRate: number
  windowDays: number
}
export type CampaignResultsUnavailable = { unavailable: true; message: string }

class Unavailable extends Error {}

async function readRows(db: AdminDb, table: string, columns: string): Promise<Row[]> {
  const { data, error } = await db.from(table).select(columns)
  if (error || !Array.isArray(data)) throw new Unavailable()
  return data as Row[]
}

const CANCELLED = new Set(['cancelled', 'canceled', 'annulee', 'annulée', 'annule', 'annulé'])
function isCancelled(status: unknown): boolean {
  return CANCELLED.has(String(status ?? '').trim().toLowerCase())
}

export async function computeCampaignResults(
  db: AdminDb,
  campaignId: string,
  nowMs: number = Date.now(),
): Promise<CampaignResults | CampaignResultsUnavailable> {
  try {
    const sends = await readRows(db, 'campaign_sends', 'campaign_id, phone, status, sent_at')
    const refusals = await readRows(db, 'marketing_refusals', 'phone, created_at, source')
    const orders = await readRows(db, 'orders', 'customer_phone, total, status, created_at')

    const sentRows = sends.filter(
      (s) => s.campaign_id === campaignId && s.status === 'sent' && getPhoneDigits(String(s.phone ?? '')),
    )
    const sent = sentRows.length

    // Un client = un numero (variantes reunies par phonesMatch) ; on garde son premier envoi.
    const clients: { phone: string; sentMs: number }[] = []
    for (const s of sentRows) {
      const phone = String(s.phone)
      const sentMs = Date.parse(String(s.sent_at ?? ''))
      if (Number.isNaN(sentMs)) continue
      const known = clients.find((c) => phonesMatch(phone, [c.phone]))
      if (known) known.sentMs = Math.min(known.sentMs, sentMs)
      else clients.push({ phone, sentMs })
    }

    let refused = 0
    if (clients.length > 0) {
      const firstSend = Math.min(...clients.map((c) => c.sentMs))
      const seen: string[] = []
      for (const r of refusals) {
        const phone = String(r.phone ?? '')
        if (!getPhoneDigits(phone)) continue
        const at = Date.parse(String(r.created_at ?? ''))
        if (Number.isNaN(at) || at < firstSend || at > nowMs) continue
        if (phonesMatch(phone, seen)) continue
        seen.push(phone)
        refused += 1
      }
    }

    let orderCount = 0
    let revenue = 0
    const converted = new Set<number>()
    for (const o of orders) {
      if (isCancelled(o.status)) continue
      const phone = String(o.customer_phone ?? '')
      if (!getPhoneDigits(phone)) continue
      const at = Date.parse(String(o.created_at ?? ''))
      if (Number.isNaN(at) || at > nowMs) continue
      const idx = clients.findIndex((c) => phonesMatch(phone, [c.phone]) && at >= c.sentMs && at <= c.sentMs + RESULTS_WINDOW_MS)
      if (idx < 0) continue
      orderCount += 1
      revenue += Number(o.total) || 0
      converted.add(idx)
    }

    const conversionRate = sent === 0 ? 0 : Math.round((converted.size / sent) * 1000) / 10
    return { unavailable: false, sent, refused, orders: orderCount, revenue, conversionRate, windowDays: RESULTS_WINDOW_DAYS }
  } catch {
    return { unavailable: true, message: CAMPAIGN_RESULTS_UNAVAILABLE_MESSAGE }
  }
}

export async function runCampaignResultsAction(input: {
  check: AdminCheckLike
  db: AdminDb
  campaignId?: string
  nowMs?: number
}): Promise<CampaignActionResult> {
  if (!input.check.ok) return { status: input.check.status, body: { error: input.check.error } }
  const id = (input.campaignId ?? '').trim()
  if (!id) return { status: 400, body: { error: 'Identifiant de la campagne manquant' } }
  const result = await computeCampaignResults(input.db, id, input.nowMs ?? Date.now())
  return { status: 200, body: result as unknown as Record<string, unknown> }
}
