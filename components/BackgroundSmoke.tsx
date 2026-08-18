'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import SmokeEffect from '@/components/SmokeEffect'

type BackgroundSettingRow = {
  key: string
  value: string | null
}

export default function BackgroundSmoke({
  initialSettings = [],
}: {
  initialSettings?: BackgroundSettingRow[]
}) {
  const initialSetting = (key: string, fallback = '') =>
    initialSettings.find((setting) => setting.key === key)?.value ?? fallback
  const [heroImage, setHeroImage] = useState(initialSetting('hero_image'))
  const [backgroundImage, setBackgroundImage] = useState(initialSetting('background_image', '/background-home.jpg'))
  const [bgImageActive, setBgImageActive] = useState(initialSetting('background_image_active', 'true'))
  const [bgType, setBgType] = useState(initialSetting('background_type', 'color'))
  const [bgColor, setBgColor] = useState(initialSetting('background_color', '#0A0804'))
  const [bgGradStart, setBgGradStart] = useState(initialSetting('background_gradient_start', '#0A0804'))
  const [bgGradEnd, setBgGradEnd] = useState(initialSetting('background_gradient_end', '#1a0a02'))
  const [bgGradDir, setBgGradDir] = useState(initialSetting('background_gradient_dir', 'to bottom'))
  const pathname = usePathname()
  const showBg = pathname === '/'

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
          ) as BackgroundSettingRow[]

        settingsRows.forEach((setting) => {
          if (
            setting.key === 'hero_image' &&
            setting.value
          ) {
            setHeroImage(setting.value)
          }

          if (
            setting.key === 'background_image' &&
            setting.value
          ) {
            setBackgroundImage(setting.value)
          }

          if (
            setting.key === 'background_image_active' &&
            setting.value
          ) {
            setBgImageActive(setting.value)
          }

          if (
            setting.key === 'background_type' &&
            setting.value
          ) {
            setBgType(setting.value)
          }

          if (
            setting.key === 'background_color' &&
            setting.value
          ) {
            setBgColor(setting.value)
          }

          if (
            setting.key === 'background_gradient_start' &&
            setting.value
          ) {
            setBgGradStart(setting.value)
          }

          if (
            setting.key === 'background_gradient_end' &&
            setting.value
          ) {
            setBgGradEnd(setting.value)
          }

          if (
            setting.key === 'background_gradient_dir' &&
            setting.value
          ) {
            setBgGradDir(setting.value)
          }
        })
      })
      .catch((error) => {
        console.error(
          '[PUBLIC CMS BackgroundSmoke]',
          error
        )
      })
  }, [])

  if (!showBg) return null

  if (bgImageActive === 'false') {
    const customBg = bgType === 'color'
      ? bgColor
      : `linear-gradient(${bgGradDir}, ${bgGradStart}, ${bgGradEnd})`
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', background: customBg }} />
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, maxWidth: 600, margin: '0 auto' }}>

        {/* Background Kinshasa nuit — zIndex 0 */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundRepeat: 'no-repeat',
            opacity: 0.35,
            zIndex: 0,
          }}
        />

        {/* Fondu haut navbar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '25%', background: 'linear-gradient(to bottom, rgba(8,6,3,0.95) 0%, transparent 100%)', zIndex: 1 }} />

        {/* Fondu gauche lisibilité */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(8,6,3,0.85) 0%, rgba(8,6,3,0.5) 50%, rgba(8,6,3,0.2) 100%)', zIndex: 1 }} />

        {/* Fumée canvas — zIndex 2 — derrière le personnage */}
        {heroImage && <SmokeEffect />}

        {/* Burger — zIndex 2 */}
        {heroImage && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 'min(75%, 450px)',
              height: 'min(55%, 360px)',
              backgroundImage: `url(${heroImage})`,
              backgroundSize: 'contain',
              backgroundPosition: 'right bottom',
              backgroundRepeat: 'no-repeat',
              opacity: 0.95,
              zIndex: 2,
            }}
          />
        )}

        {/* Halo chaud burger */}
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '80%', height: '50%', background: 'radial-gradient(ellipse 65% 55% at 75% 95%, rgba(232,120,20,0.2) 0%, transparent 65%)', zIndex: 2 }} />

      </div>
    </div>
  )
}
