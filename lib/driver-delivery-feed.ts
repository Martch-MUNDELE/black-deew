// BLAC-P3-054 : fil des courses terminees (livreurs liberes) pour le tableau de bord admin.
// Fonction pure : aucune lecture de base ici.

export type DeliveryFeedRow = {
  order_id?: string | null
  driver_id?: string | null
  status?: string | null
  delivered_at?: string | null
  amount_collected?: number | string | null
}

export type DeliveryFeedDriver = {
  id: string
  full_name?: string | null
}

export type DeliveryFeedItem = {
  order_id: string
  driver_name: string
  delivered_at: string
  amount_collected: number
  minutes_ago: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export function buildDeliveryFeed(
  rows: DeliveryFeedRow[] | null | undefined,
  drivers: DeliveryFeedDriver[] | null | undefined,
  now: Date | number = Date.now()
): DeliveryFeedItem[] {
  const nowMs = now instanceof Date ? now.getTime() : Number(now)
  const names = new Map<string, string>()
  for (const d of drivers || []) {
    if (d && d.id) names.set(String(d.id), (d.full_name || '').trim())
  }

  const out: (DeliveryFeedItem & { _ts: number })[] = []
  for (const r of rows || []) {
    if (!r || r.status !== 'delivered' || !r.delivered_at) continue
    const ts = new Date(r.delivered_at).getTime()
    if (!Number.isFinite(ts)) continue
    const age = nowMs - ts
    if (age > DAY_MS) continue
    out.push({
      order_id: String(r.order_id ?? ''),
      driver_name: (r.driver_id && names.get(String(r.driver_id))) || 'Livreur',
      delivered_at: r.delivered_at,
      amount_collected: Number(r.amount_collected) || 0,
      minutes_ago: Math.max(0, Math.floor(age / 60000)),
      _ts: ts,
    })
  }
  out.sort((a, b) => b._ts - a._ts)
  return out.map(({ _ts, ...item }) => item)
}
