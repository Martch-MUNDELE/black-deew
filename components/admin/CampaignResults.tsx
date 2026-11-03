'use client'

import { useEffect, useState } from 'react'

// BLAC-P3-014 : resultats d'une campagne (totaux uniquement, aucun numero affiche).
type Campaign = { id: string; name?: string }
type Results = { sent: number; refused: number; orders: number; revenue: number; conversionRate: number; windowDays: number }

const BOX: React.CSSProperties = {
  background: '#131009', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 12, padding: '1rem', marginTop: 16,
}
const TEXT: React.CSSProperties = { fontSize: 13, color: '#6A5A40', margin: 0, lineHeight: 1.5 }

export default function CampaignResults() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selected, setSelected] = useState('')
  const [results, setResults] = useState<Results | null>(null)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/admin/campaigns', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        const list = Array.isArray(data) ? data : Array.isArray(data?.campaigns) ? data.campaigns : []
        if (!alive) return
        const items: Campaign[] = list
          .filter((c: Campaign) => c && typeof c.id === 'string')
          .map((c: Campaign) => ({ id: c.id, name: c.name }))
        setCampaigns(items)
        if (data?.unavailable) setUnavailable(String(data.message ?? ''))
        if (items.length > 0) setSelected(items[0].id)
      } catch {
        if (alive) setError('Chargement impossible')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!selected) return
    let alive = true
    setResults(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/campaign-results?id=${encodeURIComponent(selected)}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok) { setError(data?.error ?? 'Chargement impossible'); return }
        setError(null)
        if (data?.unavailable) { setUnavailable(String(data.message ?? '')); return }
        setUnavailable(null)
        setResults(data as Results)
      } catch {
        if (alive) setError('Chargement impossible')
      }
    })()
    return () => { alive = false }
  }, [selected])

  const days = results?.windowDays ?? 7
  const cell = (label: string, value: string, testid: string) => (
    <div style={{ flex: '1 1 130px', minWidth: 120 }} data-testid={testid}>
      <div style={{ fontSize: 12, color: '#8A7A5C' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#F0E6CC' }}>{value}</div>
    </div>
  )

  return (
    <div style={BOX} data-testid="campaign-results">
      <div style={{ fontSize: 14, fontWeight: 600, color: '#E8A020', marginBottom: 4 }}>Résultats de la campagne</div>
      {unavailable ? (
        <p style={TEXT}>{unavailable}</p>
      ) : loading ? (
        <p style={TEXT}>Chargement…</p>
      ) : campaigns.length === 0 ? (
        <p style={TEXT}>Aucune campagne à mesurer pour l’instant.</p>
      ) : (
        <>
          {campaigns.length > 1 && (
            <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Campagne"
              style={{ width: '100%', minHeight: 40, marginBottom: 10, background: '#0D0A05', color: '#F0E6CC',
                border: '1px solid rgba(232,160,32,0.3)', borderRadius: 8, padding: '0 8px' }}>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
            </select>
          )}
          {error && <div role="alert" style={{ fontSize: 13, color: '#E57373', marginBottom: 8 }}>{error}</div>}
          {results ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {cell('Envoyés', String(results.sent), 'result-sent')}
                {cell('Refus', String(results.refused), 'result-refused')}
                {cell('Commandes', String(results.orders), 'result-orders')}
                {cell('Chiffre d’affaires', `${results.revenue.toLocaleString('fr-FR')} $`, 'result-revenue')}
                {cell('Taux', `${results.conversionRate.toLocaleString('fr-FR')} %`, 'result-rate')}
              </div>
              <p style={{ ...TEXT, marginTop: 10 }}>
                Règle : une commande compte si elle vient d’un client marqué envoyé, passée dans les {days} jours qui suivent son envoi (commandes annulées exclues). Le taux = clients ayant commandé / messages envoyés.
              </p>
            </>
          ) : !error ? <p style={TEXT}>Chargement…</p> : null}
        </>
      )}
    </div>
  )
}
