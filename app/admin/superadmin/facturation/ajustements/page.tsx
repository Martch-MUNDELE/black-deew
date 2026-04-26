'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recalculatePeriod } from '@/app/actions/billing'
import { ADJUSTMENT_TYPE_LABELS, BILLING_STATUS_LABELS, type BillingAdjustment, type BillingAdjustmentType, type BillingPeriod } from '@/lib/types/billing'

const supabase = createClient()

const TYPE_COLORS: Record<BillingAdjustmentType, { bg: string; color: string }> = {
  remise:     { bg: 'rgba(91,197,122,0.1)',  color: '#5BC57A' },
  avoir:      { bg: 'rgba(91,197,122,0.1)',  color: '#5BC57A' },
  correction: { bg: 'rgba(232,160,32,0.1)',  color: '#E8A020' },
  frais:      { bg: 'rgba(255,107,107,0.1)', color: '#FF6B6B' },
}

function AjustementsContent() {
  const searchParams  = useSearchParams()
  const preselectedId = searchParams.get('period')

  const [periods, setPeriods]       = useState<BillingPeriod[]>([])
  const [admins, setAdmins]         = useState<any[]>([])
  const [adjustments, setAdjustments] = useState<BillingAdjustment[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>(preselectedId || '')
  const [type, setType]             = useState<BillingAdjustmentType>('remise')
  const [amount, setAmount]         = useState('')
  const [reason, setReason]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user))
    loadAll()
  }, [])

  useEffect(() => {
    if (selectedPeriod) loadAdjustments(selectedPeriod)
  }, [selectedPeriod])

  const loadAll = async () => {
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('billing_periods').select('*').order('period_start', { ascending: false }),
      supabase.from('admins').select('id, email, auth_user_id').eq('role', 'admin'),
    ])
    setPeriods(p || [])
    setAdmins(a || [])
    if (preselectedId && p) loadAdjustments(preselectedId)
  }

  const loadAdjustments = async (periodId: string) => {
    const { data } = await supabase
      .from('billing_adjustments')
      .select('*')
      .eq('billing_period_id', periodId)
      .order('created_at', { ascending: false })
    setAdjustments(data || [])
  }

  const getAdminEmail = (clientId: string) =>
    admins.find(a => a.auth_user_id === clientId)?.email || clientId.slice(0, 8) + '...'

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatMAD = (n: number) =>
    `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`

  const currentPeriod = periods.find(p => p.id === selectedPeriod)

  const saveAdjustment = async () => {
    if (!selectedPeriod) { setMsg('❌ Sélectionne une période'); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setMsg('❌ Montant invalide'); return }
    if (currentPeriod?.status !== 'en_cours') { setMsg('❌ Impossible d\'ajuster une période clôturée'); return }
    setSaving(true)
    try {
      await supabase.from('billing_adjustments').insert({
        billing_period_id: selectedPeriod,
        type,
        amount: Number(amount),
        reason: reason || null,
        created_by: currentUser?.id,
      })
      await recalculatePeriod(selectedPeriod)
      await loadAdjustments(selectedPeriod)
      await loadAll()
      setAmount('')
      setReason('')
      setMsg('✅ Ajustement enregistré et période recalculée')
    } catch (e) {
      setMsg('❌ Erreur lors de l\'enregistrement')
    }
    setSaving(false)
  }

  const deleteAdjustment = async (id: string) => {
    if (!confirm('Supprimer cet ajustement ?')) return
    if (currentPeriod?.status !== 'en_cours') { setMsg('❌ Impossible de modifier une période clôturée'); return }
    await supabase.from('billing_adjustments').delete().eq('id', id)
    await recalculatePeriod(selectedPeriod)
    await loadAdjustments(selectedPeriod)
    await loadAll()
    setMsg('✅ Ajustement supprimé')
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/admin/superadmin/facturation/periodes" style={{ fontSize: 12, color: '#C8B99A', textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>← Périodes</a>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5C842', margin: 0 }}>Ajustements</h1>
        <p style={{ fontSize: 12, color: '#C8B99A', marginTop: 4 }}>Ajouter des remises, avoirs, corrections ou frais sur une période.</p>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('✅') ? 'rgba(91,197,122,0.08)' : 'rgba(255,107,107,0.08)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(91,197,122,0.2)' : 'rgba(255,107,107,0.2)'}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: msg.startsWith('✅') ? '#5BC57A' : '#FF6B6B', display: 'flex', justifyContent: 'space-between' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: '#C8B99A', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', marginBottom: 16 }}>Nouvel ajustement</div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Période concernée</label>
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} style={{ ...inp, appearance: 'none' }}>
              <option value="">— Choisir une période —</option>
              {periods.filter(p => p.status === 'en_cours').map(p => (
                <option key={p.id} value={p.id} style={{ background: '#131009' }}>
                  {getAdminEmail(p.client_id)} · {formatDate(p.period_start)} → {formatDate(p.period_end)}
                </option>
              ))}
            </select>
            {currentPeriod && currentPeriod.status !== 'en_cours' && (
              <div style={{ fontSize: 11, color: '#FF6B6B', marginTop: 4 }}>Période clôturée — ajustements désactivés.</div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Type d'ajustement</label>
            <select value={type} onChange={e => setType(e.target.value as BillingAdjustmentType)} style={{ ...inp, appearance: 'none' }}>
              {(Object.entries(ADJUSTMENT_TYPE_LABELS) as [BillingAdjustmentType, string][]).map(([key, label]) => (
                <option key={key} value={key} style={{ background: '#131009' }}>{label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 4 }}>
              {type === 'remise' || type === 'avoir' ? '− Déduit du total dû' : '+ Ajouté au total dû'}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Montant (MAD)</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ex: 50" style={inp} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Motif (optionnel)</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Geste commercial, erreur de calcul..." style={inp} />
          </div>

          {currentPeriod && (
            <div style={{ background: 'rgba(232,160,32,0.04)', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ color: '#E8A020', fontWeight: 700, marginBottom: 6 }}>Période sélectionnée</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C8B99A', marginBottom: 3 }}><span>Abonnement fixe</span><span>{formatMAD(currentPeriod.flat_fee_amount)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C8B99A', marginBottom: 3 }}><span>Commission</span><span>{formatMAD(currentPeriod.commission_amount)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C8B99A', marginBottom: 3 }}><span>Ajustements</span><span>{formatMAD(currentPeriod.adjustments_total)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F5C842', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(232,160,32,0.1)' }}><span>Total dû</span><span>{formatMAD(currentPeriod.total_due)}</span></div>
            </div>
          )}

          <button onClick={saveAdjustment} disabled={saving || !selectedPeriod} style={{ width: '100%', padding: '12px', borderRadius: 50, border: 'none', background: saving || !selectedPeriod ? 'rgba(232,160,32,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 13, cursor: saving || !selectedPeriod ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Enregistrement...' : 'Enregistrer l\'ajustement'}
          </button>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
            Ajustements {selectedPeriod ? `(${adjustments.length})` : ''}
          </div>
          {!selectedPeriod && (
            <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 14, padding: '32px 20px', textAlign: 'center', color: '#7A6E58', fontSize: 13 }}>
              Sélectionne une période pour voir ses ajustements.
            </div>
          )}
          {selectedPeriod && adjustments.length === 0 && (
            <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 14, padding: '32px 20px', textAlign: 'center', color: '#7A6E58', fontSize: 13 }}>
              Aucun ajustement sur cette période.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {adjustments.map(adj => {
              const tc = TYPE_COLORS[adj.type]
              const isDeduction = adj.type === 'remise' || adj.type === 'avoir'
              return (
                <div key={adj.id} style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 50, background: tc.bg, color: tc.color }}>{ADJUSTMENT_TYPE_LABELS[adj.type]}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isDeduction ? '#5BC57A' : '#FF6B6B' }}>{isDeduction ? '−' : '+'} {formatMAD(adj.amount)}</span>
                    </div>
                    {currentPeriod?.status === 'en_cours' && (
                      <button onClick={() => deleteAdjustment(adj.id)} style={{ background: 'none', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 14, opacity: 0.6 }}>×</button>
                    )}
                  </div>
                  {adj.reason && <div style={{ fontSize: 11, color: '#C8B99A' }}>{adj.reason}</div>}
                  <div style={{ fontSize: 10, color: '#7A6E58', marginTop: 4 }}>
                    {new Date(adj.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AjustementsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#7A6E58', fontFamily: 'DM Sans, sans-serif' }}>Chargement…</div>}>
      <AjustementsContent />
    </Suspense>
  )
}
