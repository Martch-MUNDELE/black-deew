// BLAC-P3-013 : scenarios de campagne (meilleurs clients, clients inactifs). Logique pure, sans base ni next/server.
// Aucune donnee client dans les journaux : ce module n'ecrit rien dans la console.
import { normalizePhone, phonesMatch } from '@/lib/vip-server'

export const BEST_CLIENTS_WINDOW_DAYS = 180
export const BEST_CLIENTS_LIMIT = 20
export const INACTIVE_MIN_ORDERS = 2
export const INACTIVE_MIN_DAYS = 60
export const INACTIVE_MAX_DAYS = 365

export type OrderRow = Record<string, unknown>
export type ScenarioClient = { phone: string; revenue: number; orders: number; lastOrderMs: number }
export type BestClientsOptions = { windowDays?: number; limit?: number }
export type InactiveClientsOptions = { minOrders?: number; minDays?: number; maxDays?: number }

const DAY_MS = 24 * 60 * 60 * 1000
const CANCELLED = new Set(['cancelled', 'canceled', 'annule', 'annulee', 'annulé', 'annulée'])

function isCancelled(order: OrderRow): boolean {
  return CANCELLED.has(String(order.status ?? '').trim().toLowerCase())
}

// Regroupe les commandes non annulees par numero (phonesMatch). Commandes sans numero ou sans date valide ignorees.
function groupOrders(orders: OrderRow[]): ScenarioClient[] {
  const groups: ScenarioClient[] = []
  for (const order of Array.isArray(orders) ? orders : []) {
    if (!order || isCancelled(order)) continue
    const phone = normalizePhone(String(order.customer_phone ?? ''))
    if (phone.replace(/\D/g, '').length < 8) continue
    const at = Date.parse(String(order.created_at ?? ''))
    if (!Number.isFinite(at)) continue
    const total = Number(order.total)
    const amount = Number.isFinite(total) ? total : 0
    const group = groups.find((g) => phonesMatch(phone, [g.phone]))
    if (group) {
      group.revenue += amount
      group.orders += 1
      if (at > group.lastOrderMs) group.lastOrderMs = at
    } else {
      groups.push({ phone, revenue: amount, orders: 1, lastOrderMs: at })
    }
  }
  return groups
}

// Meilleurs clients : commandes non annulees des 180 derniers jours, 20 plus gros chiffres d'affaires, egalite : plus recent d'abord.
export function selectBestClients(orders: OrderRow[], nowMs: number, options: BestClientsOptions = {}): ScenarioClient[] {
  const windowDays = options.windowDays ?? BEST_CLIENTS_WINDOW_DAYS
  const limit = options.limit ?? BEST_CLIENTS_LIMIT
  const cutoff = nowMs - windowDays * DAY_MS
  const recent = (Array.isArray(orders) ? orders : []).filter((o) => {
    const at = Date.parse(String(o?.created_at ?? ''))
    return Number.isFinite(at) && at >= cutoff
  })
  return groupOrders(recent)
    .sort((a, b) => b.revenue - a.revenue || b.lastOrderMs - a.lastOrderMs)
    .slice(0, limit)
}

// Clients inactifs : au moins 2 commandes non annulees, derniere commande il y a plus de 60 jours et au plus 365 jours.
export function selectInactiveClients(orders: OrderRow[], nowMs: number, options: InactiveClientsOptions = {}): ScenarioClient[] {
  const minOrders = options.minOrders ?? INACTIVE_MIN_ORDERS
  const minDays = options.minDays ?? INACTIVE_MIN_DAYS
  const maxDays = options.maxDays ?? INACTIVE_MAX_DAYS
  return groupOrders(orders)
    .filter((c) => {
      const age = nowMs - c.lastOrderMs
      return c.orders >= minOrders && age > minDays * DAY_MS && age <= maxDays * DAY_MS
    })
    .sort((a, b) => b.lastOrderMs - a.lastOrderMs)
}

// ---------------------------------------------------------------------------
// BLAC-P3-025 : apercu de l'ecran 3 (Scenarios automatiques). Lecture seule : aucun insert, aucun update.
// Table absente ou en erreur : 200 + unavailable true (meme forme que les autres routes du module).
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScenarioDb = { from: (table: string) => any }
type ScenarioCheck = { ok: true; email: string; role: string | null } | { ok: false; status: number; error: string }

export const SCENARIOS_SCREEN_UNAVAILABLE_MESSAGE =
  "Les scénarios automatiques ne sont pas disponibles pour le moment : les commandes n'ont pas pu être lues."
export const SCENARIOS_PREVIEW_SIZE = 3

export type RankedClient = { phone: string; pseudo: string | null; orders: number; revenue: number }

async function readScenarioRows(db: ScenarioDb, table: string, columns: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await db.from(table).select(columns)
  if (error || !Array.isArray(data)) throw new Error('unavailable')
  return data as Record<string, unknown>[]
}

function maskedPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `Client ••••${digits.slice(-4)}`
}

export async function runCampaignScenariosAction(input: {
  check: ScenarioCheck
  db: ScenarioDb
  method: string
  nowMs?: number
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { check, db, method } = input
  if (!check.ok) return { status: check.status, body: { error: check.error } }
  if (method !== 'GET') return { status: 405, body: { error: 'Méthode non autorisée' } }
  const nowMs = input.nowMs ?? Date.now()
  const unavailable = () => ({
    status: 200,
    body: { unavailable: true, message: SCENARIOS_SCREEN_UNAVAILABLE_MESSAGE, best: [], inactive: { count: 0, preview: [] } },
  })
  try {
    const orders = await readScenarioRows(db, 'orders', 'customer_phone, customer_name, total, status, created_at')
    let requests: Record<string, unknown>[] = []
    try {
      requests = await readScenarioRows(db, 'vip_access_requests', 'phone, pseudo, status, marketing_opt_in')
    } catch {
      requests = []
    }
    const pseudoOf = (phone: string): string | null => {
      const named = requests.filter((r) => typeof r.pseudo === 'string' && String(r.pseudo).trim() && phonesMatch(phone, [String(r.phone ?? '')]))
      const found = named.find((r) => r.status === 'approved') ?? named[0]
      return found ? String(found.pseudo).trim() : null
    }
    const best: RankedClient[] = selectBestClients(orders, nowMs, { limit: SCENARIOS_PREVIEW_SIZE }).map((c) => ({
      phone: c.phone,
      pseudo: pseudoOf(c.phone),
      orders: c.orders,
      revenue: c.revenue,
    }))
    // Seuls les VIP connus qui n'ont pas refuse les offres sont comptes.
    const inactive = selectInactiveClients(orders, nowMs).filter((c) =>
      requests.some((r) => r.marketing_opt_in !== false && phonesMatch(c.phone, [String(r.phone ?? '')])),
    )
    const preview = inactive.slice(0, SCENARIOS_PREVIEW_SIZE).map((c) => pseudoOf(c.phone) ?? maskedPhone(c.phone))
    return { status: 200, body: { best, inactive: { count: inactive.length, preview } } }
  } catch {
    console.warn('[campaign-scenarios] lecture indisponible')
    return unavailable()
  }
}
