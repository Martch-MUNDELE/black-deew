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
