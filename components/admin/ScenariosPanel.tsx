'use client'

// BLAC-P3-025 : écran 3 du Marketing, Scénarios automatiques (meilleur client, relance des VIP inactifs).
// Lecture : GET /api/admin/campaign-scenarios et GET /api/admin/client-offers?rules=1.
// Écriture uniquement au clic sur « Valider et préparer l'envoi » : POST /api/admin/client-offers
// (offre du gagnant) ou POST /api/admin/campaigns (relance). Aucune autre écriture.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyCampaignVariables } from '@/lib/campaign-sends'

type RankedClient = { phone: string; pseudo: string | null; orders: number; revenue: number }
type ScenariosData = {
  unavailable?: boolean
  message?: string
  best?: RankedClient[]
  inactive?: { count: number; preview: string[] }
}
type RuleOption = { id: string; name: string; ends_at?: string | null }

const GOLD = '#E8A020'
const MUTED = '#8A7A5C'
const cardStyle: React.CSSProperties = {
  flex: '1 1 340px', minWidth: 0, background: '#14110B', border: '1px solid rgba(232,160,32,0.2)',
  borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
}
const fieldStyle: React.CSSProperties = {
  minHeight: 44, background: '#0C0A06', color: '#F3E9D2', border: '1px solid rgba(232,160,32,0.25)',
  borderRadius: 8, padding: '0 10px', fontSize: 14, width: '100%', boxSizing: 'border-box',
}
const buttonStyle: React.CSSProperties = {
  minHeight: 44, padding: '0 18px', borderRadius: 8, border: 'none', background: GOLD, color: '#1A1205',
  fontWeight: 700, fontSize: 14, cursor: 'pointer',
}

const BEST_TEMPLATE = 'Bravo {pseudo}, tu es notre meilleur client du mois ! Ton offre t\'attend : {lien} (valable jusqu\'au {date de fin}).'
const INACTIVE_TEMPLATE = 'Salut {pseudo}, ça fait un moment ! Une offre t\'attend : {lien} (valable jusqu\'au {date de fin}).'

function toIso(local: string): string | null {
  if (!local) return null
  const ms = Date.parse(local)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

function formatRevenue(n: number): string {
  return `${Math.round(n * 100) / 100} $`
}

export default function ScenariosPanel() {
  const [data, setData] = useState<ScenariosData | null>(null)
  const [rules, setRules] = useState<RuleOption[]>([])
  const [loadError, setLoadError] = useState('')
  const [bestPromo, setBestPromo] = useState('')
  const [bestEnd, setBestEnd] = useState('')
  const [bestBusy, setBestBusy] = useState(false)
  const [bestError, setBestError] = useState('')
  const [bestMessageSent, setBestMessageSent] = useState<string | null>(null)
  const [inPromo, setInPromo] = useState('')
  const [inEnd, setInEnd] = useState('')
  const [inBusy, setInBusy] = useState(false)
  const [inError, setInError] = useState('')
  const [inDone, setInDone] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        fetch('/api/admin/campaign-scenarios'),
        fetch('/api/admin/client-offers?rules=1'),
      ])
      const sj = (await s.json().catch(() => ({}))) as ScenariosData
      const rj = (await r.json().catch(() => ({}))) as { rules?: RuleOption[] }
      setData(sj)
      setRules(Array.isArray(rj.rules) ? rj.rules : [])
    } catch {
      setLoadError('Impossible de charger les scénarios pour le moment.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const winner = data?.best?.[0] ?? null
  const bestMessage = useMemo(
    () => applyCampaignVariables(BEST_TEMPLATE, { pseudo: winner?.pseudo ?? null, offerUrl: '', endsAt: toIso(bestEnd) }),
    [winner, bestEnd],
  )
  const inactiveMessage = useMemo(
    () => applyCampaignVariables(INACTIVE_TEMPLATE, { pseudo: null, offerUrl: '', endsAt: toIso(inEnd) }),
    [inEnd],
  )

  async function validateBest() {
    if (!winner || !bestPromo) {
      setBestError('Choisis une promotion.')
      return
    }
    setBestBusy(true)
    setBestError('')
    try {
      const res = await fetch('/api/admin/client-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: winner.phone,
          promotion_id: bestPromo,
          campaign_label: 'Meilleur client du mois',
          ends_at: toIso(bestEnd),
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; unavailable?: boolean; message?: string }
      if (!res.ok || json.unavailable) setBestError(json.error ?? json.message ?? "L'offre n'a pas pu être créée.")
      else setBestMessageSent(bestMessage)
    } catch {
      setBestError("L'offre n'a pas pu être créée.")
    } finally {
      setBestBusy(false)
    }
  }

  async function validateInactive() {
    if (!inPromo) {
      setInError('Choisis une promotion.')
      return
    }
    setInBusy(true)
    setInError('')
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Relance des VIP inactifs',
          promotion_id: inPromo,
          message: inactiveMessage,
          ends_at: toIso(inEnd),
          audience_mode: 'inactive_clients',
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; unavailable?: boolean; message?: string }
      if (!res.ok || json.unavailable) setInError(json.error ?? json.message ?? "La campagne n'a pas pu être créée.")
      else {
        setInDone(true)
        try {
          window.history.replaceState(null, '', '#campagnes')
          window.dispatchEvent(new HashChangeEvent('hashchange'))
        } catch {
          /* la file d'envoi reste accessible dans l'onglet Campagnes */
        }
      }
    } catch {
      setInError("La campagne n'a pas pu être créée.")
    } finally {
      setInBusy(false)
    }
  }

  const whatsappUrl = winner && bestMessageSent
    ? `https://wa.me/${winner.phone.replace(/\D/g, '')}?text=${encodeURIComponent(bestMessageSent)}`
    : ''

  // BLAC-P3-026 : avertissement si la promotion choisie n'a pas de date de fin (ends_at fourni et vide).
  const noEndWarning = (value: string) => {
    const rule = rules.find((r) => r.id === value)
    if (!rule || !('ends_at' in rule) || rule.ends_at) return null
    return (
      <div role="alert" data-testid="promo-no-end-warning-scenarios"
        style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#F5A623',
          background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.45)' }}>
        Cette promotion n'a pas de date de fin : l'offre n'expirera pas toute seule.
      </div>
    )
  }

  const promoSelect = (id: string, value: string, onChange: (v: string) => void) => (
    <>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: MUTED }}>
      Promotion
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={fieldStyle}>
        <option value="">Choisir une promotion</option>
        {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    </label>
    {noEndWarning(value)}
    </>
  )

  return (
    <div data-testid="scenarios-panel">
      {(loadError || data?.unavailable) && (
        <p role="status" style={{ color: MUTED, fontSize: 14 }}>{loadError || data?.message}</p>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <section data-testid="scenario-best-client" style={cardStyle} aria-label="Meilleur client du mois">
          <h2 style={{ margin: 0, fontSize: 17, color: GOLD }}>Meilleur client du mois</h2>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.best ?? []).slice(0, 3).map((c, i) => (
              <li key={c.phone} style={{
                padding: 10, borderRadius: 8, fontSize: 14, color: '#F3E9D2',
                border: i === 0 ? `1px solid ${GOLD}` : '1px solid rgba(232,160,32,0.12)',
                background: i === 0 ? 'rgba(232,160,32,0.12)' : 'transparent',
              }}>
                <strong>{i + 1}. {c.pseudo || c.phone}</strong>
                <span style={{ color: MUTED }}> · {c.orders} commande{c.orders > 1 ? 's' : ''} · {formatRevenue(c.revenue)}</span>
              </li>
            ))}
            {data && !data.unavailable && (data.best ?? []).length === 0 && (
              <li style={{ color: MUTED, fontSize: 14 }}>Aucun client sur la période.</li>
            )}
          </ol>
          {promoSelect('scenario-best-promo', bestPromo, setBestPromo)}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: MUTED }}>
            Date de fin
            <input id="scenario-best-end" type="datetime-local" value={bestEnd} onChange={(e) => setBestEnd(e.target.value)} style={fieldStyle} />
          </label>
          <div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Message proposé</div>
            <div data-testid="scenario-best-message" style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#F3E9D2', background: '#0C0A06', borderRadius: 8, padding: 10 }}>{bestMessage}</div>
          </div>
          {bestError && <p role="alert" style={{ color: '#E5604D', fontSize: 13, margin: 0 }}>{bestError}</p>}
          {!bestMessageSent ? (
            <button type="button" data-testid="scenario-best-validate" style={buttonStyle} disabled={bestBusy || !winner} onClick={validateBest}>
              {bestBusy ? 'Création…' : "Valider et préparer l'envoi"}
            </button>
          ) : (
            <a data-testid="scenario-best-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
              Ouvrir WhatsApp
            </a>
          )}
        </section>

        <section data-testid="scenario-inactive-vip" style={cardStyle} aria-label="Relance des VIP inactifs">
          <h2 style={{ margin: 0, fontSize: 17, color: GOLD }}>Relance des VIP inactifs</h2>
          <p data-testid="scenario-inactive-count" style={{ margin: 0, fontSize: 14, color: '#F3E9D2' }}>
            <strong>{data?.inactive?.count ?? 0}</strong> VIP à relancer
            {(data?.inactive?.preview ?? []).length > 0 && <span style={{ color: MUTED }}> : {(data?.inactive?.preview ?? []).slice(0, 3).join(', ')}</span>}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Seuls les VIP qui ont accepté les offres sont relancés.</p>
          {promoSelect('scenario-inactive-promo', inPromo, setInPromo)}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: MUTED }}>
            Date de fin
            <input id="scenario-inactive-end" type="datetime-local" value={inEnd} onChange={(e) => setInEnd(e.target.value)} style={fieldStyle} />
          </label>
          <div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Message proposé</div>
            <div data-testid="scenario-inactive-message" style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#F3E9D2', background: '#0C0A06', borderRadius: 8, padding: 10 }}>{inactiveMessage}</div>
          </div>
          {inError && <p role="alert" style={{ color: '#E5604D', fontSize: 13, margin: 0 }}>{inError}</p>}
          {inDone && <p role="status" style={{ color: GOLD, fontSize: 13, margin: 0 }}>Campagne créée. Retrouve-la dans la file d'envoi (onglet Campagnes).</p>}
          <button type="button" data-testid="scenario-inactive-validate" style={buttonStyle} disabled={inBusy || inDone} onClick={validateInactive}>
            {inBusy ? 'Création…' : "Valider et préparer l'envoi"}
          </button>
        </section>
      </div>
    </div>
  )
}
