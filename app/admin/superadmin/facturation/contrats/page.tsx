'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { recalculatePeriod } from '@/app/actions/billing'
import { BILLING_MODE_LABELS, type BillingMode, type ClientContract, type BillingPeriod, type CommissionRule } from '@/lib/types/billing'

const supabase = createClient()

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

const SUBCATEGORY_LABELS: Record<string, string> = {
  sandwichs_chauds: 'Sandwichs chauds',
  sandwichs_froids: 'Sandwichs froids',
  salades:          'Salades',
  chaudes:          'Boissons chaudes',
  froides:          'Boissons froides',
}

export default function ContratsPage() {
  const [admins, setAdmins]         = useState<any[]>([])
  const [contracts, setContracts]   = useState<ClientContract[]>([])
  const [periods, setPeriods]       = useState<BillingPeriod[]>([])
  const [rules, setRules]           = useState<CommissionRule[]>([])
  const [categories, setCategories] = useState<{ slug: string; label: string }[]>([])
  const [selected, setSelected]     = useState<any>(null)
  const [mode, setMode]             = useState<BillingMode>('flat_only')
  const [flatFee, setFlatFee]       = useState('')
  const [startDate, setStartDate]   = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving]         = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [msg, setMsg]               = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [tiers, setTiers]           = useState<{ from: string; to: string; rate: string }[]>([{ from: '0', to: '', rate: '' }])
  const [flatPercent, setFlatPercent] = useState('')
  const [catRates, setCatRates]     = useState<Record<string, string>>({})
  const [perOrderAmount, setPerOrderAmount] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user))
    loadAll()
  }, [])

  const loadAll = async () => {
    const [{ data: a }, { data: c }, { data: p }, { data: r }, { data: prods }] = await Promise.all([
      supabase.from('admins').select('*').eq('role', 'admin').order('created_at', { ascending: false }),
      supabase.from('client_contracts').select('*').eq('is_active', true),
      supabase.from('billing_periods').select('*').eq('status', 'en_cours'),
      supabase.from('commission_rules').select('*'),
      supabase.from('products').select('subcategory').eq('active', true),
    ])
    setAdmins(a || [])
    setContracts(c || [])
    setPeriods(p || [])
    setRules(r || [])
    const slugs = [...new Set((prods || []).map((p: any) => p.subcategory).filter(Boolean))]
    const cats = slugs.map(slug => ({ slug, label: SUBCATEGORY_LABELS[slug] || slug }))
    setCategories(cats)
    setCatRates(Object.fromEntries(cats.map(c => [c.slug, ''])))
  }

  const getAuthId = (admin: any) => admin.auth_user_id || admin.id
  const getContract = (admin: any) => contracts.find(c => c.client_id === getAuthId(admin))
  const getPeriod   = (admin: any) => periods.find(p => p.client_id === getAuthId(admin))
  const getRules    = (contractId: string) => rules.filter(r => r.contract_id === contractId)

  const selectAdmin = (admin: any) => {
    setSelected(admin)
    const existing = getContract(admin)
    if (existing) {
      setMode(existing.billing_mode)
      setFlatFee(String(existing.flat_fee_amount))
      setStartDate(existing.started_at)
      const existingRules = getRules(existing.id)
      const tierRules = existingRules.filter(r => r.rule_type === 'tier').sort((a, b) => (a.tier_from ?? 0) - (b.tier_from ?? 0))
      setTiers(tierRules.length > 0 ? tierRules.map(r => ({ from: String(r.tier_from ?? 0), to: String(r.tier_to ?? ''), rate: String(r.rate_percent ?? '') })) : [{ from: '0', to: '', rate: '' }])
      const pctRule = existingRules.find(r => r.rule_type === 'flat_percent')
      setFlatPercent(pctRule ? String(pctRule.rate_percent ?? '') : '')
      const newCatRates = Object.fromEntries(categories.map(c => [c.slug, '']))
      existingRules.filter(r => r.rule_type === 'category').forEach(r => {
        if (r.category_slug) newCatRates[r.category_slug] = String(r.rate_percent ?? '')
      })
      setCatRates(newCatRates)
      const poRule = existingRules.find(r => r.rule_type === 'per_order')
      setPerOrderAmount(poRule ? String(poRule.amount_per_order ?? '') : '')
    } else {
      setMode('flat_only')
      setFlatFee('')
      setStartDate(new Date().toISOString().slice(0, 10))
      setTiers([{ from: '0', to: '', rate: '' }])
      setFlatPercent('')
      setCatRates(Object.fromEntries(categories.map(c => [c.slug, ''])))
      setPerOrderAmount('')
    }
    setMsg('')
  }

  const saveRules = async (contractId: string) => {
    await supabase.from('commission_rules').delete().eq('contract_id', contractId)
    const inserts: any[] = []
    if (mode === 'flat_tiered') {
      tiers.forEach(t => {
        if (!t.rate) return
        inserts.push({ contract_id: contractId, rule_type: 'tier', tier_from: Number(t.from), tier_to: t.to ? Number(t.to) : null, rate_percent: Number(t.rate) })
      })
    }
    if (mode === 'flat_percent' && flatPercent) inserts.push({ contract_id: contractId, rule_type: 'flat_percent', rate_percent: Number(flatPercent) })
    if (mode === 'flat_category') {
      categories.forEach(cat => {
        if (catRates[cat.slug]) inserts.push({ contract_id: contractId, rule_type: 'category', category_slug: cat.slug, rate_percent: Number(catRates[cat.slug]) })
      })
    }
    if (mode === 'flat_per_order' && perOrderAmount) inserts.push({ contract_id: contractId, rule_type: 'per_order', amount_per_order: Number(perOrderAmount) })
    if (inserts.length > 0) await supabase.from('commission_rules').insert(inserts)
  }

  const saveContract = async () => {
    if (!selected) return
    if (!flatFee || isNaN(Number(flatFee))) { setMsg('❌ Montant invalide'); return }
    const authId = getAuthId(selected)
    if (!authId) { setMsg('❌ Auth ID introuvable pour ce client'); return }
    setSaving(true)
    try {
      const existing = getContract(selected)
      let contractId = existing?.id
      if (existing) {
        await supabase.from('contract_history').insert({ contract_id: existing.id, changed_by: currentUser?.id, old_snapshot: existing, new_snapshot: { billing_mode: mode, flat_fee_amount: Number(flatFee) }, reason: 'Modification via Super Admin' })
        await supabase.from('client_contracts').update({ billing_mode: mode, flat_fee_amount: Number(flatFee), updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        const { data: newContract, error } = await supabase
          .from('client_contracts')
          .insert({ client_id: authId, started_at: startDate, billing_mode: mode, flat_fee_amount: Number(flatFee) })
          .select().single()
        if (error || !newContract) throw error
        contractId = newContract.id
        if (!getPeriod(selected)) {
          const { start, end } = getMonthRange()
          await supabase.from('billing_periods').insert({ client_id: authId, period_start: start, period_end: end, status: 'en_cours', flat_fee_amount: Number(flatFee) })
        }
      }
      if (contractId) await saveRules(contractId)
      const p = getPeriod(selected)
      if (p) { setRecalculating(true); await recalculatePeriod(p.id); setRecalculating(false) }
      setMsg(existing ? '✅ Contrat mis à jour' : '✅ Contrat créé et période ouverte')
      await loadAll()
    } catch (e) {
      setMsg('❌ Erreur lors de la sauvegarde')
      console.error(e)
    }
    setSaving(false)
  }

  const triggerRecalculate = async () => {
    if (!selected) return
    const p = getPeriod(selected)
    if (!p) { setMsg('❌ Aucune période en cours'); return }
    setRecalculating(true)
    const result = await recalculatePeriod(p.id)
    setRecalculating(false)
    await loadAll()
    setMsg(result.success ? '✅ Période recalculée' : `❌ ${result.error}`)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }
  const sml: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }

  const period = selected ? getPeriod(selected) : null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/admin/superadmin" style={{ fontSize: 12, color: '#C8B99A', textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>← Super Admin</a>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5C842', margin: 0 }}>Clients & Contrats</h1>
        <p style={{ fontSize: 12, color: '#C8B99A', marginTop: 4 }}>Associer un contrat de facturation à chaque client admin.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Clients ({admins.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {admins.length === 0 && <div style={{ color: '#7A6E58', fontSize: 13, padding: '20px 0' }}>Aucun client admin trouvé.</div>}
            {admins.map(admin => {
              const contract = getContract(admin)
              const p = getPeriod(admin)
              const isActive = selected?.id === admin.id
              return (
                <div key={admin.id} onClick={() => selectAdmin(admin)} style={{ background: isActive ? 'rgba(232,160,32,0.08)' : '#131009', border: `1px solid ${isActive ? 'rgba(232,160,32,0.4)' : 'rgba(232,160,32,0.1)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', marginBottom: 6 }}>{admin.email}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {contract ? (
                      <>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 50, background: 'rgba(91,197,122,0.1)', color: '#5BC57A' }}>Contrat actif</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 50, background: 'rgba(232,160,32,0.08)', color: '#E8A020' }}>{contract.flat_fee_amount} MAD/mois</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 50, background: 'rgba(232,160,32,0.05)', color: '#C8B99A' }}>{BILLING_MODE_LABELS[contract.billing_mode]}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 50, background: 'rgba(255,107,107,0.08)', color: '#FF6B6B' }}>Sans contrat</span>
                    )}
                    {p && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 50, background: 'rgba(56,182,255,0.08)', color: '#38B6FF' }}>Période · {p.total_due.toFixed(2)} MAD</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          {!selected ? (
            <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 14, padding: '32px 20px', textAlign: 'center', color: '#7A6E58', fontSize: 13 }}>
              Sélectionne un client pour configurer son contrat.
            </div>
          ) : (
            <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 14, padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', marginBottom: 2 }}>{selected.email}</div>
                  <div style={{ fontSize: 11, color: '#7A6E58' }}>{getContract(selected) ? 'Modifier le contrat' : 'Créer un contrat'}</div>
                </div>
                {period && (
                  <button onClick={triggerRecalculate} disabled={recalculating} style={{ padding: '6px 14px', borderRadius: 50, border: '1px solid rgba(56,182,255,0.3)', background: 'rgba(56,182,255,0.06)', color: '#38B6FF', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                    {recalculating ? '...' : '↻ Recalculer'}
                  </button>
                )}
              </div>

              {msg && (
                <div style={{ background: msg.startsWith('✅') ? 'rgba(91,197,122,0.08)' : 'rgba(255,107,107,0.08)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(91,197,122,0.2)' : 'rgba(255,107,107,0.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: msg.startsWith('✅') ? '#5BC57A' : '#FF6B6B' }}>
                  {msg}
                </div>
              )}

              {period && (
                <div style={{ background: 'rgba(56,182,255,0.04)', border: '1px solid rgba(56,182,255,0.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 12 }}>
                  <div style={{ color: '#38B6FF', fontWeight: 700, marginBottom: 6 }}>Période en cours</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: '#C8B99A' }}>
                    <span>{period.orders_count} commandes</span>
                    <span>Base : {period.orders_base_amount.toFixed(2)} MAD</span>
                    <span>Commission : {period.commission_amount.toFixed(2)} MAD</span>
                    <span style={{ color: '#F5C842', fontWeight: 700 }}>Total : {period.total_due.toFixed(2)} MAD</span>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Mode de facturation</label>
                <select value={mode} onChange={e => setMode(e.target.value as BillingMode)} style={{ ...inp, appearance: 'none' }}>
                  {(Object.entries(BILLING_MODE_LABELS) as [BillingMode, string][]).map(([key, label]) => (
                    <option key={key} value={key} style={{ background: '#131009' }}>{label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Abonnement fixe mensuel (MAD)</label>
                <input type="number" min="0" step="0.01" value={flatFee} onChange={e => setFlatFee(e.target.value)} placeholder="Ex: 500" style={inp} />
              </div>

              {!getContract(selected) && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Date de début</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
                </div>
              )}

              {mode === 'flat_percent' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Pourcentage (% sur base produits)</label>
                  <input type="number" min="0" max="100" step="0.01" value={flatPercent} onChange={e => setFlatPercent(e.target.value)} placeholder="Ex: 5" style={inp} />
                </div>
              )}

              {mode === 'flat_tiered' && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>Paliers de commission</label>
                    <button onClick={() => setTiers(t => [...t, { from: t[t.length-1]?.to || '0', to: '', rate: '' }])} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.2)', background: 'transparent', color: '#E8A020', cursor: 'pointer' }}>+ Palier</button>
                  </div>
                  {tiers.map((tier, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                      <div><div style={{ fontSize: 10, color: '#7A6E58', marginBottom: 4 }}>De (MAD)</div><input type="number" value={tier.from} onChange={e => setTiers(t => t.map((x, j) => j === i ? { ...x, from: e.target.value } : x))} style={sml} /></div>
                      <div><div style={{ fontSize: 10, color: '#7A6E58', marginBottom: 4 }}>À (MAD)</div><input type="number" value={tier.to} onChange={e => setTiers(t => t.map((x, j) => j === i ? { ...x, to: e.target.value } : x))} placeholder="∞" style={sml} /></div>
                      <div><div style={{ fontSize: 10, color: '#7A6E58', marginBottom: 4 }}>Taux (%)</div><input type="number" min="0" max="100" step="0.01" value={tier.rate} onChange={e => setTiers(t => t.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} placeholder="%" style={sml} /></div>
                      {tiers.length > 1 && <button onClick={() => setTiers(t => t.filter((_, j) => j !== i))} style={{ marginBottom: 2, background: 'none', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 16 }}>×</button>}
                    </div>
                  ))}
                </div>
              )}

              {mode === 'flat_category' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Taux par catégorie (%)</label>
                  {categories.length === 0 && <div style={{ fontSize: 12, color: '#7A6E58' }}>Aucune catégorie trouvée.</div>}
                  {categories.map(cat => (
                    <div key={cat.slug} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: '#C8B99A' }}>{cat.label}</div>
                      <input type="number" min="0" max="100" step="0.01" value={catRates[cat.slug] || ''} onChange={e => setCatRates(r => ({ ...r, [cat.slug]: e.target.value }))} placeholder="%" style={sml} />
                    </div>
                  ))}
                </div>
              )}

              {mode === 'flat_per_order' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Montant fixe par commande livrée (MAD)</label>
                  <input type="number" min="0" step="0.01" value={perOrderAmount} onChange={e => setPerOrderAmount(e.target.value)} placeholder="Ex: 3" style={inp} />
                </div>
              )}

              <button onClick={saveContract} disabled={saving || recalculating} style={{ width: '100%', padding: '12px', borderRadius: 50, border: 'none', background: (saving || recalculating) ? 'rgba(232,160,32,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 13, cursor: (saving || recalculating) ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Enregistrement...' : recalculating ? 'Calcul en cours...' : getContract(selected) ? 'Mettre à jour' : 'Créer le contrat'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
