'use client'

import { useCallback, useEffect, useState } from 'react'

type Offer = {
  id: string
  phone: string
  promotion_id: string
  campaign_label?: string | null
  status?: string | null
  starts_at?: string | null
  ends_at?: string | null
  created_at?: string | null
}

type RuleOption = { id: string; name: string }

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#8A7A5C', margin: '0 0 10px',
  textTransform: 'uppercase', letterSpacing: 0.5,
}

const CARD_STYLE: React.CSSProperties = {
  background: '#131009', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 12, padding: '1rem',
}

const LABEL_STYLE: React.CSSProperties = { display: 'block', fontSize: 12, color: '#8A7A5C', marginBottom: 4 }

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0.6rem 0.75rem', fontSize: 14,
  background: '#0B0905', color: '#F0E6CC', border: '1px solid rgba(232,160,32,0.25)', borderRadius: 8,
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active', used: 'Utilisée', expired: 'Expirée', cancelled: 'Annulée',
}

function statusLabel(offer: Offer, now: number): string {
  const status = offer.status ?? 'active'
  if (status === 'active' && offer.ends_at && Date.parse(offer.ends_at) < now) return STATUS_LABELS.expired
  return STATUS_LABELS[status] ?? status
}

function isCancellable(offer: Offer, now: number): boolean {
  return statusLabel(offer, now) === STATUS_LABELS.active
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? '—' : new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ClientOffersPanel() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [rules, setRules] = useState<RuleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [phone, setPhone] = useState('')
  const [promotionId, setPromotionId] = useState('')
  const [label, setLabel] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/client-offers?rules=1', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Chargement impossible')
      } else if (data?.unavailable) {
        setUnavailable(String(data.message ?? ''))
        setOffers([])
        setRules([])
      } else {
        setUnavailable(null)
        setOffers(Array.isArray(data.offers) ? data.offers : [])
        setRules(Array.isArray(data.rules) ? data.rules : [])
        setError(null)
      }
    } catch {
      setError('Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const ruleName = (id: string) => rules.find((r) => r.id === id)?.name ?? 'Promotion inconnue'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/client-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          promotion_id: promotionId,
          campaign_label: label,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Enregistrement impossible')
      } else if (data?.unavailable) {
        setUnavailable(String(data.message ?? ''))
      } else {
        setNotice('Offre enregistrée.')
        setPhone('')
        setPromotionId('')
        setLabel('')
        setStartsAt('')
        setEndsAt('')
        await load()
      }
    } catch {
      setError('Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  async function cancel(id: string) {
    if (!window.confirm('Annuler cette offre ?')) return
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/client-offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data?.error ?? 'Annulation impossible')
      else if (data?.unavailable) setUnavailable(String(data.message ?? ''))
      else {
        setNotice('Offre annulée.')
        await load()
      }
    } catch {
      setError('Annulation impossible')
    }
  }

  const now = Date.now()

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={SECTION_TITLE_STYLE}>Offres personnelles</h2>

      {unavailable ? (
        <div style={{ ...CARD_STYLE, padding: '1.5rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#E8A020', marginBottom: 8 }}>
            Offres personnelles indisponibles
          </div>
          <p style={{ fontSize: 13, color: '#6A5A40', margin: '0 auto', maxWidth: 520, lineHeight: 1.5 }}>
            {unavailable}
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={submit} style={{ ...CARD_STYLE, display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={LABEL_STYLE} htmlFor="offer-phone">Téléphone du client</label>
              <input id="offer-phone" style={INPUT_STYLE} value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+243 81 000 0000" inputMode="tel" required />
            </div>
            <div>
              <label style={LABEL_STYLE} htmlFor="offer-promo">Promotion</label>
              <select id="offer-promo" style={INPUT_STYLE} value={promotionId}
                onChange={(e) => setPromotionId(e.target.value)} required>
                <option value="">Choisir une promotion</option>
                {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE} htmlFor="offer-label">Nom de la campagne (facultatif)</label>
              <input id="offer-label" style={INPUT_STYLE} value={label} onChange={(e) => setLabel(e.target.value)}
                maxLength={120} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE} htmlFor="offer-start">Début (facultatif)</label>
                <input id="offer-start" type="datetime-local" style={INPUT_STYLE} value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <label style={LABEL_STYLE} htmlFor="offer-end">Fin (facultatif)</label>
                <input id="offer-end" type="datetime-local" style={INPUT_STYLE} value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
            {error && <div role="alert" style={{ fontSize: 13, color: '#E57373' }}>{error}</div>}
            {notice && <div role="status" style={{ fontSize: 13, color: '#E8A020' }}>{notice}</div>}
            <button type="submit" disabled={saving}
              style={{ minHeight: 44, borderRadius: 8, border: 'none', background: '#E8A020', color: '#0B0905',
                fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer l’offre'}
            </button>
          </form>

          <div style={CARD_STYLE}>
            {loading ? (
              <p style={{ fontSize: 13, color: '#6A5A40', margin: 0 }}>Chargement…</p>
            ) : offers.length === 0 ? (
              <p style={{ fontSize: 13, color: '#6A5A40', margin: 0, textAlign: 'center' }}>
                Aucune offre personnelle pour l'instant.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {offers.map((o) => (
                  <div key={o.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
                    justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid rgba(232,160,32,0.1)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#E8A020', fontWeight: 600 }}>{o.phone}</div>
                      <div style={{ fontSize: 13, color: '#8A7A5C' }}>
                        {ruleName(o.promotion_id)}{o.campaign_label ? ' · ' + o.campaign_label : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#6A5A40' }}>
                        Du {formatDate(o.starts_at)} au {formatDate(o.ends_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#8A7A5C' }}>{statusLabel(o, now)}</span>
                      {isCancellable(o, now) && (
                        <button type="button" onClick={() => cancel(o.id)}
                          style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, background: 'transparent',
                            color: '#E57373', border: '1px solid rgba(229,115,115,0.4)', fontSize: 13, cursor: 'pointer' }}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
