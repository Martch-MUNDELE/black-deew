'use client'
// BLAC-P3-047 : fenetre de creation / reinitialisation du compte de connexion d'un livreur.
import { useState } from 'react'
import { validateDriverAccountInput } from '@/lib/driver-account'

interface Props {
  driverId: string
  driverName: string
  /** Email du compte existant : pre-rempli et non modifiable quand le livreur a deja un acces. */
  existingEmail: string | null
  hasAccount: boolean
  onClose: () => void
  /** Appelee apres un succes pour recharger la liste. */
  onDone: () => Promise<void> | void
}

const LBL = { fontSize: 9, color: '#7A6E58', textTransform: 'uppercase' as const, marginBottom: 2 }
const INP = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(232,160,32,0.2)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#F5EDD6',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box' as const,
}

export default function DriverAccountDialog({
  driverId,
  driverName,
  existingEmail,
  hasAccount,
  onClose,
  onDone,
}: Props) {
  const [email, setEmail] = useState(existingEmail ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Le mot de passe n'est jamais conserve apres fermeture.
  function close() {
    setPassword('')
    setShowPassword(false)
    onClose()
  }

  async function submit() {
    setError(null)
    setSuccess(null)
    const check = validateDriverAccountInput({ email, password })
    if (!check.ok) {
      setError(check.error)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/driver-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, email: check.email, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; created?: boolean }
      if (!res.ok || !data.ok) {
        setError(data.error || 'Operation impossible')
        return
      }
      setPassword('')
      setShowPassword(false)
      setSuccess(data.created ? 'Acces livreur cree' : 'Mot de passe reinitialise')
      await onDone()
    } catch {
      setError('Connexion au serveur impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        style={{ background: '#14110A', border: '1px solid rgba(232,160,32,0.25)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, fontFamily: 'DM Sans, sans-serif' }}
      >
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: '#F5EDD6', margin: '0 0 6px' }}>
          {hasAccount ? 'Reinitialiser le mot de passe' : 'Acces livreur'}
        </h2>
        <p style={{ fontSize: 12, color: '#7A6E58', margin: '0 0 16px' }}>{driverName}</p>

        <div style={LBL}>Email</div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={hasAccount}
          autoComplete="off"
          style={{ ...INP, marginBottom: 12, opacity: hasAccount ? 0.7 : 1 }}
        />

        <div style={LBL}>Mot de passe (10 caracteres minimum)</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            style={INP}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{ background: 'rgba(232,160,32,0.1)', color: '#E8A020', border: '1px solid rgba(232,160,32,0.25)', borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {showPassword ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        {error && <p style={{ color: '#E85D5D', fontSize: 12, margin: '0 0 12px' }}>{error}</p>}
        {success && <p style={{ color: '#6FCF97', fontSize: 12, margin: '0 0 12px' }}>{success}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={close}
            style={{ background: 'transparent', color: '#7A6E58', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}
          >
            {success ? 'Fermer' : 'Annuler'}
          </button>
          {!success && (
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              style={{ background: '#E8A020', color: '#0A0804', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Envoi...' : hasAccount ? 'Reinitialiser' : 'Creer l\'acces'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
