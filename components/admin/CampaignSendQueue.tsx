'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

// BLAC-P2-026 : file d'envoi WhatsApp d'une campagne prete. Aucun envoi automatique :
// l'admin ouvre WhatsApp pour chaque client, puis marque le message envoye ou STOP.
// BLAC-P3-024 : ecran 2 (progression, liste filtrable, panneau « Prochain message »).
// Affichage et lecture seule : « Passer ce client » ne change que l'ordre local de la session.

type QueueItem = {
  phone: string
  status: 'to_send' | 'sent'
  whatsapp_url: string | null
  pseudo?: string | null
  message?: string | null
}

type Filter = 'all' | 'to_send' | 'sent'

const AUDIENCE_LABELS: Record<string, string> = {
  all_consenting: 'Tous les clients autorisés',
  best_clients: 'Meilleurs clients',
  inactive_clients: 'Clients inactifs',
}

const GOLD = '#E8A020'

const BTN: React.CSSProperties = {
  minHeight: 44, minWidth: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(232,160,32,0.4)',
  background: 'transparent', color: GOLD, fontSize: 13, cursor: 'pointer', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: GOLD, color: '#0D0A04', border: `1px solid ${GOLD}`, fontWeight: 600 }
const BTN_STOP: React.CSSProperties = { ...BTN, border: '1px solid rgba(229,115,115,0.4)', color: '#E57373' }

const CARD: React.CSSProperties = {
  background: '#0D0A04', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 12, padding: '1rem',
}

function badgeStyle(kind: 'next' | 'to_send' | 'sent'): React.CSSProperties {
  const base: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }
  if (kind === 'next') return { ...base, background: GOLD, color: '#0D0A04' }
  if (kind === 'sent') return { ...base, background: 'rgba(110,190,130,0.15)', color: '#7FCB8F' }
  return { ...base, background: 'rgba(232,160,32,0.12)', color: '#C9A24A' }
}

export default function CampaignSendQueue({ campaignId, campaignName }: { campaignId: string; campaignName?: string }) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [sent, setSent] = useState(0)
  const [total, setTotal] = useState(0)
  const [audience, setAudience] = useState<string>('all_consenting')
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  // Numeros passes pendant cette session (ordre de passage). Jamais ecrit en base.
  const [skipped, setSkipped] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaign-sends?campaign_id=${encodeURIComponent(campaignId)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Chargement impossible')
      } else if (data?.unavailable) {
        setUnavailable(String(data.message ?? ''))
        setQueue([])
      } else {
        setUnavailable(null)
        setError(null)
        setQueue(Array.isArray(data.queue) ? data.queue : [])
        setSent(Number(data.sent) || 0)
        setTotal(Number(data.total) || 0)
        setAudience(typeof data.audience === 'string' ? data.audience : 'all_consenting')
      }
    } catch {
      setError('Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    setLoading(true)
    setSkipped([])
    void load()
  }, [load])

  async function act(phone: string, action: 'sent' | 'stop') {
    setError(null)
    try {
      const res = await fetch('/api/admin/campaign-sends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, phone, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data?.error ?? 'Modification impossible')
      else if (data?.unavailable) setUnavailable(String(data.message ?? ''))
      else await load()
    } catch {
      setError('Modification impossible')
    }
  }

  function skip(phone: string) {
    setSkipped((prev) => [...prev.filter((p) => p !== phone), phone])
  }

  // Ordre : a envoyer (non passes), puis a envoyer passes (dans l'ordre de passage), puis envoyes.
  const ordered = useMemo(() => {
    const toSend = queue.filter((i) => i.status === 'to_send')
    const normal = toSend.filter((i) => !skipped.includes(i.phone))
    const passed = skipped.map((p) => toSend.find((i) => i.phone === p)).filter((i): i is QueueItem => Boolean(i))
    return [...normal, ...passed, ...queue.filter((i) => i.status === 'sent')]
  }, [queue, skipped])

  const next = ordered.find((i) => i.status === 'to_send') ?? null
  const toSendCount = queue.filter((i) => i.status === 'to_send').length
  const sentCount = queue.filter((i) => i.status === 'sent').length
  const visible = ordered.filter((i) => filter === 'all' || i.status === filter)
  const percent = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0
  const label = (i: QueueItem) => (i.pseudo && i.pseudo.trim() ? i.pseudo : i.phone)

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: queue.length },
    { key: 'to_send', label: 'À envoyer', count: toSendCount },
    { key: 'sent', label: 'Envoyés', count: sentCount },
  ]

  return (
    <div style={{ ...CARD, background: '#131009', marginTop: 16 }} data-testid="campaign-send-queue">
      <div style={{ fontSize: 14, fontWeight: 600, color: GOLD, marginBottom: 8 }}>
        File d’envoi{campaignName ? ` : ${campaignName}` : ''}
      </div>
      {unavailable ? (
        <p style={{ fontSize: 13, color: '#6A5A40', margin: 0, lineHeight: 1.5 }}>{unavailable}</p>
      ) : loading ? (
        <p style={{ fontSize: 13, color: '#6A5A40', margin: 0 }}>Chargement…</p>
      ) : (
        <>
          <div style={{ ...CARD, marginBottom: 12 }} data-testid="queue-progress">
            <div style={{ fontSize: 24, fontWeight: 700, color: '#F0E6CC' }} data-testid="queue-counter">
              {sent} / {total} messages envoyés
            </div>
            <div
              role="progressbar"
              aria-label="Progression de l’envoi"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={sent}
              style={{ height: 10, borderRadius: 999, background: 'rgba(232,160,32,0.15)', marginTop: 10, overflow: 'hidden' }}
            >
              <div style={{ width: `${percent}%`, height: '100%', background: GOLD }} />
            </div>
            <div style={{ fontSize: 13, color: '#8A7A5C', marginTop: 8 }} data-testid="queue-scenario">
              Scénario : {AUDIENCE_LABELS[audience] ?? AUDIENCE_LABELS.all_consenting} · {total} destinataire{total > 1 ? 's' : ''} retenu{total > 1 ? 's' : ''}
            </div>
          </div>
          {error && <div role="alert" style={{ fontSize: 13, color: '#E57373', marginBottom: 8 }}>{error}</div>}
          {queue.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6A5A40', margin: 0, lineHeight: 1.5 }}>
              Aucun client à contacter pour cette campagne : tous ont déjà reçu un message ce mois-ci, ont refusé, ou ne sont pas dans la liste VIP.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: '2 1 320px', minWidth: 0 }} data-testid="queue-list">
                <div role="group" aria-label="Filtrer la liste" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={filter === f.key}
                      data-testid={`queue-filter-${f.key}`}
                      style={filter === f.key ? BTN_PRIMARY : BTN}
                      onClick={() => setFilter(f.key)}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {visible.length === 0 && (
                    <p style={{ fontSize: 13, color: '#6A5A40', margin: 0 }}>Aucun client dans ce filtre.</p>
                  )}
                  {visible.map((item) => {
                    const isNext = next !== null && item.phone === next.phone
                    const kind = item.status === 'sent' ? 'sent' : isNext ? 'next' : 'to_send'
                    const text = kind === 'sent' ? 'Envoyé' : kind === 'next' ? 'Prochain' : 'À envoyer'
                    const named = Boolean(item.pseudo && item.pseudo.trim())
                    return (
                      <div
                        key={item.phone}
                        data-testid="queue-row"
                        style={{
                          display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', minHeight: 44,
                          padding: '8px 12px', borderRadius: 10,
                          background: isNext ? 'rgba(232,160,32,0.08)' : 'transparent',
                          border: isNext ? `1px solid ${GOLD}` : '1px solid rgba(232,160,32,0.1)',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#F0E6CC' }}>{label(item)}</div>
                          {named && <div style={{ fontSize: 12, color: '#8A7A5C' }}>{item.phone}</div>}
                        </div>
                        <span style={badgeStyle(kind)}>{text}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <aside style={{ ...CARD, flex: '1 1 300px', minWidth: 0 }} data-testid="queue-next-panel" aria-label="Prochain message">
                {next ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 600, color: GOLD, marginBottom: 10 }}>Prochain : {label(next)}</div>
                    <div
                      data-testid="queue-next-bubble"
                      style={{
                        background: '#DCF8C6', color: '#1B2A1B', borderRadius: '12px 12px 12px 2px', padding: '10px 12px',
                        fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 12,
                      }}
                    >
                      {next.message || 'Aperçu du message indisponible.'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {next.whatsapp_url && (
                        <a href={next.whatsapp_url} target="_blank" rel="noopener noreferrer" style={BTN_PRIMARY}>
                          Ouvrir WhatsApp
                        </a>
                      )}
                      <button type="button" style={BTN} onClick={() => act(next.phone, 'sent')}>Marquer comme envoyé</button>
                      <button type="button" style={BTN} onClick={() => skip(next.phone)} disabled={toSendCount < 2}>Passer ce client</button>
                      <button type="button" style={BTN_STOP} onClick={() => act(next.phone, 'stop')}>A répondu STOP</button>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: '#8A7A5C', margin: 0, lineHeight: 1.5 }}>
                    Tous les messages de cette file ont été envoyés.
                  </p>
                )}
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  )
}
