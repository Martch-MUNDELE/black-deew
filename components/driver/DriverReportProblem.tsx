'use client'
// BLAC-SIGNALER-PROBLEME : bouton secondaire "Signaler un problème" + feuille des types.
// N'agit jamais sur la course : le signalement est seulement transmis a l'admin du portail.
import { useState } from 'react'
import { REPORT_KINDS, REPORT_NOTE_MAX, type ReportKind } from '@/lib/delivery-reports'

const SANS = "'DM Sans', sans-serif"

export default function DriverReportProblem({ deliveryId }: { deliveryId: string }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ReportKind | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function close() {
    setOpen(false)
    setKind(null)
    setNote('')
    setError(null)
    setSent(false)
  }

  async function send() {
    if (sending || !kind) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/driver/report-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: deliveryId, kind, note: note.trim() || undefined }),
      })
      if (res.ok) {
        setSent(true)
      } else if (res.status === 409) {
        setError('Ce problème a déjà été signalé pour cette course.')
      } else if (res.status === 503) {
        setError("Le signalement n'est pas encore disponible. Préviens l'administrateur.")
      } else if (res.status === 403) {
        setError("Cette course ne t'est pas assignée.")
      } else {
        setError("Le signalement n'a pas pu être envoyé. Réessaie.")
      }
    } catch {
      setError('Connexion impossible. Réessaie.')
    }
    setSending(false)
  }

  const secondary: React.CSSProperties = {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    fontFamily: SANS,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    background: '#15110B',
    color: '#FFA566',
    border: '1px solid #2A2216',
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={secondary}>
        Signaler un problème
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Signaler un problème"
      style={{ background: '#15110B', border: '1px solid #2A2216', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SANS, color: '#F5EDD6' }}
    >
      {sent ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#7FD6A0' }}>Signalement envoyé</div>
          <div style={{ fontSize: 13, color: '#BFAF8F', lineHeight: 1.5 }}>L&apos;administrateur a reçu ton signalement et te dira quoi faire.</div>
          <button type="button" onClick={close} style={{ ...secondary, color: '#F5C842' }}>
            Fermer
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Quel est le problème ?</div>
          <div role="radiogroup" aria-label="Type de problème" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REPORT_KINDS.map((k) => {
              const selected = kind === k.value
              return (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setKind(k.value)}
                  style={{
                    minHeight: 48,
                    borderRadius: 12,
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontFamily: SANS,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: selected ? '#2E1809' : '#0B0906',
                    color: selected ? '#FFA566' : '#F5EDD6',
                    border: `1px solid ${selected ? '#FF6B20' : '#2A2216'}`,
                  }}
                >
                  {k.label}
                </button>
              )
            })}
          </div>
          <label style={{ fontSize: 12, color: '#BFAF8F' }} htmlFor="report-note">
            Précisions (facultatif)
          </label>
          <textarea
            id="report-note"
            value={note}
            maxLength={REPORT_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            style={{ borderRadius: 12, padding: 12, fontFamily: SANS, fontSize: 14, background: '#0B0906', color: '#F5EDD6', border: '1px solid #2A2216', resize: 'vertical' }}
          />
          {error ? (
            <div role="alert" style={{ fontSize: 14, color: '#FFA566' }}>
              {error}
            </div>
          ) : null}
          <button
            type="button"
            disabled={!kind || sending}
            onClick={send}
            style={{
              minHeight: 52,
              borderRadius: 14,
              fontFamily: SANS,
              fontSize: 16,
              fontWeight: 700,
              border: 'none',
              cursor: kind && !sending ? 'pointer' : 'not-allowed',
              background: 'linear-gradient(135deg, #F5C842, #FF6B20)',
              color: '#1A1206',
              opacity: !kind || sending ? 0.5 : 1,
            }}
          >
            {sending ? 'Envoi…' : 'Envoyer le signalement'}
          </button>
          <button type="button" onClick={close} style={secondary}>
            Annuler
          </button>
        </>
      )}
    </div>
  )
}
