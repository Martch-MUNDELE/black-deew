'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type FooterSettingRow = {
  key: string
  value: string | null
}

export default function FooterHero() {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [line1, setLine1] = useState('Livraison à')
  const [line2, setLine2] = useState('Kinshasa.')
  const [subtitle, setSubtitle] = useState('Directement chez toi.')
  const [description, setDescription] = useState('Plats chauds, boissons fraîches et snacks livrés rapidement.')

  useEffect(() => {
    supabase.from('settings').select('key, value')
      .in('key', ['footer_line1', 'footer_line2', 'footer_subtitle', 'footer_description'])
      .then(({ data }) => {
        if (!data) return

        const settingsRows = data as FooterSettingRow[]
        settingsRows.forEach((s) => {
          if (s.key === 'footer_line1' && s.value) setLine1(s.value)
          if (s.key === 'footer_line2' && s.value) setLine2(s.value)
          if (s.key === 'footer_subtitle' && s.value) setSubtitle(s.value)
          if (s.key === 'footer_description' && s.value) setDescription(s.value)
        })
      })
  }, [supabase])

  if (pathname !== '/') return null
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 0, pointerEvents: 'none', height: 'clamp(220px, 40vh, 360px)', overflow: 'hidden' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', height: '100%' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', background: 'linear-gradient(to top, rgba(8,6,3,0.9) 0%, rgba(8,6,3,0.5) 40%, transparent 100%)', zIndex: 1 }} />
        <div style={{ position: 'absolute', bottom: 28, left: 20, zIndex: 2 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(22px, 7vw, 34px)', lineHeight: 0.95, letterSpacing: '-1px', marginBottom: 6 }}>
            <span style={{ display: 'block', background: 'linear-gradient(135deg,#FFD060 0%,#F5A020 35%,#FF6020 70%,#FF3500 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{line1}</span>
            <span style={{ display: 'block', background: 'linear-gradient(135deg,#FFD060 0%,#F5A020 35%,#FF6020 70%,#FF3500 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{line2}</span>
          </div>
          <p style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 14, color: '#FFFFFF', margin: '0 0 4px', fontStyle: 'italic' }}>{subtitle}</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.5, maxWidth: 'min(200px, 65vw)', margin: 0 }}>{description}</p>
        </div>
      </div>
    </div>
  )
}
