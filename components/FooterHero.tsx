'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type FooterSettingRow = {
  key: string
  value: string | null
}

export default function FooterHero({
  initialSettings = [],
}: {
  initialSettings?: FooterSettingRow[]
}) {
  const initialSetting = (key: string, fallback = '') =>
    initialSettings.find((setting) => setting.key === key)?.value ?? fallback
  const pathname = usePathname()
  const [line1, setLine1] = useState(initialSetting('footer_line1'))
  const [line2, setLine2] = useState(initialSetting('footer_line2'))
  const [subtitle, setSubtitle] = useState(initialSetting('footer_subtitle'))
  const [description, setDescription] = useState(initialSetting('footer_description'))

  useEffect(() => {
    fetch('/api/public-cms', {
      cache: 'no-store'
    })
      .then((res) => res.json())
      .then((payload) => {
        const settingsRows =
          (
            Array.isArray(payload?.settings)
              ? payload.settings
              : []
          ) as FooterSettingRow[]

        settingsRows.forEach((setting) => {
          if (
            setting.key === 'footer_line1' &&
            setting.value
          ) {
            setLine1(setting.value)
          }

          if (
            setting.key === 'footer_line2' &&
            setting.value
          ) {
            setLine2(setting.value)
          }

          if (
            setting.key === 'footer_subtitle' &&
            setting.value
          ) {
            setSubtitle(setting.value)
          }

          if (
            setting.key === 'footer_description' &&
            setting.value
          ) {
            setDescription(setting.value)
          }
        })
      })
      .catch((error) => {
        console.error(
          '[PUBLIC CMS FooterHero]',
          error
        )
      })
  }, [])

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
