import type { SupabaseClient } from '@supabase/supabase-js'
import { isBusinessActiveOrder } from '@/lib/order-status'

type OrderItemLite = {
  is_vip?: boolean | null
  unit_price?: number | null
  quantity?: number | null
  product_id?: string | null
  product_name?: string | null
}

type OrderRow = {
  id: string
  status?: string | null
  total?: number | null
  customer_phone?: string | null
  customer_name?: string | null
  created_at: string
  delivery_mode?: string | null
  delivery_fee?: number | null
  distance_km?: number | null
  lat?: number | null
  lng?: number | null
  geo_address?: string | null
  order_items?: OrderItemLite[]
}

type ConnexionRow = {
  type: 'classique_visite' | 'classique_commande' | 'vip'
  client_phone?: string | null
  created_at: string
}

type StatusHistoryRow = {
  order_id: string
  from_status: string | null
  to_status: string
  changed_at: string
}

type ProductRow = {
  id: string
  category?: string | null
}

type DeliveryZoneRow = {
  id: string
  min_km: number
  max_km: number
}

type DeliverySlotRow = {
  id: string
  date: string
  capacity: number
  booked: number
}

type BillingPeriodRow = {
  status: string
  period_start: string
  period_end: string
  flat_fee_amount: number
  commission_amount: number
  adjustments_total: number
  total_due: number
  orders_count: number
  orders_base_amount: number
}

export type MonthlyStatistics = {
  month: string

  facturation: {
    available: boolean
    status?: string
    periodStart?: string
    periodEnd?: string
    flatFee: number
    commission: number
    commissionRatePercent: number
    adjustments: number
    totalDue: number
    ordersCount: number
    caBasePeriode: number
    caBaseAuDernierRecalcul: number
    recalculNecessaire: boolean
  }

  ca: {
    total: number
    classique: number
    vip: number
    mixed: number
    panierMoyenClassique: number
    panierMoyenVip: number
  }

  ventes: {
    classique: { count: number; ca: number }
    vip: { count: number; ca: number }
    mixed: { count: number; ca: number }
    total: { count: number; ca: number }
  }

  clients: {
    uniqueClassique: number
    uniqueVip: number
    uniqueTotal: number
    recurrenceRatePercent: number
    nouveauxClients: number
    clientsARisque: number
  }

  topProduits: Array<{ name: string; quantity: number; ca: number }>
  topClients: Array<{ label: string; commandes: number; ca: number }>

  zones: Array<{ label: string; commandes: number; ca: number }>
  categories: Array<{ category: string; ca: number; percent: number }>

  operationnel: {
    tauxLivraisonPercent: number
    tauxAnnulationPercent: number
    livraisonPercent: number
    retraitPercent: number
    distanceMoyenneKm: number
    revenuFraisLivraison: number
    remplissageCreneauxPercent: number
  }

  connexions: {
    classique: number
    vip: number
    total: number
  }

  funnel: Array<{ status: string; count: number }>

  pointsLivraison: Array<{
    phone: string
    customerName: string
    lat: number
    lng: number
    commandes: number
    total: number
    typeClient: 'classique' | 'vip' | 'mixte'
    orders: Array<{
      id: string
      date: string
      total: number
      items: Array<{ name: string; quantity: number; unitPrice: number }>
    }>
  }>

  dailyBreakdown: Array<{
    date: string
    connexionsClassique: number
    connexionsVip: number
    caClassique: number
    caVip: number
    caMixed: number
  }>

  hourlyBreakdown: Array<{ hour: number; commandes: number }>
}

function isClassicOnly(o: OrderRow): boolean {
  return !(o.order_items?.some(i => i.is_vip === true))
}

function isVipOnly(o: OrderRow): boolean {
  return !!(o.order_items && o.order_items.length > 0 && o.order_items.every(i => i.is_vip === true))
}

function isMixed(o: OrderRow): boolean {
  return !isClassicOnly(o) && !isVipOnly(o)
}

function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

function prevMonthStr(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return d.toISOString().slice(0, 7)
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone
  return phone.slice(0, 6) + '••' + phone.slice(-2)
}

export async function getMonthlyStatistics(
  supabase: SupabaseClient,
  month: string
): Promise<MonthlyStatistics> {
  const { start, end } = monthRange(month)
  const prevMonth = prevMonthStr(month)
  const { start: prevStart, end: prevEnd } = monthRange(prevMonth)

  const [
    ordersRes,
    prevOrdersRes,
    connexionsRes,
    statusHistoryRes,
    productsRes,
    zonesRes,
    slotsRes,
    billingRes,
    historicalPhonesRes,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total, customer_phone, customer_name, created_at, delivery_mode, delivery_fee, distance_km, lat, lng, geo_address, order_items(*)')
      .gte('created_at', start)
      .lt('created_at', end),
    supabase
      .from('orders')
      .select('id, status, customer_phone, created_at')
      .gte('created_at', prevStart)
      .lt('created_at', prevEnd),
    supabase
      .from('platform_connexions')
      .select('type, client_phone, created_at')
      .gte('created_at', start)
      .lt('created_at', end),
    supabase
      .from('order_status_history')
      .select('order_id, from_status, to_status, changed_at')
      .gte('changed_at', start)
      .lt('changed_at', end),
    supabase
      .from('products')
      .select('id, category'),
    supabase
      .from('delivery_zones')
      .select('id, min_km, max_km')
      .order('min_km', { ascending: true }),
    supabase
      .from('delivery_slots')
      .select('id, date, capacity, booked')
      .gte('date', start.slice(0, 10))
      .lt('date', end.slice(0, 10)),
    supabase
      .from('billing_periods')
      .select('status, period_start, period_end, flat_fee_amount, commission_amount, adjustments_total, total_due, orders_count, orders_base_amount')
      .lte('period_start', start)
      .gte('period_end', start)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('customer_phone')
      .lt('created_at', start),
  ])

  const orders = ((ordersRes.data || []) as OrderRow[]).filter(isBusinessActiveOrder)
  const allOrdersRaw = (ordersRes.data || []) as OrderRow[]
  const prevOrders = ((prevOrdersRes.data || []) as { customer_phone?: string | null }[])
  const connexions = (connexionsRes.data || []) as ConnexionRow[]
  const statusHistory = (statusHistoryRes.data || []) as StatusHistoryRow[]
  const products = (productsRes.data || []) as ProductRow[]
  const zones = (zonesRes.data || []) as DeliveryZoneRow[]
  const slots = (slotsRes.data || []) as DeliverySlotRow[]
  const billing = billingRes.data as BillingPeriodRow | null

  let caBasePeriode = 0
  if (billing) {
    const { data: periodOrdersRaw } = await supabase
      .from('orders')
      .select('total')
      .eq('status', 'livr' + String.fromCharCode(0xe9) + 'e')
      .gte('created_at', billing.period_start)
      .lte('created_at', billing.period_end + 'T23:59:59')
    const periodOrders = (periodOrdersRaw || []) as { total: number | null }[]
    caBasePeriode = periodOrders.reduce((s, o) => s + Math.max(o.total || 0, 0), 0)
  }

  const historicalPhones = new Set(
    ((historicalPhonesRes.data || []) as { customer_phone?: string | null }[])
      .map(r => r.customer_phone)
      .filter(Boolean)
  )

  const productCategoryMap = new Map(products.map(p => [p.id, p.category || 'autre']))

  const deliveredOrders = orders.filter(o => o.status === 'livr' + String.fromCharCode(0xe9) + 'e')
  const cancelledOrders = allOrdersRaw.filter(o => o.status === 'annul' + String.fromCharCode(0xe9) + 'e')
  const validOrders = allOrdersRaw.filter(o => o.status !== 'annul' + String.fromCharCode(0xe9) + 'e')

  const classicOrders = deliveredOrders.filter(isClassicOnly)
  const vipOrders = deliveredOrders.filter(isVipOnly)
  const mixedOrders = deliveredOrders.filter(isMixed)

  const caClassique = classicOrders.reduce((s, o) => s + (o.total || 0), 0)
  const caVip = vipOrders.reduce((s, o) => s + (o.total || 0), 0)
  const caMixed = mixedOrders.reduce((s, o) => s + (o.total || 0), 0)
  const caTotal = caClassique + caVip + caMixed

  // Facturation plateforme
  const facturation = billing
    ? {
        available: true,
        status: billing.status,
        periodStart: billing.period_start,
        periodEnd: billing.period_end,
        flatFee: billing.flat_fee_amount || 0,
        commission: billing.commission_amount || 0,
        commissionRatePercent: billing.orders_base_amount > 0
          ? Math.round((billing.commission_amount / billing.orders_base_amount) * 1000) / 10
          : 0,
        adjustments: billing.adjustments_total || 0,
        totalDue: billing.total_due || 0,
        ordersCount: billing.orders_count || 0,
        caBasePeriode,
        caBaseAuDernierRecalcul: billing.orders_base_amount || 0,
        recalculNecessaire: Math.abs(caBasePeriode - (billing.orders_base_amount || 0)) > 0.01,
      }
    : {
        available: false,
        flatFee: 0,
        commission: 0,
        commissionRatePercent: 0,
        adjustments: 0,
        totalDue: 0,
        ordersCount: 0,
        caBasePeriode: 0,
        caBaseAuDernierRecalcul: 0,
        recalculNecessaire: false,
      }

  // Clients
  const classiquePhones = new Set(classicOrders.map(o => o.customer_phone).filter(Boolean) as string[])
  const vipPhones = new Set(vipOrders.map(o => o.customer_phone).filter(Boolean) as string[])
  const allPhonesThisMonth = new Set(deliveredOrders.map(o => o.customer_phone).filter(Boolean) as string[])
  const prevMonthPhones = new Set(prevOrders.map(o => o.customer_phone).filter(Boolean) as string[])

  const ordersByPhone = new Map<string, number>()
  deliveredOrders.forEach(o => {
    if (!o.customer_phone) return
    ordersByPhone.set(o.customer_phone, (ordersByPhone.get(o.customer_phone) || 0) + 1)
  })
  const recurrenceCount = Array.from(ordersByPhone.values()).filter(c => c >= 2).length
  const recurrenceRatePercent = allPhonesThisMonth.size > 0
    ? Math.round((recurrenceCount / allPhonesThisMonth.size) * 100)
    : 0

  const nouveauxClients = Array.from(allPhonesThisMonth).filter(p => !historicalPhones.has(p)).length
  const clientsARisque = Array.from(prevMonthPhones).filter(p => !allPhonesThisMonth.has(p)).length

  // Top produits
  const productAgg = new Map<string, { name: string; quantity: number; ca: number }>()
  deliveredOrders.forEach(o => {
    o.order_items?.forEach(item => {
      const key = item.product_name || 'Inconnu'
      const existing = productAgg.get(key) || { name: key, quantity: 0, ca: 0 }
      existing.quantity += item.quantity || 0
      existing.ca += (item.unit_price || 0) * (item.quantity || 0)
      productAgg.set(key, existing)
    })
  })
  const topProduits = Array.from(productAgg.values())
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5)

  // Top clients
  const clientAgg = new Map<string, { label: string; commandes: number; ca: number }>()
  deliveredOrders.forEach(o => {
    if (!o.customer_phone) return
    const existing = clientAgg.get(o.customer_phone) || {
      label: o.customer_name || maskPhone(o.customer_phone),
      commandes: 0,
      ca: 0,
    }
    existing.commandes += 1
    existing.ca += o.total || 0
    clientAgg.set(o.customer_phone, existing)
  })
  const topClients = Array.from(clientAgg.values())
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5)

  // Zones (bucket par distance_km selon delivery_zones)
  const zoneAgg = new Map<string, { label: string; commandes: number; ca: number }>()
  deliveredOrders.forEach(o => {
    if (o.distance_km == null) return
    const zone = zones.find(z => o.distance_km! >= z.min_km && o.distance_km! < z.max_km)
    const label = zone ? `${zone.min_km} - ${zone.max_km} km` : 'Hors zone'
    const existing = zoneAgg.get(label) || { label, commandes: 0, ca: 0 }
    existing.commandes += 1
    existing.ca += o.total || 0
    zoneAgg.set(label, existing)
  })
  const zonesStats = Array.from(zoneAgg.values()).sort((a, b) => b.ca - a.ca)

  // Categories (via order_items -> product_id -> products.category)
  const categoryAgg = new Map<string, number>()
  deliveredOrders.forEach(o => {
    o.order_items?.forEach(item => {
      const category = item.product_id ? (productCategoryMap.get(item.product_id) || 'autre') : 'autre'
      const lineCa = (item.unit_price || 0) * (item.quantity || 0)
      categoryAgg.set(category, (categoryAgg.get(category) || 0) + lineCa)
    })
  })
  const categoryTotal = Array.from(categoryAgg.values()).reduce((s, v) => s + v, 0)
  const categories = Array.from(categoryAgg.entries()).map(([category, ca]) => ({
    category,
    ca,
    percent: categoryTotal > 0 ? Math.round((ca / categoryTotal) * 100) : 0,
  })).sort((a, b) => b.ca - a.ca)

  // Operationnel
  const deliveryOrders = validOrders.filter(o => o.delivery_mode !== 'pickup')
  const livraisonPercent = validOrders.length > 0 ? Math.round((deliveryOrders.length / validOrders.length) * 100) : 0
  const retraitPercent = validOrders.length > 0 ? 100 - livraisonPercent : 0

  const tauxLivraisonPercent = validOrders.length > 0
    ? Math.round((deliveredOrders.length / validOrders.length) * 100)
    : 0
  const tauxAnnulationPercent = allOrdersRaw.length > 0
    ? Math.round((cancelledOrders.length / allOrdersRaw.length) * 100)
    : 0

  const distancesWithValue = deliveredOrders.map(o => o.distance_km).filter((d): d is number => d != null)
  const distanceMoyenneKm = distancesWithValue.length > 0
    ? Math.round((distancesWithValue.reduce((s, d) => s + d, 0) / distancesWithValue.length) * 10) / 10
    : 0

  const revenuFraisLivraison = deliveredOrders.reduce((s, o) => s + (o.delivery_fee || 0), 0)

  const slotsWithCapacity = slots.filter(s => s.capacity > 0)
  const remplissageCreneauxPercent = slotsWithCapacity.length > 0
    ? Math.round(
        (slotsWithCapacity.reduce((s, slot) => s + Math.min(slot.booked / slot.capacity, 1), 0) / slotsWithCapacity.length) * 100
      )
    : 0

  // Connexions
  const connexionsClassique = connexions.filter(c => c.type === 'classique_visite' || c.type === 'classique_commande').length
  const connexionsVip = connexions.filter(c => c.type === 'vip').length

  // Funnel statuts
  const funnelAgg = new Map<string, Set<string>>()
  statusHistory.forEach(h => {
    const set = funnelAgg.get(h.to_status) || new Set<string>()
    set.add(h.order_id)
    funnelAgg.set(h.to_status, set)
  })
  const funnelOrder = ['nouvelle', 'confirm' + String.fromCharCode(0xe9) + 'e', 'en_preparation', 'en_livraison', 'livr' + String.fromCharCode(0xe9) + 'e', 'annul' + String.fromCharCode(0xe9) + 'e']
  const funnel = funnelOrder.map(status => ({
    status,
    count: funnelAgg.get(status)?.size || 0,
  }))

  // Points de livraison (pour la carte) : un point par client + adresse distincte
  // (retrait boutique exclu, ce n'est pas une livraison)
  type DeliveryPointAgg = {
    phone: string
    customerName: string
    lat: number
    lng: number
    commandes: number
    total: number
    ordersRaw: OrderRow[]
  }
  const deliveryPointsAgg = new Map<string, DeliveryPointAgg>()
  deliveredOrders.forEach(o => {
    if (!o.customer_phone || o.lat == null || o.lng == null) return
    if (o.delivery_mode === 'pickup') return
    const latKey = Math.round(o.lat * 100000) / 100000
    const lngKey = Math.round(o.lng * 100000) / 100000
    const key = o.customer_phone + '|' + latKey + '|' + lngKey
    const existing = deliveryPointsAgg.get(key) || {
      phone: maskPhone(o.customer_phone),
      customerName: o.customer_name || maskPhone(o.customer_phone),
      lat: o.lat,
      lng: o.lng,
      commandes: 0,
      total: 0,
      ordersRaw: [] as OrderRow[],
    }
    existing.commandes += 1
    existing.total += o.total || 0
    existing.ordersRaw.push(o)
    deliveryPointsAgg.set(key, existing)
  })
  const pointsLivraison = Array.from(deliveryPointsAgg.values()).map(p => {
    const allClassic = p.ordersRaw.every(isClassicOnly)
    const allVip = p.ordersRaw.every(isVipOnly)
    const typeClient: 'classique' | 'vip' | 'mixte' = allClassic ? 'classique' : allVip ? 'vip' : 'mixte'
    return {
      phone: p.phone,
      customerName: p.customerName,
      lat: p.lat,
      lng: p.lng,
      commandes: p.commandes,
      total: p.total,
      typeClient,
      orders: p.ordersRaw.map(o => ({
        id: o.id,
        date: o.created_at,
        total: o.total || 0,
        items: (o.order_items || []).map(i => ({
          name: i.product_name || 'Inconnu',
          quantity: i.quantity || 0,
          unitPrice: i.unit_price || 0,
        })),
      })),
    }
  })

  // Daily breakdown
  const dayCount = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()
  const dailyBreakdown = Array.from({ length: dayCount }, (_, i) => {
    const dayNum = i + 1
    const dayStr = month + '-' + String(dayNum).padStart(2, '0')
    const dayOrders = deliveredOrders.filter(o => o.created_at.slice(0, 10) === dayStr)
    const dayConnexions = connexions.filter(c => c.created_at.slice(0, 10) === dayStr)
    return {
      date: dayStr,
      connexionsClassique: dayConnexions.filter(c => c.type === 'classique_visite' || c.type === 'classique_commande').length,
      connexionsVip: dayConnexions.filter(c => c.type === 'vip').length,
      caClassique: dayOrders.filter(isClassicOnly).reduce((s, o) => s + (o.total || 0), 0),
      caVip: dayOrders.filter(isVipOnly).reduce((s, o) => s + (o.total || 0), 0),
      caMixed: dayOrders.filter(isMixed).reduce((s, o) => s + (o.total || 0), 0),
    }
  })

  // Hourly breakdown
  const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    commandes: deliveredOrders.filter(o => new Date(o.created_at).getUTCHours() === hour).length,
  })).filter(h => h.commandes > 0 || true)

  return {
    month,
    facturation,
    ca: {
      total: caTotal,
      classique: caClassique,
      vip: caVip,
      mixed: caMixed,
      panierMoyenClassique: classicOrders.length > 0 ? Math.round((caClassique / classicOrders.length) * 100) / 100 : 0,
      panierMoyenVip: vipOrders.length > 0 ? Math.round((caVip / vipOrders.length) * 100) / 100 : 0,
    },
    ventes: {
      classique: { count: classicOrders.length, ca: caClassique },
      vip: { count: vipOrders.length, ca: caVip },
      mixed: { count: mixedOrders.length, ca: caMixed },
      total: { count: deliveredOrders.length, ca: caTotal },
    },
    clients: {
      uniqueClassique: classiquePhones.size,
      uniqueVip: vipPhones.size,
      uniqueTotal: allPhonesThisMonth.size,
      recurrenceRatePercent,
      nouveauxClients,
      clientsARisque,
    },
    topProduits,
    topClients,
    zones: zonesStats,
    categories,
    operationnel: {
      tauxLivraisonPercent,
      tauxAnnulationPercent,
      livraisonPercent,
      retraitPercent,
      distanceMoyenneKm,
      revenuFraisLivraison,
      remplissageCreneauxPercent,
    },
    connexions: {
      classique: connexionsClassique,
      vip: connexionsVip,
      total: connexionsClassique + connexionsVip,
    },
    funnel,
    pointsLivraison,
    dailyBreakdown,
    hourlyBreakdown,
  }
}
