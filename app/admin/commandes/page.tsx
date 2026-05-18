'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
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

function cleanPhone(phone: string) {
  const p = phone.replace(/[\s\-]/g, '')
  if (p.startsWith('+')) return p
  if (p.startsWith('00')) return '+' + p.slice(2)
  if (p.startsWith('0')) return '+243' + p.slice(1)
  return p
}

function buildWhatsAppUrl(order: any, slot: any, targetStatus: string, formatDate: (d: string) => string, shopAddress?: string, factureUrl?: string, currency = 'DH', driverInfo?: { full_name: string; phone: string } | null): string | null {
  const name = order.customer_name
  let msg: string | null = null

  if (targetStatus === 'confirmée') {
    const itemsList = order.order_items?.map((i: any) =>
      `${i.quantity} x ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} — ${(i.unit_price * i.quantity).toFixed(2)} ${currency}`
    ).join('\n') || ''
    const slotDate = slot ? formatDate(slot.date) : 'À confirmer'
    const slotTime = slot ? `${slot.time_start?.slice(0, 5)} à ${slot.time_end?.slice(0, 5)}` : ''
    const address = order.customer_address || ''
    const mapsLine = order.lat && order.lng ? `\nhttps://maps.google.com/?q=${order.lat},${order.lng}` : ''
    let deliveryLines = ''
    if (order.delivery_mode === 'pickup') {
      deliveryLines = `\nMode : Retrait sur place\nAdresse boutique : ${shopAddress || ''}`
    } else if (order.delivery_fee === 0) {
      deliveryLines = '\nLivraison gratuite'
    } else if (order.delivery_fee > 0) {
      deliveryLines = `\nFrais de livraison : ${order.delivery_fee} ${currency}`
    }
    msg = `Bonjour ${name},\n\nVotre commande Black Deew est confirmée.\n\n${itemsList}${deliveryLines}\n\nTotal : ${order.total.toFixed(2)} ${currency} - paiement cash à la livraison\nCréneau : ${slotDate} de ${slotTime}\n\nVotre adresse de livraison :\n${address}${mapsLine}\n\nMerci pour votre confiance !\nBlack Deew`
  } else if (targetStatus === 'en_preparation') {
    msg = `Bonjour ${name}, votre commande Black Deew est en cours de préparation. Encore un peu de patience !`
  } else if (targetStatus === 'en_livraison') {
    const driverLine = driverInfo ? `\n\n Votre livreur : ${driverInfo.full_name} - Tel : ${driverInfo.phone}` : ''
    msg = `Bonjour ${name}, votre commande Black Deew est en route ! Notre livreur arrive bientot chez vous.${driverLine}`
  } else if (targetStatus === 'livrée') {
    const factureLine = factureUrl ? `\n\n🧾 Votre facture (72h) : ${factureUrl}` : ''
    msg = `Merci ${name} ! Votre commande a bien été livrée. Bon appétit et à très bientôt chez Black Deew !${factureLine}`
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
const IconCal = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

type DispatchedPayload = {
  orderId: string
  driverId: string
  driverInfo: { full_name: string; phone: string } | null
}

function DispatchModal({ order, onClose, onDispatched, currency }: { order: any, onClose: () => void, onDispatched: (info: DispatchedPayload) => void, currency: string }) {
  const [drivers, setDrivers] = useState<any[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [successWaUrl, setSuccessWaUrl] = useState<string | null>(null)
  const [pendingPayload, setPendingPayload] = useState<DispatchedPayload | null>(null)
  const [phase, setPhase] = useState<'form' | 'success'>('form')
  const supabase = createClient()
  useEffect(() => {
    const load = async () => {
      const { data: sessions } = await supabase
        .from('driver_sessions')
        .select('driver_id')
        .eq('session_status', 'open')
      const driverIds = (sessions || []).map((s: any) => s.driver_id)
      if (driverIds.length === 0) { setDrivers([]); setLoading(false); return }
      const { data } = await supabase
        .from('delivery_drivers')
        .select('id, full_name, phone, vehicle_type, zone')
        .in('id', driverIds)
      setDrivers(data || [])
      setLoading(false)
    }
    load()
  }, [])
  const handleConfirm = async () => {
    if (!selectedDriver) return
    setErrorMsg('')
    setSaving(true)

    const driver = drivers.find(d => d.id === selectedDriver)

    // 1. orders.driver_id — .select() to surface RLS-zero-row writes
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
      setErrorMsg('Aucune ligne mise à jour — vérifie les permissions (RLS).')
      return
    }

    // 2. order_deliveries — gérer une éventuelle ligne existante (re-dispatch)
    const { data: existing } = await supabase
      .from('order_deliveries')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle()
    const payload = {
      driver_id: selectedDriver,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      amount_to_collect: order.total,
      delivery_fee_charged_to_customer: order.delivery_fee || 0,
    }
    const { error: delErr } = existing
      ? await supabase.from('order_deliveries').update(payload).eq('id', existing.id)
      : await supabase.from('order_deliveries').insert({ order_id: order.id, ...payload })
    if (delErr) {
      setSaving(false)
      setErrorMsg(`Création livraison échouée : ${delErr.message}`)
      return
    }

    setSaving(false)

    const driverInfo = driver ? { full_name: driver.full_name, phone: driver.phone } : null

    // 3. Build WhatsApp URL — pour en_livraison, slot et formatDate ne sont pas utilisés
    const formatDateLocal = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    const waUrl = buildWhatsAppUrl(order, null, 'en_livraison', formatDateLocal, undefined, undefined, currency, driverInfo)

    // 4. Vue succès : statut en_livraison appliqué dans finishDispatch (WA ou Fermer)
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
        <div style={{ fontSize: 12, color: '#C8B99A', marginBottom: 20 }}>Commande #{order.id.slice(0,8).toUpperCase()} - {order.customer_name} - {order.total.toFixed(2)} {currency}</div>
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
            {loading ? (<div style={{ color: '#7A6E58', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Chargement...</div>) : drivers.length === 0 ? (<div style={{ color: '#FF6B6B', fontSize: 13, textAlign: 'center', padding: '20px 0', background: 'rgba(255,107,107,0.07)', borderRadius: 10, border: '1px solid rgba(255,107,107,0.15)' }}>Aucun livreur avec session ouverte</div>) : (
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
  const [orders, setOrders] = useState<any[]>([])
  const currency = useCurrency()
  const searchParams = useSearchParams()
  const [filter, setFilter] = useState(() => searchParams.get('tab') || 'nouvelle')
  const [highlightIdParam] = useState(() => searchParams.get('highlight'))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [slots, setSlots] = useState<Record<string, any>>({})
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, string>>({})
  const [factureUrls, setFactureUrls] = useState<Record<string, string>>({})
  const [shopAddress, setShopAddress] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [dispatchOrder, setDispatchOrder] = useState<any | null>(null)
  const [driverInfos, setDriverInfos] = useState<Record<string, { full_name: string; phone: string }>>({})
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const supabase = createClient()


  const markLivree = async (order: any) => {
    const supabase2 = createClient()
    // 1. Update order status
    await supabase2.from('orders').update({ status: 'livrée' }).eq('id', order.id)
    // 2. Update order_deliveries
    await supabase2.from('order_deliveries')
      .update({ status: 'delivered', delivered_at: new Date().toISOString(), amount_collected: order.total })
      .eq('order_id', order.id)
    // 3. Recalculer driver_sessions collected_cash + net_to_remit
    const { data: delRow } = await supabase2.from('order_deliveries')
      .select('driver_id').eq('order_id', order.id).single()
    if (delRow?.driver_id) {
      const { data: sess } = await supabase2.from('driver_sessions')
        .select('id').eq('driver_id', delRow.driver_id).eq('session_status', 'open').single()
      if (sess?.id) {
        const { data: deliveries } = await supabase2.from('order_deliveries')
          .select('amount_collected, delivery_fee_charged_to_customer')
          .eq('driver_id', delRow.driver_id)
          .eq('status', 'delivered')
        const collected = (deliveries || []).reduce((s: number, d: any) => s + (d.amount_collected || 0), 0)
        const fees = (deliveries || []).reduce((s: number, d: any) => s + (d.delivery_fee_charged_to_customer || 0), 0)
        await supabase2.from('driver_sessions').update({
          collected_cash: collected,
          net_to_remit: collected - fees
        }).eq('id', sess.id)
      }
    }
    reload()
  }

  const loadCounts = async () => {
    const countResults = await Promise.all([
      ...STATUSES.map(s => supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', s)),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('delivery_mode', 'pickup'),
    ])
    const c: Record<string, number> = {}
    STATUSES.forEach((s, i) => { c[s] = countResults[i].count || 0 })
    c['retrait'] = countResults[STATUSES.length].count || 0
    setCounts(c)
  }

  // Charge un slice via .range() côté serveur. append=true ajoute, sinon remplace.
  const fetchOrders = async (offset: number, append: boolean) => {
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
    if (!data) {
      if (append) setLoadingMore(false)
      return
    }
    const total = count || 0
    if (append) setOrders(prev => [...prev, ...data])
    else setOrders(data)
    setHasMore(offset + data.length < total)

    const slotIds = [...new Set(data.filter(o => o.slot_id).map(o => o.slot_id as string))]
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
    const driverIds = [...new Set(data.filter((o: any) => o.driver_id).map((o: any) => o.driver_id as string))]
    if (driverIds.length > 0) {
      const { data: driverData } = await supabase.from('delivery_drivers').select('id, full_name, phone').in('id', driverIds)
      if (driverData) {
        setDriverInfos(prev => {
          const map = { ...prev }
          driverData.forEach((d: any) => { map[d.id] = { full_name: d.full_name, phone: d.phone } })
          return map
        })
      }
    }
    if (append) setLoadingMore(false)
  }

  const reload = () => Promise.all([loadCounts(), fetchOrders(0, false)])

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'delivery_shop_address').single()
      .then(({ data }) => { if (data) setShopAddress(data.value || '') })
  }, [])

  useEffect(() => {
    if (!highlightIdParam) return
    setHighlightId(highlightIdParam)
    setTimeout(() => {
      const el = document.getElementById(`order-${highlightIdParam}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 500)
    setTimeout(() => setHighlightId(null), 3500)
  }, [orders, highlightIdParam])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && tab !== filter) setFilter(tab)
  }, [searchParams.toString()])
  useEffect(() => { reload() }, [filter])

  // Refresh auto + realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`admin-commandes-${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => reload())
      .subscribe()
    const interval = setInterval(() => reload(), 30000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [filter])

  // Infinite scroll: observe la sentinelle et appende la suite quand visible
  useEffect(() => {
    if (!hasMore || loadingMore) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) fetchOrders(orders.length, true)
    }, { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, orders.length, filter])

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
        {STATUSES.map(s => {
          const sc = STATUS_COLORS[s]
          const active = filter === s
          return (
            <button key={s} onClick={() => setFilter(s)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 50, border: '1px solid', borderColor: active ? sc.border : 'rgba(255,255,255,0.06)', background: active ? sc.bg : 'transparent', color: active ? sc.color : '#C8B99A', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
              {STATUS_LABELS[s]}
              {counts[s] ? <span style={{ background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)', padding: '0 6px', borderRadius: 50, fontSize: 10 }}>{counts[s]}</span> : null}
            </button>
          )
        })}
        <button onClick={() => setFilter('retrait')} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 50, border: '1px solid', borderColor: filter === 'retrait' ? 'rgba(232,160,32,0.25)' : 'rgba(255,255,255,0.06)', background: filter === 'retrait' ? 'rgba(232,160,32,0.1)' : 'transparent', color: filter === 'retrait' ? '#E8A020' : '#C8B99A', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
          Retrait
          {counts['retrait'] ? <span style={{ background: filter === 'retrait' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)', padding: '0 6px', borderRadius: 50, fontSize: 10 }}>{counts['retrait']}</span> : null}
        </button>
      </div>

      {/* LISTE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.length === 0 && (
          <div style={{ textAlign: 'center', color: '#C8B99A', padding: '40px 0', fontSize: 14 }}>Aucune commande</div>
        )}
        {orders.map(order => {
          const sc = STATUS_COLORS[order.status] || STATUS_COLORS['nouvelle']
          const transitions = STATUS_TRANSITIONS[order.status] || []
          const pending = pendingStatuses[order.id] || ''
          return (
            <div key={order.id} id={`order-${order.id}`} style={{ background: '#131009', border: highlightId === order.id ? '2px solid #F5C842' : '1px solid rgba(232,160,32,0.1)', borderRadius: 16, padding: '18px 20px', transition: 'border 0.3s', boxShadow: highlightId === order.id ? '0 0 20px rgba(245,200,66,0.2)' : 'none' }}>

              {/* HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#F5EDD6' }}>{order.customer_name}</div>
                  <div style={{ fontSize: 11, color: '#C8B99A', marginTop: 3 }}>{order.customer_phone} · {order.customer_address?.slice(0, 40)}{order.customer_address?.length > 40 ? '…' : ''}</div>
                  <div style={{ fontSize: 10, color: '#A89880', marginTop: 2 }}>#{order.id.slice(0,8).toUpperCase()} · {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#F5C842', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>{order.total.toFixed(2)} <span style={{ fontSize: 13 }}>{currency}</span></div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 50, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, display: 'inline-block' }}>{STATUS_LABELS[order.status]}</span>
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
                {order.order_items?.map((item: any) => (
                  <span key={item.id} style={{ background: 'rgba(232,160,32,0.07)', border: '1px solid rgba(232,160,32,0.12)', color: '#C8B890', padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 500 }}>
                    {item.quantity}× {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''}{item.variant_name ? ` (${item.variant_name})` : ''}
                  </span>
                ))}
              </div>

              {/* DÉTAIL LIVRAISON */}
              {(order.delivery_fee > 0 || order.delivery_mode === 'pickup') && (
                <div style={{ fontSize: 11, color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', marginBottom: 10 }}>
                  {order.delivery_mode === 'pickup'
                    ? 'Retrait sur place'
                    : order.delivery_fee === 0
                      ? `Livraison gratuite · ${order.distance_km ? Number(order.distance_km).toFixed(2) : '?'} km`
                      : `Livraison · ${order.distance_km ? Number(order.distance_km).toFixed(2) : '?'} km · ${order.delivery_fee} ${currency}`}
                </div>
              )}


              {order.status === 'en_livraison' && (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => markLivree(order)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 50, border: '1px solid rgba(91,197,122,0.4)', background: 'rgba(91,197,122,0.12)', color: '#5BC57A', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    ✓ Marquer livrée
                  </button>
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
                {order.lat && order.lng && (
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
                          {transitions.map(s => (
                            <option key={s} value={s} style={{ background: '#131009', color: '#F5EDD6' }}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: pending ? (STATUS_COLORS[pending]?.color || '#E8A020') : '#7A6E58', fontSize: 10 }}>▾</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 50, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{STATUS_LABELS[order.status]}</span>
                    )}
                  </div>
                  {pending && pending !== order.status && (() => {
                    const btnStyle = { marginTop: 10, display: 'inline-block', float: 'right' as const, background: '#25D366', color: '#0A0804', borderRadius: 50, padding: '6px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', border: 'none' }
                    if (pending === 'en_livraison' && !order.driver_id) return null
                    const waUrl = buildWhatsAppUrl(
                      order,
                      slots[order.slot_id] ?? null,
                      pending,
                      formatDate,
                      shopAddress,
                      pending === 'livrée' ? factureUrls[order.id] : undefined,
                      currency,
                      driverInfos[order.driver_id] ?? null
                    )
                    if (!waUrl) return null
                    return (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          sendStatusBeacon(order.id, pending)
                          applyStatusChange(order.id, pending)
                        }}
                        style={btnStyle}
                      >
                        {WA_BUTTON_LABELS[pending] || 'Envoyer message WhatsApp'}
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
