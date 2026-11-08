// BLAC-P3-063 : bloc « Itineraire » du livreur (Google Maps, Waze, Plans, Android).
import { buildNavigationLinks } from '@/lib/driver-navigation'

const C = {
  card: '#15110B',
  border: '#2A2216',
  muted: '#BFAF8F',
  gold: '#F5C842',
  orange: '#FF6B20',
  dark: '#1A1206',
}
const SANS = "'DM Sans', sans-serif"

const labelStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: C.muted,
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
  const links = buildNavigationLinks({ address, lat, lng })
  if (!links) return null

  const apps: { label: string; href: string }[] = [
    { label: 'Google Maps', href: links.google },
    { label: 'Waze', href: links.waze },
    { label: 'Plans', href: links.apple },
    { label: 'Android', href: links.android },
  ]

  return (
    <div
      aria-label="Itinéraire"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12 }}
    >
      <div style={labelStyle}>Itinéraire</div>
      <a href={links.google} target="_blank" rel="noopener noreferrer" style={mainButton}>
        {"Lancer l'itinéraire"}
      </a>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {apps.map((app) => (
          <a key={app.label} href={app.href} target="_blank" rel="noopener noreferrer" style={smallButton}>
            {app.label}
          </a>
        ))}
      </div>
    </div>
  )
}
