'use client'
// BLAC-P3-051 : bouton "Marquer comme livree" avec confirmation dans la page (aucune boite du navigateur).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/driver-space'

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

export default function DriverMarkDelivered({ deliveryId, amount }: { deliveryId: string; amount: number }) {
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
