'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Slot = {
  id: string
  date: string
  time_start: string
  time_end: string
  capacity: number
  booked: number
  blocked: boolean
}

export default function SlotPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const [groups, setGroups] = useState<{ date: string; slots: Slot[] }[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
      const { data } = await supabase
        .from('delivery_slots')
        .select('*')
        .gte('date', today)
        .eq('blocked', false)
        .order('date')
        .order('time_start')

      if (data) {
        const available = data.filter((s: Slot) => {
          if (s.booked >= s.capacity) return false
          if (s.date === today) {
            const [h, m] = s.time_end.split(':').map(Number)
            return (h * 60 + m) > nowMins
          }
          return true
        })
        const map = new Map<string, Slot[]>()
        for (const s of available) {
          if (!map.has(s.date)) map.set(s.date, [])
          map.get(s.date)!.push(s)
        }
        const result = Array.from(map.entries()).map(([date, slots]) => ({ date, slots }))
        setGroups(result)
        if (result.length > 0) setSelectedDate(result[0].date)
      }
      setLoading(false)
    }
    load()
  }, [])

  const daySlots = groups.find(g => g.date === selectedDate)?.slots ?? []

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return {
      day: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
      num: date.toLocaleDateString('fr-FR', { day: 'numeric' }),
      month: date.toLocaleDateString('fr-FR', { month: 'short' }),
      isToday: d === new Date().toISOString().split('T')[0],
    }
  }

  const getStatus = (slot: Slot) => {
    const remaining = slot.capacity - slot.booked
    const ratio = slot.booked / slot.capacity
    if (ratio >= 0.7) return { label: `${remaining} place${remaining > 1 ? 's' : ''}`, color: '#FF6B20', bg: 'rgba(255,107,32,0.1)', bar: '#FF6B20' }
    return { label: `${remaining} place${remaining > 1 ? 's' : ''}`, color: '#F5C842', bg: 'rgba(245,200,66,0.06)', bar: '#F5C842' }
  }

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: '#C8B99A', fontSize: 13 }}>
      Chargement des disponibilités...
    </div>
  )

  if (groups.length === 0) return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
      <div style={{ color: '#C8B99A', fontSize: 14 }}>Aucun créneau disponible</div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '0.8px', textTransform: 'uppercase' as const, marginBottom: 12 }}>Choisir un jour</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' as const, paddingBottom: 4 }}>
          {groups.map(({ date }) => {
            const { day, num, month, isToday } = formatDate(date)
            const isSelected = date === selectedDate
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  flexShrink: 0,
                  padding: '10px 14px',
                  borderRadius: 14,
                  border: isSelected ? 'none' : '1.5px solid rgba(232,160,32,0.15)',
                  background: isSelected ? 'linear-gradient(135deg,#F5C842,#FF6B20)' : 'rgba(255,255,255,0.03)',
                  color: isSelected ? '#0A0804' : '#C8B890',
                  cursor: 'pointer',
                  textAlign: 'center' as const,
                  minWidth: 64,
                  boxShadow: isSelected ? '0 4px 16px rgba(232,160,32,0.3)' : 'none',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 3, opacity: 0.8 }}>
                  {isToday ? 'Auj.' : day}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, fontFamily: 'DM Sans, sans-serif' }}>{num}</div>
                <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8, textTransform: 'capitalize' as const }}>{month}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '0.8px', textTransform: 'uppercase' as const, marginBottom: 12 }}>Choisir un horaire</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {daySlots.map(slot => {
            const status = getStatus(slot)
            const isSelected = selectedSlot === slot.id
            const ratio = slot.booked / slot.capacity
            return (
              <button
                key={slot.id}
                onClick={() => { setSelectedSlot(slot.id); onSelect(slot.id) }}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: isSelected ? '2px solid #F5C842' : '1.5px solid rgba(232,160,32,0.1)',
                  background: isSelected ? 'rgba(245,200,66,0.08)' : status.bg,
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isSelected ? '#F5C842' : 'rgba(232,160,32,0.2)'}`, background: isSelected ? '#F5C842' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0A0804' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 16, color: isSelected ? '#F5C842' : '#F5EDD6', marginBottom: 6, letterSpacing: '-0.3px' }}>
                    {slot.time_start.slice(0, 5)} — {slot.time_end.slice(0, 5)}
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${ratio * 100}%`, background: status.bar, borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: status.color }}>{status.label}</div>
                  <div style={{ fontSize: 10, color: '#C8B99A', marginTop: 2 }}>disponible</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
