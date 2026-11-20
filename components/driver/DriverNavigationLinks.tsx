'use client'
// BLAC-P3-063 puis BLAC-DETAIL-ERGONOMIE : bloc d'itineraire du livreur (un bouton principal adapte a l'appareil, autres applications repliees).
import { useEffect, useState } from 'react'
import { buildNavigationLinks } from '@/lib/driver-navigation'
import { detectNavigationTarget, LABEL_COLOR, LABEL_FONT_SIZE, type NavigationTarget } from '@/lib/driver-delivery-view'

const C = {
  card: '#15110B',
  border: '#2A2216',
  gold: '#F5C842',
  orange: '#FF6B20',
  dark: '#1A1206',
}
const SANS = "'DM Sans', sans-serif"

const labelStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: LABEL_FONT_SIZE,
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: LABEL_COLOR,
}

const mainButton: React.CSSProperties = {
  minHeight: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 14,
  fontFamily: SANS,
  fontSize: 17,
  fontWeight: 700,
  textDecoration: 'none',
  background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
  color: C.dark,
}

const smallButton: React.CSSProperties = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 12,
  fontFamily: SANS,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  background: C.card,
  color: C.gold,
  border: `1px solid ${C.gold}`,
}

export default function DriverNavigationLinks({
  address,
  lat,
  lng,
}: {
  address?: string | null
  lat?: number | string | null
  lng?: number | string | null
}) {
  const [target, setTarget] = useState<NavigationTarget>('google')
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    setTarget(detectNavigationTarget({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints }))
  }, [])

  const links = buildNavigationLinks({ address, lat, lng })
  if (!links) return null

  const mainHref = target === 'apple' ? links.apple : target === 'android' ? links.android : links.google

  const apps: { label: string; href: string }[] = [
    { label: 'Google Maps', href: links.google },
    { label: 'Waze', href: links.waze },
    { label: 'Plans Apple', href: links.apple },
    { label: 'Android', href: links.android },
  ]

  return (
    <div
      aria-label="Itinéraire"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12 }}
    >
      <div style={labelStyle}>Itinéraire</div>
      <a href={mainHref} target="_blank" rel="noopener noreferrer" style={mainButton}>
        {"Lancer l'itinéraire"}
      </a>
      <details>
        <summary style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.gold, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
          Autre application
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {apps.map((app) => (
            <a key={app.label} href={app.href} target="_blank" rel="noopener noreferrer" style={smallButton}>
              {app.label}
            </a>
          ))}
        </div>
      </details>
    </div>
  )
}
