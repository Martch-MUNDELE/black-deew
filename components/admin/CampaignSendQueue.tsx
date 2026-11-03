'use client'

import { useCallback, useEffect, useState } from 'react'

// BLAC-P2-026 : file d'envoi WhatsApp d'une campagne prete. Aucun envoi automatique :
// l'admin ouvre WhatsApp pour chaque client, puis marque le message envoye ou STOP.

type QueueItem = { phone: string; status: 'to_send' | 'sent'; whatsapp_url: string | null }

const AUDIENCE_LABELS: Record<string, string> = {
  all_consenting: 'Tous les clients autorisés',
  best_clients: 'Meilleurs clients',
  inactive_clients: 'Clients inactifs',
}

const BTN: React.CSSProperties = {
  minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(232,160,32,0.4)',
  background: 'transparent', color: '#E8A020', fontSize: 12, cursor: 'pointer', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center',
}

export default function CampaignSendQueue({ campaignId, campaignName }: { campaignId: string; campaignName?: string }) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [sent, setSent] = useState(0)
  const [total, setTotal] = useState(0)
  const [audience, setAudience] = useState<string>('all_consenting')
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const box: React.CSSProperties = {
    background: '#131009', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 12, padding: '1rem', marginTop: 16,
  }

  return (
    <div style={box} data-testid="campaign-send-queue">
      <div style={{ fontSize: 14, fontWeight: 600, color: '#E8A020', marginBottom: 4 }}>
        File d’envoi{campaignName ? ` : ${campaignName}` : ''}
      </div>
      {unavailable ? (
        <p style={{ fontSize: 13, color: '#6A5A40', margin: 0, lineHeight: 1.5 }}>{unavailable}</p>
      ) : loading ? (
        <p style={{ fontSize: 13, color: '#6A5A40', margin: 0 }}>Chargement…</p>
      ) : (
        <>
          <div style={{ fontSize: 13, color: '#8A7A5C', marginBottom: 10 }} data-testid="queue-counter">
            {sent} envoyé{sent > 1 ? 's' : ''} sur {total}
          </div>
          <div style={{ fontSize: 13, color: '#8A7A5C', marginBottom: 10 }} data-testid="queue-scenario">
            Scénario : {AUDIENCE_LABELS[audience] ?? AUDIENCE_LABELS.all_consenting} · {total} destinataire{total > 1 ? 's' : ''} retenu{total > 1 ? 's' : ''}
          </div>
          {error && <div role="alert" style={{ fontSize: 13, color: '#E57373', marginBottom: 8 }}>{error}</div>}
          {queue.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6A5A40', margin: 0, lineHeight: 1.5 }}>
              Aucun client à contacter pour cette campagne : tous ont déjà reçu un message ce mois-ci, ont refusé, ou ne sont pas dans la liste VIP.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {queue.map((item) => (
                <div key={item.phone} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
                  justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(232,160,32,0.1)' }}>
                  <span style={{ fontSize: 14, color: '#F0E6CC' }}>{item.phone}</span>
                  {item.status === 'sent' ? (
                    <span style={{ fontSize: 12, color: '#8A7A5C' }}>Envoyé</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {item.whatsapp_url && (
                        <a href={item.whatsapp_url} target="_blank" rel="noopener noreferrer" style={BTN}>
                          Ouvrir WhatsApp
                        </a>
                      )}
                      <button type="button" style={BTN} onClick={() => act(item.phone, 'sent')}>Marquer envoyé</button>
                      <button type="button" style={{ ...BTN, border: '1px solid rgba(229,115,115,0.4)', color: '#E57373' }}
                        onClick={() => act(item.phone, 'stop')}>A répondu STOP</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
