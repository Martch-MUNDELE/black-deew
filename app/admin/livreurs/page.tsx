'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'

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
    collected_cash: number
    expected_cash: number
    net_to_remit: number
  } | null
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
  bike: '🚲', scooter: '🛵', car: '🚗', on_foot: '🚶'
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
  const [addError, setAddError] = useState('')
  const [sessionDriver, setSessionDriver] = useState<Driver | null>(null)
  const [openingCash, setOpeningCash] = useState('')
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [closeDriver, setCloseDriver] = useState<Driver | null>(null)
  const [closeLoading, setCloseLoading] = useState(false)

  async function load() {
    setLoading(true)
    const { data: driversRaw } = await supabase
      .from('delivery_drivers')
      .select('id, full_name, phone, status, vehicle_type, zone')
      .order('full_name')
    if (!driversRaw) { setLoading(false); return }
    const { data: sessions } = await supabase
      .from('driver_sessions')
      .select('id, driver_id, started_at, collected_cash, expected_cash, net_to_remit')
      .eq('session_status', 'open')
    const sessionMap: Record<string, any> = {}
    for (const s of sessions || []) { sessionMap[s.driver_id] = s }
    setDrivers(driversRaw.map((d: any) => ({ ...d, open_session: sessionMap[d.id] || null })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAddDriver() {
    setAddError('')
    if (!addForm.full_name.trim() || !addForm.phone.trim()) { setAddError('Nom et telephone obligatoires'); return }
    setAddLoading(true)
    const { error } = await supabase.from('delivery_drivers').insert({
      full_name: addForm.full_name.trim(),
      phone: addForm.phone.trim(),
      vehicle_type: addForm.vehicle_type,
      zone: addForm.zone.trim() || null,
      status: addForm.status,
    })
    setAddLoading(false)
    if (error) { setAddError(error.message); return }
    setShowAdd(false)
    setAddForm({ full_name: '', phone: '', vehicle_type: 'scooter', zone: '', status: 'active' })
    load()
  }

  async function handleOpenSession() {
    if (!sessionDriver) return
    setSessionError('')
    const cash = parseFloat(openingCash)
    if (isNaN(cash) || cash < 0) { setSessionError('Montant invalide'); return }
    setSessionLoading(true)
    const { error } = await supabase.from('driver_sessions').insert({
      driver_id: sessionDriver.id,
      opening_cash: cash,
      session_status: 'open',
      started_at: new Date().toISOString(),
      collected_cash: 0,
      expected_cash: 0,
      net_to_remit: 0,
    })
    setSessionLoading(false)
    if (error) { setSessionError(error.message); return }
    setSessionDriver(null)
    setOpeningCash('')
    load()
  }

  async function handleCloseSession() {
    if (!closeDriver?.open_session) return
    setCloseLoading(true)
    await supabase.from('driver_sessions')
      .update({ session_status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', closeDriver.open_session.id)
    setCloseLoading(false)
    setCloseDriver(null)
    load()
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
    { key: 'tous', label: 'Tous' },
    { key: 'active', label: 'Actifs' },
    { key: 'inactive', label: 'Inactifs' },
    { key: 'suspended', label: 'Suspendus' },
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
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, background: 'linear-gradient(90deg,#FFD060,#E8901A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, marginBottom: 6 }}>
                Livreurs
              </h1>
              <p style={{ color: '#7A6E58', fontSize: 13, margin: 0 }}>
                {drivers.length} livreur{drivers.length !== 1 ? 's' : ''} &mdash; {openCount} session{openCount !== 1 ? 's' : ''} ouverte{openCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={() => { setShowAdd(true); setAddError('') }} style={{ background: 'linear-gradient(135deg,#F5C842,#E8901A)', color: '#0D0B07', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span style={{ fontSize: 18, lineHeight: '1' }}>+</span> Nouveau livreur
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
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 14, padding: 48, textAlign: 'center', color: '#7A6E58', fontSize: 14 }}>
              Aucun livreur dans cette categorie
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(driver => {
                const sc = STATUS_COLORS[driver.status] || STATUS_COLORS.inactive
                const hasSession = !!driver.open_session
                return (
                  <div key={driver.id} style={{ background: hasSession ? 'rgba(245,200,66,0.04)' : 'rgba(255,255,255,0.02)', border: hasSession ? '1px solid rgba(245,200,66,0.2)' : '1px solid rgba(232,160,32,0.08)', borderRadius: 14, padding: 16, position: 'relative' }}>
                    {hasSession && (
                      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.3)', borderRadius: 20, padding: '3px 10px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5C842', display: 'inline-block', boxShadow: '0 0 6px #F5C842' }} />
                        <span style={{ fontSize: 10, color: '#F5C842', fontWeight: 700, letterSpacing: '0.5px' }}>SESSION OUVERTE</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12, paddingRight: hasSession ? 140 : 0 }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {VEHICLE_ICONS[driver.vehicle_type || ''] || '👤'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#F5EDD6' }}>{driver.full_name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.color, border: '1px solid ' + sc.border, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {STATUS_LABELS[driver.status]}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: '#7A6E58' }}>📞 {driver.phone}</span>
                          {driver.zone && <span style={{ fontSize: 12, color: '#7A6E58' }}>📍 {driver.zone}</span>}
                        </div>
                      </div>
                    </div>

                    {hasSession && driver.open_session && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(245,200,66,0.1)', borderRadius: 10, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Ouverture</div>
                          <div style={{ fontSize: 12, color: '#F5EDD6', fontWeight: 600 }}>{formatDate(driver.open_session.started_at)}</div>
                          <div style={{ fontSize: 11, color: '#7A6E58' }}>{formatTime(driver.open_session.started_at)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Collecte</div>
                          <div style={{ fontSize: 14, color: '#5BC57A', fontWeight: 700 }}>{driver.open_session.collected_cash.toFixed(0)} {currency}</div>
                          <div style={{ fontSize: 10, color: '#7A6E58' }}>/ {driver.open_session.expected_cash.toFixed(0)} attendu</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: '#7A6E58', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>A remettre</div>
                          <div style={{ fontSize: 14, color: '#F5C842', fontWeight: 700 }}>{driver.open_session.net_to_remit.toFixed(0)} {currency}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!hasSession && (
                        <button onClick={() => { setSessionDriver(driver); setOpeningCash(''); setSessionError('') }} style={{ background: 'rgba(91,197,122,0.1)', color: '#5BC57A', border: '1px solid rgba(91,197,122,0.25)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          Ouvrir session
                        </button>
                      )}
                      {hasSession && (
                        <button onClick={() => setCloseDriver(driver)} style={{ background: 'rgba(255,107,107,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          Cloture session
                        </button>
                      )}
                    </div>
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
                <label style={LBL}>Nom complet *</label>
                <input value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ex: Ahmed Benali" style={INP} />
              </div>
              <div>
                <label style={LBL}>Telephone *</label>
                <input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="Ex: 0770123456" style={INP} />
              </div>
              <div>
                <label style={LBL}>Vehicule</label>
                <select value={addForm.vehicle_type} onChange={e => setAddForm(f => ({ ...f, vehicle_type: e.target.value }))} style={SEL}>
                  <option value="scooter">🛵 Scooter</option>
                  <option value="bike">🚲 Velo</option>
                  <option value="car">🚗 Voiture</option>
                  <option value="on_foot">🚶 A pied</option>
                </select>
              </div>
              <div>
                <label style={LBL}>Zone</label>
                <input value={addForm.zone} onChange={e => setAddForm(f => ({ ...f, zone: e.target.value }))} placeholder="Ex: Centre-ville" style={INP} />
              </div>
              <div>
                <label style={LBL}>Statut</label>
                <select value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))} style={SEL}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                  <option value="suspended">Suspendu</option>
                </select>
              </div>
              {addError && <div style={{ color: '#FF6B6B', fontSize: 13, background: 'rgba(255,107,107,0.1)', padding: '8px 12px', borderRadius: 8 }}>{addError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAdd(false)} style={BCANCEL}>Annuler</button>
                <button onClick={handleAddDriver} disabled={addLoading} style={{ background: 'linear-gradient(135deg,#F5C842,#E8901A)', color: '#0D0B07', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flex: 1, opacity: addLoading ? 0.7 : 1 }}>{addLoading ? 'Ajout...' : 'Ajouter'}</button>
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
            <div style={{ marginBottom: 16 }}>
              <label style={LBL}>Fonds ouverture</label>
              <input type="number" min="0" value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="0" style={INP} />
            </div>
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
    </>
  )
}
