// BLAC-P3-048 : lecture serveur de l'accueil livreur avec la cle service_role (jamais cote navigateur).
// Toutes les lectures sont limitees a l'identifiant livreur recu en parametre (celui de la session).
import { createClient } from '@supabase/supabase-js'
import { lowStockAlerts, vipStockBalance } from '@/lib/driver-ledger'
import { listVipProducts, loadLedgers, sessionCashSummary, type LedgerClient } from '@/lib/driver-ledger-data'
import type { DriverDelivery, DriverHomeData, DriverLastSession, DriverStockLine } from '@/lib/driver-space'

type DeliveryRow = {
  id: string
  order_id: string | null
  driver_id: string | null
  status: string | null
  amount_to_collect: number | string | null
  amount_collected: number | string | null
  driver_fee_total: number | string | null
  delivered_at: string | null
  created_at: string | null
}

type OrderRow = {
  id: string
  customer_name: string | null
  customer_phone: string | null
  customer_address: string | null
  lat: number | string | null
  lng: number | string | null
  slot_id: string | null
}

type SlotRow = { id: string; date: string | null; time_start: string | null; time_end: string | null }

const DELIVERY_COLUMNS =
  'id, order_id, driver_id, status, amount_to_collect, amount_collected, driver_fee_total, delivered_at, created_at'
const SESSION_COLUMNS =
  'id, driver_id, started_at, closed_at, session_status, opening_cash, collected_cash, net_to_remit, driver_fee_total'

const toNum = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const toNumOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Configuration serveur absente')
  return createClient(url, key)
}

export async function getDriverHome(driverId: string, fullName: string | null = null): Promise<DriverHomeData> {
  if (!driverId) throw new Error('Identifiant livreur manquant')
  const db = serviceClient()
  const ledgerDb = db as unknown as LedgerClient

  const { data: openRows, error: openError } = await db
    .from('driver_sessions')
    .select(SESSION_COLUMNS)
    .eq('driver_id', driverId)
    .eq('session_status', 'open')
    .order('started_at', { ascending: false })
    .limit(1)
  if (openError) throw new Error('Lecture de la session impossible')
  const open = openRows?.[0] ?? null

  const base = { driver: { id: driverId, fullName }, generatedAt: new Date().toISOString() }

  if (!open) {
    const { data: closedRows, error: closedError } = await db
      .from('driver_sessions')
      .select(SESSION_COLUMNS)
      .eq('driver_id', driverId)
      .neq('session_status', 'open')
      .order('started_at', { ascending: false })
      .limit(1)
    if (closedError) throw new Error('Lecture de la derniere session impossible')
    const last = closedRows?.[0] ?? null
    let lastSession: DriverLastSession | null = null
    if (last) {
      let query = db
        .from('order_deliveries')
        .select('id')
        .eq('driver_id', driverId)
        .eq('status', 'delivered')
        .gte('created_at', last.started_at)
      if (last.closed_at) query = query.lte('created_at', last.closed_at)
      const { data: lastDeliveries, error: lastError } = await query
      if (lastError) throw new Error('Lecture des livraisons de la derniere session impossible')
      lastSession = {
        startedAt: last.started_at as string,
        closedAt: (last.closed_at as string | null) ?? null,
        deliveriesCount: (lastDeliveries ?? []).length,
        collected: toNum(last.collected_cash),
        driverFees: toNum(last.driver_fee_total),
        netToRemit: toNum(last.net_to_remit),
      }
    }
    return { ...base, session: null, cash: null, lastSession, stock: [], deliveries: [] }
  }

  const { data: deliveryRows, error: deliveryError } = await db
    .from('order_deliveries')
    .select(DELIVERY_COLUMNS)
    .eq('driver_id', driverId)
    .in('status', ['assigned', 'pending', 'delivered'])
    .gte('created_at', open.started_at)
    .order('created_at', { ascending: true })
  if (deliveryError) throw new Error('Lecture des livraisons impossible')
  const rows = (deliveryRows ?? []) as DeliveryRow[]

  const ledger = (await loadLedgers(ledgerDb, [open.id]))[open.id] ?? { cash: [], stock: [] }
  const summary = sessionCashSummary(
    { driver_id: driverId, started_at: open.started_at, opening_cash: toNumOrNull(open.opening_cash) },
    rows.map((r) => ({
      driver_id: r.driver_id,
      status: r.status ?? '',
      amount_collected: r.amount_collected,
      driver_fee_total: r.driver_fee_total,
      delivered_at: r.delivered_at,
      created_at: r.created_at,
    })),
    ledger.cash
  )

  const products = await listVipProducts(ledgerDb)
  const nameById = new Map(products.map((p) => [p.id, p.name]))
  const balances = vipStockBalance(ledger.stock).filter((b) => nameById.has(b.product_id))
  const levelById = new Map(lowStockAlerts(balances).map((a) => [a.product_id, a.level]))
  const stock: DriverStockLine[] = balances.map((b) => ({
    productId: b.product_id,
    name: nameById.get(b.product_id) ?? b.product_id,
    onHand: b.onHand,
    level: levelById.get(b.product_id) ?? null,
  }))

  const orderIds = Array.from(new Set(rows.map((r) => r.order_id).filter((v): v is string => !!v)))
  const orderMap = new Map<string, OrderRow>()
  const slotMap = new Map<string, SlotRow>()
  if (orderIds.length > 0) {
    const { data: orderRows, error: orderError } = await db
      .from('orders')
      .select('id, customer_name, customer_phone, customer_address, lat, lng, slot_id')
      .in('id', orderIds)
    if (orderError) throw new Error('Lecture des commandes impossible')
    for (const o of (orderRows ?? []) as OrderRow[]) orderMap.set(o.id, o)
    const slotIds = Array.from(new Set(Array.from(orderMap.values()).map((o) => o.slot_id).filter((v): v is string => !!v)))
    if (slotIds.length > 0) {
      const { data: slotRows, error: slotError } = await db
        .from('delivery_slots')
        .select('id, date, time_start, time_end')
        .in('id', slotIds)
      if (slotError) throw new Error('Lecture des creneaux impossible')
      for (const s of (slotRows ?? []) as SlotRow[]) slotMap.set(s.id, s)
    }
  }

  const deliveries: DriverDelivery[] = rows.map((r) => {
    const order = r.order_id ? orderMap.get(r.order_id) : undefined
    const slot = order?.slot_id ? slotMap.get(order.slot_id) : undefined
    return {
      id: r.id,
      orderId: r.order_id,
      status: r.status ?? '',
      customerName: order?.customer_name?.trim() || 'Client',
      customerPhone: order?.customer_phone ?? null,
      address: order?.customer_address ?? null,
      lat: toNumOrNull(order?.lat),
      lng: toNumOrNull(order?.lng),
      slotDate: slot?.date ?? null,
      slotStart: slot?.time_start ?? null,
      slotEnd: slot?.time_end ?? null,
      amountToCollect: toNum(r.amount_to_collect),
      amountCollected: toNum(r.amount_collected),
      deliveredAt: r.delivered_at,
    }
  })
  const key = (d: DriverDelivery) => `${d.slotDate ?? '9999'}${d.slotStart ?? '99:99'}`
  deliveries.sort((a, b) => key(a).localeCompare(key(b)))

  return {
    ...base,
    session: { id: open.id as string, startedAt: open.started_at as string, openingCash: toNum(open.opening_cash) },
    cash: {
      given: summary.given,
      collected: summary.collected,
      driverFees: summary.driverFees,
      netToRemit: summary.netToRemit,
    },
    lastSession: null,
    stock,
    deliveries,
  }
}
