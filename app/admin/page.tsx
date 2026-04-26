'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `il y a ${hrs}h`
  return `il y a ${Math.floor(hrs / 24)}j`
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  nouvelle:       { label: 'Nouvelle',    color: '#E8A020', bg: 'rgba(232,160,32,0.15)' },
  confirmée:      { label: 'Confirmée',   color: '#5BC57A', bg: 'rgba(91,197,122,0.15)' },
  en_preparation: { label: 'Préparation', color: '#FF6B20', bg: 'rgba(255,107,32,0.15)' },
  en_livraison:   { label: 'Livraison',   color: '#38B6FF', bg: 'rgba(56,182,255,0.15)' },
  livrée:         { label: 'Livrée',      color: '#C8B99A', bg: 'rgba(200,185,154,0.15)' },
  annulée:        { label: 'Annulée',     color: '#FF6B6B', bg: 'rgba(255,107,107,0.15)' },
}

const PIPELINE = ['nouvelle', 'confirmée', 'en_preparation', 'en_livraison'] as const

function KpiCard({ label, value, valueColor, trend, sub }: {
  label: string
  value: string
  valueColor: string
  trend?: 'up' | 'down'
  sub: string
}) {
  return (
    <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#8A7A60', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontFamily: 'Playfair Display, serif', fontWeight: 800, color: valueColor, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: trend === 'up' ? '#5BC57A' : trend === 'down' ? '#FF6B6B' : '#8A7A60', display: 'flex', alignItems: 'center', gap: 4 }}>
        {trend && <span style={{ fontSize: 10 }}>{trend === 'up' ? '▲' : '▼'}</span>}
        <span>{sub}</span>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const [toast, setToast] = useState<{ name: string; total: number } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevOrderIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)

  const fetchOrders = useCallback(async (supabase: ReturnType<typeof createClient>) => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    const fetched = data || []

    if (!isFirstLoad.current) {
      const newOnes = fetched.filter((o: any) => !prevOrderIds.current.has(o.id))
      if (newOnes.length > 0) {
        const latest = newOnes[0]
        if (toastTimer.current) clearTimeout(toastTimer.current)
        setToast({ name: latest.customer_name, total: latest.total || 0 })
        toastTimer.current = setTimeout(() => setToast(null), 8000)
      }
    }

    prevOrderIds.current = new Set(fetched.map((o: any) => o.id))
    isFirstLoad.current = false
    setOrders(fetched)
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    fetchOrders(supabase)

    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders(supabase)
      })
      .subscribe()

    const interval = setInterval(() => fetchOrders(supabase), 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [fetchOrders])

  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const todayO = orders.filter(o => o.created_at.slice(0, 10) === today)
  const yestO  = orders.filter(o => o.created_at.slice(0, 10) === yesterday)
  const caToday = todayO.reduce((s, o) => s + (o.total || 0), 0)
  const caYest  = yestO.reduce((s, o) => s + (o.total || 0), 0)

  const nouvelles   = orders.filter(o => o.status === 'nouvelle')
  const livrees     = orders.filter(o => o.status === 'livrée')
  const annulees    = orders.filter(o => o.status === 'annulée')
  const validTotal  = orders.length - annulees.length
  const taux        = validTotal > 0 ? Math.round((livrees.length / validTotal) * 100) : 0

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(Date.now() - (6 - i) * 86400000)
    const key = d.toISOString().slice(0, 10)
    const ca  = orders.filter(o => o.created_at.slice(0, 10) === key).reduce((s, o) => s + (o.total || 0), 0)
    return { label: d.toLocaleDateString('fr-FR', { weekday: 'short' }), total: ca }
  })
  const maxCA = Math.max(...chartData.map(d => d.total), 1)

  const recent = orders.slice(0, 8)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: '#8A7A60', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}>
        Chargement…
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <style>{`
        @keyframes pulse-urgent {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.72; }
        }
        @keyframes slide-in-toast {
          from { transform: translateY(-80px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {toast && (
        <div style={{
          position: 'fixed',
          top: 64,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          background: 'linear-gradient(135deg, #1A1408, #231C0A)',
          border: '1px solid rgba(245,200,66,0.5)',
          borderRadius: 14,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'slide-in-toast 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          minWidth: 260,
          maxWidth: 'calc(100vw - 32px)',
        }}>
          <div style={{ fontSize: 20 }}>🛎️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#F5C842', fontWeight: 700, marginBottom: 2 }}>
              Nouvelle commande !
            </div>
            <div style={{ fontSize: 13, color: '#F5EDD6', fontWeight: 600 }}>
              {toast.name} — {toast.total.toFixed(0)} DH
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: '#7A6E58', cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 800, color: '#F5EDD6', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
          Dashboard
        </h1>
        <p style={{ color: '#8A7A60', fontSize: 13, margin: 0 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Urgence banner */}
      {nouvelles.length > 0 && (
        <div style={{
          background: 'rgba(255,107,32,0.15)',
          border: '1px solid rgba(255,107,32,0.45)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'pulse-urgent 2.2s ease-in-out infinite',
        }}>
          <span style={{ color: '#FF8C50', fontWeight: 600, fontSize: 14 }}>
            ⚡ {nouvelles.length} commande{nouvelles.length > 1 ? 's' : ''} en attente de confirmation
          </span>
          <a
            href="/admin/commandes"
            style={{ color: '#FF6B20', fontWeight: 700, fontSize: 13, textDecoration: 'none', border: '1px solid rgba(255,107,32,0.5)', borderRadius: 8, padding: '5px 12px' }}
          >
            Traiter →
          </a>
        </div>
      )}

      {/* KPIs 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <KpiCard
          label="CA aujourd'hui"
          value={`${caToday.toFixed(0)} DH`}
          valueColor="#F5C842"
          trend={caToday >= caYest ? 'up' : 'down'}
          sub={`vs ${caYest.toFixed(0)} DH hier`}
        />
        <KpiCard
          label="Commandes aujourd'hui"
          value={String(todayO.length)}
          valueColor="#F5C842"
          trend={todayO.length >= yestO.length ? 'up' : 'down'}
          sub={`vs ${yestO.length} hier`}
        />
        <KpiCard
          label="En attente"
          value={String(nouvelles.length)}
          valueColor="#FF6B20"
          sub="à confirmer"
        />
        <KpiCard
          label="Taux livraison"
          value={`${taux}%`}
          valueColor="#5BC57A"
          sub={`${livrees.length} livrées / ${validTotal} total`}
        />
      </div>

      {/* Pipeline visuel */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: '#F5EDD6', margin: '0 0 14px', letterSpacing: '-0.3px' }}>
          En cours
        </h2>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {PIPELINE.map(status => {
            const cfg = STATUS[status]
            const col = orders.filter(o => o.status === status)
            return (
              <div
                key={status}
                style={{ minWidth: 188, flex: '0 0 188px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(232,160,32,0.07)', borderRadius: 12, padding: 12 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 8px' }}>
                    {col.length}
                  </span>
                </div>
                {col.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#3A3020', textAlign: 'center' as const, padding: '14px 0' }}>Vide</div>
                ) : (
                  col.slice(0, 5).map(o => (
                    <a
                      key={o.id}
                      href={`/admin/commandes?tab=${o.status}&highlight=${o.id}`}
                      style={{ display: 'block', background: '#131009', borderRadius: 8, padding: '8px 10px', marginBottom: 6, textDecoration: 'none', border: '1px solid rgba(232,160,32,0.07)' }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#F5EDD6', marginBottom: 3, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.customer_name}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#F5C842', fontWeight: 600 }}>{(o.total || 0).toFixed(0)} DH</span>
                        <span style={{ fontSize: 10, color: '#6A5A40' }}>{timeAgo(o.created_at)}</span>
                      </div>
                    </a>
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Graphique CA 7 jours */}
      <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 16, padding: '20px 20px 14px', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: '#F5EDD6', margin: '0 0 16px', letterSpacing: '-0.3px' }}>
          Chiffre d'affaires — 7 derniers jours
        </h2>
        <svg viewBox="0 0 280 118" style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
          {chartData.map((d, i) => {
            const SLOT_W  = 40
            const BAR_W   = 26
            const BASE_Y  = 90
            const MAX_H   = 78
            const xSlot   = i * SLOT_W
            const xBar    = xSlot + (SLOT_W - BAR_W) / 2
            const barH    = d.total > 0 ? Math.max((d.total / maxCA) * MAX_H, 2) : 0
            const barY    = BASE_Y - barH
            const tipY    = Math.max(barY - 26, 2)
            const xCenter = xBar + BAR_W / 2
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredBar(i)}
                onMouseLeave={() => setHoveredBar(null)}
                style={{ cursor: 'default' }}
              >
                {/* fond */}
                <rect x={xBar} y={12} width={BAR_W} height={MAX_H} rx={5} fill="rgba(245,200,66,0.08)" />
                {/* barre valeur */}
                {barH > 0 && (
                  <rect x={xBar} y={barY} width={BAR_W} height={barH} rx={5} fill={hoveredBar === i ? '#FFD76A' : '#F5C842'} />
                )}
                {/* label jour */}
                <text x={xCenter} y={106} textAnchor="middle" fill="#6A5A40" fontSize="9.5" fontFamily="DM Sans, sans-serif">
                  {d.label}
                </text>
                {/* tooltip */}
                {hoveredBar === i && (
                  <g>
                    <rect x={xBar - 10} y={tipY} width={BAR_W + 20} height={20} rx={4} fill="#1F1A10" stroke="rgba(245,200,66,0.35)" strokeWidth={1} />
                    <text x={xCenter} y={tipY + 13.5} textAnchor="middle" fill="#F5C842" fontSize="9.5" fontFamily="DM Sans, sans-serif" fontWeight="700">
                      {d.total.toFixed(0)} DH
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Activité récente */}
      <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(232,160,32,0.06)' }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 16, color: '#F5EDD6' }}>
            Activité récente
          </span>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' as const, color: '#8A7A60', fontSize: 13 }}>
            Aucune commande récente
          </div>
        ) : recent.map((o, i) => {
          const cfg = STATUS[o.status] || STATUS.nouvelle
          return (
            <div
              key={o.id}
              style={{
                padding: '12px 20px',
                borderBottom: i < recent.length - 1 ? '1px solid rgba(232,160,32,0.05)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#F5EDD6', marginBottom: 2, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {o.customer_name}
                </div>
                <div style={{ fontSize: 11, color: '#6A5A40' }}>
                  {new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F5C842', fontFamily: 'Playfair Display, serif' }}>
                  {(o.total || 0).toFixed(0)} DH
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 20,
                  background: cfg.bg,
                  color: cfg.color,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.4px',
                  whiteSpace: 'nowrap' as const,
                }}>
                  {cfg.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
