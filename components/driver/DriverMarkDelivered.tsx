'use client'
// BLAC-P3-051 : bouton "Marquer comme livree" avec confirmation dans la page (aucune boite du navigateur).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/driver-space'
import DriverTrackingSender from '@/components/driver/DriverTrackingSender'
import { shareTrackingViaWhatsApp } from '@/lib/delivery-whatsapp'

const SANS = "'DM Sans', sans-serif"

const baseButton: React.CSSProperties = {
  flex: 1,
  minHeight: 52,
  borderRadius: 14,
  fontFamily: SANS,
  fontSize: 16,
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
}

function DriverMarkDeliveredForm({ deliveryId, amount }: { deliveryId: string; amount: number }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/driver/mark-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: deliveryId }),
      })
      if (!res.ok) {
        setError(
          res.status === 409
            ? 'Cette livraison est annulée.'
            : "La livraison n'a pas pu être enregistrée. Réessaie."
        )
        setSending(false)
        return
      }
      setConfirming(false)
      setSending(false)
      router.refresh()
    } catch {
      setError('Connexion impossible. Réessaie.')
      setSending(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null)
          setConfirming(true)
        }}
        style={{ ...baseButton, width: '100%', background: '#7FD6A0', color: '#0B1A12' }}
      >
        Marquer comme livrée
      </button>
    )
  }

  return (
    <div role="group" aria-label="Confirmation de livraison" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: SANS, fontSize: 15, color: '#F5EDD6' }}>
        <strong>Confirmer la livraison ?</strong>
        <div style={{ color: '#BFAF8F', marginTop: 2 }}>Montant encaissé : {formatMoney(amount)}</div>
      </div>
      {error ? (
        <div role="alert" style={{ fontFamily: SANS, fontSize: 14, color: '#FFA566' }}>
          {error}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          disabled={sending}
          onClick={() => {
            setConfirming(false)
            setError(null)
          }}
          style={{ ...baseButton, background: '#15110B', color: '#F5C842', border: '1px solid #F5C842', opacity: sending ? 0.5 : 1 }}
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={sending}
          onClick={send}
          style={{ ...baseButton, background: '#7FD6A0', color: '#0B1A12', opacity: sending ? 0.6 : 1 }}
        >
          {sending ? 'Envoi…' : 'Oui, livrée'}
        </button>
      </div>
    </div>
  )
}

// BLAC-P3-065 / BLAC-P3-077 : envoi de position + bouton qui ouvre WhatsApp avec le message complet pret a envoyer
export default function DriverMarkDelivered({ deliveryId, amount }: { deliveryId: string; amount: number }) {
  const [tipOpen, setTipOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  async function shareTracking() {
    if (sharing) return
    setSharing(true)
    setShareError(null)
    const result = await shareTrackingViaWhatsApp({
      deliveryId,
      fetchImpl: (input, init) => fetch(input, init),
      open: (url) => {
        window.location.href = url
      },
    })
    if (!result.ok) setShareError(result.error)
    setSharing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DriverTrackingSender deliveryId={deliveryId} />
      <DriverMarkDeliveredForm deliveryId={deliveryId} amount={amount} />
      <button
        type="button"
        disabled={sharing}
        onClick={shareTracking}
        style={{
          width: '100%',
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 12,
          padding: '0 14px',
          background: '#15110B',
          border: '1px solid #F5C842',
          fontFamily: SANS,
          fontSize: 15,
          fontWeight: 700,
          color: '#F5C842',
          cursor: 'pointer',
          opacity: sharing ? 0.6 : 1,
        }}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        {sharing ? 'Ouverture…' : 'Prévenir le client et partager mon suivi'}
      </button>
      {shareError ? (
        <div role="alert" style={{ fontFamily: SANS, fontSize: 14, color: '#FFA566' }}>
          {shareError}
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={tipOpen}
        onClick={() => setTipOpen((v) => !v)}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, fontFamily: SANS, fontSize: 13, color: '#BFAF8F', textDecoration: 'underline', cursor: 'pointer' }}
      >
        Astuce : suivi continu écran verrouillé
      </button>
      {tipOpen ? (
        <ol style={{ margin: 0, paddingLeft: 20, fontFamily: SANS, fontSize: 14, color: '#BFAF8F', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Ouvre la discussion WhatsApp avec le client.</li>
          <li>Touche le trombone ou le +.</li>
          <li>Choisis Position, puis « Partager la position en direct ».</li>
        </ol>
      ) : null}
    </div>
  )
}
