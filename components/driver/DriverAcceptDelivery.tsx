'use client'
// BLAC-P3-058 : bouton "Accepter la course" (prise en charge avant livraison).
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SANS = "'DM Sans', sans-serif"

export default function DriverAcceptDelivery({ deliveryId }: { deliveryId: string }) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/driver/accept-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: deliveryId }),
      })
      if (!res.ok) {
        setError(
          res.status === 409
            ? 'Cette course ne peut plus être acceptée.'
            : "La course n'a pas pu être acceptée. Réessaie."
        )
        setSending(false)
        return
      }
      setSending(false)
      router.refresh()
    } catch {
      setError('Connexion impossible. Réessaie.')
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error ? (
        <div role="alert" style={{ fontFamily: SANS, fontSize: 14, color: '#FFA566' }}>
          {error}
        </div>
      ) : null}
      <button
        type="button"
        disabled={sending}
        onClick={send}
        style={{
          width: '100%',
          minHeight: 52,
          borderRadius: 14,
          fontFamily: SANS,
          fontSize: 16,
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #F5C842, #FF6B20)',
          color: '#1A1206',
          opacity: sending ? 0.6 : 1,
        }}
      >
        {sending ? 'Envoi…' : 'Accepter la course'}
      </button>
    </div>
  )
}
