'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NotFound() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()
  const [heroImage, setHeroImage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('settings').select('value').eq('key', 'hero_image').single().then(({ data }) => {
      if (data?.value) setHeroImage(data.value)
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 500
    canvas.height = 500

    type Particle = {
      x: number; y: number
      vx: number; vy: number
      life: number; maxLife: number
      size: number
      wobble: number; wobbleSpeed: number
    }
    const particles: Particle[] = []

    // 2-3 points de sortie discrets — sommet du pain
    const sources = [
      { x: 215, y: 318 },
      { x: 250, y: 312 },
      { x: 285, y: 318 },
    ]

    const addParticle = () => {
      const src = sources[Math.floor(Math.random() * sources.length)]
      particles.push({
        x: src.x + (Math.random() - 0.5) * 12,
        y: src.y,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(Math.random() * 0.9 + 0.5),
        life: 0,
        maxLife: 90 + Math.random() * 60,
        size: Math.random() * 8 + 5,   // filets fins au départ
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.025 + Math.random() * 0.015,
      })
    }

    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, 500, 500)
      if (frame % 5 === 0) addParticle()   // moins fréquent
      frame++

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.wobble += p.wobbleSpeed
        p.x += p.vx + Math.sin(p.wobble) * 0.6
        p.y += p.vy
        p.size += 0.18         // s'élargit doucement
        p.life++
        if (p.life > p.maxLife) { particles.splice(i, 1); continue }

        const t = p.life / p.maxLife
        const alpha = t < 0.25
          ? (t / 0.25) * 0.18
          : (1 - (t - 0.25) / 0.75) * 0.18   // max 0.18 — très subtil

        ctx.save()
        ctx.globalAlpha = alpha
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
        grad.addColorStop(0,   'rgba(220,220,220,1)')
        grad.addColorStop(0.6, 'rgba(200,200,200,0.4)')
        grad.addColorStop(1,   'rgba(180,180,180,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      requestAnimationFrame(animate)
    }
    animate()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080603',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Fond ambiant */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,200,66,0.06) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -60%)',
        pointerEvents: 'none',
      }} />

      {/* Canvas fumée */}
      <div style={{ position: 'relative', width: 308, height: 308, marginBottom: -60, marginTop: 150 }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', top: -200, left: -96, pointerEvents: 'none', opacity: 1, zIndex: 10 }} />

        {/* Image hero dynamique ou SVG fallback */}
        {heroImage ? (
          <img
            src={heroImage}
            alt="hero"
            style={{
              position: 'relative',
              zIndex: 2,
              width: 308,
              height: 308,
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 40px rgba(245,200,66,0.25))',
            }}
          />
        ) : (
        <svg viewBox="0 0 200 180" width="308" height="277" style={{ position: 'relative', zIndex: 2, filter: 'drop-shadow(0 8px 32px rgba(245,200,66,0.15))' }}>
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 - 90) * Math.PI / 180
            const r1 = 72, r2 = 88
            return (
              <line key={i}
                x1={100 + Math.cos(angle) * r1}
                y1={85 + Math.sin(angle) * r1}
                x2={100 + Math.cos(angle) * r2}
                y2={85 + Math.sin(angle) * r2}
                stroke="#F5C842" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"
              />
            )
          })}
          <ellipse cx="100" cy="62" rx="52" ry="28" fill="#E8A020" opacity="0.95"/>
          <ellipse cx="100" cy="58" rx="48" ry="22" fill="#F5B830"/>
          <ellipse cx="100" cy="55" rx="44" ry="16" fill="#F5C842" opacity="0.6"/>
          <ellipse cx="88" cy="53" rx="4" ry="2" fill="#E8A020" transform="rotate(-20 88 53)"/>
          <ellipse cx="106" cy="50" rx="4" ry="2" fill="#E8A020" transform="rotate(10 106 50)"/>
          <ellipse cx="118" cy="56" rx="3.5" ry="1.8" fill="#E8A020" transform="rotate(-10 118 56)"/>
          <path d="M48 88 Q70 78 100 82 Q130 78 152 88 Q130 96 100 92 Q70 96 48 88Z" fill="#5BC57A" opacity="0.9"/>
          <rect x="50" y="92" width="100" height="10" rx="5" fill="#C8781A" opacity="0.9"/>
          <path d="M50 106 Q100 100 150 106 Q150 118 100 120 Q50 118 50 106Z" fill="#E8402A" opacity="0.85"/>
          <ellipse cx="100" cy="130" rx="55" ry="14" fill="#E8A020"/>
          <ellipse cx="100" cy="128" rx="52" ry="12" fill="#F5B830"/>
          <ellipse cx="100" cy="154" rx="60" ry="8" fill="#1A1408" opacity="0.4"/>
        </svg>
        )}
      </div>

      {/* 404 */}
      <div style={{
        fontFamily: 'Playfair Display, serif',
        fontSize: 96,
        fontWeight: 900,
        color: '#F5C842',
        lineHeight: 1,
        marginBottom: 8,
        letterSpacing: '-4px',
        opacity: 0.95,
      }}>
        404
      </div>

      <div style={{ fontSize: 18, fontWeight: 600, color: '#F5EDD6', marginBottom: 8 }}>
        Cette page n'existe pas
      </div>

      <div style={{ fontSize: 14, color: '#8A7A60', marginBottom: 40, textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
        Elle s'est peut-être perdue en route, comme une commande sans adresse.
      </div>

      <button
        onClick={() => router.push('/')}
        style={{
          padding: '14px 36px',
          borderRadius: 50,
          border: 'none',
          background: 'linear-gradient(135deg, #F5C842, #FF6B20)',
          color: '#0A0804',
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 800,
          fontSize: 14,
          cursor: 'pointer',
          letterSpacing: '0.3px',
        }}
      >
        Retour à l'accueil
      </button>
    </div>
  )
}
