'use client'
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'

const PAGE_SIZE = 20
const STATUSES = ['nouvelle', 'confirmée', 'en_preparation', 'en_livraison', 'livrée', 'annulée']
const STATUS_LABELS: Record<string, string> = {
  nouvelle: 'Nouvelle', confirmée: 'Confirmée', en_preparation: 'Préparation',
  en_livraison: 'Livraison', livrée: 'Livrée', annulée: 'Annulée'
}
const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  nouvelle:       { bg: 'rgba(232,160,32,0.1)',   color: '#E8A020', border: 'rgba(232,160,32,0.25)' },
  confirmée:      { bg: 'rgba(91,197,122,0.1)',   color: '#5BC57A', border: 'rgba(91,197,122,0.25)' },
  en_preparation: { bg: 'rgba(255,107,32,0.1)',   color: '#FF6B20', border: 'rgba(255,107,32,0.25)' },
  en_livraison:   { bg: 'rgba(56,182,255,0.1)',   color: '#38B6FF', border: 'rgba(56,182,255,0.25)' },
  livrée:         { bg: 'rgba(91,197,122,0.12)',  color: '#5BC57A', border: 'rgba(91,197,122,0.3)'  },
  annulée:        { bg: 'rgba(255,107,107,0.1)',  color: '#FF6B6B', border: 'rgba(255,107,107,0.2)' },
}
const STATUS_TRANSITIONS: Record<string, string[]> = {
  nouvelle:       ['confirmée', 'annulée'],
  confirmée:      ['en_preparation', 'annulée'],
  en_preparation: ['en_livraison', 'annulée'],
  en_livraison:   ['livrée', 'annulée'],
  livrée:         [],
  annulée:        [],
}
const WA_BUTTON_LABELS: Record<string, string> = {
  confirmée:      'Envoyer message Confirmation',
  en_preparation: 'Envoyer message Préparation',
  en_livraison:   'Envoyer message Livraison',
  livrée:         'Envoyer message Livrée',
  annulée:        'Envoyer message Annulation',
}
const WA_BUTTON_LABELS_PICKUP: Record<string, string> = {
  confirmée:      'Envoyer message Confirmation',
  en_preparation: 'Envoyer message Préparation',
  livrée:         'Envoyer message Retrait confirmé',
  annulée:        'Envoyer message Annulation',
}

type OrderItemRow = {
  id?: string
  quantity: number
  product_name: string
  variant_name?: string | null
  unit_price: number
}

type DeliverySlotRow = {
  id: string
  date: string
  time_start?: string | null
  time_end?: string | null
}

type OrderRow = {
  id: string
  customer_name: string
  customer_phone: string
  customer_address?: string | null
  delivery_mode?: string | null
  delivery_fee?: number | null
  distance_km?: number | null
  total: number
  lat?: number | null
  lng?: number | null
  slot_id?: string | null
  status?: string | null
  driver_id?: string | null
  order_items?: OrderItemRow[] | null
  created_at?: string | null
  [key: string]: unknown
}

type DriverRow = {
  id: string
  full_name: string
  phone: string
  vehicle_type?: string | null
  zone?: string | null
}

type DriverSessionRow = {
  delivery_drivers?: DriverRow | DriverRow[] | null
}

type ZoneRow = {
  min_km: number | string | null
  max_km: number | string | null
  price: number | string | null
}

function cleanPhone(phone: string) {
  const p = phone.replace(/[\s\-]/g, '')
  if (p.startsWith('+')) return p
  if (p.startsWith('00')) return '+' + p.slice(2)
  if (p.startsWith('0')) return '+243' + p.slice(1)
  return p
}

function buildWhatsAppUrl(order: OrderRow, slot: DeliverySlotRow | null, targetStatus: string, formatDate: (d: string) => string, shopAddress?: string, factureUrl?: string, currency = 'DH', driverInfo?: { full_name: string; phone: string } | null): string | null {
  const name = order.customer_name
  let msg: string | null = null

  if (targetStatus === 'confirmée') {
    const itemsList = order.order_items?.map((i: OrderItemRow) =>
      `${i.quantity} x ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} — ${(i.unit_price * i.quantity).toFixed(2)} ${currency}`
    ).join('\n') || ''
    const slotDate = slot ? formatDate(slot.date) : 'À confirmer'
    const slotTime = slot ? `${slot.time_start?.slice(0, 5)} à ${slot.time_end?.slice(0, 5)}` : ''
    const address = order.customer_address || ''
    const mapsLine = order.lat !== null && order.lat !== undefined && order.lng !== null && order.lng !== undefined ? `\nhttps://maps.google.com/?q=${order.lat},${order.lng}` : ''
    let deliveryLines = ''
    if (order.delivery_mode === 'pickup') {
      deliveryLines = `\nMode : Retrait sur place\nAdresse boutique : ${shopAddress || ''}`
    } else if (order.delivery_fee === 0) {
      deliveryLines = '\nLivraison gratuite'
    } else if ((order.delivery_fee ?? 0) > 0) {
      deliveryLines = `\nFrais de livraison : ${order.delivery_fee ?? 0} ${currency}`
    }
    msg = `Bonjour ${name},\n\nVotre commande Black Deew est confirmée.\n\n${itemsList}${deliveryLines}\n\nTotal : ${(order.total ?? 0).toFixed(2)} ${currency} - paiement cash à la livraison\nCréneau : ${slotDate} de ${slotTime}\n\nVotre adresse de livraison :\n${address}${mapsLine}\n\nMerci pour votre confiance !\nBlack Deew`
  } else if (targetStatus === 'en_preparation') {
    msg = `Bonjour ${name}, votre commande Black Deew est en cours de préparation. Encore un peu de patience !`
  } else if (targetStatus === 'en_livraison') {
    const driverLine = driverInfo ? `\n\n Votre livreur : ${driverInfo.full_name} - Tel : ${driverInfo.phone}` : ''
    msg = `Bonjour ${name}, votre commande Black Deew est en route ! Notre livreur arrive bientot chez vous.${driverLine}`
  } else if (targetStatus === 'livrée') {
    const isPickup = order.delivery_mode === 'pickup'
    const factureLine = factureUrl ? `\n\n🧾 Votre facture (72h) : ${factureUrl}` : ''
    if (isPickup) {
      msg = `Merci ${name} ! Votre commande Black Deew a bien été retirée. Bon appétit et à très bientôt !${factureLine}`
    } else {
      msg = `Merci ${name} ! Votre commande a bien été livrée. Bon appétit et à très bientôt chez Black Deew !${factureLine}`
    }
  } else if (targetStatus === 'annulée') {
    msg = `Bonjour ${name}, nous sommes désolés mais votre commande a dû être annulée. Contactez-nous pour plus d'informations.`
  }

  if (!msg) return null
  return `https://wa.me/${cleanPhone(order.customer_phone)}?text=${encodeURIComponent(msg)}`
}

// Envoie la mise à jour statut via sendBeacon — survit au passage en arrière-plan Safari iOS
function sendStatusBeacon(orderId: string, status: string) {
  const blob = new Blob([JSON.stringify({ orderId, status })], { type: 'application/json' })
  navigator.sendBeacon('/api/update-order-status', blob)
}

const IconPhone = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 11.67a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/>
  </svg>
)
const IconChat = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C8.69 2 6 4.69 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.31-2.69-6-6-6z"/>
    <circle cx="12" cy="8" r="2"/>
  </svg>
)


type DispatchedPayload = {
  orderId: string
  driverId: string
  driverInfo: { full_name: string; phone: string } | null
}

function DispatchModal({ order, onClose, onDispatched, currency }: { order: OrderRow, onClose: () => void, onDispatched: (info: DispatchedPayload) => void, currency: string }) {
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [successWaUrl, setSuccessWaUrl] = useState<string | null>(null)
  const [pendingPayload, setPendingPayload] = useState<DispatchedPayload | null>(null)
  const [phase, setPhase] = useState<'form' | 'success'>('form')
  const supabase = useMemo(() => createClient(), [])
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('driver_sessions')
        .select('driver_id, delivery_drivers(id, full_name, phone, vehicle_type, zone)')
        .eq('session_status', 'open')
      const rows = (data || []) as DriverSessionRow[]
      const mapped = rows
        .map((s) => Array.isArray(s.delivery_drivers) ? s.delivery_drivers[0] : s.delivery_drivers)
        .filter((driver): driver is DriverRow => Boolean(driver))
      setDrivers(mapped)
      setLoading(false)
    }
    load()
  }, [supabase])
  const handleConfirm = async () => {
    if (!selectedDriver) return
    setErrorMsg('')
    setSaving(true)
    const driver = drivers.find(d => d.id === selectedDriver)
    const { data: updatedRows, error: updErr } = await supabase
      .from('orders')
      .update({ driver_id: selectedDriver })
      .eq('id', order.id)
      .select('id, driver_id')
    if (updErr) {
      setSaving(false)
      setErrorMsg(`Mise à jour commande échouée : ${updErr.message}`)
      return
    }
    if (!updatedRows || updatedRows.length === 0) {
      setSaving(false)
      setErrorMsg('Aucune ligne mise a jour - verifie les permissions (RLS).')
      return
    }
    let driver_fee_total = 0
    if ((order.delivery_fee ?? 0) > 0) {
      driver_fee_total = order.delivery_fee ?? 0
    } else if (order.delivery_fee === 0 && order.distance_km) {
      const { data: zones } = await supabase
        .from('delivery_zones')
        .select('min_km, max_km, price')
        .eq('active', true)
        .order('min_km', { ascending: true })
      if (zones && zones.length > 0) {
        const distKm = Number(order.distance_km) || 0
        const zone = ((zones || []) as ZoneRow[]).find((z) => distKm >= Number(z.min_km) && distKm < Number(z.max_km))
        driver_fee_total = zone ? Number(zone.price) : 0
      }
    }
    const { error: insErr } = await supabase.from('order_deliveries').insert({
      order_id: order.id,
      driver_id: selectedDriver,
      status: 'assigned',
      amount_to_collect: order.total,
      delivery_fee_charged_to_customer: order.delivery_fee || 0,
      driver_fee_due: driver_fee_total,
      driver_fee_total,
    })
    if (insErr) {
      console.error('[order_deliveries insert failed]', insErr.message)
    }
    setSaving(false)
    const driverInfo = driver ? { full_name: driver.full_name, phone: driver.phone } : null
    const formatDateLocal = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    const waUrl = buildWhatsAppUrl(order, null, 'en_livraison', formatDateLocal, undefined, undefined, currency, driverInfo)
    const dispatched: DispatchedPayload = { orderId: order.id, driverId: selectedDriver, driverInfo }
    setPendingPayload(dispatched)
    setSuccessWaUrl(waUrl)
    setPhase('success')
  }

  const finishDispatch = () => {
    // Passage en en_livraison déclenché ici, après confirmation visuelle admin
    sendStatusBeacon(order.id, 'en_livraison')
    if (pendingPayload) onDispatched(pendingPayload)
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={phase === 'success' ? finishDispatch : onClose}>
      <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, fontFamily: 'DM Sans, sans-serif' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 800, color: '#F5EDD6', marginBottom: 6 }}>{phase === 'success' ? 'Livreur dispatché' : 'Dispatcher vers un livreur'}</div>
        <div style={{ fontSize: 12, color: '#C8B99A', marginBottom: 20 }}>Commande #{order.id.slice(0, 8).toUpperCase()} - {order.customer_name} - {(order.total ?? 0).toFixed(2)} {currency}</div>
        {phase === 'success' ? (
          <>
            <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 10, background: 'rgba(91,197,122,0.08)', border: '1px solid rgba(91,197,122,0.25)', color: '#5BC57A', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>Commande dispatchée. Prévenez le client par WhatsApp avec les infos du livreur.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {successWaUrl && (
                <a
                  href={successWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={finishDispatch}
                  style={{ display: 'block', textAlign: 'center', padding: '12px 0', borderRadius: 50, background: '#25D366', color: '#0A0804', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}
                >Envoyer message WhatsApp au client</a>
              )}
              <button onClick={finishDispatch} style={{ padding: '10px 0', borderRadius: 50, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#C8B99A', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            {loading ? (<div style={{ color: '#7A6E58', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Chargement...</div>) : drivers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 36 }}>🛵</div>
                <div style={{ color: '#C8B99A', fontSize: 15, fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>Aucun livreur disponible</div>
                <div style={{ color: 'rgba(200,185,154,0.6)', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>Ouvrez une session livreur avant de dispatcher.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {drivers.map(d => (<button key={d.id} onClick={() => setSelectedDriver(d.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, border: `1px solid ${selectedDriver === d.id ? 'rgba(56,182,255,0.5)' : 'rgba(255,255,255,0.08)'}`, background: selectedDriver === d.id ? 'rgba(56,182,255,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left' }}><div><div style={{ fontWeight: 700, fontSize: 13, color: selectedDriver === d.id ? '#38B6FF' : '#F5EDD6' }}>{d.full_name}</div><div style={{ fontSize: 11, color: '#C8B99A', marginTop: 2 }}>{d.phone}</div></div>{selectedDriver === d.id && <span style={{ color: '#38B6FF' }}>OK</span>}</button>))}
              </div>
            )}
            {errorMsg && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', color: '#FF6B6B', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>{errorMsg}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 50, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#C8B99A', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Annuler</button>
              <button onClick={handleConfirm} disabled={!selectedDriver || saving} style={{ flex: 2, padding: '10px 0', borderRadius: 50, border: 'none', background: selectedDriver && !saving ? '#38B6FF' : 'rgba(56,182,255,0.2)', color: selectedDriver && !saving ? '#0A0804' : 'rgba(56,182,255,0.4)', fontSize: 13, fontWeight: 700, cursor: selectedDriver && !saving ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans, sans-serif' }}>{saving ? 'Enregistrement...' : 'Confirmer la livraison'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CommandesAdminInner() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const currency = useCurrency()
  const searchParams = useSearchParams()
  const [filter, setFilter] = useState(() => searchParams.get('tab') || 'nouvelle')
  const [highlightIdParam] = useState(() => searchParams.get('highlight'))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [slots, setSlots] = useState<Record<string, DeliverySlotRow>>({})
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, string>>({})
  const [factureUrls, setFactureUrls] = useState<Record<string, string>>({})
  const [shopAddress, setShopAddress] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [dispatchOrder, setDispatchOrder] = useState<OrderRow | null>(null)
  const [driverInfos, setDriverInfos] = useState<Record<string, { full_name: string; phone: string }>>({})
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const loadCounts = useCallback(async () => {
    const countResults = await Promise.all([
      ...STATUSES.map(s => supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', s)),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('delivery_mode', 'pickup'),
    ])
    const c: Record<string, number> = {}
    STATUSES.forEach((s, i) => { c[s] = countResults[i].count || 0 })
    c['retrait'] = countResults[STATUSES.length].count || 0
    setCounts(c)
  }, [supabase])

  // Charge un slice via .range() côté serveur. append=true ajoute, sinon remplace.
  const fetchOrders = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true)
    const from = offset
    const to = offset + PAGE_SIZE - 1
    let query = supabase
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (filter === 'retrait') query = query.eq('delivery_mode', 'pickup')
    else query = query.eq('status', filter)

    const { data, count } = await query
    const fetched = (data || []) as OrderRow[]
    if (!fetched.length) {
      if (append) setLoadingMore(false)
      return
    }
    const total = count || 0
    if (append) setOrders(prev => [...prev, ...fetched])
    else setOrders(fetched)
    setHasMore(offset + fetched.length < total)

    const slotIds = [...new Set(fetched.filter(o => o.slot_id).map(o => o.slot_id as string))]
    if (slotIds.length > 0) {
      const { data: slotData } = await supabase.from('delivery_slots').select('*').in('id', slotIds)
      if (slotData) {
        setSlots(prev => {
          const map = { ...prev }
          slotData.forEach(s => { map[s.id] = s })
          return map
        })
      }
    }
    const driverIds = [...new Set(fetched.filter(o => o.driver_id).map(o => o.driver_id as string))]
    if (driverIds.length > 0) {
      const { data: driverData } = await supabase.from('delivery_drivers').select('id, full_name, phone').in('id', driverIds)
      if (driverData) {
        setDriverInfos(prev => {
          const map: Record<string, { full_name: string; phone: string }> = { ...prev }
          const driversList = (driverData || []) as DriverRow[]
          driversList.forEach((d: DriverRow) => { map[d.id] = { full_name: d.full_name, phone: d.phone } })
          return map
        })
      }
    }
    if (append) setLoadingMore(false)
  }, [filter, supabase])

  const reload = useCallback(() => Promise.all([loadCounts(), fetchOrders(0, false)]), [loadCounts, fetchOrders])

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'delivery_shop_address').single()
      .then(({ data }) => { if (data) setShopAddress(String(data.value || '')) })
  }, [supabase])

  useEffect(() => {
    if (!highlightIdParam) return
    const showTimer = window.setTimeout(() => {
      setHighlightId(highlightIdParam)
      const el = document.getElementById(`order-${highlightIdParam}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 500)
    const hideTimer = window.setTimeout(() => setHighlightId(null), 3500)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [highlightIdParam])

  const tabParam = searchParams.get('tab') || 'nouvelle'

  useEffect(() => {
    const timer = window.setTimeout(() => setFilter(tabParam), 0)
    return () => window.clearTimeout(timer)
  }, [tabParam])

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  // Refresh auto + realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`admin-commandes-${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void reload() })
      .subscribe()
    const interval = window.setInterval(() => { void reload() }, 30000)
    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(interval)
    }
  }, [filter, reload])

  // Infinite scroll: observe la sentinelle et appende la suite quand visible
  useEffect(() => {
    if (!hasMore || loadingMore) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) void fetchOrders(orders.length, true)
    }, { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, orders.length, fetchOrders])

  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

  // Pré-fetch URL facture dès sélection "livrée" dans le select
  const prefetchFactureUrl = (orderId: string) => {
    if (factureUrls[orderId]) return
    fetch(`/api/facture-url?order_id=${orderId}`)
      .then(r => r.json())
      .then(({ url }) => { if (url) setFactureUrls(prev => ({ ...prev, [orderId]: url })) })
      .catch(() => {})
  }

  // Applique le changement de statut côté UI (optimiste) et recharge après délai
  const applyStatusChange = (orderId: string, newStatus: string) => {
    void newStatus
    setOrders(prev => prev.filter(o => o.id !== orderId))
    setPendingStatuses(prev => { const n = { ...prev }; delete n[orderId]; return n })
    setTimeout(() => reload(), 2000)
  }

  const handleDispatched = (info: DispatchedPayload) => {
    setOrders(prev => prev.map(o => o.id === info.orderId ? { ...o, driver_id: info.driverId } : o))
    if (info.driverInfo) {
      setDriverInfos(prev => ({ ...prev, [info.driverId]: info.driverInfo! }))
    }
    reload()
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {dispatchOrder && (
        <DispatchModal order={dispatchOrder} currency={currency} onClose={() => setDispatchOrder(null)} onDispatched={handleDispatched} />
      )}
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 900, color: '#F5EDD6', marginBottom: 24 }}>
        Commandes
      </h1>

      {/* FILTRES */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
        {STATUSES.filter((s) => (counts[s] ?? 0) > 0 || filter === s).map(s => {
          const sc = STATUS_COLORS[s]
          const active = filter === s
          return (
            <button key={s} onClick={() => setFilter(s)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 50, border: '1px solid', borderColor: active ? sc.border : 'rgba(255,255,255,0.06)', background: active ? sc.bg : 'transparent', color: active ? sc.color : '#C8B99A', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
              {STATUS_LABELS[s]}
              {counts[s] ? <span style={{ background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)', padding: '0 6px', borderRadius: 50, fontSize: 10 }}>{counts[s]}</span> : null}
            </button>
          )
        })}
        {((counts.retrait ?? 0) > 0 || filter === 'retrait') && (

        <button onClick={() => setFilter('retrait')} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 50, border: '1px solid', borderColor: filter === 'retrait' ? 'rgba(232,160,32,0.25)' : 'rgba(255,255,255,0.06)', background: filter === 'retrait' ? 'rgba(232,160,32,0.1)' : 'transparent', color: filter === 'retrait' ? '#E8A020' : '#C8B99A', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
          Retrait
          {counts['retrait'] ? <span style={{ background: filter === 'retrait' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)', padding: '0 6px', borderRadius: 50, fontSize: 10 }}>{counts['retrait']}</span> : null}
        </button>

        )}
      </div>

      {/* LISTE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.length === 0 && (
          <div style={{ textAlign: 'center', color: '#C8B99A', padding: '40px 0', fontSize: 14 }}>Aucune commande</div>
        )}
        {orders.map(order => {
          const status = order.status || 'nouvelle'
          const customerAddress = order.customer_address ?? ''
          const createdAt = order.created_at ? new Date(order.created_at) : null
          const slotForOrder: DeliverySlotRow | null = order.slot_id ? slots[order.slot_id] ?? null : null
          const driverInfoForOrder: { full_name: string; phone: string } | null = order.driver_id ? driverInfos[order.driver_id] ?? null : null
          const sc = STATUS_COLORS[status] || STATUS_COLORS['nouvelle']
          const assignedDriver = order.driver_id ? driverInfos[order.driver_id] : undefined
          const topStatusLabel = status === 'en_livraison'
            ? (assignedDriver?.full_name || 'Livreur assigné')
            : (STATUS_LABELS[status] ?? status)
          const rawTransitions = STATUS_TRANSITIONS[status] || []
          const transitions = order.delivery_mode === 'pickup'
            ? rawTransitions.map((s: string) => s === 'en_livraison' ? 'livrée' : s)
            : rawTransitions
          const pending = pendingStatuses[order.id] || ''
          return (
            <div key={order.id} id={`order-${order.id}`} style={{ background: '#131009', border: highlightId === order.id ? '2px solid #F5C842' : '1px solid rgba(232,160,32,0.1)', borderRadius: 16, padding: '18px 20px', transition: 'border 0.3s', boxShadow: highlightId === order.id ? '0 0 20px rgba(245,200,66,0.2)' : 'none' }}>

              {/* HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#F5EDD6' }}>{order.customer_name}</div>
                  <div style={{ fontSize: 11, color: '#C8B99A', marginTop: 3 }}>{order.customer_phone} · {customerAddress.slice(0, 40)}{customerAddress.length > 40 ? '…' : ''}</div>
                  <div style={{ fontSize: 10, color: '#A89880', marginTop: 2 }}>#{order.id.slice(0, 8).toUpperCase()} · {createdAt ? createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#F5C842', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>{(order.total ?? 0).toFixed(2)} <span style={{ fontSize: 13 }}>{currency}</span></div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 50, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, display: 'inline-block' }}>{topStatusLabel}</span>
                    {order.delivery_mode && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 50, background: order.delivery_mode === 'pickup' ? 'rgba(232,160,32,0.1)' : 'rgba(91,197,122,0.1)', color: order.delivery_mode === 'pickup' ? '#E8A020' : '#5BC57A', border: `1px solid ${order.delivery_mode === 'pickup' ? 'rgba(232,160,32,0.25)' : 'rgba(91,197,122,0.25)'}`, display: 'inline-block' }}>
                        {order.delivery_mode === 'pickup' ? '🏪 Retrait' : '🛵 Livraison'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ITEMS */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {order.order_items?.map((item: OrderItemRow) => (
                  <span key={item.id} style={{ background: 'rgba(232,160,32,0.07)', border: '1px solid rgba(232,160,32,0.12)', color: '#C8B890', padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 500 }}>
                    {item.quantity}× {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''}{item.variant_name ? ` (${item.variant_name})` : ''}
                  </span>
                ))}
              </div>

              {/* DÉTAIL LIVRAISON */}
              {((order.delivery_fee ?? 0) > 0 || order.delivery_mode === 'pickup') && (
                <div style={{ fontSize: 11, color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', marginBottom: 10 }}>
                  {order.delivery_mode === 'pickup'
                    ? 'Retrait sur place'
                    : order.delivery_fee === 0
                      ? `Livraison gratuite · ${order.distance_km ? Number(order.distance_km).toFixed(2) : '?'} km`
                      : `Livraison · ${order.distance_km ? Number(order.distance_km).toFixed(2) : '?'} km · ${order.delivery_fee ?? 0} ${currency}`}
                </div>
              )}


              {/* ACTIONS */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <a href={`tel:${order.customer_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(232,160,32,0.06)', color: '#E8A020', textDecoration: 'none', fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
                  <IconPhone /> Appeler
                </a>
                <a href={`https://wa.me/${cleanPhone(order.customer_phone)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 50, border: '1px solid rgba(91,197,122,0.2)', background: 'rgba(91,197,122,0.06)', color: '#5BC57A', textDecoration: 'none', fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
                  <IconChat /> WhatsApp
                </a>
                {order.lat !== null && order.lat !== undefined && order.lng !== null && order.lng !== undefined && (
                  <a href={`https://www.google.com/maps?q=${order.lat},${order.lng}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 50, border: '1px solid rgba(255,107,32,0.2)', background: 'rgba(255,107,32,0.06)', color: '#FF6B20', textDecoration: 'none', fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
                    <IconPin /> Maps
                  </a>
                )}
              </div>

              {/* STATUT */}
              {order.status === 'en_preparation' && order.delivery_mode !== 'pickup' ? (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {!order.driver_id ? (
                    <button onClick={() => setDispatchOrder(order)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 50, border: '1px solid rgba(56,182,255,0.35)', background: 'rgba(56,182,255,0.1)', color: '#38B6FF', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      🛵 Sélectionner un livreur
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: '#38B6FF', fontWeight: 700, fontFamily: 'DM Sans, sans-serif' }}>
                        🛵 {driverInfos[order.driver_id]?.full_name || 'Livreur assigné'}
                      </span>
                      {driverInfos[order.driver_id]?.phone && (
                        <a href={`https://wa.me/${cleanPhone(driverInfos[order.driver_id].phone)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 50, border: '1px solid rgba(37,211,102,0.35)', background: 'rgba(37,211,102,0.08)', color: '#25D366', textDecoration: 'none', fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
                          <IconChat /> WA Livreur
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#7A6E58', fontFamily: 'DM Sans, sans-serif' }}>Statut</span>
                    {transitions.length > 0 ? (
                      <div style={{ position: 'relative' }}>
                        <select
                          value={pending}
                          onChange={e => {
                            const newStatus = e.target.value
                            setPendingStatuses(prev => ({ ...prev, [order.id]: newStatus }))
                            if (newStatus === 'livrée') prefetchFactureUrl(order.id)
                          }}
                          style={{ background: '#1A1510', border: '1px solid rgba(232,160,32,0.25)', color: pending ? (STATUS_COLORS[pending]?.color || '#E8A020') : '#7A6E58', borderRadius: 8, padding: '7px 32px 7px 12px', fontSize: 12, fontWeight: 700, outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', appearance: 'none', WebkitAppearance: 'none' }}
                        >
                          <option value="" disabled style={{ background: '#131009', color: '#7A6E58' }}>— Changer statut —</option>
                          {transitions.map((s: string) => (
                            <option key={s} value={s} style={{ background: '#131009', color: '#F5EDD6' }}>{order.delivery_mode === 'pickup' && s === 'livrée' ? 'Retirée' : STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: pending ? (STATUS_COLORS[pending]?.color || '#E8A020') : '#7A6E58', fontSize: 10 }}>▾</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 50, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{STATUS_LABELS[status]}</span>
                    )}
                  </div>
                  {pending && pending !== status && (() => {
                    const btnStyle = { marginTop: 10, display: 'inline-block', float: 'right' as const, background: '#25D366', color: '#0A0804', borderRadius: 50, padding: '6px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', border: 'none' }
                    if (pending === 'en_livraison' && !order.driver_id) return null
                    const waUrl = buildWhatsAppUrl(
                      order,
                      slotForOrder,
                      pending,
                      formatDate,
                      shopAddress,
                      pending === 'livrée' ? factureUrls[order.id] : undefined,
                      currency,
                      driverInfoForOrder
                    )
                    if (!waUrl) return null
                    return (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          sendStatusBeacon(order.id, pending)
                          if (pending === 'livrée') {
                            fetch('/api/mark-livree', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, total: Number(order.total) }) })
                          }
                          applyStatusChange(order.id, pending)
                        }}
                        style={btnStyle}
                      >
                        {(order.delivery_mode === 'pickup' ? WA_BUTTON_LABELS_PICKUP[pending] : WA_BUTTON_LABELS[pending]) || 'Envoyer message WhatsApp'}
                      </a>
                    )
                  })()}
                </div>
              )}

            </div>
          )
        })}
        {hasMore && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
        {loadingMore && (
          <div style={{ textAlign: 'center', color: '#7A6E58', padding: '12px 0', fontSize: 11, fontFamily: 'DM Sans, sans-serif', letterSpacing: 0.5 }}>
            Chargement…
          </div>
        )}
      </div>
    </div>
  )
}

export default function CommandesAdmin() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#C8B99A', fontFamily: 'DM Sans, sans-serif' }}>Chargement...</div>}>
      <CommandesAdminInner />
    </Suspense>
  )
}
