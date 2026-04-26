'use client'
import { useEffect, useRef } from 'react'

export default function SmokeEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const particles: any[] = []

    class Particle {
      x: number; y: number; size: number; speedX: number; speedY: number
      opacity: number; life: number; maxLife: number; wobble: number; wobbleSpeed: number

      constructor(x: number, y: number) {
        this.x = x + (Math.random() - 0.5) * 40
        this.y = y
        this.size = Math.random() * 18 + 8
        this.speedX = (Math.random() - 0.5) * 0.3
        this.speedY = -(Math.random() * 0.5 + 0.25)
        this.opacity = Math.random() * 0.12 + 0.04
        this.life = 0
        this.maxLife = Math.random() * 120 + 80
        this.wobble = Math.random() * Math.PI * 2
        this.wobbleSpeed = (Math.random() - 0.5) * 0.03
      }

      update() {
        this.life++
        this.wobble += this.wobbleSpeed
        this.x += this.speedX + Math.sin(this.wobble) * 0.4
        this.y += this.speedY
        this.size += 0.18
        const progress = this.life / this.maxLife
        if (progress < 0.2) {
          this.opacity = (progress / 0.2) * 0.18
        } else {
          this.opacity = ((1 - progress) / 0.8) * 0.18
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size)
        gradient.addColorStop(0, `rgba(255,200,120,${this.opacity * 1.2})`)
        gradient.addColorStop(0.4, `rgba(220,160,80,${this.opacity})`)
        gradient.addColorStop(1, `rgba(180,120,60,0)`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
      }

      isDead() { return this.life >= this.maxLife }
    }

    let frame = 0
    let animId: number

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Spawn plusieurs particules depuis différents points du burger
      if (frame % 6 === 0) {
        const baseY = canvas.height * 0.82
        const spawnPoints = [
          canvas.width * 0.60 - 50,
          canvas.width * 0.65 - 50,
          canvas.width * 0.70 - 50,
          canvas.width * 0.75 - 50,
          canvas.width * 0.80 - 50,
          canvas.width * 0.85 - 50,
          canvas.width * 0.90 - 50,
        ]
        spawnPoints.forEach(x => {
          if (Math.random() > 0.4) {
            particles.push(new Particle(x, baseY))
          }
        })
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update()
        particles[i].draw(ctx)
        if (particles[i].isDead()) particles.splice(i, 1)
      }

      frame++
      animId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
    />
  )
}
