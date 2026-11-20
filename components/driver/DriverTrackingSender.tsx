'use client'
// BLAC-P3-065 : envoie la position du livreur a /api/driver/tracking toutes les 15 s environ tant que la course est affichee.
// BLAC-P3-077 : verrou d'ecran allume (wakeLock) quand disponible, position immediate au retour de visibilite.
import { useEffect, useRef, useState } from 'react'
import { buildPositionPayload, shouldSendPosition } from '@/lib/tracking-sender'

const SANS = "'DM Sans', sans-serif"

type Status = 'waiting' | 'shared' | 'denied'

type WakeLockSentinelLike = { release?: () => Promise<void> }

export default function DriverTrackingSender({ deliveryId }: { deliveryId: string }) {
  const [status, setStatus] = useState<Status>('waiting')
  const lastSentAt = useRef<number | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('denied')
      return
    }
    let cancelled = false

    function sendCoords(coords: GeolocationCoordinates, force: boolean) {
      if (cancelled) return
      const now = Date.now()
      if (!force && !shouldSendPosition(lastSentAt.current, now)) return
      const payload = buildPositionPayload(deliveryId, coords)
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
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => sendCoords(position.coords, false),
      () => {
        if (!cancelled) setStatus('denied')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )

    // Verrou d'ecran : toute indisponibilite ou erreur est ignoree
    let wakeLock: WakeLockSentinelLike | null = null
    async function requestWakeLock() {
      try {
        const nav = navigator as unknown as { wakeLock?: { request?: (type: 'screen') => Promise<WakeLockSentinelLike> } }
        if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') return
        const sentinel = await nav.wakeLock.request('screen')
        if (cancelled) {
          try {
            await sentinel?.release?.()
          } catch {
            // ignore
          }
          return
        }
        wakeLock = sentinel
      } catch {
        // verrou refuse ou indisponible : ignore
      }
    }
    void requestWakeLock()

    function onVisibilityChange() {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
      void requestWakeLock()
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => sendCoords(position.coords, true),
          () => {
            // ignore : le watch continue
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
        )
      } catch {
        // ignore
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      navigator.geolocation.clearWatch(watchId)
      try {
        void wakeLock?.release?.()?.catch?.(() => {})
      } catch {
        // ignore
      }
    }
  }, [deliveryId])

  const ok = status === 'shared'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'flex-start' }}>
      {status === 'waiting' ? null : (
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
          {ok ? 'Position partagée avec le client' : 'Active la localisation pour que le client te suive'}
        </div>
      )}
      <div style={{ fontFamily: SANS, fontSize: 13, color: '#BFAF8F' }}>Garde cet écran ouvert pour que le client te suive</div>
    </div>
  )
}
