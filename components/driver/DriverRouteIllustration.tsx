// BLAC-P3-068 : illustration stylisee du trajet (SVG pur, sans etat, aucune image externe ni appel reseau).
const C = { bg: '#120E08', street: '#2A2216', gold: '#F5C842', green: '#7FD6A0', orange: '#FF6B20', card: '#15110B', text: '#F5EDD6', border: '#2A2216' }

export default function DriverRouteIllustration({ distanceText }: { distanceText?: string }) {
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: C.bg }}>
      <svg viewBox="0 0 320 160" width="100%" style={{ display: 'block' }} aria-hidden="true" focusable="false">
        <rect width="320" height="160" fill={C.bg} />
        <g stroke={C.street} strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M0 40 L320 56" />
          <path d="M0 110 L320 96" />
          <path d="M70 0 L90 160" />
          <path d="M200 0 L180 160" />
          <path d="M250 0 L290 160" />
        </g>
        <g stroke={C.street} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M0 78 L320 76" />
          <path d="M130 0 L140 160" />
        </g>
        <path d="M50 124 C 100 120, 120 60, 180 78 S 260 60, 262 36" fill="none" stroke={C.gold} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 8" />
        <circle cx="50" cy="124" r="8" fill={C.green} />
        <circle cx="50" cy="124" r="3" fill={C.bg} />
        <path d="M262 14 C 252 14 246 21 246 29 C 246 40 262 54 262 54 C 262 54 278 40 278 29 C 278 21 272 14 262 14 Z" fill={C.orange} />
        <circle cx="262" cy="29" r="5" fill={C.bg} />
      </svg>
      {distanceText ? (
        <span
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            padding: '4px 10px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: C.text,
          }}
        >
          {distanceText}
        </span>
      ) : null}
    </div>
  )
}
