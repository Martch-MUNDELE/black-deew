'use client'
// BLAC-SUIVI-LIVRAISON-PAGE : page publique de suivi de livraison (lien secret /suivi/<token>).
// Aucune donnee personnelle : seulement la position du livreur et l'heure de mise a jour.
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { googleMapsUrl, osmEmbedUrl, trackingStatusText, type TrackingView } from '@/lib/tracking-view'

const POLL_MS = 10_000

export default function SuiviPage() {
  const params = useParams<{ token: string }>()
  const token = typeof params?.token === 'string' ? params.token : ''
  const [view, setView] = useState<TrackingView | null>(null)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!token) {
      setInvalid(true)
      return
    }
    let stopped = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function load() {
      try {
        const res = await fetch(`/api/tracking/${encodeURIComponent(token)}`, { cache: 'no-store' })
        if (stopped) return
        if (res.status === 404) {
          setInvalid(true)
          if (timer) clearInterval(timer)
          return
        }
        if (!res.ok) return
        const data = (await res.json()) as TrackingView
        if (!stopped) setView(data)
      } catch {
        // erreur reseau passagere : on garde la derniere vue et on reessaie au prochain tour
      }
    }

    load()
    timer = setInterval(load, POLL_MS)
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
    }
  }, [token])

  const hasPosition = !!view && typeof view.lat === 'number' && typeof view.lng === 'number'
  const finished = !!view && !view.active
  const updatedAt = view?.updated_at ? new Date(view.updated_at) : null
  const updatedLabel =
    updatedAt && !Number.isNaN(updatedAt.getTime())
      ? updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : null

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#080603',
        color: '#F5EDD6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        <p style={{ color: '#E8A020', letterSpacing: 3, fontSize: 12, textTransform: 'uppercase', margin: 0 }}>
          Black Deew
        </p>
        <h1 style={{ fontSize: 24, margin: '8px 0 20px', fontWeight: 700 }}>Suivi de ta livraison</h1>

        {invalid ? (
          <div style={cardStyle}>
            <p style={{ fontSize: 18, margin: 0 }}>Ce lien de suivi n'est plus valide</p>
          </div>
        ) : !view ? (
          <div style={cardStyle}>
            <p style={{ margin: 0, color: '#B8A98A' }}>Chargement…</p>
          </div>
        ) : finished ? (
          <div style={cardStyle}>
            <p style={{ fontSize: 18, margin: 0, color: '#E8A020' }}>{trackingStatusText(view)}</p>
            <p style={{ margin: '8px 0 0', color: '#B8A98A' }}>Merci et bon appétit !</p>
          </div>
        ) : (
          <>
            <div style={cardStyle}>
              <p style={{ fontSize: 18, margin: 0, color: '#E8A020' }}>{trackingStatusText(view)}</p>
              {updatedLabel && (
                <p style={{ margin: '8px 0 0', color: '#B8A98A', fontSize: 14 }}>
                  Dernière mise à jour : {updatedLabel}
                </p>
              )}
            </div>
            {hasPosition && (
              <>
                <iframe
                  title="Position du livreur"
                  src={osmEmbedUrl(view.lat as number, view.lng as number)}
                  style={{
                    width: '100%',
                    height: 320,
                    border: '1px solid rgba(232,160,32,0.28)',
                    borderRadius: 12,
                    marginTop: 16,
                    background: '#131009',
                  }}
                  loading="lazy"
                />
                <a
                  href={googleMapsUrl(view.lat as number, view.lng as number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    marginTop: 16,
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: '#E8A020',
                    color: '#080603',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Ouvrir dans Google Maps
                </a>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#131009',
  border: '1px solid rgba(232,160,32,0.28)',
  borderRadius: 12,
  padding: 20,
}
