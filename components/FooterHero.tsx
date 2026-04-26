'use client'
import { usePathname } from 'next/navigation'

export default function FooterHero() {
  const pathname = usePathname()
  if (pathname !== '/') return null
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 0, pointerEvents: 'none', height: 'clamp(220px, 40vh, 360px)', overflow: 'hidden' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', height: '100%' }}>
        {/* Fondu bas */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', background: 'linear-gradient(to top, rgba(8,6,3,0.9) 0%, rgba(8,6,3,0.5) 40%, transparent 100%)', zIndex: 1 }} />
        {/* Texte accroche */}
        <div style={{ position: 'absolute', bottom: 28, left: 20, zIndex: 2 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(22px, 7vw, 34px)', lineHeight: 0.95, letterSpacing: '-1px', marginBottom: 6 }}>
            <span style={{ display: 'block', background: 'linear-gradient(135deg,#FFD060 0%,#F5A020 35%,#FF6020 70%,#FF3500 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Saveurs du</span>
            <span style={{ display: 'block', background: 'linear-gradient(135deg,#FFD060 0%,#F5A020 35%,#FF6020 70%,#FF3500 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Souss.</span>
          </div>
          <p style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 14, color: '#FFFFFF', margin: '0 0 4px', fontStyle: 'italic' }}>Livrées chez toi.</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.5, maxWidth: 'min(200px, 65vw)', margin: 0 }}>Sandwichs maison, salades fraîches et boissons du terroir.</p>
        </div>
      </div>
    </div>
  )
}
