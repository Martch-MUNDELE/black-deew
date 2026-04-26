'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SmokeEffect from '@/components/SmokeEffect'

export default function BackgroundSmoke() {
  const [heroImage, setHeroImage] = useState('')
  const [backgroundImage, setBackgroundImage] = useState('/background-home.jpg')
  const [bgImageActive, setBgImageActive] = useState('true')
  const [bgType, setBgType] = useState('color')
  const [bgColor, setBgColor] = useState('#0A0804')
  const [bgGradStart, setBgGradStart] = useState('#0A0804')
  const [bgGradEnd, setBgGradEnd] = useState('#1a0a02')
  const [bgGradDir, setBgGradDir] = useState('to bottom')
  const pathname = usePathname()
  const showBg = pathname === '/'

  useEffect(() => {
    const supabase = createClient()
    supabase.from('settings').select('*').in('key', [
      'hero_image', 'background_image', 'background_image_active',
      'background_type', 'background_color', 'background_gradient_start',
      'background_gradient_end', 'background_gradient_dir',
    ]).then(({ data }) => {
      data?.forEach((s: any) => {
        if (s.key === 'hero_image' && s.value) setHeroImage(s.value)
        if (s.key === 'background_image' && s.value) setBackgroundImage(s.value)
        if (s.key === 'background_image_active') setBgImageActive(s.value)
        if (s.key === 'background_type') setBgType(s.value)
        if (s.key === 'background_color' && s.value) setBgColor(s.value)
        if (s.key === 'background_gradient_start' && s.value) setBgGradStart(s.value)
        if (s.key === 'background_gradient_end' && s.value) setBgGradEnd(s.value)
        if (s.key === 'background_gradient_dir' && s.value) setBgGradDir(s.value)
      })
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

        {/* Background Agadir nuit — zIndex 0 */}
        <img
          src={backgroundImage}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: 0.35, zIndex: 0 }}
        />

        {/* Fondu haut navbar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '25%', background: 'linear-gradient(to bottom, rgba(8,6,3,0.95) 0%, transparent 100%)', zIndex: 1 }} />

        {/* Fondu gauche lisibilité */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(8,6,3,0.85) 0%, rgba(8,6,3,0.5) 50%, rgba(8,6,3,0.2) 100%)', zIndex: 1 }} />

        {/* Burger — zIndex 2 */}
        {heroImage && (
          <img src={heroImage} alt="" style={{ position: 'absolute', bottom: 0, right: 0, width: 'min(75%, 450px)', height: 'min(55%, 360px)', objectFit: 'contain', objectPosition: 'right bottom', opacity: 0.95, zIndex: 2 }} />
        )}

        {/* Halo chaud burger */}
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '80%', height: '50%', background: 'radial-gradient(ellipse 65% 55% at 75% 95%, rgba(232,120,20,0.2) 0%, transparent 65%)', zIndex: 2 }} />

        {/* Fumée canvas — zIndex 3 */}
        {heroImage && <SmokeEffect />}

      </div>
    </div>
  )
}
