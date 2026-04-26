'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addDays } from 'date-fns'

const labelStyle = { fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }
const inputStyle = { width: '100%', maxWidth: '100%', minWidth: 0, padding: '10px 14px', boxSizing: 'border-box' as const, borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', appearance: 'none' as const }
const sectionStyle = { background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 16px', marginBottom: 14, overflow: 'hidden' as const }

const DAYS = [
  { label: 'Dim', value: '0' },
  { label: 'Lun', value: '1' },
  { label: 'Mar', value: '2' },
  { label: 'Mer', value: '3' },
  { label: 'Jeu', value: '4' },
  { label: 'Ven', value: '5' },
  { label: 'Sam', value: '6' },
]

const SPINNER_CHARS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const TABS = [
  { key: 'horaires', label: 'Horaires' },
  { key: 'pause', label: 'Pause déjeuner' },
  { key: 'fermeture', label: 'Jours fermés' },
  { key: 'generation', label: 'Génération' },
]

function CreneauxContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'horaires'

  const [slotsStart, setSlotsStart] = useState('09:00')
  const [slotsEnd, setSlotsEnd] = useState('19:00')
  const [slotsDuration, setSlotsDuration] = useState('60')
  const [slotsCapacity, setSlotsCapacity] = useState('10')
  const [slotsPauseStart, setSlotsPauseStart] = useState('')
  const [slotsPauseEnd, setSlotsPauseEnd] = useState('')
  const [slotsClosedDays, setSlotsClosedDays] = useState<string[]>([])
  const [slotsDaysAhead, setSlotsDaysAhead] = useState('14')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [spinIdx, setSpinIdx] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => {
      data?.forEach((s: { key: string; value: string }) => {
        if (s.key === 'slots_start') setSlotsStart(s.value)
        if (s.key === 'slots_end') setSlotsEnd(s.value)
        if (s.key === 'slots_duration') setSlotsDuration(s.value)
        if (s.key === 'slots_capacity') setSlotsCapacity(s.value)
        if (s.key === 'slots_pause_start') setSlotsPauseStart(s.value)
        if (s.key === 'slots_pause_end') setSlotsPauseEnd(s.value)
        if (s.key === 'slots_closed_days') { try { setSlotsClosedDays(JSON.parse(s.value)) } catch {} }
        if (s.key === 'slots_days_ahead') setSlotsDaysAhead(s.value)
      })
    })
  }, [])

  useEffect(() => {
    if (!saving) return
    const t = setInterval(() => setSpinIdx(i => (i + 1) % SPINNER_CHARS.length), 80)
    return () => clearInterval(t)
  }, [saving])

  const toggleClosedDay = (day: string) => {
    setSlotsClosedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const toTime = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`
    const duration = parseInt(slotsDuration) || 60
    const capacity = parseInt(slotsCapacity) || 10
    const daysAhead = parseInt(slotsDaysAhead) || 14
    const ps = slotsPauseStart ? toMin(slotsPauseStart) : null
    const pe = slotsPauseEnd ? toMin(slotsPauseEnd) : null
    const todayStr = new Date().toISOString().split('T')[0]
    await Promise.all([
      supabase.from('settings').upsert({ key: 'slots_start', value: slotsStart }),
      supabase.from('settings').upsert({ key: 'slots_end', value: slotsEnd }),
      supabase.from('settings').upsert({ key: 'slots_duration', value: slotsDuration }),
      supabase.from('settings').upsert({ key: 'slots_capacity', value: slotsCapacity }),
      supabase.from('settings').upsert({ key: 'slots_pause_start', value: slotsPauseStart }),
      supabase.from('settings').upsert({ key: 'slots_pause_end', value: slotsPauseEnd }),
      supabase.from('settings').upsert({ key: 'slots_closed_days', value: JSON.stringify(slotsClosedDays) }),
      supabase.from('settings').upsert({ key: 'slots_days_ahead', value: slotsDaysAhead }),
    ])
    await supabase.from('delivery_slots').delete().gte('date', todayStr)
    for (let i = 0; i < daysAhead; i++) {
      const d = addDays(new Date(), i)
      if (slotsClosedDays.includes(d.getDay().toString())) continue
      const dateStr = d.toISOString().split('T')[0]
      const rows: { date: string; time_start: string; time_end: string; capacity: number; booked: number; blocked: boolean }[] = []
      let cur = toMin(slotsStart)
      const end = toMin(slotsEnd)
      while (cur + duration <= end) {
        const next = cur + duration
        if (!(ps !== null && pe !== null && cur < pe && next > ps)) {
          rows.push({ date: dateStr, time_start: toTime(cur), time_end: toTime(next), capacity, booked: 0, blocked: false })
        }
        cur = next
      }
      if (rows.length > 0) await supabase.from('delivery_slots').insert(rows)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 5000)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 12px', boxSizing: 'border-box' as const }}>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 900, color: '#F5EDD6', marginBottom: 20 }}>Créneaux</h1>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => router.push(`/admin/creneaux?tab=${t.key}`)} style={{ padding: '8px 14px', borderRadius: 50, border: '1px solid', borderColor: activeTab === t.key ? 'rgba(232,160,32,0.4)' : 'rgba(232,160,32,0.12)', background: activeTab === t.key ? 'rgba(232,160,32,0.12)' : 'transparent', color: activeTab === t.key ? '#E8A020' : '#C8B99A', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' as const }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'horaires' && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 16 }}>Horaires & durée</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Heure de début</label>
              <input type="time" value={slotsStart} onChange={e => setSlotsStart(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Heure de fin</label>
              <input type="time" value={slotsEnd} onChange={e => setSlotsEnd(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Durée (min)</label>
              <input type="number" min={15} max={240} step={15} value={slotsDuration} onChange={e => setSlotsDuration(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Capacité par défaut</label>
              <input type="number" min={1} value={slotsCapacity} onChange={e => setSlotsCapacity(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pause' && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 4 }}>Pause déjeuner</div>
          <div style={{ fontSize: 12, color: '#C8B99A', marginBottom: 16, fontFamily: 'DM Sans, sans-serif' }}>Laisser vide = pas de pause</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Début pause</label>
              <input type="time" value={slotsPauseStart} onChange={e => setSlotsPauseStart(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Fin pause</label>
              <input type="time" value={slotsPauseEnd} onChange={e => setSlotsPauseEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fermeture' && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 16 }}>Jours de fermeture</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {DAYS.map(({ label, value }) => {
              const closed = slotsClosedDays.includes(value)
              return (
                <button key={value} onClick={() => toggleClosedDay(value)} style={{ padding: '8px 16px', borderRadius: 50, border: '1px solid', borderColor: closed ? 'rgba(255,107,107,0.4)' : 'rgba(232,160,32,0.15)', background: closed ? 'rgba(255,107,107,0.12)' : 'transparent', color: closed ? '#FF6B6B' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'generation' && (
        <div style={{ ...sectionStyle, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 16 }}>Génération</div>
          <label style={labelStyle}>Jours à générer en avance</label>
          <input type="number" min={1} max={90} value={slotsDaysAhead} onChange={e => setSlotsDaysAhead(e.target.value)} style={inputStyle} />
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', border: 'none', borderRadius: 50, fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.8 : 1 }}>
          {saving ? `${SPINNER_CHARS[spinIdx]}  Enregistrement en cours...` : 'Enregistrer'}
        </button>
        {saved && (
          <div style={{ marginTop: 12, background: 'rgba(91,197,122,0.08)', border: '1px solid rgba(91,197,122,0.25)', borderRadius: 12, padding: '14px 18px', textAlign: 'center', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#5BC57A' }}>
            Configuration enregistrée et créneaux régénérés ✓
          </div>
        )}
      </div>
    </div>
  )
}

export default function CreneauxAdmin() {
  return (
    <Suspense fallback={<div style={{ color: '#C8B99A', padding: 40 }}>Chargement...</div>}>
      <CreneauxContent />
    </Suspense>
  )
}
