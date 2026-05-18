import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addDays } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data: settings } = await supabase.from('settings').select('*')
  const get = (key: string) => settings?.find((s: {key: string, value: string}) => s.key === key)?.value ?? ''

  const start = get('slots_start')
  const end = get('slots_end')
  const duration = parseInt(get('slots_duration')) || 30
  const capacity = parseInt(get('slots_capacity')) || 3
  const pauseStart = get('slots_pause_start')
  const pauseEnd = get('slots_pause_end')
  const closedDays: string[] = JSON.parse(get('slots_closed_days') || '[]')
  const daysAhead = parseInt(get('slots_days_ahead')) || 14

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const toTime = (n: number) => `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`

  const results: string[] = []

  for (let d = 0; d <= daysAhead; d++) {
    const targetDate = addDays(new Date(), d)
    const dateStr = targetDate.toISOString().split('T')[0]
    const dayOfWeek = targetDate.getDay().toString()

    if (closedDays.includes(dayOfWeek)) {
      results.push(`Jour fermé : ${dateStr}`)
      continue
    }

    const { data: existing } = await supabase.from('delivery_slots').select('id').eq('date', dateStr).limit(1)
    if (existing && existing.length > 0) {
      results.push(`Déjà généré : ${dateStr}`)
      continue
    }

    const rows: {date: string, time_start: string, time_end: string, capacity: number, booked: number, blocked: boolean}[] = []
    let cur = toMin(start)
    const endMin = toMin(end)
    const ps = pauseStart ? toMin(pauseStart) : null
    const pe = pauseEnd ? toMin(pauseEnd) : null

    while (cur + duration <= endMin) {
      const next = cur + duration
      if (!(ps !== null && pe !== null && cur < pe && next > ps)) {
        rows.push({ date: dateStr, time_start: toTime(cur), time_end: toTime(next), capacity, booked: 0, blocked: false })
      }
      cur = next
    }

    if (rows.length > 0) {
      await supabase.from('delivery_slots').insert(rows)
    }

    results.push(`Généré ${rows.length} créneaux pour ${dateStr}`)
  }

  return NextResponse.json({ message: results })
}
