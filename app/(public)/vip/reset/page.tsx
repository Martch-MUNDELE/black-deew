'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

type TokenRow = {
  id: string
  phone: string
  expires_at: string
  used_at: string | null
}

const AUTOLOGIN_KEY = 'base_food_vip_autologin'

function VipResetContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [tokenRow, setTokenRow] = useState<TokenRow | null>(null)
  const [tokenError, setTokenError] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    let active = true

    async function checkToken() {
      if (!token) {
        setTokenError('Lien invalide.')
        setChecking(false)
        return
      }

      const { data, error } = await supabase
        .from('vip_password_reset_tokens')
        .select('id,phone,expires_at,used_at')
        .eq('token', token)
        .maybeSingle()

      if (!active) return

      if (error || !data) {
        setTokenError('Lien invalide ou introuvable.')
        setChecking(false)
        return
      }

      const row = data as TokenRow

      if (row.used_at) {
        setTokenError('Ce lien a déjà été utilisé. Demandez un nouveau lien depuis la page VIP.')
        setChecking(false)
        return
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        setTokenError('Ce lien a expiré (validité 1 heure). Demandez un nouveau lien depuis la page VIP.')
        setChecking(false)
        return
      }

      setTokenRow(row)
      setChecking(false)
    }

    checkToken()

    return () => {
      active = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const submit = async () => {
    setSubmitError('')

    if (!tokenRow) return

    if (newPassword.trim().length < 4) {
      setSubmitError('Choisissez un mot de passe d’au moins 4 caractères.')
      return
    }

    if (newPassword !== newPasswordConfirm) {
      setSubmitError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)

    const cleanPassword = newPassword.trim()

    const { error: upsertError } = await supabase
      .from('vip_individual_passwords')
      .upsert(
        { phone: tokenRow.phone, password: cleanPassword, updated_at: new Date().toISOString() },
        { onConflict: 'phone' }
      )

    if (upsertError) {
      setSubmitting(false)
      setSubmitError('Impossible d’enregistrer votre nouveau mot de passe. Réessayez.')
      return
    }

    await supabase
      .from('vip_password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.id)

    try {
      window.sessionStorage.setItem(
        AUTOLOGIN_KEY,
        JSON.stringify({ phone: tokenRow.phone, password: cleanPassword })
      )
    } catch {}

    setSubmitting(false)
    router.replace('/vip')
  }

  if (checking) {
    return (
      <div style={panelWrapperStyle}>
        <div style={{ textAlign: 'center', color: '#7A6E58', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
          Vérification du lien...
        </div>
      </div>
    )
  }

  if (tokenError) {
    return (
      <div style={panelWrapperStyle}>
        <div style={headerStyle}>
          <Logo size={56} />
          <h1 style={titleStyle}>Lien indisponible</h1>
        </div>
        <div style={{ ...panelStyle, textAlign: 'center' }}>
          <div style={{ color: '#FF6B6B', fontFamily: 'DM Sans, sans-serif', fontSize: 13, lineHeight: 1.5 }}>
            {tokenError}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={panelWrapperStyle}>
      <div style={headerStyle}>
        <Logo size={56} />
        <h1 style={titleStyle}>Nouveau mot de passe</h1>
        <div style={{ fontSize: 11, color: '#C8B99A', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 4 }}>
          Accès VIP
        </div>
      </div>

      <div style={panelStyle}>
        <div style={{ color: '#C8B99A', fontSize: 13, lineHeight: 1.5, marginBottom: 20, fontFamily: 'DM Sans, sans-serif' }}>
          Choisissez votre nouveau mot de passe personnel.
        </div>

        {submitError && (
          <div style={errorBoxStyle}>{submitError}</div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nouveau mot de passe</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              style={eyeButtonStyle}
            >
              {showPassword ? 'Masquer' : 'Voir'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Confirmez le mot de passe</label>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{ ...inputStyle, paddingRight: 14 }}
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 50,
            border: 'none',
            background: submitting ? 'rgba(232,160,32,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)',
            color: '#0A0804',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 800,
            fontSize: 14,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Enregistrement...' : 'Valider mon nouveau mot de passe'}
        </button>
      </div>
    </div>
  )
}

const panelWrapperStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#080603',
  padding: 16,
}

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: 28,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
}

const titleStyle: React.CSSProperties = {
  fontFamily: 'Playfair Display, serif',
  fontSize: 22,
  fontWeight: 900,
  color: '#F5EDD6',
  margin: 0,
}

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 380,
  background: '#131009',
  border: '1px solid rgba(232,160,32,0.12)',
  borderRadius: 20,
  padding: '32px 28px',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#C8B99A',
  display: 'block',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
}

const inputStyle: React.CSSProperties = {
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
}

const eyeButtonStyle: React.CSSProperties = {
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
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,107,107,0.1)',
  border: '1px solid rgba(255,107,107,0.25)',
  color: '#FF6B6B',
  padding: '10px 14px',
  borderRadius: 10,
  marginBottom: 20,
  fontSize: 13,
  fontFamily: 'DM Sans, sans-serif',
  lineHeight: 1.45,
}

export default function VipResetPage() {
  return (
    <Suspense fallback={<div style={panelWrapperStyle} />}>
      <VipResetContent />
    </Suspense>
  )
}
