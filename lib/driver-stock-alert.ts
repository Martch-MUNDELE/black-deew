// BLAC-P3-034 : avertissements de stock VIP embarqué (fonctions pures, aucun accès base ni réseau).
import {
  DEFAULT_VIP_LOW_STOCK,
  lowStockAlerts,
  vipStockBalance,
  type LowStockLevel,
  type StockBalance,
  type StockMovement,
} from '@/lib/driver-ledger'
import { listVipProducts, loadLedgers, type LedgerClient } from '@/lib/driver-ledger-data'

export interface OrderLineInput {
  product_id: string | null
  quantity: number | string | null
  is_vip?: boolean | null
}

export type BalanceInput = Pick<StockBalance, 'product_id' | 'onHand'>

export interface MissingVipProduct {
  product_id: string
  requested: number
  onHand: number
  missing: number
}

export interface DriverBalances {
  driver_id: string
  driver_name: string
  balances: BalanceInput[]
}

export interface DriverVipAlertItem {
  driver_id: string
  driver_name: string
  product_id: string
  product_name: string
  level: LowStockLevel
  onHand: number
}

function toQty(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Quantités VIP demandées par produit (les articles non VIP sont ignorés). */
export function vipQuantities(lines: OrderLineInput[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of lines ?? []) {
    if (l?.is_vip !== true || !l.product_id) continue
    const q = toQty(l.quantity)
    if (q > 0) out[l.product_id] = (out[l.product_id] ?? 0) + q
  }
  return out
}

export function hasVipLines(lines: OrderLineInput[]): boolean {
  return Object.keys(vipQuantities(lines)).length > 0
}

/** Quantité en main du livreur pour chaque produit VIP de la commande. */
export function vipOnHandForOrder(lines: OrderLineInput[], balances: BalanceInput[]): Record<string, number> {
  const wanted = vipQuantities(lines)
  const out: Record<string, number> = {}
  for (const productId of Object.keys(wanted)) {
    const b = (balances ?? []).find((x) => x.product_id === productId)
    out[productId] = b ? b.onHand : 0
  }
  return out
}

/** Produits VIP dont la quantité demandée dépasse la quantité en main. */
export function missingVipProducts(lines: OrderLineInput[], balances: BalanceInput[]): MissingVipProduct[] {
  const wanted = vipQuantities(lines)
  const onHand = vipOnHandForOrder(lines, balances)
  const missing: MissingVipProduct[] = []
  for (const [product_id, requested] of Object.entries(wanted)) {
    const have = Math.max(0, onHand[product_id] ?? 0)
    if (requested > have) missing.push({ product_id, requested, onHand: have, missing: requested - have })
  }
  return missing
}

/** Texte d'avertissement en français (chaîne vide s'il ne manque rien). */
export function missingVipWarning(missing: MissingVipProduct[], names: Record<string, string> = {}): string {
  if (!missing || missing.length === 0) return ''
  const parts = missing.map(
    (m) => `${names[m.product_id] ?? m.product_id} (demandé ${m.requested}, en main ${m.onHand})`
  )
  return `Stock VIP insuffisant chez ce livreur : ${parts.join(', ')}. Affectation possible, à vous de décider.`
}

/** Alertes à afficher pour tous les livreurs en session ouverte. */
export function driverVipAlerts(
  drivers: DriverBalances[],
  names: Record<string, string> = {},
  threshold: number = DEFAULT_VIP_LOW_STOCK
): DriverVipAlertItem[] {
  const out: DriverVipAlertItem[] = []
  for (const d of drivers ?? []) {
    for (const a of lowStockAlerts(d.balances ?? [], threshold)) {
      out.push({
        driver_id: d.driver_id,
        driver_name: d.driver_name,
        product_id: a.product_id,
        product_name: names[a.product_id] ?? a.product_id,
        level: a.level,
        onHand: Math.max(0, a.onHand),
      })
    }
  }
  return out.sort((x, y) => (x.level === y.level ? 0 : x.level === 'empty' ? -1 : 1))
}

/** Libellé d'une alerte. */
export function alertMessage(a: DriverVipAlertItem): string {
  if (a.level === 'empty') return `Livreur ${a.driver_name} : plus de produit ${a.product_name}`
  return `Livreur ${a.driver_name} : stock bas de ${a.product_name} : ${a.onHand} restant`
}

export interface OpenDriverStock {
  drivers: DriverBalances[]
  names: Record<string, string>
}

const EMPTY_STOCK: OpenDriverStock = { drivers: [], names: {} }

/** Soldes VIP d'un journal ; journal invalide = aucun solde (jamais d'exception vers l'écran). */
export function balancesOfStock(stock: StockMovement[] | undefined): BalanceInput[] {
  try {
    return vipStockBalance(stock ?? [])
  } catch {
    return []
  }
}

type SessionRow = {
  id: string
  driver_id: string
  delivery_drivers?: { full_name?: string | null } | { full_name?: string | null }[] | null
}

/** Soldes VIP embarqués de tous les livreurs en session ouverte (lecture seule). */
export async function loadOpenDriverStock(client: LedgerClient): Promise<OpenDriverStock> {
  try {
    const { data, error } = await client
      .from('driver_sessions')
      .select('id, driver_id, delivery_drivers(id, full_name)')
      .eq('session_status', 'open')
    if (error) return EMPTY_STOCK
    const rows = (data ?? []) as SessionRow[]
    const ledgers = await loadLedgers(client, rows.map((r) => r.id))
    const names: Record<string, string> = {}
    for (const p of await listVipProducts(client)) names[p.id] = p.name
    const drivers = rows.map((r) => {
      const dd = Array.isArray(r.delivery_drivers) ? r.delivery_drivers[0] : r.delivery_drivers
      return {
        driver_id: r.driver_id,
        driver_name: dd?.full_name ?? r.driver_id,
        balances: balancesOfStock(ledgers[r.id]?.stock),
      }
    })
    return { drivers, names }
  } catch {
    return EMPTY_STOCK
  }
}

/** Texte affiché sous un livreur proposé dans la fenêtre d'affectation (avertissement non bloquant). */
export function driverVipNote(
  lines: OrderLineInput[],
  stock: OpenDriverStock,
  driverId: string
): { summary: string; warning: string } {
  const balances = stock.drivers.find((d) => d.driver_id === driverId)?.balances ?? []
  const onHand = vipOnHandForOrder(lines, balances)
  const summary =
    'VIP en main : ' +
    Object.entries(onHand)
      .map(([id, n]) => `${stock.names[id] ?? id} ${Math.max(0, n)}`)
      .join(', ')
  return { summary, warning: missingVipWarning(missingVipProducts(lines, balances), stock.names) }
}
