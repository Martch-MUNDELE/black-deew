'use client'
// BLAC-P3-065 : envoie la position du livreur a /api/driver/tracking toutes les 15 s environ tant que la course est affichee.
import { useEffect, useRef, useState } from 'react'
import { buildPositionPayload, shouldSendPosition } from '@/lib/tracking-sender'

const SANS = "'DM Sans', sans-serif"

type Status = 'waiting' | 'shared' | 'denied'

export default function DriverTrackingSender({ deliveryId }: { deliveryId: string }) {
  const [status, setStatus] = useState<Status>('waiting')
  const lastSentAt = useRef<number | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('denied')
      return
    }
    let cancelled = false
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) return
        const now = Date.now()
        if (!shouldSendPosition(lastSentAt.current, now)) return
        const payload = buildPositionPayload(deliveryId, position.coords)
        if (!payload) return
        lastSentAt.current = now
        try {
          fetch('/api/driver/tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
            .then((res) => {
              if (!cancelled && res.ok) setStatus('shared')
            })
            .catch(() => {
              // Echec reseau : ignore, le prochain envoi reessaiera
            })
        } catch {
          // Ne jamais casser l'ecran
        }
        if (!cancelled) setStatus('shared')
      },
      () => {
        if (!cancelled) setStatus('denied')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
    return () => {
      cancelled = true
      navigator.geolocation.clearWatch(watchId)
    }
  }, [deliveryId])

  if (status === 'waiting') return null
  const ok = status === 'shared'
  return (
    <div
      role="status"
      style={{
        alignSelf: 'flex-start',
        fontFamily: SANS,
        fontSize: 13,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
        background: ok ? 'rgba(127,214,160,0.15)' : 'rgba(255,165,102,0.15)',
        color: ok ? '#7FD6A0' : '#FFA566',
      }}
    >
      {ok ? 'Position partagée' : 'Active la localisation pour que le client te suive'}
    </div>
  )
}
