'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { recalculatePeriod } from '@/app/actions/billing'
import { BILLING_STATUS_LABELS, type BillingPeriod, type BillingPeriodStatus } from '@/lib/types/billing'

const supabase = createClient()

const STATUS_COLORS: Record<BillingPeriodStatus, { bg: string; color: string }> = {
  en_cours: { bg: 'rgba(56,182,255,0.1)',  color: '#38B6FF' },
  cloture:  { bg: 'rgba(232,160,32,0.1)',  color: '#E8A020' },
  facture:  { bg: 'rgba(245,200,66,0.1)',  color: '#F5C842' },
  paye:     { bg: 'rgba(91,197,122,0.1)',  color: '#5BC57A' },
}

export default function PeriodesPage() {
  const [admins, setAdmins]     = useState<any[]>([])
  const [periods, setPeriods]   = useState<BillingPeriod[]>([])
  const [selected, setSelected] = useState<BillingPeriod | null>(null)
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [filterClient, setFilterClient] = useState<string>('all')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user))
    loadAll()
  }, [])

  const loadAll = async () => {
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from('admins').select('id, email, auth_user_id').eq('role', 'admin'),
      supabase.from('billing_periods').select('*').order('period_start', { ascending: false }),
    ])
    setAdmins(a || [])
    setPeriods(p || [])
  }

  const getAdminEmail = (clientId: string) =>
    admins.find(a => a.auth_user_id === clientId)?.email || clientId.slice(0, 8) + '...'

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatMAD = (n: number) =>
    `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`

  const handleRecalculate = async (period: BillingPeriod) => {
    setLoading(true)
    const result = await recalculatePeriod(period.id)
    setLoading(false)
    await loadAll()
    setMsg(result.success ? '✅ Période recalculée' : `❌ ${result.error}`)
  }

  const handleStatusChange = async (period: BillingPeriod, newStatus: BillingPeriodStatus) => {
    if (newStatus === 'cloture' && period.status === 'en_cours') {
      if (!confirm(`Clôturer la période ${formatDate(period.period_start)} → ${formatDate(period.period_end)} ?\n\nLe montant sera figé. Cette action est irréversible.`)) return
    }
    setLoading(true)
    const update: any = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'paye') update.paid_at = new Date().toISOString()
    if (newStatus === 'cloture') update.locked_at = new Date().toISOString()
    await supabase.from('billing_periods').update(update).eq('id', period.id)

    // Si clôture → ouvrir automatiquement la période suivante
    if (newStatus === 'cloture') {
      const periodEnd   = new Date(period.period_end)
      const nextStart   = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 1)
      const nextEnd     = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0)
      const nextStartStr = nextStart.toISOString().slice(0, 10)
      const nextEndStr   = nextEnd.toISOString().slice(0, 10)

      // Vérifier qu'il n'y a pas déjà une période en cours
      const { data: existing } = await supabase
        .from('billing_periods')
        .select('id')
        .eq('client_id', period.client_id)
        .eq('status', 'en_cours')
        .single()

      if (!existing) {
        // Récupérer le montant fixe du contrat
        const { data: contract } = await supabase
          .from('client_contracts')
          .select('flat_fee_amount')
          .eq('client_id', period.client_id)
          .eq('is_active', true)
          .single()

        await supabase.from('billing_periods').insert({
          client_id:        period.client_id,
          period_start:     nextStartStr,
          period_end:       nextEndStr,
          status:           'en_cours',
          flat_fee_amount:  contract?.flat_fee_amount ?? 0,
        })
      }
    }

    await loadAll()
    setSelected(null)
    setLoading(false)
    setMsg(`✅ Statut mis à jour : ${BILLING_STATUS_LABELS[newStatus]}`)
  }

  const filtered = filterClient === 'all'
    ? periods
    : periods.filter(p => p.client_id === filterClient)

  const btn = (label: string, onClick: () => void, color = '#E8A020', disabled = false): React.ReactNode => (
    <button onClick={onClick} disabled={disabled || loading} style={{ padding: '5px 12px', borderRadius: 50, border: `1px solid ${color}40`, background: `${color}10`, color, fontSize: 11, fontWeight: 700, cursor: disabled || loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: disabled ? 0.4 : 1 }}>
      {label}
    </button>
  )

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/admin/superadmin" style={{ fontSize: 12, color: '#C8B99A', textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>← Super Admin</a>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5C842', margin: 0 }}>Périodes de facturation</h1>
        <p style={{ fontSize: 12, color: '#C8B99A', marginTop: 4 }}>Consulter, recalculer, clôturer et marquer les périodes.</p>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('✅') ? 'rgba(91,197,122,0.08)' : 'rgba(255,107,107,0.08)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(91,197,122,0.2)' : 'rgba(255,107,107,0.2)'}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: msg.startsWith('✅') ? '#5BC57A' : '#FF6B6B', display: 'flex', justifyContent: 'space-between' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: '#C8B99A', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Filtre client */}
      <div style={{ marginBottom: 16 }}>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: '#131009', color: '#F5EDD6', fontSize: 12, outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
          <option value="all">Tous les clients</option>
          {admins.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
        </select>
      </div>

      {/* Liste périodes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ color: '#7A6E58', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>Aucune période trouvée.</div>
        )}
        {filtered.map(period => {
          const sc = STATUS_COLORS[period.status]
          return (
            <div key={period.id} style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', marginBottom: 4 }}>
                    {getAdminEmail(period.client_id)}
                  </div>
                  <div style={{ fontSize: 12, color: '#C8B99A' }}>
                    {formatDate(period.period_start)} → {formatDate(period.period_end)}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 50, background: sc.bg, color: sc.color }}>
                  {BILLING_STATUS_LABELS[period.status]}
                </span>
              </div>

              {/* Chiffres */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Commandes', value: String(period.orders_count) },
                  { label: 'Base', value: formatMAD(period.orders_base_amount) },
                  { label: 'Commission', value: formatMAD(period.commission_amount) },
                  { label: 'Total dû', value: formatMAD(period.total_due), highlight: true },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#7A6E58', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: item.highlight ? '#F5C842' : '#F5EDD6' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {period.status === 'en_cours' && btn('↻ Recalculer', () => handleRecalculate(period), '#38B6FF')}
                {period.status === 'en_cours' && btn('Clôturer', () => handleStatusChange(period, 'cloture'), '#E8A020')}
                {period.status === 'cloture'  && btn('Marquer facturé', () => handleStatusChange(period, 'facture'), '#F5C842')}
                {period.status === 'facture'  && btn('Marquer payé', () => handleStatusChange(period, 'paye'), '#5BC57A')}
                <a href={`/admin/superadmin/facturation/ajustements?period=${period.id}`} style={{ padding: '5px 12px', borderRadius: 50, border: '1px solid rgba(200,185,154,0.2)', background: 'rgba(200,185,154,0.05)', color: '#C8B99A', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                  Ajustements
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
