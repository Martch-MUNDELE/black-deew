'use client'
// BLAC-SIGNALER-PROBLEME : bouton secondaire "Signaler un problème" + feuille des types.
// BLAC-SIGNALEMENT-FENETRE : la feuille est une vraie fenêtre modale (fond assombri, croix, Échap, choix visible).
// N'agit jamais sur la course : le signalement est seulement transmis a l'admin du portail.
import { useEffect, useState } from 'react'
import { REPORT_KINDS, REPORT_NOTE_MAX, type ReportKind } from '@/lib/delivery-reports'

const SANS = "'DM Sans', sans-serif"
const GOLD = '#F5C842'

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

  // Fenêtre ouverte : Échap ferme, le défilement de la page derrière est bloqué.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // Après l'envoi : la confirmation s'affiche puis la fenêtre se ferme.
  useEffect(() => {
    if (!sent) return
    const t = setTimeout(close, 1800)
    return () => clearTimeout(t)
  }, [sent])

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
      data-report-backdrop
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <style>{`@keyframes reportSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Signaler un problème"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#15110B',
          border: '1px solid #2A2216',
          borderRadius: '20px 20px 0 0',
          fontFamily: SANS,
          color: '#F5EDD6',
          animation: 'reportSheetUp 240ms ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 8px 8px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{sent ? 'Signalement envoyé' : 'Quel est le problème ?'}</div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={close}
            style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: 'transparent', color: '#F5EDD6', fontSize: 22, lineHeight: 1, cursor: 'pointer', fontFamily: SANS }}
          >
            ×
          </button>
        </div>

        {sent ? (
          <div style={{ padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#7FD6A0' }}>Signalement envoyé</div>
            <div style={{ fontSize: 13, color: '#BFAF8F', lineHeight: 1.5 }}>L&apos;administrateur a reçu ton signalement et te dira quoi faire.</div>
            <button type="button" onClick={close} style={{ ...secondary, color: GOLD }}>
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 auto' }}>
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
                        minHeight: 52,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        borderRadius: 12,
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontFamily: SANS,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: selected ? 'rgba(245,200,66,0.18)' : '#0B0906',
                        color: selected ? GOLD : '#F5EDD6',
                        border: `1px solid ${selected ? GOLD : '#2A2216'}`,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        data-radio-circle
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `2px solid ${selected ? GOLD : '#6B5E45'}`,
                          background: selected ? GOLD : 'transparent',
                        }}
                      >
                        {selected ? (
                          <svg data-check width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A1206" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        ) : null}
                      </span>
                      <span style={{ flex: 1 }}>{k.label}</span>
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
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              {!kind ? (
                <div style={{ fontSize: 13, color: '#BFAF8F', textAlign: 'center' }}>Choisis un type pour envoyer</div>
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
