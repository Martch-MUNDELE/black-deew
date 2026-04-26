'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BILLING_MODE_LABELS, BILLING_STATUS_LABELS, type ClientContract, type BillingPeriod } from '@/lib/types/billing'

const supabase = createClient()

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  en_cours: { bg: 'rgba(56,182,255,0.1)',  color: '#38B6FF' },
  cloture:  { bg: 'rgba(232,160,32,0.1)',  color: '#E8A020' },
  facture:  { bg: 'rgba(245,200,66,0.1)',  color: '#F5C842' },
  paye:     { bg: 'rgba(91,197,122,0.1)',  color: '#5BC57A' },
}

export default function AbonnementPage() {
  const [contract, setContract]     = useState<ClientContract | null>(null)
  const [period, setPeriod]         = useState<BillingPeriod | null>(null)
  const [history, setHistory]       = useState<BillingPeriod[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const [{ data: c }, { data: periods }] = await Promise.all([
        supabase.from('client_contracts').select('*').eq('client_id', data.user.id).eq('is_active', true).single(),
        supabase.from('billing_periods').select('*').eq('client_id', data.user.id).order('period_start', { ascending: false }),
      ])
      setContract(c || null)
      const all = periods || []
      setPeriod(all.find(p => p.status === 'en_cours') || null)
      setHistory(all.filter(p => p.status !== 'en_cours'))
      setLoading(false)
    })
  }, [])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const formatDateShort = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatMAD = (n: number) =>
    `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`

  const s: Record<string, React.CSSProperties> = {
    page:    { maxWidth: 560, margin: '0 auto', padding: '24px 16px', fontFamily: 'DM Sans, sans-serif' },
    card:    { background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '20px', marginBottom: 12 },
    label:   { fontSize: 11, fontWeight: 700, color: '#8A7A60', textTransform: 'uppercase' as const, letterSpacing: '0.8px' },
    row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingBottom: 10, borderBottom: '1px solid rgba(232,160,32,0.06)' },
    key:     { fontSize: 13, color: '#C8B99A' },
    val:     { fontSize: 13, fontWeight: 600, color: '#F5EDD6' },
  }

  if (loading) return (
    <div style={{ ...s.page, paddingTop: 60, textAlign: 'center', color: '#7A6E58', fontSize: 13 }}>
      Chargement…
    </div>
  )

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5C842', margin: 0 }}>
          Mon abonnement
        </h1>
        <p style={{ fontSize: 12, color: '#8A7A60', marginTop: 4 }}>
          Suivi de votre facturation plateforme en temps réel.
        </p>
      </div>

      {!contract && (
        <div style={{ ...s.card, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#F5EDD6', marginBottom: 6 }}>Aucun contrat actif</div>
          <div style={{ fontSize: 12, color: '#7A6E58' }}>Contactez votre gestionnaire de compte pour configurer votre abonnement.</div>
        </div>
      )}

      {contract && (
        <>
          {/* Période en cours */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={s.label}>Période en cours</div>
              {period && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 50, background: 'rgba(56,182,255,0.1)', color: '#38B6FF' }}>
                  {formatDateShort(period.period_start)} → {formatDateShort(period.period_end)}
                </span>
              )}
            </div>

            {!period ? (
              <div style={{ fontSize: 13, color: '#7A6E58', padding: '8px 0' }}>Aucune période ouverte pour le moment.</div>
            ) : (
              <>
                <div style={s.row}>
                  <span style={s.key}>Abonnement fixe</span>
                  <span style={s.val}>{formatMAD(period.flat_fee_amount)}</span>
                </div>
                <div style={s.row}>
                  <span style={s.key}>Mode de commission</span>
                  <span style={s.val}>{BILLING_MODE_LABELS[contract.billing_mode]}</span>
                </div>
                <div style={s.row}>
                  <span style={s.key}>Commandes prises en compte</span>
                  <span style={s.val}>{period.orders_count}</span>
                </div>
                <div style={s.row}>
                  <span style={s.key}>Base de calcul</span>
                  <span style={s.val}>{formatMAD(period.orders_base_amount)}</span>
                </div>
                <div style={s.row}>
                  <span style={s.key}>Commission calculée</span>
                  <span style={s.val}>{formatMAD(period.commission_amount)}</span>
                </div>
                {period.adjustments_total !== 0 && (
                  <div style={s.row}>
                    <span style={s.key}>Ajustements</span>
                    <span style={{ ...s.val, color: period.adjustments_total < 0 ? '#5BC57A' : '#FF6B6B' }}>
                      {period.adjustments_total > 0 ? '+' : ''}{formatMAD(period.adjustments_total)}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, marginTop: 4, borderTop: '1px solid rgba(232,160,32,0.15)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#F5EDD6' }}>Total estimé</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#F5C842', fontFamily: 'Playfair Display, serif' }}>
                    {formatMAD(period.total_due)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Mon contrat */}
          <div style={s.card}>
            <div style={{ ...s.label, marginBottom: 14 }}>Mon contrat</div>
            <div style={s.row}>
              <span style={s.key}>Abonnement mensuel</span>
              <span style={s.val}>{formatMAD(contract.flat_fee_amount)}</span>
            </div>
            <div style={s.row}>
              <span style={s.key}>Mode de rémunération</span>
              <span style={s.val}>{BILLING_MODE_LABELS[contract.billing_mode]}</span>
            </div>
            <div style={{ ...s.row, borderBottom: 'none' }}>
              <span style={s.key}>Actif depuis</span>
              <span style={s.val}>{formatDate(contract.started_at)}</span>
            </div>
          </div>

          {/* Historique des périodes */}
          {history.length > 0 && (
            <div style={s.card}>
              <div style={{ ...s.label, marginBottom: 14 }}>Historique</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map(p => {
                  const sc = STATUS_COLORS[p.status]
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(232,160,32,0.06)' }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#C8B99A', marginBottom: 3 }}>
                          {formatDateShort(p.period_start)} → {formatDateShort(p.period_end)}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 50, background: sc.bg, color: sc.color }}>
                          {BILLING_STATUS_LABELS[p.status]}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#F5C842' }}>{formatMAD(p.total_due)}</div>
                        {p.total_paid > 0 && (
                          <div style={{ fontSize: 11, color: '#5BC57A' }}>Payé : {formatMAD(p.total_paid)}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
