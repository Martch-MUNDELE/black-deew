'use client'
// BLAC-P3-054 : bloc "Livreurs liberes" - courses terminees dans les dernieres 24 h.
// Lecture seule, rafraichi toutes les 30 secondes.
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildDeliveryFeed, type DeliveryFeedItem } from '@/lib/driver-delivery-feed'

const REFRESH_MS = 30000
const DAY_MS = 24 * 60 * 60 * 1000

export default function DriverDeliveryIndicator({ currency = '' }: { currency?: string }) {
  const [feed, setFeed] = useState<DeliveryFeedItem[]>([])

  const load = useCallback(async (supabase: ReturnType<typeof createClient>) => {
    try {
      const since = new Date(Date.now() - DAY_MS).toISOString()
      const { data: rows } = await supabase
        .from('order_deliveries')
        .select('order_id, driver_id, status, delivered_at, amount_collected')
        .eq('status', 'delivered')
        .gte('delivered_at', since)
      const { data: drivers } = await supabase.from('delivery_drivers').select('id, full_name')
      setFeed(buildDeliveryFeed(rows || [], drivers || [], Date.now()))
    } catch (e) {
      console.error('[DriverDeliveryIndicator] lecture impossible', e)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    load(supabase)
    const interval = setInterval(() => load(supabase), REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div
      data-testid="driver-delivery-indicator"
      style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: 16, marginBottom: 16 }}
    >
      <div style={{ fontSize: 11, color: '#8A7A60', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
        Livreurs libérés
      </div>
      {feed.length === 0 ? (
        <div style={{ fontSize: 13, color: '#7A6E58' }}>Aucune course terminée récemment</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {feed.map((f) => (
            <div key={f.order_id + f.delivered_at} style={{ fontSize: 13, color: '#C8B99A' }}>
              {f.driver_name} a terminé sa course (il y a {f.minutes_ago} min) – {f.amount_collected.toFixed(0)} {currency}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
