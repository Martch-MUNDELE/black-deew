'use client'

import { useCallback, useEffect, useState } from 'react'
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

const STATUS_LABELS: Record<string, string> = { draft: 'Brouillon', ready: 'Prête', cancelled: 'Annulée' }
const AUDIENCES: { value: string; label: string }[] = [
  { value: 'all_consenting', label: 'Tous les clients qui ont accepté' },
  { value: 'best_clients', label: 'Meilleurs clients' },
  { value: 'inactive_clients', label: 'Clients inactifs' },
]
const audienceLabel = (v?: string | null) => AUDIENCES.find((a) => a.value === v)?.label ?? '—'

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
          <form onSubmit={submit} style={{ ...CARD_STYLE, display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={LABEL_STYLE} htmlFor="camp-name">Nom de la campagne</label>
              <input id="camp-name" style={INPUT_STYLE} value={name} onChange={(e) => setName(e.target.value)}
                maxLength={120} required />
            </div>
            <div>
              <label style={LABEL_STYLE} htmlFor="camp-promo">Promotion</label>
              <select id="camp-promo" style={INPUT_STYLE} value={promotionId}
                onChange={(e) => setPromotionId(e.target.value)} required>
                <option value="">Choisir une promotion</option>
                {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE} htmlFor="camp-message">Message</label>
              <textarea id="camp-message" style={{ ...INPUT_STYLE, minHeight: 110, resize: 'vertical' }}
                value={message} onChange={(e) => setMessage(e.target.value)} required />
            </div>
            <div>
              <div style={LABEL_STYLE}>Aperçu du message envoyé</div>
              <div data-testid="campaign-preview"
                style={{ ...INPUT_STYLE, minHeight: 60, whiteSpace: 'pre-wrap', color: '#C9BC9C' }}>
                {buildCampaignMessage(message)}
              </div>
              <div style={{ fontSize: 12, color: '#6A5A40', marginTop: 4 }}>
                La ligne de désinscription STOP est ajoutée automatiquement, une seule fois.
              </div>
            </div>
            <div>
              <div style={LABEL_STYLE}>Image de l'aperçu WhatsApp (facultatif)</div>
              {imageUrl ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Image de la campagne" data-testid="campaign-image-preview"
                    style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(232,160,32,0.25)' }} />
                  <button type="button" onClick={() => setImageUrl('')}
                    style={{ minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(229,115,115,0.4)',
                      background: 'transparent', color: '#E57373', fontSize: 12, cursor: 'pointer' }}>
                    Retirer l'image
                  </button>
                </div>
              ) : (
                <label style={{ ...INPUT_STYLE, display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#E8A020' }}>
                  {uploadingImage === 'form' ? 'Téléversement…' : "Téléverser une image"}
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => { void onFormImage(e.target.files?.[0]); e.target.value = '' }} />
                </label>
              )}
              <div style={{ fontSize: 12, color: '#6A5A40', marginTop: 4 }}>
                Sans image, l'aperçu garde l'image de la marque.
              </div>
            </div>
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
            <div>
              <label style={LABEL_STYLE} htmlFor="camp-audience">Audience</label>
              <select id="camp-audience" style={INPUT_STYLE} value={audience}
                onChange={(e) => setAudience(e.target.value)}>
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <div style={{ fontSize: 12, color: '#6A5A40', marginTop: 4 }}>
                Un client qui a refusé les offres n’est jamais contacté.
              </div>
            </div>
            {error && <div role="alert" style={{ fontSize: 13, color: '#E57373' }}>{error}</div>}
            {notice && <div role="status" style={{ fontSize: 13, color: '#E8A020' }}>{notice}</div>}
            <button type="submit" disabled={saving}
              style={{ minHeight: 44, borderRadius: 8, border: 'none', background: '#E8A020', color: '#0B0905',
                fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer la campagne'}
            </button>
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
