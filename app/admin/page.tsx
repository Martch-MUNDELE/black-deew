'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isBusinessActiveOrder } from '@/lib/order-status'
import { useCurrency } from '@/lib/currency'
import type { Order } from '@/lib/types'

function timeAgo(dateStr: string, nowMs: number): string {
  const mins = Math.floor((nowMs - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return "a l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `il y a ${hrs}h`
  return `il y a ${Math.floor(hrs / 24)}j`
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  nouvelle:       { label: 'Nouvelle',    color: '#E8A020', bg: 'rgba(232,160,32,0.15)' },
  confirmée:      { label: 'Confirmée',   color: '#5BC57A', bg: 'rgba(91,197,122,0.15)' },
  en_preparation: { label: 'Preparation', color: '#FF6B20', bg: 'rgba(255,107,32,0.15)' },
  en_livraison:   { label: 'Livraison',   color: '#38B6FF', bg: 'rgba(56,182,255,0.15)' },
  livrée:         { label: 'Livrée',      color: '#C8B99A', bg: 'rgba(200,185,154,0.15)' },
  annulée:        { label: 'Annulée',     color: '#FF6B6B', bg: 'rgba(255,107,107,0.15)' },
}

const PIPELINE = ['nouvelle', 'confirmée', 'en_preparation', 'en_livraison'] as const
const DAY_MS = 86400000

type OrderItemLite = {
  is_vip?: boolean | null
  unit_price?: number | null
  quantity?: number | null
}

type OrderWithItems = Omit<Order, 'order_items'> & {
  order_items?: OrderItemLite[]
}

function isVipOrder(o: OrderWithItems): boolean {
  return !!(o.order_items?.some(i => i.is_vip === true))
}


function KpiCardCA({ label, total, classic, vip, mixed, trend, trendVal, trendLabel, currency }: {
  label: string; total: number; classic: number; vip: number; mixed?: number; trend?: string; trendVal?: number; trendLabel?: string; currency: string
}) {
  return (
    <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#8A7A60', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 8, whiteSpace: 'pre-line' as const }}>{label}</div>
      <div style={{ fontSize: 26, fontFamily: 'Playfair Display, serif', fontWeight: 800, color: '#F5C842', lineHeight: 1, marginBottom: 8 }}>
        {total.toFixed(0)} <span style={{fontSize:13,fontWeight:400,color:'#7A6E58'}}>{currency}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#E8A020', background: 'rgba(245,200,66,0.1)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
          Cl. {classic.toFixed(0)}
        </span>
        <span style={{ fontSize: 10, color: '#FF6EB4', background: 'rgba(255,110,180,0.1)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
          VIP {vip.toFixed(0)}
        </span>
        <span style={{ fontSize: 10, color: '#A078FF', background: 'rgba(150,100,255,0.1)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>Mix {(mixed??0).toFixed(0)}</span>
      </div>
      {trend && (
        <div style={{ fontSize: 11, color: trend === 'up' ? '#5BC57A' : '#FF6B6B', marginTop: 4, display: 'flex', gap: 3 }}>
          <span>{trend === 'up' ? '▲' : '▼'}</span>
          <span>{trendLabel || 'vs hier'} ({trendVal !== undefined ? trendVal.toFixed(0) : '—'} {currency})</span>
        </div>
      )}
    </div>
  )
}

function KpiCardOrders({ label, total, classic, vip, mixed, trend, sub }: {
  label: string; total: number; classic: number; vip: number; mixed?: number; trend?: string; sub?: string
}) {
  return (
    <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#8A7A60', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 8, whiteSpace: 'pre-line' as const }}>{label}</div>
      <div style={{ fontSize: 26, fontFamily: 'Playfair Display, serif', fontWeight: 800, color: '#F5C842', lineHeight: 1, marginBottom: 8 }}>
        {total}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: 10, color: '#E8A020', background: 'rgba(245,200,66,0.1)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>Cl. {classic}</span>
        <span style={{ fontSize: 10, color: '#FF6EB4', background: 'rgba(255,110,180,0.1)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>VIP {vip}</span>
        <span style={{ fontSize: 10, color: '#A078FF', background: 'rgba(150,100,255,0.1)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>Mix {mixed ?? 0}</span>
      </div>
      <div style={{ fontSize: 11, color: trend === 'up' ? '#5BC57A' : trend === 'down' ? '#FF6B6B' : '#8A7A60', marginTop: 6, display: 'flex', gap: 3 }}>
        {trend && <span>{trend === 'up' ? '▲' : '▼'}</span>}
        <span>{sub || 'vs hier'}</span>
      </div>
    </div>
  )
}

function KpiCard({ label, value, valueColor, trend, sub }: {
  label: string; value: string; valueColor: string; trend?: string; sub: string
}) {
  return (
    <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#8A7A60', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 8, whiteSpace: 'pre-line' as const }}>{label}</div>
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
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredSerie, setHoveredSerie] = useState<{day:number;serie:string}|null>(null)
  const [hoveredWeek, setHoveredWeek] = useState<{week:number;serie:string}|null>(null)
  const [hoveredDay30, setHoveredDay30] = useState<number|null>(null)
  const [toast, setToast] = useState<{name:string;total:number}|null>(null)
  const currency = useCurrency()
  const toastTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const prevOrderIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)
  const [dashboardNow] = useState(() => new Date())

  const fetchOrders = useCallback(async (supabase: ReturnType<typeof createClient>) => {
    const since = new Date(Date.now() - 30*86400000).toISOString()
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    const fetched: OrderWithItems[] = (data || []) as OrderWithItems[]
    if (!isFirstLoad.current) {
      const newOnes = fetched.filter(o => !prevOrderIds.current.has(o.id))
      if (newOnes.length > 0) {
        const latest = newOnes[0]
        if (toastTimer.current) clearTimeout(toastTimer.current)
        setToast({ name: latest.customer_name, total: latest.total || 0 })
        toastTimer.current = setTimeout(() => setToast(null), 8000)
      }
    }
    prevOrderIds.current = new Set(fetched.map(o => o.id))
    isFirstLoad.current = false
    setOrders(fetched)
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    fetchOrders(supabase)
    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders(supabase))
      .subscribe()
    const interval = setInterval(() => fetchOrders(supabase), 30000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [fetchOrders])

  const today     = dashboardNow.toISOString().slice(0,10)
  const yesterday = new Date(dashboardNow.getTime() - DAY_MS).toISOString().slice(0,10)

  const businessOrders = orders.filter(isBusinessActiveOrder)
  const deliveredBusinessOrders = businessOrders.filter(o => o.status === 'livrée')
  const todayO = deliveredBusinessOrders.filter(o => o.created_at.slice(0,10) === today)
  const yestO  = deliveredBusinessOrders.filter(o => o.created_at.slice(0,10) === yesterday)

  const caToday = todayO.reduce((s,o) => s+(o.total||0), 0)
  const caYest  = yestO.reduce((s,o) => s+(o.total||0), 0)

  // CA mensuel
  const currentMonth = dashboardNow.toISOString().slice(0,7) // YYYY-MM
  const monthO = deliveredBusinessOrders.filter(o => o.created_at.slice(0,7) === currentMonth)
  const caMonth = monthO.reduce((s,o) => s+(o.total||0), 0)
  const isClassicOnly = (o: OrderWithItems) => !o.order_items?.some(i => i.is_vip === true)
  const isVipOnly = (o: OrderWithItems) => o.order_items?.every(i => i.is_vip === true)
  const isMixed = (o: OrderWithItems) => !isClassicOnly(o) && !isVipOnly(o)
  const caMonthClassic = monthO.filter(isClassicOnly).reduce((s,o) => s+(o.total||0), 0)
  const caMonthVip = monthO.filter(isVipOnly).reduce((s,o) => s+(o.total||0), 0)
  const caMonthMixed = monthO.filter(isMixed).reduce((s,o) => s+(o.total||0), 0)
  const prevMonth = new Date(dashboardNow.getFullYear(), dashboardNow.getMonth()-1, 1).toISOString().slice(0,7)
  const prevMonthO = deliveredBusinessOrders.filter(o => o.created_at.slice(0,7) === prevMonth)
  const caMonthPrev = prevMonthO.reduce((s,o) => s+(o.total||0), 0)
  const monthTrend = caMonth >= caMonthPrev ? 'up' : 'down'

  const todayClassicOrders = todayO.filter(isClassicOnly)
  const todayVipOrders     = todayO.filter(isVipOnly)
  const todayMixedOrders   = todayO.filter(isMixed)

  const caClassicToday = todayClassicOrders.reduce((s,o) => s+(o.total||0), 0)
  const caVipToday     = todayVipOrders.reduce((s,o) => s+(o.total||0), 0)
  const caMixedToday   = todayMixedOrders.reduce((s,o) => s+(o.total||0), 0)

  const nouvelles  = orders.filter(o => o.status === 'nouvelle')
  const livrees    = orders.filter(o => o.status === 'livrée')
  const annulees   = orders.filter(o => o.status === 'annulée')
  const validTotal = orders.length - annulees.length
  const taux       = validTotal > 0 ? Math.round((livrees.length/validTotal)*100) : 0

  const chartData = Array.from({length:7}, (_,i) => {
    const d   = new Date(dashboardNow.getTime() - (6-i)*DAY_MS)
    const key = d.toISOString().slice(0,10)
    const dayOrders = deliveredBusinessOrders.filter(o => o.created_at.slice(0,10) === key)
    const caC = dayOrders.filter(o => !isVipOrder(o)).reduce((s,o) => s+(o.total||0), 0)
    const caV = dayOrders.filter(isVipOrder).reduce((s,o) => s+(o.total||0), 0)
    return { label: d.toLocaleDateString('fr-FR',{weekday:'short'}), classic: caC, vip: caV }
  })
  const maxCA = Math.max(...chartData.map(d => d.classic+d.vip), 1)

  const weeklyData = Array.from({length:4}, (_,i) => {
    const now = new Date(dashboardNow.getTime())
    const dow = now.getDay() || 7
    const weekStart = new Date(dashboardNow.getTime() - (3-i)*7*DAY_MS - (dow-1)*DAY_MS)
    weekStart.setHours(0,0,0,0)
    const weekEnd = new Date(weekStart.getTime() + 7*DAY_MS)
    const wo = deliveredBusinessOrders.filter(o => { const d=new Date(o.created_at); return d>=weekStart && d<weekEnd })
    const caC = wo.filter(o => !isVipOrder(o)).reduce((s,o)=>s+(o.total||0),0)
    const caV = wo.filter(isVipOrder).reduce((s,o)=>s+(o.total||0),0)
    const label = i===3 ? 'S act.' : 'S-'+(3-i)
    return { label, classic: caC, vip: caV }
  })
  const maxWeekCA = Math.max(...weeklyData.map(d=>d.classic+d.vip),1)
  const dailyData30 = Array.from({length:30}, (_,i) => {
    const d = new Date(dashboardNow.getTime() - (29-i)*DAY_MS)
    const key = d.toISOString().slice(0,10)
    const cnt = orders.filter(o=>o.created_at.slice(0,10)===key).length
    const dn = d.getDate()
    const isFirst = dn===1 || i===0
    const label = isFirst ? d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : String(dn)
    return { label, count: cnt, date: key, showLabel: isFirst||i===29||i===14 }
  })
  const maxDay30 = Math.max(...dailyData30.map(d=>d.count),1)
  const recent = orders.slice(0,8)
  const SLOT_W=40; const BASE_Y=90; const MAX_H=78; const BAR_W=11

  if (loading) {
    return (
      <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:300,color:'#8A7A60',fontSize:14,fontFamily:'DM Sans, sans-serif'}}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{fontFamily:'DM Sans, sans-serif'}}>
      <style>{`
        @keyframes pulse-urgent{0%,100%{opacity:1}50%{opacity:0.72}}
        @keyframes slide-in-toast{from{transform:translateY(-80px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>

      {toast && (
        <div style={{position:'fixed',top:64,left:'50%',transform:'translateX(-50%)',zIndex:200,background:'linear-gradient(135deg,#1A1408,#231C0A)',border:'1px solid rgba(245,200,66,0.5)',borderRadius:14,padding:'12px 18px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 8px 32px rgba(0,0,0,0.5)',animation:'slide-in-toast 0.35s cubic-bezier(0.34,1.56,0.64,1)',minWidth:260,maxWidth:'calc(100vw - 32px)'}}>
          <div style={{fontSize:20}}>🛎️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,color:'#F5C842',fontWeight:700,marginBottom:2}}>Nouvelle commande !</div>
            <div style={{fontSize:13,color:'#F5EDD6',fontWeight:600}}>{toast.name} — {toast.total.toFixed(0)} {currency}</div>
          </div>
          <button onClick={() => setToast(null)} style={{background:'none',border:'none',color:'#7A6E58',cursor:'pointer',fontSize:16,padding:4,lineHeight:1}}>✕</button>
        </div>
      )}

      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:'Playfair Display, serif',fontSize:28,fontWeight:800,color:'#F5EDD6',margin:'0 0 4px',letterSpacing:'-0.5px'}}>Dashboard</h1>
        <p style={{color:'#8A7A60',fontSize:13,margin:0}}>{dashboardNow.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
      </div>

      {nouvelles.length > 0 && (
        <div style={{background:'rgba(255,107,32,0.15)',border:'1px solid rgba(255,107,32,0.45)',borderRadius:12,padding:'12px 16px',marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center',animation:'pulse-urgent 2.2s ease-in-out infinite'}}>
          <span style={{color:'#FF8C50',fontWeight:600,fontSize:14}}>⚡ {nouvelles.length} commande{nouvelles.length>1?'s':''} en attente de confirmation</span>
          <a href="/admin/commandes" style={{color:'#FF6B20',fontWeight:700,fontSize:13,textDecoration:'none',border:'1px solid rgba(255,107,32,0.5)',borderRadius:8,padding:'5px 12px'}}>Traiter →</a>
        </div>
      )}

      {/* CA Mensuel */}
      <div style={{ marginBottom: 12 }}>
      <KpiCardCA
        label="CA ce mois"
        total={caMonth}
        classic={caMonthClassic}
        vip={caMonthVip}
        mixed={caMonthMixed}
        trend={monthTrend}
        trendVal={caMonthPrev}
        trendLabel="vs mois préc."
        currency={currency}
      />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
        <KpiCardCA
          label={"CA\nAUJOURD'HUI"}
          total={caToday}
          classic={caClassicToday}
          vip={caVipToday}
          mixed={caMixedToday}
          trend={caToday >= caYest ? 'up' : 'down'}
          trendVal={caYest}
          currency={currency}
        />
        <KpiCardOrders
          label={"COMMANDES\nAUJOURD'HUI"}
          total={todayO.length}
          classic={todayClassicOrders.length}
          vip={todayVipOrders.length}
          mixed={todayMixedOrders.length}
          trend={todayO.length >= yestO.length ? 'up' : 'down'}
          sub={'vs ' + yestO.length + ' hier'}
        />
        <KpiCard label="En attente" value={String(nouvelles.length)} valueColor="#FF6B20" sub="a confirmer" />
        <KpiCard label="Taux livraison" value={taux+'%'} valueColor="#5BC57A" sub={livrees.length+' livrees / '+validTotal+' total'} />
      </div>

      <div style={{marginBottom:24}}>
        <h2 style={{fontFamily:'Playfair Display, serif',fontSize:18,fontWeight:700,color:'#F5EDD6',margin:'0 0 14px',letterSpacing:'-0.3px'}}>En cours</h2>
        <div style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:8}}>
          {PIPELINE.map(status => {
            const cfg = STATUS[status]
            const col = businessOrders.filter(o => o.status === status)
            if (col.length === 0) return null
            return (
              <div key={status} style={{minWidth:188,flex:'0 0 188px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(232,160,32,0.07)',borderRadius:12,padding:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:cfg.color}}>{cfg.label}</span>
                  <span style={{fontSize:11,fontWeight:700,background:cfg.bg,color:cfg.color,borderRadius:20,padding:'2px 8px'}}>{col.length}</span>
                </div>
                {col.length === 0 ? (
                  <div style={{fontSize:11,color:'#3A3020',textAlign:'center' as const,padding:'14px 0'}}>Vide</div>
                ) : col.slice(0,5).map(o => {
                  const hasVip = isVipOrder(o as OrderWithItems)
                  return (
                    <a key={o.id} href={'/admin/commandes?tab='+o.status+'&highlight='+o.id} style={{display:'block',background:'#131009',borderRadius:8,padding:'8px 10px',marginBottom:6,textDecoration:'none',border:'1px solid rgba(232,160,32,0.07)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:600,color:'#F5EDD6',whiteSpace:'nowrap' as const,overflow:'hidden',textOverflow:'ellipsis',maxWidth:100}}>{o.customer_name}</span>
                        {hasVip && <span style={{fontSize:9,fontWeight:700,color:'#FF6EB4',background:'rgba(255,110,180,0.15)',borderRadius:4,padding:'1px 5px',flexShrink:0}}>VIP</span>}
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:11,color:'#F5C842',fontWeight:600}}>{(o.total||0).toFixed(0)} {currency}</span>
                        <span style={{fontSize:10,color:'#6A5A40'}}>{timeAgo(o.created_at, dashboardNow.getTime())}</span>
                      </div>
                    </a>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{background:'#131009',border:'1px solid rgba(232,160,32,0.08)',borderRadius:16,padding:'20px 20px 14px',marginBottom:24}}>
        <h2 style={{fontFamily:'Playfair Display, serif',fontSize:16,fontWeight:700,color:'#F5EDD6',margin:'0 0 8px',letterSpacing:'-0.3px'}}>
          {'Chiffre d’affaires - 7 derniers jours'}
        </h2>
        <div style={{display:'flex',gap:16,marginBottom:14}}>
          <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#F5C842'}}>
            <span style={{width:10,height:10,borderRadius:2,background:'#F5C842',display:'inline-block'}}></span>Classique
          </span>
          <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#FF6EB4'}}>
            <span style={{width:10,height:10,borderRadius:2,background:'#FF6EB4',display:'inline-block'}}></span>VIP
          </span>
        </div>
        <svg viewBox="0 0 280 118" style={{width:'100%',height:'auto',display:'block',overflow:'visible'}}>
          {chartData.map((d,i) => {
            const xSlot   = i*SLOT_W
            const xCenter = xSlot+SLOT_W/2
            const hC = d.classic>0 ? Math.max((d.classic/maxCA)*MAX_H,2) : 0
            const hV = d.vip>0 ? Math.max((d.vip/maxCA)*MAX_H,2) : 0
            const xC = xSlot+(SLOT_W-BAR_W*2-2)/2
            const xV = xC+BAR_W+2
            const isHovC = hoveredSerie?.day===i && hoveredSerie?.serie==='classic'
            const isHovV = hoveredSerie?.day===i && hoveredSerie?.serie==='vip'
            return (
              <g key={i}>
                <rect x={xC} y={12} width={BAR_W} height={MAX_H} rx={3} fill="rgba(245,200,66,0.08)" />
                <rect x={xV} y={12} width={BAR_W} height={MAX_H} rx={3} fill="rgba(255,110,180,0.08)" />
                {hC>0 && <rect x={xC} y={BASE_Y-hC} width={BAR_W} height={hC} rx={3} fill={isHovC?'#FFD76A':'#F5C842'}
                  onMouseEnter={()=>setHoveredSerie({day:i,serie:'classic'})} onMouseLeave={()=>setHoveredSerie(null)} style={{cursor:'default'}} />}
                {hV>0 && <rect x={xV} y={BASE_Y-hV} width={BAR_W} height={hV} rx={3} fill={isHovV?'#FFB0D8':'#FF6EB4'}
                  onMouseEnter={()=>setHoveredSerie({day:i,serie:'vip'})} onMouseLeave={()=>setHoveredSerie(null)} style={{cursor:'default'}} />}
                <text x={xCenter} y={106} textAnchor="middle" fill="#6A5A40" fontSize="9.5" fontFamily="DM Sans, sans-serif">{d.label}</text>
                {isHovC && <g>
                  <rect x={xC-8} y={BASE_Y-hC-22} width={BAR_W+16} height={18} rx={3} fill="#1F1A10" stroke="rgba(245,200,66,0.35)" strokeWidth={1}/>
                  <text x={xC+BAR_W/2} y={BASE_Y-hC-10} textAnchor="middle" fill="#F5C842" fontSize="9" fontFamily="DM Sans, sans-serif" fontWeight="700">{d.classic.toFixed(0)}</text>
                </g>}
                {isHovV && <g>
                  <rect x={xV-8} y={BASE_Y-hV-22} width={BAR_W+16} height={18} rx={3} fill="#1F1A10" stroke="rgba(255,110,180,0.35)" strokeWidth={1}/>
                  <text x={xV+BAR_W/2} y={BASE_Y-hV-10} textAnchor="middle" fill="#FF6EB4" fontSize="9" fontFamily="DM Sans, sans-serif" fontWeight="700">{d.vip.toFixed(0)}</text>
                </g>}
              </g>
            )
          })}
        </svg>
      </div>

      <div style={{background:'#131009',border:'1px solid rgba(232,160,32,0.08)',borderRadius:16,padding:'20px 20px 14px',marginBottom:24}}>
        <h2 style={{fontFamily:'Playfair Display, serif',fontSize:16,fontWeight:700,color:'#F5EDD6',margin:'0 0 8px',letterSpacing:'-0.3px'}}>CA par semaine — 4 dernières semaines</h2>
        <div style={{display:'flex',gap:16,marginBottom:14}}>
          <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#F5C842'}}><span style={{width:10,height:10,borderRadius:2,background:'#F5C842',display:'inline-block'}}></span>Classique</span>
          <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#FF6EB4'}}><span style={{width:10,height:10,borderRadius:2,background:'#FF6EB4',display:'inline-block'}}></span>VIP</span>
        </div>
        <svg viewBox="0 0 280 118" style={{width:'100%',height:'auto',display:'block',overflow:'visible'}}>
          {weeklyData.map((d,i) => {
            const WSLOT=64,WBAR=16,WBY=90,WMH=72
            const xSlot=i*WSLOT+8
            const hC=d.classic>0?Math.max((d.classic/maxWeekCA)*WMH,2):0
            const hV=d.vip>0?Math.max((d.vip/maxWeekCA)*WMH,2):0
            const xC=xSlot,xV=xSlot+WBAR+4
            const isHovC=hoveredWeek?.week===i&&hoveredWeek?.serie==='classic'
            const isHovV=hoveredWeek?.week===i&&hoveredWeek?.serie==='vip'
            return (
              <g key={i}>
                <rect x={xC} y={12} width={WBAR} height={WMH} rx={3} fill="rgba(245,200,66,0.06)"/>
                <rect x={xV} y={12} width={WBAR} height={WMH} rx={3} fill="rgba(255,110,180,0.06)"/>
                {hC>0&&<rect x={xC} y={WBY-hC} width={WBAR} height={hC} rx={3} fill={isHovC?'#FFD76A':'#F5C842'} onMouseEnter={()=>setHoveredWeek({week:i,serie:'classic'})} onMouseLeave={()=>setHoveredWeek(null)} style={{cursor:'default'}}/>}
                {hV>0&&<rect x={xV} y={WBY-hV} width={WBAR} height={hV} rx={3} fill={isHovV?'#FFB0D8':'#FF6EB4'} onMouseEnter={()=>setHoveredWeek({week:i,serie:'vip'})} onMouseLeave={()=>setHoveredWeek(null)} style={{cursor:'default'}}/>}
                <text x={xC+WBAR} y={106} textAnchor="middle" fill="#6A5A40" fontSize="10" fontFamily="DM Sans, sans-serif">{d.label}</text>
                {isHovC&&hC>0&&<g><rect x={xC-4} y={WBY-hC-22} width={WBAR+8} height={18} rx={3} fill="#1F1A10" stroke="rgba(245,200,66,0.35)" strokeWidth={1}/><text x={xC+WBAR/2} y={WBY-hC-10} textAnchor="middle" fill="#F5C842" fontSize="9" fontFamily="DM Sans, sans-serif" fontWeight="700">{d.classic.toFixed(0)}</text></g>}
                {isHovV&&hV>0&&<g><rect x={xV-4} y={WBY-hV-22} width={WBAR+8} height={18} rx={3} fill="#1F1A10" stroke="rgba(255,110,180,0.35)" strokeWidth={1}/><text x={xV+WBAR/2} y={WBY-hV-10} textAnchor="middle" fill="#FF6EB4" fontSize="9" fontFamily="DM Sans, sans-serif" fontWeight="700">{d.vip.toFixed(0)}</text></g>}
              </g>
            )
          })}
        </svg>
      </div>
      <div style={{background:'#131009',border:'1px solid rgba(232,160,32,0.08)',borderRadius:16,padding:'20px 20px 14px',marginBottom:24}}>
        <h2 style={{fontFamily:'Playfair Display, serif',fontSize:16,fontWeight:700,color:'#F5EDD6',margin:'0 0 4px',letterSpacing:'-0.3px'}}>Commandes par jour — 30 derniers jours</h2>
        <p style={{fontSize:11,color:'#8A7A60',margin:'0 0 14px'}}>Total : {dailyData30.reduce((s,d)=>s+d.count,0)} commandes</p>
        <svg viewBox="0 0 320 100" style={{width:'100%',height:'auto',display:'block',overflow:'visible'}}>
          {dailyData30.map((d,i) => {
            const DSLOT=10,DBY=78,DMHGT=60,DBAR=7
            const x=i*DSLOT+1
            const h=d.count>0?Math.max((d.count/maxDay30)*DMHGT,2):0
            const isHov=hoveredDay30===i
            return (
              <g key={i}>
                <rect x={x} y={8} width={DBAR} height={DMHGT} rx={2} fill="rgba(255,107,32,0.08)"/>
                {h>0&&<rect x={x} y={DBY-h} width={DBAR} height={h} rx={2} fill={isHov?'#FF8C45':'#FF6B20'} onMouseEnter={()=>setHoveredDay30(i)} onMouseLeave={()=>setHoveredDay30(null)} style={{cursor:'default'}}/>}
                {d.showLabel&&<text x={x+DBAR/2} y={94} textAnchor="middle" fill="#6A5A40" fontSize="7.5" fontFamily="DM Sans, sans-serif">{d.label}</text>}
                {isHov&&h>0&&<g><rect x={x-6} y={DBY-h-20} width={DBAR+12} height={16} rx={3} fill="#1F1A10" stroke="rgba(255,107,32,0.45)" strokeWidth={1}/><text x={x+DBAR/2} y={DBY-h-9} textAnchor="middle" fill="#FF6B20" fontSize="9" fontFamily="DM Sans, sans-serif" fontWeight="700">{d.count}</text></g>}
              </g>
            )
          })}
        </svg>
      </div>
      <div style={{background:'#131009',border:'1px solid rgba(232,160,32,0.08)',borderRadius:16,overflow:'hidden'}}>
        <div style={{padding:'16px 20px 12px',borderBottom:'1px solid rgba(232,160,32,0.06)'}}>
          <span style={{fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:16,color:'#F5EDD6'}}>Activite recente</span>
        </div>
        {recent.length === 0 ? (
          <div style={{padding:'32px 20px',textAlign:'center' as const,color:'#8A7A60',fontSize:13}}>Aucune commande recente</div>
        ) : recent.map((o,i) => {
          const cfg = STATUS[o.status] || STATUS.nouvelle
          const hasVip = isVipOrder(o as OrderWithItems)
          return (
            <div key={o.id} style={{padding:'12px 20px',borderBottom:i<recent.length-1?'1px solid rgba(232,160,32,0.05)':'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                  <span style={{fontWeight:600,fontSize:13,color:'#F5EDD6',whiteSpace:'nowrap' as const,overflow:'hidden',textOverflow:'ellipsis'}}>{o.customer_name}</span>
                  {hasVip && <span style={{fontSize:9,fontWeight:700,color:'#FF6EB4',background:'rgba(255,110,180,0.15)',borderRadius:4,padding:'1px 5px',flexShrink:0}}>VIP</span>}
                </div>
                <div style={{fontSize:11,color:'#6A5A40'}}>{new Date(o.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                <span style={{fontSize:13,fontWeight:700,color:'#F5C842',fontFamily:'Playfair Display, serif'}}>{(o.total||0).toFixed(0)} {currency}</span>
                <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20,background:cfg.bg,color:cfg.color,textTransform:'uppercase' as const,letterSpacing:'0.4px',whiteSpace:'nowrap' as const}}>{cfg.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
