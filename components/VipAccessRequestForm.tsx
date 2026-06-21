'use client'

import { useState } from 'react'
import PhoneInput from '@/components/PhoneInput'
import { createClient } from '@/lib/supabase/client'

type VipAccessRequestFormProps = {
  defaultCountryCode?: string
  onSubmitted?: () => void
}

export default function VipAccessRequestForm({
  defaultCountryCode = 'CD',
  onSubmitted,
}: VipAccessRequestFormProps) {
  const supabase = createClient()
  const [phone, setPhone] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [requestedPassword, setRequestedPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const submit = async () => {
    setError('')

    const cleanPseudo = pseudo.trim()
    const digits = phone.replace(/[^\d]/g, '')

    if (!phone || digits.length < 7) {
      setError('Veuillez saisir un numéro de téléphone valide.')
      return
    }

    if (!cleanPseudo) {
      setError('Veuillez saisir votre pseudo.')
      return
    }

    if (requestedPassword.trim().length < 4) {
      setError('Choisissez un mot de passe d’au moins 4 caractères.')
      return
    }

    if (requestedPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    const last9 = digits.slice(-9)

    const [{ data: existingRequests }, { data: allowedPhonesSetting }] = await Promise.all([
      supabase
        .from('vip_access_requests')
        .select('id,phone,status')
        .eq('status', 'pending'),
      supabase
        .from('settings')
        .select('value')
        .eq('key', 'vip_allowed_phones')
        .maybeSingle(),
    ])

    const hasPendingRequest = (existingRequests || []).some((request: { phone: string }) =>
      request.phone.replace(/[^\d]/g, '').slice(-9) === last9
    )

    let isAlreadyAllowed = false
    try {
      const allowedPhones = JSON.parse(allowedPhonesSetting?.value || '[]') as string[]
      isAlreadyAllowed = allowedPhones.some((allowedPhone) =>
        allowedPhone.replace(/[^\d]/g, '').slice(-9) === last9
      )
    } catch {}

    if (hasPendingRequest) {
      setLoading(false)
      setError('Une demande est déjà en attente pour ce numéro.')
      return
    }

    if (isAlreadyAllowed) {
      setLoading(false)
      setError('Ce numéro a déjà accès à la sélection VIP.')
      return
    }

    const { error: insertError } = await supabase.from('vip_access_requests').insert({
      phone,
      pseudo: cleanPseudo,
      status: 'pending',
      requested_password: requestedPassword.trim(),
    })

    setLoading(false)

    if (insertError) {
      setError('Impossible d’envoyer votre demande. Réessayez dans quelques instants.')
      return
    }

    setSuccess(true)
    onSubmitted?.()
  }

  if (success) {
    return (
      <div
        style={{
          background: 'rgba(91,197,122,0.1)',
          border: '1px solid rgba(91,197,122,0.3)',
          borderRadius: 14,
          padding: '18px 20px',
          color: '#5BC57A',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13,
          lineHeight: 1.5,
          textAlign: 'center',
        }}
      >
        Votre demande a bien été envoyée. Vous serez contacté(e) dès qu’elle sera validée.
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#131009',
        border: '1px solid rgba(232,160,32,0.12)',
        borderRadius: 20,
        padding: '28px 24px',
        marginTop: 16,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: '#C8B99A',
          marginBottom: 18,
          lineHeight: 1.5,
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        Pas encore d’accès VIP ? Laissez vos coordonnées, votre demande sera examinée.
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(255,107,107,0.1)',
            border: '1px solid rgba(255,107,107,0.25)',
            color: '#FF6B6B',
            padding: '10px 14px',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            fontFamily: 'DM Sans, sans-serif',
            lineHeight: 1.45,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#C8B99A',
            display: 'block',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}
        >
          Téléphone
        </label>
        <PhoneInput value={phone} onChange={setPhone} defaultCountryCode={defaultCountryCode} />
      </div>

      <div style={{ marginBottom: 22 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#C8B99A',
            display: 'block',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}
        >
          Pseudo
        </label>
        <input
          type="text"
          placeholder="Votre pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid rgba(232,160,32,0.2)',
            background: 'rgba(255,255,255,0.03)',
            color: '#F5EDD6',
            fontSize: 14,
            outline: 'none',
            fontFamily: 'DM Sans, sans-serif',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 22 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#C8B99A',
            display: 'block',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}
        >
          Choisissez votre mot de passe
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={requestedPassword}
            onChange={(e) => setRequestedPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{
              width: '100%',
              padding: '12px 44px 12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(232,160,32,0.2)',
              background: 'rgba(255,255,255,0.03)',
              color: '#F5EDD6',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'DM Sans, sans-serif',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: '#7A6E58',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              padding: 4,
            }}
          >
            {showPassword ? 'Masquer' : 'Voir'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 6, marginBottom: 14, lineHeight: 1.4 }}>
          Ce sera votre mot de passe personnel pour accéder à la sélection VIP.
        </div>

        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#C8B99A',
            display: 'block',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}
        >
          Confirmez votre mot de passe
        </label>
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid rgba(232,160,32,0.2)',
            background: 'rgba(255,255,255,0.03)',
            color: '#F5EDD6',
            fontSize: 14,
            outline: 'none',
            fontFamily: 'DM Sans, sans-serif',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        style={{
          width: '100%',
          padding: '13px 18px',
          borderRadius: 50,
          border: 'none',
          background: loading
            ? 'rgba(232,160,32,0.3)'
            : 'linear-gradient(135deg, #F5C842 0%, #E8A020 100%)',
          color: '#1A1006',
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 800,
          fontSize: 14,
          cursor: loading ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Envoi…' : 'Envoyer ma demande'}
      </button>
    </div>
  )
}
