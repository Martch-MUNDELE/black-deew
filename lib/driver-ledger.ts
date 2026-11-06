// BLAC-P3-032 : journal de monnaie et de stock VIP embarqué (calculs purs).
// Aucune lecture réseau ni base : toutes les fonctions reçoivent leurs données en argument.

export const DEFAULT_VIP_LOW_STOCK = 3

export type CashKind = 'opening' | 'topup' | 'returned' | 'kept_for_next_day'
export type StockKind =
  | 'load'
  | 'topup'
  | 'delivered'
  | 'returned'
  | 'kept_for_next_day'
  | 'adjust_plus'
  | 'adjust_minus'

export interface CashMovement {
  kind: CashKind
  amount: number | string | null
  note?: string | null
  created_at?: string | null
}

export interface StockMovement {
  kind: StockKind
  product_id: string
  quantity: number
  order_id?: string | null
  created_at?: string | null
}

export interface LedgerSession {
  driver_id: string | null
  started_at: string
  closed_at?: string | null
  ended_at?: string | null
  session_status?: string | null
}

export interface LedgerDelivery {
  driver_id: string | null
  status: string
  amount_collected?: number | string | null
  driver_fee_total?: number | string | null
  delivered_at?: string | null
  created_at?: string | null
}

export interface SessionCash {
  opening: number
  topup: number
  given: number
  collected: number
  driverFees: number
  netToRemit: number
  returned: number
  kept: number
  cashOnHand: number
}

export interface StockBalance {
  product_id: string
  loaded: number
  delivered: number
  returned: number
  kept: number
  adjustPlus: number
  adjustMinus: number
  onHand: number
  insufficient: boolean
}

export type LowStockLevel = 'empty' | 'low'

export interface LowStockAlert {
  product_id: string
  level: LowStockLevel
  onHand: number
  threshold: number
}

export interface ClosingDecisions {
  cash: { returned: number; kept: number }
  stock: Record<string, { returned: number; kept: number }>
}

export interface ClosingMovements {
  cashMovements: { kind: 'returned' | 'kept_for_next_day'; amount: number }[]
  stockMovements: { kind: 'returned' | 'kept_for_next_day'; product_id: string; quantity: number }[]
}

export interface CarryOver {
  openingCash: number
  stockLoads: { kind: 'load'; product_id: string; quantity: number }[]
}

export class LedgerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LedgerError'
  }
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function toCents(value: number): number {
  return Math.round(value * 100)
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Livraisons comptées dans une session : même livreur, statut delivered,
 * date dans la fenêtre [started_at ; closed_at] (ou maintenant si la session est ouverte).
 * Colonne de date retenue : delivered_at, avec repli sur created_at si delivered_at est vide.
 */
export function deliveriesOfSession<T extends LedgerDelivery>(
  deliveries: T[],
  session: LedgerSession,
  now: Date = new Date()
): T[] {
  const start = toTime(session.started_at)
  if (start === null) return []
  const end = toTime(session.closed_at) ?? toTime(session.ended_at) ?? now.getTime()
  return deliveries.filter((d) => {
    if (!session.driver_id || d.driver_id !== session.driver_id) return false
    if (d.status !== 'delivered') return false
    const when = toTime(d.delivered_at) ?? toTime(d.created_at)
    if (when === null) return false
    return when >= start && when <= end
  })
}

/** Règle conservée : net à remettre = fonds donné + argent collecté - frais livreur. */
export function computeSessionCash(params: {
  movements: CashMovement[]
  deliveries: LedgerDelivery[]
  session: LedgerSession
  now?: Date
}): SessionCash {
  const { movements, deliveries, session, now } = params
  let opening = 0
  let topup = 0
  let returned = 0
  let kept = 0
  for (const m of movements) {
    const amount = toNumber(m.amount)
    if (amount < 0) throw new LedgerError('Montant négatif interdit dans le journal de monnaie.')
    if (m.kind === 'opening') opening += amount
    else if (m.kind === 'topup') topup += amount
    else if (m.kind === 'returned') returned += amount
    else if (m.kind === 'kept_for_next_day') kept += amount
  }
  let collected = 0
  let driverFees = 0
  for (const d of deliveriesOfSession(deliveries, session, now)) {
    collected += toNumber(d.amount_collected)
    driverFees += toNumber(d.driver_fee_total)
  }
  const given = opening + topup
  return {
    opening,
    topup,
    given,
    collected,
    driverFees,
    netToRemit: given + collected - driverFees,
    returned,
    kept,
    cashOnHand: given - returned - kept,
  }
}

/** Solde de stock VIP par produit (ordre de première apparition). */
export function vipStockBalance(movements: StockMovement[]): StockBalance[] {
  const ordered = movements
    .map((m, index) => ({ m, index }))
    .sort((a, b) => {
      const ta = toTime(a.m.created_at)
      const tb = toTime(b.m.created_at)
      if (ta !== null && tb !== null && ta !== tb) return ta - tb
      return a.index - b.index
    })
    .map((x) => x.m)

  const byProduct = new Map<string, StockBalance>()
  for (const m of ordered) {
    if (!Number.isInteger(m.quantity) || m.quantity <= 0) {
      throw new LedgerError(`Quantité invalide pour le produit ${m.product_id} : ${m.quantity}.`)
    }
    let b = byProduct.get(m.product_id)
    if (!b) {
      b = {
        product_id: m.product_id,
        loaded: 0,
        delivered: 0,
        returned: 0,
        kept: 0,
        adjustPlus: 0,
        adjustMinus: 0,
        onHand: 0,
        insufficient: false,
      }
      byProduct.set(m.product_id, b)
    }
    if (m.kind === 'load' || m.kind === 'topup') {
      b.loaded += m.quantity
      b.onHand += m.quantity
    } else if (m.kind === 'adjust_plus') {
      b.adjustPlus += m.quantity
      b.onHand += m.quantity
    } else {
      if (m.kind === 'delivered') b.delivered += m.quantity
      else if (m.kind === 'returned') b.returned += m.quantity
      else if (m.kind === 'kept_for_next_day') b.kept += m.quantity
      else if (m.kind === 'adjust_minus') b.adjustMinus += m.quantity
      b.onHand -= m.quantity
      if (b.onHand < 0) b.insufficient = true
    }
  }
  return Array.from(byProduct.values())
}

/**
 * Clôture : pour la monnaie et pour chaque produit en main, rendu + gardé doit être égal à la quantité en main.
 * Erreur explicite sinon ; aucune quantité négative n'est produite.
 */
export function buildClosingMovements(params: {
  cashOnHand: number
  stockOnHand: Record<string, number>
  decisions: ClosingDecisions
}): ClosingMovements {
  const { cashOnHand, stockOnHand, decisions } = params
  if (toCents(cashOnHand) < 0) {
    throw new LedgerError(`Monnaie en main négative (${cashOnHand}) : clôture impossible.`)
  }
  const cashReturned = toNumber(decisions.cash?.returned)
  const cashKept = toNumber(decisions.cash?.kept)
  if (cashReturned < 0 || cashKept < 0) {
    throw new LedgerError('Monnaie : rendu et gardé ne peuvent pas être négatifs.')
  }
  if (toCents(cashReturned) + toCents(cashKept) !== toCents(cashOnHand)) {
    throw new LedgerError(
      `Monnaie : rendu (${cashReturned}) + gardé (${cashKept}) doit être égal à la monnaie en main (${cashOnHand}).`
    )
  }

  const cashMovements: ClosingMovements['cashMovements'] = []
  if (cashReturned > 0) cashMovements.push({ kind: 'returned', amount: cashReturned })
  if (cashKept > 0) cashMovements.push({ kind: 'kept_for_next_day', amount: cashKept })

  for (const productId of Object.keys(decisions.stock ?? {})) {
    if (!(productId in stockOnHand)) {
      throw new LedgerError(`Décision de clôture pour un produit inconnu : ${productId}.`)
    }
  }

  const stockMovements: ClosingMovements['stockMovements'] = []
  for (const [productId, onHand] of Object.entries(stockOnHand)) {
    if (!Number.isInteger(onHand) || onHand < 0) {
      throw new LedgerError(`Produit ${productId} : quantité en main invalide (${onHand}).`)
    }
    const decision = decisions.stock?.[productId]
    if (!decision) {
      if (onHand === 0) continue
      throw new LedgerError(`Produit ${productId} : aucune décision de clôture (en main : ${onHand}).`)
    }
    const { returned, kept } = decision
    if (!Number.isInteger(returned) || !Number.isInteger(kept) || returned < 0 || kept < 0) {
      throw new LedgerError(`Produit ${productId} : rendu et gardé doivent être des entiers positifs ou nuls.`)
    }
    if (returned + kept !== onHand) {
      throw new LedgerError(
        `Produit ${productId} : rendu (${returned}) + gardé (${kept}) doit être égal à la quantité en main (${onHand}).`
      )
    }
    if (returned > 0) stockMovements.push({ kind: 'returned', product_id: productId, quantity: returned })
    if (kept > 0) stockMovements.push({ kind: 'kept_for_next_day', product_id: productId, quantity: kept })
  }

  return { cashMovements, stockMovements }
}

/** Ouverture du lendemain : monnaie gardée et une ligne load par produit gardé. */
export function carryOverFromSession(movements: {
  cash?: CashMovement[]
  stock?: StockMovement[]
}): CarryOver {
  let keptCents = 0
  for (const m of movements.cash ?? []) {
    if (m.kind === 'kept_for_next_day') keptCents += toCents(toNumber(m.amount))
  }
  const perProduct = new Map<string, number>()
  for (const m of movements.stock ?? []) {
    if (m.kind === 'kept_for_next_day') {
      perProduct.set(m.product_id, (perProduct.get(m.product_id) ?? 0) + m.quantity)
    }
  }
  const stockLoads: CarryOver['stockLoads'] = []
  for (const [product_id, quantity] of perProduct) {
    if (quantity > 0) stockLoads.push({ kind: 'load', product_id, quantity })
  }
  return { openingCash: keptCents / 100, stockLoads }
}

/** Alertes de stock bas : empty (en main <= 0) et low (en main <= seuil). Rien au-dessus du seuil. */
export function lowStockAlerts(
  balances: Pick<StockBalance, 'product_id' | 'onHand'>[],
  threshold: number = DEFAULT_VIP_LOW_STOCK
): LowStockAlert[] {
  const alerts: LowStockAlert[] = []
  for (const b of balances) {
    if (b.onHand <= 0) alerts.push({ product_id: b.product_id, level: 'empty', onHand: b.onHand, threshold })
    else if (b.onHand <= threshold) alerts.push({ product_id: b.product_id, level: 'low', onHand: b.onHand, threshold })
  }
  return alerts
}

/**
 * Refuse tout produit qui n'est pas explicitement VIP, et tout produit VIP que le livreur
 * ne peut pas embarquer (driver_carryable === false, ex. un service de facturation).
 * Colonne absente ou null : le produit reste accepté (comportement d'avant BLAC-P3-036).
 */
export function assertVipProduct<
  T extends { is_vip?: boolean | null; driver_carryable?: boolean | null; id?: string; name?: string },
>(product: T): T {
  const label = product?.name ?? product?.id ?? 'inconnu'
  if (!product || product.is_vip !== true) {
    throw new LedgerError(`Produit non VIP refusé : ${label}.`)
  }
  if (product.driver_carryable === false) {
    throw new LedgerError(`Produit non embarquable par un livreur refusé : ${label}.`)
  }
  return product
}
