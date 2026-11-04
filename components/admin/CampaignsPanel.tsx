'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { buildCampaignMessage } from '@/lib/campaigns'
import { buildCampaignPublicUrl } from '@/lib/campaign-public'
import CampaignSendQueue from '@/components/admin/CampaignSendQueue'

type Campaign = {
  id: string
  name: string
  promotion_id: string
  message: string
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
  audience_mode?: string | null
  created_at?: string | null
  image_url?: string | null
}

// ends_at : champ facultatif (la route actuelle ne renvoie que id et name, voir rapport).
type RuleOption = { id: string; name: string; ends_at?: string | null }

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

const STATUS_LABELS: Record<string, string> = { draft: 'Brouillon', ready: 'Prête', cancelled: 'Annulée' }
const AUDIENCES: { value: string; label: string }[] = [
  { value: 'all_consenting', label: 'Tous les clients qui ont accepté' },
  { value: 'best_clients', label: 'Meilleurs clients' },
  { value: 'inactive_clients', label: 'Clients inactifs' },
]
const audienceLabel = (v?: string | null) => AUDIENCES.find((a) => a.value === v)?.label ?? '—'

const TOKENS = ['{pseudo}', '{lien}', '{date de fin}']

function Card({ n, title, children }: { n?: number; title: string; children: React.ReactNode }) {
  return (
    <section style={CARD_STYLE}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#E8A020' }}>
        {n !== undefined && (
          <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 13, background: '#E8A020', color: '#0B0905',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{n}</span>
        )}
        <span>{n !== undefined ? `${n}. ${title}` : title}</span>
      </h3>
      {children}
    </section>
  )
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? '—' : new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function CampaignsPanel({
  emptyTitle = "Aucune campagne pour l'instant",
  emptyText = 'Prépare une première campagne avec le formulaire ci-dessus. Rien n’est envoyé à ce stade.',
}: {
  emptyTitle?: string
  emptyText?: string
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [rules, setRules] = useState<RuleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [promotionId, setPromotionId] = useState('')
  const [message, setMessage] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [audience, setAudience] = useState('all_consenting')
  const [openQueueId, setOpenQueueId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  // Insere un texte a la position du curseur dans le message.
  function insertToken(token: string) {
    const el = messageRef.current
    const start = el?.selectionStart ?? message.length
    const end = el?.selectionEnd ?? start
    setMessage(message.slice(0, start) + token + message.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  // BLAC-P3-015 : televersement via la route existante /api/upload-image (seau public products).
  async function uploadImageFile(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) {
      setError("Ce fichier n'est pas une image")
      return null
    }
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'products')
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data?.url !== 'string') {
        setError(data?.error ?? 'Téléversement impossible')
        return null
      }
      return data.url
    } catch {
      setError('Téléversement impossible')
      return null
    }
  }

  async function onFormImage(file: File | undefined) {
    if (!file) return
    setError(null)
    setUploadingImage('form')
    const url = await uploadImageFile(file)
    if (url) setImageUrl(url)
    setUploadingImage(null)
  }

  async function setCampaignImage(id: string, url: string | null) {
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, image_url: url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data?.error ?? 'Modification impossible')
      else {
        setNotice(url ? "Image de la campagne enregistrée." : "Image de la campagne retirée.")
        await load()
      }
    } catch {
      setError('Modification impossible')
    }
  }

  async function onCampaignImage(id: string, file: File | undefined) {
    if (!file) return
    setError(null)
    setUploadingImage(id)
    const url = await uploadImageFile(file)
    setUploadingImage(null)
    if (url) await setCampaignImage(id, url)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/campaigns', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Chargement impossible')
      } else if (data?.unavailable) {
        setUnavailable(String(data.message ?? ''))
        setCampaigns([])
        setRules([])
      } else {
        setUnavailable(null)
        setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : [])
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
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          promotion_id: promotionId,
          message,
          audience_mode: audience,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          image_url: imageUrl || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Enregistrement impossible')
      } else if (data?.unavailable) {
        setUnavailable(String(data.message ?? ''))
      } else {
        setNotice('Campagne enregistrée en brouillon. Aucun message n’est envoyé.')
        setName('')
        setPromotionId('')
        setMessage('')
        setStartsAt('')
        setEndsAt('')
        setImageUrl('')
        setAudience('all_consenting')
        await load()
      }
    } catch {
      setError('Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(id: string, status: 'ready' | 'cancelled') {
    if (status === 'cancelled' && !window.confirm('Annuler cette campagne ?')) return
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data?.error ?? 'Modification impossible')
      else if (data?.unavailable) setUnavailable(String(data.message ?? ''))
      else {
        setNotice(status === 'ready' ? 'Campagne marquée prête.' : 'Campagne annulée.')
        await load()
      }
    } catch {
      setError('Modification impossible')
    }
  }

  const selectedRule = rules.find((r) => r.id === promotionId)
  const endMs = endsAt ? Date.parse(endsAt) : NaN
  const endLong = Number.isNaN(endMs)
    ? null
    : new Date(endMs).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const daysLeft = Number.isNaN(endMs) ? null : Math.ceil((endMs - Date.now()) / 86400000)
  const daysLeftLabel = daysLeft === null ? '' : daysLeft < 0 ? 'Date déjà passée'
    : daysLeft === 0 ? "Dernier jour" : `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`
  // Avertissement seulement si la route fournit ends_at pour la promotion et qu'il est vide.
  const promoHasNoEnd = !!selectedRule && 'ends_at' in selectedRule && !selectedRule.ends_at

  return (
    <section>
      <h2 style={SECTION_TITLE_STYLE}>Campagnes</h2>

      {unavailable ? (
        <div style={{ ...CARD_STYLE, padding: '1.5rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#E8A020', marginBottom: 8 }}>Campagnes indisponibles</div>
          <p style={{ fontSize: 13, color: '#6A5A40', margin: '0 auto', maxWidth: 520, lineHeight: 1.5 }}>{unavailable}</p>
        </div>
      ) : (
        <>
          <form onSubmit={submit} style={{ marginBottom: 16 }}>
            <style>{`.mk-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}@media (min-width:1024px){.mk-grid{grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);align-items:start}.mk-side{position:sticky;top:16px}}`}</style>
            <div className="mk-grid">
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={CARD_STYLE}>
                  <label style={LABEL_STYLE} htmlFor="camp-name">Nom de la campagne</label>
                  <input id="camp-name" style={INPUT_STYLE} value={name} onChange={(e) => setName(e.target.value)}
                    maxLength={120} required />
                </div>

                <Card n={1} title="Visuel de la promo">
                  <div style={LABEL_STYLE}>Image de l'aperçu WhatsApp (facultatif)</div>
                  {imageUrl ? (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Image de la campagne" data-testid="campaign-image-preview"
                        style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(232,160,32,0.25)' }} />
                      <button type="button" onClick={() => setImageUrl('')}
                        style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(229,115,115,0.4)',
                          background: 'transparent', color: '#E57373', fontSize: 13, cursor: 'pointer' }}>
                        Retirer l'image
                      </button>
                    </div>
                  ) : (
                    <label style={{ ...INPUT_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 96,
                      cursor: 'pointer', color: '#E8A020', border: '1px dashed rgba(232,160,32,0.45)' }}>
                      {uploadingImage === 'form' ? 'Téléversement…' : 'Téléverser une image'}
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={(e) => { void onFormImage(e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  )}
                  <div style={{ fontSize: 12, color: '#6A5A40', marginTop: 6 }}>
                    Sans image, l'aperçu garde l'image de la marque.
                  </div>
                </Card>

                <Card n={2} title="Promotion liée">
                  <label style={LABEL_STYLE} htmlFor="camp-promo">Promotion</label>
                  <select id="camp-promo" style={INPUT_STYLE} value={promotionId}
                    onChange={(e) => setPromotionId(e.target.value)} required>
                    <option value="">Choisir une promotion</option>
                    {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {promoHasNoEnd && (
                    <div role="alert" data-testid="promo-no-end-warning"
                      style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#F5A623',
                        background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.45)' }}>
                      Cette promotion n'a pas de date de fin : l'offre n'expirera pas toute seule.
                    </div>
                  )}
                </Card>

                <Card n={3} title="Validité de l'offre">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={LABEL_STYLE} htmlFor="camp-start">Début (facultatif)</label>
                      <input id="camp-start" type="datetime-local" style={INPUT_STYLE} value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)} />
                    </div>
                    <div>
                      <label style={LABEL_STYLE} htmlFor="camp-end">Fin (facultatif)</label>
                      <input id="camp-end" type="datetime-local" style={INPUT_STYLE} value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)} />
                    </div>
                  </div>
                  <div data-testid="validity-end" style={{ marginTop: 12 }}>
                    {endLong ? (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#E8A020' }}>{endLong}</div>
                        <div style={{ fontSize: 13, color: '#8A7A5C' }}>{daysLeftLabel}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: '#6A5A40' }}>Aucune date de fin choisie.</div>
                    )}
                  </div>
                </Card>

                <Card n={4} title="Message WhatsApp">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }} aria-label="Insérer dans le message">
                    {TOKENS.map((t) => (
                      <button key={t} type="button" onClick={() => insertToken(t)}
                        style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(232,160,32,0.4)',
                          background: 'transparent', color: '#E8A020', fontSize: 13, cursor: 'pointer' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <label style={LABEL_STYLE} htmlFor="camp-message">Message</label>
                  <textarea id="camp-message" ref={messageRef} style={{ ...INPUT_STYLE, minHeight: 130, resize: 'vertical' }}
                    value={message} onChange={(e) => setMessage(e.target.value)} required />
                  <div style={{ fontSize: 12, color: '#6A5A40', marginTop: 6 }}>
                    La ligne de désinscription STOP est ajoutée automatiquement, une seule fois.
                  </div>
                </Card>

                <Card n={5} title="Destinataires">
                  <div id="camp-audience" role="radiogroup" aria-labelledby="camp-audience-label"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span id="camp-audience-label" style={{ ...LABEL_STYLE, width: '100%' }}>Audience</span>
                    {AUDIENCES.map((a) => {
                      const on = audience === a.value
                      return (
                        <button key={a.value} type="button" role="radio" aria-checked={on}
                          onClick={() => setAudience(a.value)}
                          style={{ flex: '1 1 150px', minHeight: 44, padding: '0 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                            fontWeight: on ? 700 : 500,
                            background: on ? '#E8A020' : 'transparent', color: on ? '#0B0905' : '#E8A020',
                            border: '1px solid rgba(232,160,32,0.5)' }}>
                          {a.label}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: '#6A5A40', marginTop: 6 }}>
                    Un client qui a refusé les offres n’est jamais contacté.
                  </div>
                </Card>
              </div>

              <div className="mk-side" style={{ display: 'grid', gap: 16 }}>
                <Card title="Aperçu chez le client">
                  <div style={{ background: '#0B0905', borderRadius: 10, padding: 12 }}>
                    <div style={{ background: '#1F3B2B', border: '1px solid rgba(37,211,102,0.35)', borderRadius: '10px 10px 10px 2px',
                      padding: 8, maxWidth: 340, color: '#F0E6CC' }}>
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt="Image de la promotion"
                          style={{ width: '100%', borderRadius: 6, display: 'block', marginBottom: 8 }} />
                      ) : (
                        <div style={{ height: 110, borderRadius: 6, marginBottom: 8, background: '#131009', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#6A5A40' }}>
                          Image de la marque
                        </div>
                      )}
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#E8A020' }}>{selectedRule?.name ?? 'Promotion à choisir'}</div>
                      <div style={{ fontSize: 12, color: '#C9BC9C', marginBottom: 6 }}>
                        {endLong ? `Valable jusqu'au ${endLong}` : 'Sans date de fin'}
                      </div>
                      <div data-testid="campaign-preview" style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                        {buildCampaignMessage(message)}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card title="Récapitulatif">
                  <dl style={{ margin: 0, display: 'grid', gap: 8, fontSize: 13 }}>
                    <div><dt style={{ color: '#8A7A5C' }}>Promotion</dt><dd style={{ margin: 0, color: '#F0E6CC' }}>{selectedRule?.name ?? '—'}</dd></div>
                    <div><dt style={{ color: '#8A7A5C' }}>Valable jusqu'au</dt><dd style={{ margin: 0, color: '#F0E6CC' }}>{endLong ?? 'Sans date de fin'}</dd></div>
                    <div><dt style={{ color: '#8A7A5C' }}>Destinataires</dt><dd style={{ margin: 0, color: '#F0E6CC' }}>{audienceLabel(audience)}</dd></div>
                    <div><dt style={{ color: '#8A7A5C' }}>Canal</dt><dd style={{ margin: 0, color: '#F0E6CC' }}>WhatsApp, un clic par client</dd></div>
                  </dl>
                  {error && <div role="alert" style={{ fontSize: 13, color: '#E57373', marginTop: 12 }}>{error}</div>}
                  {notice && <div role="status" style={{ fontSize: 13, color: '#E8A020', marginTop: 12 }}>{notice}</div>}
                  <button type="submit" disabled={saving}
                    style={{ width: '100%', marginTop: 12, minHeight: 44, borderRadius: 8, border: 'none', background: '#E8A020', color: '#0B0905',
                      fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Enregistrement…' : 'Enregistrer la campagne'}
                  </button>
                </Card>
              </div>
            </div>
          </form>

          <div style={CARD_STYLE}>
            {loading ? (
              <p style={{ fontSize: 13, color: '#6A5A40', margin: 0 }}>Chargement…</p>
            ) : campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#E8A020', marginBottom: 8 }}>
                  {emptyTitle}
                </div>
                <p style={{ fontSize: 13, color: '#6A5A40', margin: '0 auto', maxWidth: 480, lineHeight: 1.5 }}>
                  {emptyText}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {campaigns.map((c) => (
                  <div key={c.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
                    justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid rgba(232,160,32,0.1)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#E8A020', fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: '#8A7A5C' }}>
                        {ruleName(c.promotion_id)} · {audienceLabel(c.audience_mode)}
                      </div>
                      <div style={{ fontSize: 12, color: '#6A5A40' }}>
                        Du {formatDate(c.starts_at)} au {formatDate(c.ends_at)}
                      </div>
                      {(c.status === 'draft' || c.status === 'ready') && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                          {c.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.image_url} alt="Image de la campagne"
                              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                          )}
                          <label style={{ minHeight: 36, padding: '0 12px', display: 'inline-flex', alignItems: 'center', borderRadius: 8,
                            border: '1px solid rgba(232,160,32,0.4)', color: '#E8A020', fontSize: 12, cursor: 'pointer' }}>
                            {uploadingImage === c.id ? 'Téléversement…' : c.image_url ? "Changer l'image" : "Ajouter une image"}
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={(e) => { void onCampaignImage(c.id, e.target.files?.[0]); e.target.value = '' }} />
                          </label>
                          {c.image_url && (
                            <button type="button" onClick={() => void setCampaignImage(c.id, null)}
                              style={{ minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(229,115,115,0.4)',
                                background: 'transparent', color: '#E57373', fontSize: 12, cursor: 'pointer' }}>
                              Retirer l'image
                            </button>
                          )}
                        </div>
                      )}
                      {c.status === 'ready' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 6 }}>
                          <span style={{ fontSize: 12, color: '#8A7A5C', wordBreak: 'break-all' }}>{buildCampaignPublicUrl(c.id)}</span>
                          <button type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(buildCampaignPublicUrl(c.id))
                                .then(() => setCopiedId(c.id))
                                .catch(() => setNotice("Copie impossible : sélectionne l'adresse à la main."))
                            }}
                            style={{ minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(232,160,32,0.4)',
                              background: 'transparent', color: '#E8A020', fontSize: 12, cursor: 'pointer' }}>
                            {copiedId === c.id ? 'Adresse copiée' : "Copier l'adresse de l'offre"}
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#8A7A5C' }}>{STATUS_LABELS[c.status ?? 'draft'] ?? c.status}</span>
                      {c.status === 'draft' && (
                        <button type="button" onClick={() => changeStatus(c.id, 'ready')}
                          style={{ minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(232,160,32,0.4)',
                            background: 'transparent', color: '#E8A020', fontSize: 12, cursor: 'pointer' }}>
                          Marquer prête
                        </button>
                      )}
                      {c.status === 'ready' && (
                        <button type="button" onClick={() => setOpenQueueId(openQueueId === c.id ? null : c.id)}
                          style={{ minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(232,160,32,0.4)',
                            background: 'transparent', color: '#E8A020', fontSize: 12, cursor: 'pointer' }}>
                          {openQueueId === c.id ? 'Fermer la file' : "Ouvrir la file d'envoi"}
                        </button>
                      )}
                      {(c.status === 'draft' || c.status === 'ready') && (
                        <button type="button" onClick={() => changeStatus(c.id, 'cancelled')}
                          style={{ minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(229,115,115,0.4)',
                            background: 'transparent', color: '#E57373', fontSize: 12, cursor: 'pointer' }}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {openQueueId && campaigns.some((c) => c.id === openQueueId && c.status === 'ready') && (
            <CampaignSendQueue campaignId={openQueueId} campaignName={campaigns.find((c) => c.id === openQueueId)?.name} />
          )}
        </>
      )}
    </section>
  )
}
