'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'
import PhoneInput from '@/components/PhoneInput'

type Driver = {
  id: string
  full_name: string
  phone: string
  status: string
  vehicle_type: string | null
  zone: string | null
  open_session: {
    id: string
    started_at: string
    opening_cash: number
    collected_cash: number
    expected_cash: number
    net_to_remit: number
  } | null
}

type DriverKPIs = {
  deliveries: number
  caCollected: number
  totalToRemit: number
}

type OrderDelivery = {
  id: string
  order_id: string
  status: string
  amount_collected: number
  delivery_fee: number
  driver_fee_total: number
  orders?: { id: string; total_amount: number; customer_name?: string }
}

type ClosedSession = {
  id: string
  started_at: string
  closed_at: string | null
  settled_at: string | null
  session_status: string
  opening_cash: number
  collected_cash: number
  net_to_remit: number
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  active:    { bg: 'rgba(91,197,122,0.1)',  color: '#5BC57A', border: 'rgba(91,197,122,0.25)' },
  inactive:  { bg: 'rgba(122,110,88,0.1)',  color: '#C8B99A', border: 'rgba(122,110,88,0.2)' },
  suspended: { bg: 'rgba(255,107,107,0.1)', color: '#FF6B6B', border: 'rgba(255,107,107,0.2)' },
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Actif', inactive: 'Inactif', suspended: 'Suspendu'
}
const VEHICLE_ICONS: Record<string, string> = {
  bike: '\u{1F6B2}', scooter: '\u{1F6F5}', car: '\u{1F697}', on_foot: '\u{1F6B6}'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LivreursPage() {
  const supabase = createClient()
  const currency = useCurrency()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'tous' | 'active' | 'inactive' | 'suspended'>('tous')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ full_name: '', phone: '', vehicle_type: 'scooter', zone: '', status: 'active' })
  const [addLoading, setAddLoading] = useState(false)
  const [contactPickerAvailable, setContactPickerAvailable] = useState(false)
  const [addError, setAddError] = useState('')
  const [sessionDriver, setSessionDriver] = useState<Driver | null>(null)
  const [openingCash, setOpeningCash] = useState('')
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [closeDriver, setCloseDriver] = useState<Driver | null>(null)
  const [closeLoading, setCloseLoading] = useState(false)
  const [editDriver, setEditDriver] = useState<Driver | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', vehicle_type: 'scooter', zone: '', status: 'active' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [deleteDriver, setDeleteDriver] = useState<Driver | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [driverKPIs, setDriverKPIs] = useState<Record<string, DriverKPIs>>({})
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set())
  const [driverDeliveries, setDriverDeliveries] = useState<Record<string, OrderDelivery[]>>({})
  const [driverClosedSessions, setDriverClosedSessions] = useState<Record<string, ClosedSession[]>>({})
  const [expandedDeliveries, setExpandedDeliveries] = useState<Set<string>>(new Set())
  const [settleLoading, setSettleLoading] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: driversRaw } = await supabase
      .from('delivery_drivers')
      .select('id, full_name, phone, status, vehicle_type, zone')
      .order('full_name')
    if (!driversRaw) { setLoading(false); return }
    const { data: sessions } = await supabase
      .from('driver_sessions')
      .select('id, driver_id, started_at, opening_cash, collected_cash, expected_cash, net_to_remit')
      .eq('session_status', 'open')
    const sessionMap: Record<string, any> = {}
    for (const s of sessions || []) { sessionMap[s.driver_id] = s }
    const driversList = driversRaw.map((d: any) => ({ ...d, open_session: sessionMap[d.id] || null }))
    setDrivers(driversList)
    const driverIds = driversRaw.map((d: any) => d.id)
    const { data: deliveries } = await supabase
      .from('order_deliveries')
      .select('driver_id, amount_collected, driver_fee_total')
      .eq('status', 'delivered')
      .in('driver_id', driverIds)
    const kpis: Record<string, DriverKPIs> = {}
    for (const id of driverIds) {
      const dd = (deliveries || []).filter((d: any) => d.driver_id === id)
      const openSess = sessionMap[id] || null
      const openingCashCurrent = openSess ? (openSess.opening_cash || 0) : 0
      const caCollected = dd.reduce((sum: number, d: any) => sum + (d.amount_collected || 0), 0)
      const sumDriverFee = dd.reduce((sum: number, d: any) => sum + (d.driver_fee_total || 0), 0)
      kpis[id] = {
        deliveries: dd.length,
        caCollected,
        totalToRemit: openingCashCurrent + caCollected - sumDriverFee,
      }
    }
    setDriverKPIs(kpis)
    setLoading(false)
  }

  async function loadDriverDetails(driverId: string) {
    const { data: dels } = await supabase
      .from('order_deliveries')
      .select('id, order_id, status, amount_collected, delivery_fee, driver_fee_total, orders(id, total_amount, customer_name)')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(30)
    setDriverDeliveries(prev => ({ ...prev, [driverId]: (dels || []) as unknown as OrderDelivery[] }))
    const { data: closed } = await supabase
      .from('driver_sessions')
      .select('id, started_at, closed_at, settled_at, session_status, opening_cash, collected_cash, net_to_remit')
      .eq('driver_id', driverId)
      .neq('session_status', 'open')
      .order('started_at', { ascending: false })
      .limit(10)
    setDriverClosedSessions(prev => ({ ...prev, [driverId]: (closed || []) as ClosedSession[] }))
  }

  function toggleExpand(driverId: string) {
    setExpandedDrivers(prev => {
      const next = new Set(prev)
      if (next.has(driverId)) { next.delete(driverId) }
      else { next.add(driverId); loadDriverDetails(driverId) }
      return next
    })
  }

  function toggleDelivery(deliveryId: string) {
    setExpandedDeliveries(prev => {
      const next = new Set(prev)
      if (next.has(deliveryId)) { next.delete(deliveryId) } else { next.add(deliveryId) }
      return next
    })
  }

  async function handleSettle(sessionId: string) {
    setSettleLoading(sessionId)
    await supabase.from('driver_sessions')
      .update({ session_status: 'settled', settled_at: new Date().toISOString() })
      .eq('id', sessionId)
    setSettleLoading(null)
    load()
    const driver = drivers.find(d => d.open_session?.id === sessionId)
    if (driver) loadDriverDetails(driver.id)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      setContactPickerAvailable(true)
    }
  }, [])

  async function handleContactPicker() {
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false })
      if (contacts && contacts.length > 0) {
        const contact = contacts[0]
        const name = contact.name && contact.name.length > 0 ? contact.name[0] : ''
        const tel = contact.tel && contact.tel.length > 0 ? contact.tel[0] : ''
        setAddForm(f => ({ ...f, full_name: name || f.full_name, phone: tel || f.phone }))
      }
    } catch (e) {
      // user cancelled or API error
    }
  }

  async function handleAddDriver() {
    setAddError('')
    if (!addForm.full_name.trim() || !addForm.phone.trim()) { setAddError('Nom et telephone obligatoires'); return }
    setAddLoading(true)
    const { error } = await supabase.from('delivery_drivers').insert({
      full_name: addForm.full_name.trim(), phone: addForm.phone.trim(),
      vehicle_type: addForm.vehicle_type, zone: addForm.zone.trim() || null, status: addForm.status,
    })
    setAddLoading(false)
    if (error) { setAddError(error.message); return }
    setShowAdd(false)
    setAddForm({ full_name: '', phone: '', vehicle_type: 'scooter', zone: '', status: 'active' })
    load()
  }

  function openEdit(driver: Driver) {
    setEditDriver(driver)
    setEditForm({ full_name: driver.full_name, phone: driver.phone, vehicle_type: driver.vehicle_type || 'scooter', zone: driver.zone || '', status: driver.status })
    setEditError('')
  }

  async function handleEditDriver() {
    if (!editDriver) return
    setEditError('')
    if (!editForm.full_name.trim() || !editForm.phone.trim()) { setEditError('Nom et telephone obligatoires'); return }
    setEditLoading(true)
    const { error } = await supabase.from('delivery_drivers').update({
      full_name: editForm.full_name.trim(), phone: editForm.phone.trim(),
      vehicle_type: editForm.vehicle_type, zone: editForm.zone.trim() || null, status: editForm.status,
    }).eq('id', editDriver.id)
    setEditLoading(false)
    if (error) { setEditError(error.message); return }
    setEditDriver(null); load()
  }

  async function handleToggleStatus(driver: Driver) {
    const newStatus = driver.status === 'active' ? 'inactive' : 'active'
    setToggleLoading(driver.id)
    await supabase.from('delivery_drivers').update({ status: newStatus }).eq('id', driver.id)
    setToggleLoading(null); load()
  }

  async function handleDeleteDriver() {
    if (!deleteDriver) return
    setDeleteLoading(true)
    await supabase.from('delivery_drivers').delete().eq('id', deleteDriver.id)
    setDeleteLoading(false); setDeleteDriver(null); load()
  }

  async function handleOpenSession() {
    if (!sessionDriver) return
    setSessionError('')
    const cash = parseFloat(openingCash)
    if (isNaN(cash) || cash < 0) { setSessionError('Montant invalide'); return }
    setSessionLoading(true)
    const { error } = await supabase.from('driver_sessions').insert({
      driver_id: sessionDriver.id, opening_cash: cash, session_status: 'open',
      started_at: new Date().toISOString(), collected_cash: 0, expected_cash: 0, net_to_remit: 0,
    })
    setSessionLoading(false)
    if (error) { setSessionError(error.message); return }
    setSessionDriver(null); setOpeningCash(''); load()
  }

  async function handleCloseSession() {
    if (!closeDriver?.open_session) return
    setCloseLoading(true)
    await supabase.from('driver_sessions')
      .update({ session_status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', closeDriver.open_session.id)
    setCloseLoading(false); setCloseDriver(null); load()
  }

  const filtered = tab === 'tous' ? drivers : drivers.filter(d => d.status === tab)
  const counts = {
    tous: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    inactive: drivers.filter(d => d.status === 'inactive').length,
    suspended: drivers.filter(d => d.status === 'suspended').length,
  }
  const openCount = drivers.filter(d => d.open_session).length
  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'tous', label: 'Tous' }, { key: 'active', label: 'Actifs' },
    { key: 'inactive', label: 'Inactifs' }, { key: 'suspended', label: 'Suspendus' },
  ]

  const INP: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(232,160,32,0.15)',
    borderRadius: 8, padding: '10px 12px', color: '#F5EDD6', fontSize: 14,
    fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' as const,
  }
  const SEL: React.CSSProperties = {
    width: '100%', background: '#1A1610', border: '1px solid rgba(232,160,32,0.15)',
    borderRadius: 8, padding: '10px 12px', color: '#F5EDD6', fontSize: 14,
    fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' as const,
  }
  const LBL: React.CSSProperties = {
    display: 'block', fontSize: 11, color: '#7A6E58', textTransform: 'uppercase' as const,
    letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600,
  }
  const BCANCEL: React.CSSProperties = {
    background: 'transparent', color: '#7A6E58', border: '1px solid rgba(122,110,88,0.3)',
    borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flex: 1,
  }

  return (
    <>
      <div style={{ minHeight: '100vh', background: '#0D0B07', color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', paddingTop: 56 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px 80px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, background: 'linear-gradient(90deg,#FFD060,#E8901A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, marginBottom: 6 }}>Livreurs</h1>
              <p style={{ color: '#7A6E58', fontSize: 13, margin: 0 }}>{drivers.length} livreur{drivers.length !== 1 ? 's' : ''} &mdash; {openCount} session{openCount !== 1 ? 's' : ''} ouverte{openCount !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => { setShowAdd(true); setAddError('') }} style={{ background: 'linear-gradient(135deg,#F5C842,#E8901A)', color: '#0D0B07', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>+</span> Nouveau livreur
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            {([
              { label: 'Sessions ouvertes', value: openCount, color: '#F5C842', icon: '🟢' },
              { label: 'Actifs', value: counts.active, color: '#5BC57A', icon: '✅' },
              { label: 'Inactifs', value: counts.inactive, color: '#C8B99A', icon: '⏸' },
            ] as { label: string; value: number; color: string; icon: string }[]).map(stat => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: '#7A6E58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '7px 14px', borderRadius: 20, border: tab === t.key ? '1px solid #F5C842' : '1px solid rgba(232,160,32,0.2)', background: tab === t.key ? 'rgba(245,200,66,0.12)' : 'transparent', color: tab === t.key ? '#F5C842' : '#7A6E58', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}>
                {t.label} <span style={{ opacity: 0.7 }}>({counts[t.key]})</span>
              </button>
            ))}
          </div>
          {loading ? (
            <div style={{ color: '#7A6E58', textAlign: 'center', padding: 48, fontSize: 14 }}>Chargement...</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 14, padding: 48, textAlign: 'center', color: '#7A6E58', fontSize: 14 }}>Aucun livreur dans cette categorie</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(driver => {
                const sc = STATUS_COLORS[driver.status] || STATUS_COLORS.inactive
                const hasSession = !!driver.open_session
                const isToggling = toggleLoading === driver.id
                const isExpanded = expandedDrivers.has(driver.id)
                const deliveries = driverDeliveries[driver.id] || []
                const closedSessions = driverClosedSessions[driver.id] || []
                const kpi = driverKPIs[driver.id]
                const openSess = driver.open_session
                const openingCashVal = openSess ? (openSess.opening_cash || 0) : 0
                const caCollecte = kpi ? kpi.caCollected : 0
                const fraisLivreur = kpi ? (openingCashVal + caCollecte - kpi.totalToRemit) : 0
                const netARemettreCalc = openingCashVal + caCollecte - fraisLivreur
                return (
                  <div key={driver.id} style={{ background: hasSession ? 'rgba(245,200,66,0.04)' : 'rgba(255,255,255,0.02)', border: hasSession ? '1px solid rgba(245,200,66,0.2)' : '1px solid rgba(232,160,32,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                    <div onClick={() => toggleExpand(driver.id)} style={{ padding: 16, cursor: 'pointer', position: 'relative' }}>
                      {hasSession && (
                        <div style={{ position: 'absolute', top: 12, right: 40, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.3)', borderRadius: 20, padding: '3px 10px' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5C842', display: 'inline-block', boxShadow: '0 0 6px #F5C842' }} />
                          <span style={{ fontSize: 10, color: '#F5C842', fontWeight: 700, letterSpacing: '0.5px' }}>SESSION</span>
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: 14, right: 12, color: '#7A6E58', fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingRight: hasSession ? 120 : 28 }}>
                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          {VEHICLE_ICONS[driver.vehicle_type || ''] || '👤'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#F5EDD6' }}>{driver.full_name}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.color, border: '1px solid ' + sc.border, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{STATUS_LABELS[driver.status]}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#7A6E58' }}>📞 {driver.phone}</span>
                            {driver.zone && <span style={{ fontSize: 12, color: '#7A6E58' }}>📍 {driver.zone}</span>}
                          </div>
                        </div>
                      </div>
                      {kpi && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '10px 12px' }}>
                          <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Livraisons</div><div style={{ fontSize: 16, color: '#F5C842', fontWeight: 700 }}>{kpi.deliveries}</div></div>
                          <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>CA collecte</div><div style={{ fontSize: 13, color: '#5BC57A', fontWeight: 700 }}>{kpi.caCollected.toFixed(0)} {currency}</div></div>
                          <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>A remettre</div><div style={{ fontSize: 13, color: '#E8A020', fontWeight: 700 }}>{kpi.totalToRemit.toFixed(0)} {currency}</div></div>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid rgba(232,160,32,0.1)', padding: '0 16px 16px' }}>
                        {hasSession && openSess && (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 11, color: '#F5C842', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>💰 Tresorerie session</div>
                            <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(245,200,66,0.12)', borderRadius: 10, padding: '12px 14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: '#7A6E58' }}>Fonds ouverture</span>
                                <span style={{ fontSize: 12, color: '#F5EDD6', fontWeight: 600 }}>{openingCashVal.toFixed(0)} {currency}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: '#7A6E58' }}>CA collecte</span>
                                <span style={{ fontSize: 12, color: '#5BC57A', fontWeight: 600 }}>+ {caCollecte.toFixed(0)} {currency}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(232,160,32,0.1)' }}>
                                <span style={{ fontSize: 12, color: '#7A6E58' }}>Frais livreur</span>
                                <span style={{ fontSize: 12, color: '#FF6B6B', fontWeight: 600 }}>- {fraisLivreur.toFixed(0)} {currency}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, color: '#F5C842', fontWeight: 700 }}>Net a remettre</span>
                                <span style={{ fontSize: 16, color: '#F5C842', fontWeight: 700 }}>{netARemettreCalc.toFixed(0)} {currency}</span>
                              </div>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleSettle(openSess.id) }}
                              disabled={settleLoading === openSess.id}
                              style={{ marginTop: 10, width: '100%', background: 'linear-gradient(135deg,rgba(91,197,122,0.2),rgba(91,197,122,0.1))', color: '#5BC57A', border: '1px solid rgba(91,197,122,0.3)', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: settleLoading === openSess.id ? 'wait' : 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: settleLoading === openSess.id ? 0.6 : 1 }}>
                              {settleLoading === openSess.id ? 'Traitement...' : '✅ Argent remis'}
                            </button>
                          </div>
                        )}
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontSize: 11, color: '#C8B99A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>🛵 Courses de la session</div>
                          {deliveries.length === 0 ? (
                            <div style={{ color: '#7A6E58', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Aucune course</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {deliveries.map(del => {
                                const isDelExpanded = expandedDeliveries.has(del.id)
                                const ord = del.orders as any
                                return (
                                  <div key={del.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                                    <div onClick={e => { e.stopPropagation(); toggleDelivery(del.id) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, color: del.status === 'delivered' ? '#5BC57A' : '#F5C842', fontWeight: 700, background: del.status === 'delivered' ? 'rgba(91,197,122,0.1)' : 'rgba(245,200,66,0.1)', padding: '2px 8px', borderRadius: 6 }}>{del.status === 'delivered' ? 'Livree' : del.status}</span>
                                        <span style={{ fontSize: 12, color: '#C8B99A' }}>{ord?.customer_name || del.order_id?.slice(0, 8)}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 12, color: '#5BC57A', fontWeight: 600 }}>{(del.amount_collected || 0).toFixed(0)} {currency}</span>
                                        <span style={{ fontSize: 12, color: '#7A6E58' }}>{isDelExpanded ? '▲' : '▼'}</span>
                                      </div>
                                    </div>
                                    {isDelExpanded && (
                                      <div style={{ padding: '8px 12px 10px', borderTop: '1px solid rgba(232,160,32,0.07)', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
                                        <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', marginBottom: 2 }}>Montant commande</div><div style={{ fontSize: 12, color: '#F5EDD6', fontWeight: 600 }}>{(ord?.total_amount || 0).toFixed(0)} {currency}</div></div>
                                        <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', marginBottom: 2 }}>Frais livraison</div><div style={{ fontSize: 12, color: '#E8A020', fontWeight: 600 }}>{(del.delivery_fee || 0).toFixed(0)} {currency}</div></div>
                                        <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', marginBottom: 2 }}>Frais livreur</div><div style={{ fontSize: 12, color: '#FF6B6B', fontWeight: 600 }}>{(del.driver_fee_total || 0).toFixed(0)} {currency}</div></div>
                                        <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', marginBottom: 2 }}>Montant collecte</div><div style={{ fontSize: 12, color: '#5BC57A', fontWeight: 600 }}>{(del.amount_collected || 0).toFixed(0)} {currency}</div></div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        {closedSessions.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 11, color: '#7A6E58', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>📋 Historique sessions</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {closedSessions.map(cs => (
                                <div key={cs.id} style={{ background: 'rgba(0,0,0,0.2)', border: cs.session_status === 'settled' ? '1px solid rgba(91,197,122,0.2)' : '1px solid rgba(232,160,32,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, color: '#7A6E58' }}>{formatDate(cs.started_at)} {formatTime(cs.started_at)}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: cs.session_status === 'settled' ? 'rgba(91,197,122,0.1)' : 'rgba(122,110,88,0.1)', color: cs.session_status === 'settled' ? '#5BC57A' : '#C8B99A' }}>{cs.session_status === 'settled' ? '✅ Regle' : 'Clos'}</span>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                                    <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', marginBottom: 2 }}>Ouverture</div><div style={{ fontSize: 12, color: '#F5EDD6', fontWeight: 600 }}>{(cs.opening_cash || 0).toFixed(0)} {currency}</div></div>
                                    <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', marginBottom: 2 }}>Collecte</div><div style={{ fontSize: 12, color: '#5BC57A', fontWeight: 600 }}>{(cs.collected_cash || 0).toFixed(0)} {currency}</div></div>
                                    <div><div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', marginBottom: 2 }}>Net remis</div><div style={{ fontSize: 12, color: '#F5C842', fontWeight: 600 }}>{(cs.net_to_remit || 0).toFixed(0)} {currency}</div></div>
                                  </div>
                                  {cs.settled_at && <div style={{ marginTop: 6, fontSize: 10, color: '#5BC57A' }}>Regle le {formatDate(cs.settled_at)} a {formatTime(cs.settled_at)}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(232,160,32,0.08)' }}>
                          {!hasSession && (
                            <button onClick={() => { setSessionDriver(driver); setOpeningCash(''); setSessionError('') }} style={{ background: 'rgba(91,197,122,0.1)', color: '#5BC57A', border: '1px solid rgba(91,197,122,0.25)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Ouvrir session</button>
                          )}
                          {hasSession && (
                            <button onClick={() => setCloseDriver(driver)} style={{ background: 'rgba(255,107,107,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cloture session</button>
                          )}
                          <button onClick={() => openEdit(driver)} style={{ background: 'rgba(232,160,32,0.1)', color: '#E8A020', border: '1px solid rgba(232,160,32,0.25)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Modifier</button>
                          <button onClick={() => handleToggleStatus(driver)} disabled={isToggling} style={{ background: driver.status === 'active' ? 'rgba(122,110,88,0.1)' : 'rgba(91,197,122,0.1)', color: driver.status === 'active' ? '#C8B99A' : '#5BC57A', border: driver.status === 'active' ? '1px solid rgba(122,110,88,0.25)' : '1px solid rgba(91,197,122,0.25)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: isToggling ? 'wait' : 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: isToggling ? 0.6 : 1 }}>{isToggling ? '...' : driver.status === 'active' ? 'Desactiver' : 'Activer'}</button>
                          <button onClick={() => setDeleteDriver(driver)} style={{ background: 'rgba(255,107,107,0.08)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1A1610', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, fontFamily: 'DM Sans, sans-serif' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: '#F5EDD6', margin: '0 0 20px' }}>Nouveau livreur</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={LBL}>Nom complet *</label>
                  {contactPickerAvailable && (
                    <button onClick={handleContactPicker} type="button" style={{ background: 'rgba(245,200,66,0.12)', color: '#F5C842', border: '1px solid rgba(245,200,66,0.3)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                      📇 Choisir contact
                    </button>
                  )}
                </div>
                <input value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ex: James Brown" style={INP} />
              </div>
              <div><label style={LBL}>Telephone *</label><PhoneInput value={addForm.phone} initialValue={addForm.phone} onChange={v => setAddForm(f => ({ ...f, phone: v }))} /></div>
              <div><label style={LBL}>Statut</label>
                <select value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))} style={SEL}>
                  <option value="active">Actif</option><option value="inactive">Inactif</option><option value="suspended">Suspendu</option>
                </select></div>
              {addError && <div style={{ color: '#FF6B6B', fontSize: 13, background: 'rgba(255,107,107,0.1)', padding: '8px 12px', borderRadius: 8 }}>{addError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAdd(false)} style={BCANCEL}>Annuler</button>
                <button onClick={handleAddDriver} disabled={addLoading} style={{ background: 'linear-gradient(135deg,#F5C842,#E8901A)', color: '#0D0B07', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flex: 1, opacity: addLoading ? 0.7 : 1 }}>{addLoading ? 'Ajout...' : 'Ajouter'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editDriver && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1A1610', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, fontFamily: 'DM Sans, sans-serif' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: '#F5EDD6', margin: '0 0 20px' }}>Modifier livreur</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={LBL}>Nom complet *</label><input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} style={INP} /></div>
              <div><label style={LBL}>Telephone *</label><PhoneInput value={editForm.phone} initialValue={editForm.phone} onChange={v => setEditForm(f => ({ ...f, phone: v }))} /></div>
              <div><label style={LBL}>Statut</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={SEL}>
                  <option value="active">Actif</option><option value="inactive">Inactif</option><option value="suspended">Suspendu</option>
                </select></div>
              {editError && <div style={{ color: '#FF6B6B', fontSize: 13, background: 'rgba(255,107,107,0.1)', padding: '8px 12px', borderRadius: 8 }}>{editError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setEditDriver(null)} style={BCANCEL}>Annuler</button>
                <button onClick={handleEditDriver} disabled={editLoading} style={{ background: 'linear-gradient(135deg,#F5C842,#E8901A)', color: '#0D0B07', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flex: 1, opacity: editLoading ? 0.7 : 1 }}>{editLoading ? 'Sauvegarde...' : 'Sauvegarder'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sessionDriver && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1A1610', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, fontFamily: 'DM Sans, sans-serif' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: '#F5EDD6', margin: '0 0 20px' }}>Ouvrir une session</h2>
            <p style={{ color: '#C8B99A', fontSize: 14, margin: '0 0 16px' }}>Livreur : <strong style={{ color: '#F5EDD6' }}>{sessionDriver.full_name}</strong></p>
            <div style={{ marginBottom: 16 }}><label style={LBL}>Fonds ouverture</label><input type="number" min="0" value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="0" style={INP} /></div>
            {sessionError && <div style={{ color: '#FF6B6B', fontSize: 13, background: 'rgba(255,107,107,0.1)', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>{sessionError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSessionDriver(null)} style={BCANCEL}>Annuler</button>
              <button onClick={handleOpenSession} disabled={sessionLoading} style={{ background: 'rgba(91,197,122,0.15)', color: '#5BC57A', border: '1px solid rgba(91,197,122,0.3)', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flex: 1, opacity: sessionLoading ? 0.7 : 1 }}>{sessionLoading ? 'Ouverture...' : 'Ouvrir'}</button>
            </div>
          </div>
        </div>
      )}

      {closeDriver && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1A1610', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, fontFamily: 'DM Sans, sans-serif' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: '#F5EDD6', margin: '0 0 12px' }}>Cloture session</h2>
            <p style={{ color: '#C8B99A', fontSize: 14, margin: '0 0 20px' }}>Confirmer la cloture pour <strong style={{ color: '#F5EDD6' }}>{closeDriver.full_name}</strong> ?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCloseDriver(null)} style={BCANCEL}>Annuler</button>
              <button onClick={handleCloseSession} disabled={closeLoading} style={{ background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flex: 1, opacity: closeLoading ? 0.7 : 1 }}>{closeLoading ? 'Cloture...' : 'Cloturer'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteDriver && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1A1610', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, fontFamily: 'DM Sans, sans-serif' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: '#FF6B6B', margin: '0 0 12px' }}>Supprimer livreur</h2>
            <p style={{ color: '#C8B99A', fontSize: 14, margin: '0 0 20px' }}>Supprimer <strong style={{ color: '#F5EDD6' }}>{deleteDriver.full_name}</strong> ? Cette action est irreversible.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteDriver(null)} style={BCANCEL}>Annuler</button>
              <button onClick={handleDeleteDriver} disabled={deleteLoading} style={{ background: 'rgba(255,107,107,0.15)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flex: 1, opacity: deleteLoading ? 0.7 : 1 }}>{deleteLoading ? 'Suppression...' : 'Supprimer'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
