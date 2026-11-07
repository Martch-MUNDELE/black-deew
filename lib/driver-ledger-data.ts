// BLAC-P3-033 : accès aux journaux de monnaie et de stock VIP des livreurs.
// Le client Supabase est reçu en paramètre : aucun import réseau ici.
import {
  LedgerError,
  assertVipProduct,
  computeSessionCash,
  lowStockAlerts,
  vipStockBalance,
  type LedgerDelivery,
  type LowStockLevel,
  type SessionCash,
  buildClosingMovements,
  carryOverFromSession,
  type CarryOver,
  type CashMovement,
  type ClosingDecisions,
  type ClosingMovements,
  type StockMovement,
} from '@/lib/driver-ledger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LedgerClient = { from: (table: string) => any }

export const CASH_TABLE = 'driver_cash_movements'
export const STOCK_TABLE = 'driver_stock_movements'
const CLOSED_STATUSES = ['closed', 'settled']

export type CashEntryKind = 'opening' | 'topup'
export type StockEntryKind = 'load' | 'topup' | 'adjust_plus' | 'adjust_minus' | 'delivered'

export interface CashMovementRow extends CashMovement {
  id?: string
  session_id: string
  driver_id: string
}

export interface StockMovementRow extends StockMovement {
  id?: string
  session_id: string
  driver_id: string
}

function fail(table: string, error: { message?: string } | null | undefined): never {
  throw new LedgerError(`Erreur base (${table}) : ${error?.message ?? 'inconnue'}.`)
}

/** Mouvements de monnaie d'une session. */
export async function listCashMovements(client: LedgerClient, sessionId: string): Promise<CashMovementRow[]> {
  const { data, error } = await client.from(CASH_TABLE).select('*').eq('session_id', sessionId).order('created_at')
  if (error) fail(CASH_TABLE, error)
  return (data ?? []) as CashMovementRow[]
}

/** Mouvements de stock VIP d'une session. */
export async function listStockMovements(client: LedgerClient, sessionId: string): Promise<StockMovementRow[]> {
  const { data, error } = await client.from(STOCK_TABLE).select('*').eq('session_id', sessionId).order('created_at')
  if (error) fail(STOCK_TABLE, error)
  return (data ?? []) as StockMovementRow[]
}

/** Ajoute un fonds d'ouverture ou un complément de monnaie. */
export async function addCashMovement(
  client: LedgerClient,
  params: { session_id: string; driver_id: string; kind: CashEntryKind; amount: number; note?: string | null }
): Promise<CashMovementRow> {
  const amount = Number(params.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new LedgerError('Montant de monnaie invalide : il doit être positif ou nul.')
  }
  if (params.kind === 'topup' && amount === 0) {
    throw new LedgerError('Un complément de monnaie doit être supérieur à zéro.')
  }
  const row = {
    session_id: params.session_id,
    driver_id: params.driver_id,
    kind: params.kind,
    amount,
    note: params.note ?? null,
  }
  const { error } = await client.from(CASH_TABLE).insert(row)
  if (error) fail(CASH_TABLE, error)
  return row as CashMovementRow
}

/** Vérifie dans products qu'un produit est VIP (refuse sinon). */
export async function requireVipProduct(client: LedgerClient, productId: string) {
  const { data, error } = await client.from('products').select('*').eq('id', productId).maybeSingle()
  if (error) fail('products', error)
  if (!data) throw new LedgerError(`Produit introuvable : ${productId}.`)
  return assertVipProduct(
    data as { id?: string; name?: string; is_vip?: boolean | null; driver_carryable?: boolean | null }
  )
}

/** Ajoute un chargement ou un réapprovisionnement de stock VIP (produit non VIP refusé). */
export async function addStockMovement(
  client: LedgerClient,
  params: {
    session_id: string
    driver_id: string
    product_id: string
    kind: StockEntryKind
    quantity: number
    order_id?: string | null
  }
): Promise<StockMovementRow> {
  if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
    throw new LedgerError('Quantité invalide : un entier strictement positif est attendu.')
  }
  await requireVipProduct(client, params.product_id)
  const row = {
    session_id: params.session_id,
    driver_id: params.driver_id,
    product_id: params.product_id,
    kind: params.kind,
    quantity: params.quantity,
    order_id: params.order_id ?? null,
  }
  const { error } = await client.from(STOCK_TABLE).insert(row)
  if (error) fail(STOCK_TABLE, error)
  return row as StockMovementRow
}

export interface WrittenClosing extends ClosingMovements {
  cashReturned: number
  cashKept: number
}

/**
 * Écrit les mouvements de clôture. Tout est validé par buildClosingMovements AVANT
 * la moindre écriture : une clôture incohérente n'écrit rien.
 */
export async function writeClosingMovements(
  client: LedgerClient,
  params: {
    session_id: string
    driver_id: string
    cashOnHand: number
    stockOnHand: Record<string, number>
    decisions: ClosingDecisions
  }
): Promise<WrittenClosing> {
  const built = buildClosingMovements({
    cashOnHand: params.cashOnHand,
    stockOnHand: params.stockOnHand,
    decisions: params.decisions,
  })
  if (built.cashMovements.length > 0) {
    const rows = built.cashMovements.map((m) => ({
      session_id: params.session_id,
      driver_id: params.driver_id,
      kind: m.kind,
      amount: m.amount,
      note: null,
    }))
    const { error } = await client.from(CASH_TABLE).insert(rows)
    if (error) fail(CASH_TABLE, error)
  }
  if (built.stockMovements.length > 0) {
    const rows = built.stockMovements.map((m) => ({
      session_id: params.session_id,
      driver_id: params.driver_id,
      product_id: m.product_id,
      kind: m.kind,
      quantity: m.quantity,
      order_id: null,
    }))
    const { error } = await client.from(STOCK_TABLE).insert(rows)
    if (error) fail(STOCK_TABLE, error)
  }
  const cashReturned = built.cashMovements.filter((m) => m.kind === 'returned').reduce((s, m) => s + m.amount, 0)
  const cashKept = built.cashMovements.filter((m) => m.kind === 'kept_for_next_day').reduce((s, m) => s + m.amount, 0)
  return { ...built, cashReturned, cashKept }
}

/** Report de la dernière session clôturée (closed ou settled) du livreur. */
export async function readLastClosedCarryOver(client: LedgerClient, driverId: string): Promise<CarryOver> {
  const { data, error } = await client
    .from('driver_sessions')
    .select('*')
    .eq('driver_id', driverId)
    .in('session_status', CLOSED_STATUSES)
    .order('started_at')
  if (error) fail('driver_sessions', error)
  const sessions = (data ?? []) as { id: string; started_at: string }[]
  const last = sessions[sessions.length - 1]
  if (!last) return { openingCash: 0, stockLoads: [] }
  const [cash, stock] = await Promise.all([listCashMovements(client, last.id), listStockMovements(client, last.id)])
  return carryOverFromSession({ cash, stock })
}

// ---------------------------------------------------------------------------
// BLAC-P3-033 : helpers de l'écran Livreurs (la logique reste hors de page.tsx)
// ---------------------------------------------------------------------------

export interface VipProductRef {
  id: string
  name: string
}

export interface SessionLedger {
  cash: CashMovementRow[]
  stock: StockMovementRow[]
}

export interface LedgerSessionInfo {
  driver_id: string
  started_at: string
  closed_at?: string | null
  opening_cash?: number | null
}

interface VipProductRow {
  id: string
  name?: string | null
  driver_carryable?: boolean | null
}

/** Lignes products avec is_vip vrai (select * : fonctionne que la colonne driver_carryable existe ou non). */
async function loadVipProductRows(client: LedgerClient): Promise<VipProductRow[]> {
  const { data, error } = await client.from('products').select('*').eq('is_vip', true).order('name')
  if (error) fail('products', error)
  return (data ?? []) as VipProductRow[]
}

/**
 * Un produit est embarquable sauf si driver_carryable est explicitement false.
 * Le filtre est fait ici et non dans la requête : si la colonne n'existe pas encore
 * (migration non appliquée), la propriété est absente, donc undefined, donc embarquable : repli sur l'ancien comportement.
 */
export function isDriverCarryable(product: { driver_carryable?: boolean | null }): boolean {
  return product.driver_carryable !== false
}

/** Produits VIP que le livreur peut embarquer (is_vip vrai et driver_carryable pas à false). */
export async function listVipProducts(client: LedgerClient): Promise<VipProductRef[]> {
  const rows = await loadVipProductRows(client)
  return rows.filter(isDriverCarryable).map((p) => ({ id: p.id, name: p.name ?? p.id }))
}

/** Identifiants des produits VIP non embarquables ; ensemble vide si la lecture échoue (l'écran reste utilisable). */
async function nonCarryableProductIds(client: LedgerClient): Promise<Set<string>> {
  try {
    const rows = await loadVipProductRows(client)
    return new Set(rows.filter((p) => !isDriverCarryable(p)).map((p) => p.id))
  } catch {
    return new Set()
  }
}

/**
 * Journaux de plusieurs sessions en deux requêtes.
 * Si les tables n'existent pas encore (SQL non appliqué), renvoie des journaux vides : l'écran reste utilisable.
 */
export async function loadLedgers(client: LedgerClient, sessionIds: string[]): Promise<Record<string, SessionLedger>> {
  const out: Record<string, SessionLedger> = {}
  if (sessionIds.length === 0) return out
  for (const id of sessionIds) out[id] = { cash: [], stock: [] }
  const [cash, stock] = await Promise.all([
    client.from(CASH_TABLE).select('*').in('session_id', sessionIds).order('created_at'),
    client.from(STOCK_TABLE).select('*').in('session_id', sessionIds).order('created_at'),
  ])
  if (cash.error || stock.error) return out
  for (const r of (cash.data ?? []) as CashMovementRow[]) out[r.session_id]?.cash.push(r)
  // Les mouvements d'un produit non embarquable (driver_carryable false) sont ignorés : alertes, clôture et historique.
  const stockRows = (stock.data ?? []) as StockMovementRow[]
  const ignored = stockRows.length > 0 ? await nonCarryableProductIds(client) : new Set<string>()
  for (const r of stockRows) if (!ignored.has(r.product_id)) out[r.session_id]?.stock.push(r)
  return out
}

/** Préremplissage de l'ouverture : report de la dernière session clôturée (zéro si rien ou tables absentes). */
export async function prepareOpening(
  client: LedgerClient,
  driverId: string
): Promise<{ openingCash: number; loads: Record<string, string> }> {
  try {
    const carry = await readLastClosedCarryOver(client, driverId)
    return {
      openingCash: carry.openingCash,
      loads: Object.fromEntries(carry.stockLoads.map((l) => [l.product_id, String(l.quantity)])),
    }
  } catch {
    return { openingCash: 0, loads: {} }
  }
}

/**
 * Ouvre une session avec son fonds et ses produits VIP embarqués.
 * Tout est validé avant la première écriture ; si le journal échoue, la session créée est supprimée.
 */
async function insertSessionWithLedger(
  client: LedgerClient,
  params: { driver_id: string; openingCash: number; loads: { product_id: string; quantity: number }[]; now?: Date }
): Promise<{ session_id: string }> {
  const cash = Number(params.openingCash)
  if (!Number.isFinite(cash) || cash < 0) throw new LedgerError('Montant invalide')
  for (const l of params.loads) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
      throw new LedgerError('Quantité invalide : un entier strictement positif est attendu.')
    }
    await requireVipProduct(client, l.product_id)
  }
  const session_id = globalThis.crypto.randomUUID()
  const { error } = await client.from('driver_sessions').insert({
    id: session_id,
    driver_id: params.driver_id,
    opening_cash: cash,
    session_status: 'open',
    started_at: (params.now ?? new Date()).toISOString(),
    collected_cash: 0,
    expected_cash: 0,
    net_to_remit: 0,
  })
  if (error) fail('driver_sessions', error)
  try {
    await addCashMovement(client, { session_id, driver_id: params.driver_id, kind: 'opening', amount: cash })
    for (const l of params.loads) {
      await addStockMovement(client, { session_id, driver_id: params.driver_id, product_id: l.product_id, kind: 'load', quantity: l.quantity })
    }
  } catch (e) {
    await client.from('driver_sessions').delete().eq('id', session_id)
    throw e
  }
  return { session_id }
}

export const SESSION_DEJA_OUVERTE_MESSAGE = "Ce livreur a déjà une session ouverte : clôturez-la avant d'en ouvrir une nouvelle."

// Livreurs dont une ouverture est en cours : un second appel rapide est refusé avant toute écriture.
const openingDrivers = new Set<string>()

/**
 * Ouvre une session avec son fonds et ses produits VIP embarqués.
 * Refuse (sans rien écrire) si le livreur a déjà une session ouverte ou si une ouverture est en cours pour lui.
 */
export async function openSessionWithLedger(
  client: LedgerClient,
  params: { driver_id: string; openingCash: number; loads: { product_id: string; quantity: number }[]; now?: Date }
): Promise<{ session_id: string }> {
  const cash = Number(params.openingCash)
  if (!Number.isFinite(cash) || cash < 0) throw new LedgerError('Montant invalide')
  if (openingDrivers.has(params.driver_id)) throw new LedgerError(SESSION_DEJA_OUVERTE_MESSAGE)
  openingDrivers.add(params.driver_id)
  try {
    // Les chargements sont validés d'abord (produit non VIP, quantité invalide) : aucune écriture dans tous les cas.
    for (const l of params.loads) {
      if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
        throw new LedgerError('Quantité invalide : un entier strictement positif est attendu.')
      }
      await requireVipProduct(client, l.product_id)
    }
    const { data, error } = await client
      .from('driver_sessions')
      .select('id')
      .eq('driver_id', params.driver_id)
      .eq('session_status', 'open')
    if (error) fail('driver_sessions', error)
    if (((data ?? []) as unknown[]).length > 0) throw new LedgerError(SESSION_DEJA_OUVERTE_MESSAGE)
    return await insertSessionWithLedger(client, params)
  } finally {
    openingDrivers.delete(params.driver_id)
  }
}

/**
 * Liste d'affectation : un livreur n'apparaît qu'une fois, avec sa session ouverte la plus récente.
 * Les sessions sont triées de la plus récente à la plus ancienne (started_at), la première rencontrée gagne.
 */
export function dedupeOpenSessionDrivers<T extends { id: string }>(
  rows: { started_at?: string | null; delivery_drivers?: T | T[] | null }[]
): T[] {
  const sorted = [...rows].sort((a, b) => String(b.started_at ?? '').localeCompare(String(a.started_at ?? '')))
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of sorted) {
    const d = Array.isArray(row.delivery_drivers) ? row.delivery_drivers[0] : row.delivery_drivers
    if (!d || seen.has(d.id)) continue
    seen.add(d.id)
    out.push(d)
  }
  return out
}

/** Trésorerie d'une session via computeSessionCash (repli sur opening_cash si la session n'a pas de journal). */
export function sessionCashSummary(
  session: LedgerSessionInfo,
  deliveries: LedgerDelivery[],
  cash: CashMovement[] | undefined
): SessionCash {
  const movements: CashMovement[] =
    cash && cash.length > 0 ? cash : [{ kind: 'opening', amount: session.opening_cash ?? 0 }]
  return computeSessionCash({
    movements,
    deliveries,
    session: {
      driver_id: session.driver_id,
      started_at: session.started_at,
      closed_at: session.closed_at ?? null,
      session_status: session.closed_at ? 'closed' : 'open',
    },
  })
}

/** Niveau d'alerte de stock VIP d'une session (empty prioritaire sur low), null si rien à signaler. */
export function stockAlertLevel(
  stock: StockMovement[] | undefined,
  ignoredProductIds?: Iterable<string>
): LowStockLevel | null {
  const ignored = new Set(ignoredProductIds ?? [])
  const kept = (stock ?? []).filter((m) => !ignored.has(m.product_id))
  if (kept.length === 0) return null
  const alerts = lowStockAlerts(vipStockBalance(kept))
  if (alerts.some((a) => a.level === 'empty')) return 'empty'
  if (alerts.length > 0) return 'low'
  return null
}

/** Texte d'historique : ce qui a été rendu et ce qui a été gardé (null si la session n'a pas de clôture journalisée). */
export function describeClosing(
  ledger: SessionLedger | undefined,
  nameOf: (productId: string) => string,
  currency: string
): string | null {
  if (!ledger) return null
  const closingCash = ledger.cash.filter((m) => m.kind === 'returned' || m.kind === 'kept_for_next_day')
  const closingStock = ledger.stock.filter((m) => m.kind === 'returned' || m.kind === 'kept_for_next_day')
  if (closingCash.length === 0 && closingStock.length === 0) return null
  const sum = (k: string) => closingCash.filter((m) => m.kind === k).reduce((s, m) => s + Number(m.amount || 0), 0)
  const parts = [`Rendu ${sum('returned').toFixed(0)} ${currency} · Gardé ${sum('kept_for_next_day').toFixed(0)} ${currency}`]
  const perProduct = new Map<string, { returned: number; kept: number }>()
  for (const m of closingStock) {
    const e = perProduct.get(m.product_id) ?? { returned: 0, kept: 0 }
    if (m.kind === 'returned') e.returned += m.quantity
    else e.kept += m.quantity
    perProduct.set(m.product_id, e)
  }
  for (const [id, e] of perProduct) parts.push(`${nameOf(id)} : rendu ${e.returned} / gardé ${e.kept}`)
  return parts.join(' · ')
}

export interface ClosingContext {
  summary: SessionCash
  cashOnHand: number
  netToRemit: number
  collected: number
  stock: { product_id: string; name: string; onHand: number }[]
}

/** Données affichées par la fenêtre de clôture (argent sur le livreur, net à remettre, produits VIP restants). */
export async function loadClosingContext(
  client: LedgerClient,
  session: LedgerSessionInfo & { id: string }
): Promise<ClosingContext> {
  let query = client.from('order_deliveries').select('*').eq('driver_id', session.driver_id)
  if (typeof query.gte === 'function') query = query.gte('created_at', session.started_at)
  const { data, error } = await query
  if (error) fail('order_deliveries', error)
  const ledgers = await loadLedgers(client, [session.id])
  const ledger = ledgers[session.id] ?? { cash: [], stock: [] }
  const summary = sessionCashSummary(session, (data ?? []) as LedgerDelivery[], ledger.cash)
  const vipRows = await loadVipProductRows(client)
  const products = vipRows.filter(isDriverCarryable).map((p) => ({ id: p.id, name: p.name ?? p.id }))
  const notCarryable = new Set(vipRows.filter((p) => !isDriverCarryable(p)).map((p) => p.id))
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? id
  const stock = vipStockBalance(ledger.stock)
    .filter((b) => b.onHand !== 0 && !notCarryable.has(b.product_id))
    .map((b) => ({ product_id: b.product_id, name: nameOf(b.product_id), onHand: b.onHand }))
  return { summary, cashOnHand: summary.cashOnHand, netToRemit: summary.netToRemit, collected: summary.collected, stock }
}

/** Ferme la session (statut, date, collecté, net remis) et passe le livreur en inactif. */
export async function finalizeSessionClose(
  client: LedgerClient,
  params: { session_id: string; driver_id: string; collected_cash: number; net_to_remit: number; now?: Date }
): Promise<void> {
  const { error } = await client
    .from('driver_sessions')
    .update({
      session_status: 'closed',
      closed_at: (params.now ?? new Date()).toISOString(),
      collected_cash: params.collected_cash,
      net_to_remit: params.net_to_remit,
    })
    .eq('id', params.session_id)
  if (error) fail('driver_sessions', error)
  const res = await client.from('delivery_drivers').update({ status: 'inactive' }).eq('id', params.driver_id)
  if (res.error) fail('delivery_drivers', res.error)
}
