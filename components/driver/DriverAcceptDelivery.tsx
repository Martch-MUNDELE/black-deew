'use client'
// BLAC-P3-058 : bouton "Accepter la course" (prise en charge avant livraison).
// BLAC-P3-066 : apres acceptation, lien WhatsApp "Prevenir le client" avant de rafraichir.
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SANS = "'DM Sans', sans-serif"

export default function DriverAcceptDelivery({ deliveryId }: { deliveryId: string }) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<{ whatsappUrl: string } | null>(null)

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
      let whatsappUrl: string | null = null
      try {
        const data = (await res.json()) as { whatsappUrl?: unknown }
        whatsappUrl = typeof data.whatsappUrl === 'string' && data.whatsappUrl ? data.whatsappUrl : null
      } catch {
        whatsappUrl = null
      }
      setSending(false)
      if (!whatsappUrl) {
        router.refresh()
        return
      }
      setAccepted({ whatsappUrl })
      try {
        // Ouverture automatique : si le navigateur la refuse, le lien ci-dessous reste disponible.
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      } catch {
        // jamais bloquant
      }
    } catch {
      setError('Connexion impossible. Réessaie.')
      setSending(false)
    }
  }

  if (accepted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, color: '#F5C842' }}>Course acceptée</div>
        <a
          href={accepted.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: '100%',
            minHeight: 52,
            borderRadius: 14,
            fontFamily: SANS,
            fontSize: 16,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            background: '#25D366',
            color: '#0B1A10',
          }}
        >
          Prévenir le client sur WhatsApp
        </a>
        <button
          type="button"
          onClick={() => router.refresh()}
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
          }}
        >
          Continuer
        </button>
      </div>
    )
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
