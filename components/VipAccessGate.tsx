'use client'

import { useEffect, useMemo, useState } from 'react'
import Logo from '@/components/Logo'
import PhoneInput from '@/components/PhoneInput'
import VipAccessRequestForm from '@/components/VipAccessRequestForm'
import { createClient } from '@/lib/supabase/client'

type SettingRow = {
  key: string
  value: string | null
}

type VipAccessGateProps = {
  children: React.ReactNode
  storageKey?: string
}

const DEFAULT_SITE_NAME = 'VIP'
const DEFAULT_PASSWORD_SETTING = 'vip_access_password'
const DEFAULT_PHONES_SETTING = 'vip_allowed_phones'
const DEFAULT_ENABLED_SETTING = 'vip_access_enabled'
const VIP_PHONE_PREFILL_KEY = 'base_food_vip_prefill_phone'

function normalizePhone(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return '+' + raw.replace(/[^\d]/g, '')
  if (raw.startsWith('00')) return '+' + raw.slice(2).replace(/[^\d]/g, '')
  return '+' + raw.replace(/[^\d]/g, '')
}

function phoneVariants(value: string) {
  const normalized = normalizePhone(value)
  const digits = normalized.replace(/[^\d]/g, '')
  const variants = new Set<string>()

  if (normalized) variants.add(normalized)
  if (digits.length >= 8) variants.add(digits)

  if (digits.startsWith('0') && digits.length > 8) {
    variants.add(digits.slice(1))
  }

  if (digits.length > 9) {
    variants.add(digits.slice(-9))
  }

  if (digits.length > 10) {
    variants.add(digits.slice(-10))
  }

  return variants
}

function phonesMatch(inputPhone: string, allowedPhoneList: string[]) {
  const inputVariants = phoneVariants(inputPhone)

  if (inputVariants.size === 0) return false

  return allowedPhoneList.some((allowedPhone) => {
    const allowedVariants = phoneVariants(allowedPhone)

    for (const variant of inputVariants) {
      if (variant.length >= 8 && allowedVariants.has(variant)) return true
    }

    return false
  })
}

function parseAllowedPhones(value: string | null | undefined) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map(normalizePhone)
        .filter(Boolean)
    }
  } catch {}

  return value
    .split(/[\n,;|]+/)
    .map(normalizePhone)
    .filter(Boolean)
}

function timeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms)

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timer)
        reject(error)
      })
  })
}

export default function VipAccessGate({
  children,
  storageKey = 'base_food_vip_access_granted',
}: VipAccessGateProps) {
  const supabase = useMemo(() => createClient(), [])
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [granted, setGranted] = useState(false)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [siteName, setSiteName] = useState(DEFAULT_SITE_NAME)
  const [siteLogo, setSiteLogo] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [allowedPhones, setAllowedPhones] = useState<string[]>([])
  const [commonPassword, setCommonPassword] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false)
  const [pendingPhoneForPasswordChange, setPendingPhoneForPasswordChange] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordChangeError, setPasswordChangeError] = useState('')
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSettings() {
      try {
        const response = await timeout(
          supabase
            .from('settings')
            .select('key,value')
            .in('key', [
              'site_name',
              'site_logo',
              DEFAULT_ENABLED_SETTING,
              DEFAULT_PASSWORD_SETTING,
              DEFAULT_PHONES_SETTING,
            ]),
          3500,
        )

        if (!active) return

        const rows = (response.data || []) as SettingRow[]

        let nextSiteName = DEFAULT_SITE_NAME
        let nextSiteLogo: string | null = ''
        let nextEnabled = true
        let nextPassword = ''
        let nextAllowedPhones: string[] = []

        rows.forEach((setting) => {
          const value = setting.value ?? ''

          if (setting.key === 'site_name') nextSiteName = value || DEFAULT_SITE_NAME
          if (setting.key === 'site_logo') nextSiteLogo = value || ''
          if (setting.key === DEFAULT_ENABLED_SETTING) nextEnabled = value !== 'false'
          if (setting.key === DEFAULT_PASSWORD_SETTING) nextPassword = value
          if (setting.key === DEFAULT_PHONES_SETTING) nextAllowedPhones = parseAllowedPhones(value)
        })

        setSiteName(nextSiteName)
        setSiteLogo(nextSiteLogo)
        setEnabled(nextEnabled)
        setCommonPassword(nextPassword)
        setAllowedPhones(nextAllowedPhones)

        if (response.error) {
          setSettingsError('Configuration VIP indisponible. Vérifiez les réglages VIP dans l’admin.')
        } else if (!nextPassword || nextAllowedPhones.length === 0) {
          setSettingsError('Accès VIP non configuré : mot de passe commun ou numéros autorisés manquants.')
        } else {
          setSettingsError('')
        }

        if (!nextEnabled) {
          window.sessionStorage.removeItem(storageKey)
          setGranted(false)
        } else {
          window.sessionStorage.removeItem(storageKey)
          setGranted(false)
        }
      } catch {
        if (active) {
          setSettingsError('Configuration VIP indisponible. Vérifiez la connexion Supabase ou les réglages VIP.')
          setGranted(false)
        }
      } finally {
        if (active) setSettingsLoaded(true)
      }
    }

    loadSettings()

    const settingsChannel = supabase
      .channel('vip-access-gate-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        loadSettings()
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(settingsChannel)
    }
  }, [storageKey, supabase])

  const login = async () => {
    setLoading(true)
    setError('')

    if (!settingsLoaded) {
      setError('Configuration VIP en cours de chargement. Réessayez dans quelques secondes.')
      setLoading(false)
      return
    }

    if (!enabled) {
      window.sessionStorage.removeItem(storageKey)
      window.sessionStorage.removeItem(VIP_PHONE_PREFILL_KEY)
      setGranted(false)
      setError('L’accès VIP est momentanément désactivé.')
      setLoading(false)
      return
    }

    if (settingsError) {
      setError(settingsError)
      setLoading(false)
      return
    }

    const cleanPhone = normalizePhone(phone)
    const phoneOk = phonesMatch(phone, allowedPhones)

    if (!cleanPhone || !password) {
      setError('Veuillez saisir votre numéro de téléphone et le mot de passe VIP.')
      setLoading(false)
      return
    }

    if (!phoneOk) {
      setError('Accès VIP refusé. Vérifiez votre numéro et votre mot de passe.')
      setLoading(false)
      return
    }

    const digits = cleanPhone.replace(/[^\d]/g, '')
    const last9 = digits.slice(-9)

    const { data: individualRows } = await supabase
      .from('vip_individual_passwords')
      .select('phone,password')

    const individualMatch = (individualRows || []).find((row: { phone: string }) =>
      row.phone.replace(/[^\d]/g, '').slice(-9) === last9
    ) as { phone: string; password: string } | undefined

    const passwordOk = individualMatch
      ? password === individualMatch.password
      : commonPassword.length > 0 && password === commonPassword

    if (!passwordOk) {
      setError('Accès VIP refusé. Vérifiez votre numéro et votre mot de passe.')
      setLoading(false)
      return
    }

    window.sessionStorage.removeItem(storageKey)
    window.sessionStorage.setItem(VIP_PHONE_PREFILL_KEY, cleanPhone)

    if (!individualMatch) {
      setPendingPhoneForPasswordChange(cleanPhone)
      setNeedsPasswordChange(true)
      setLoading(false)
      return
    }

    setGranted(true)
    setLoading(false)
  }

  const submitPasswordChange = async () => {
    setPasswordChangeError('')

    if (newPassword.trim().length < 4) {
      setPasswordChangeError('Choisissez un mot de passe d’au moins 4 caractères.')
      return
    }

    if (newPassword !== newPasswordConfirm) {
      setPasswordChangeError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setPasswordChangeLoading(true)

    const { error: upsertError } = await supabase
      .from('vip_individual_passwords')
      .upsert(
        { phone: pendingPhoneForPasswordChange, password: newPassword.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'phone' }
      )

    setPasswordChangeLoading(false)

    if (upsertError) {
      setPasswordChangeError('Impossible d’enregistrer votre nouveau mot de passe. Réessayez.')
      return
    }

    setNeedsPasswordChange(false)
    setGranted(true)
  }

  if (settingsLoaded && !enabled) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080603', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
            {siteLogo ? (
              <span role="img" aria-label={siteName} style={{ width: 64, height: 64, display: 'inline-block', backgroundImage: `url(${siteLogo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
            ) : (
              <Logo size={64} />
            )}
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5EDD6', margin: 0 }}>{siteName}</h1>
          <div style={{ background: '#131009', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 20, padding: '26px 24px', marginTop: 28 }}>
            <div style={{ color: '#FF6B6B', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
              Accès VIP désactivé
            </div>
            <div style={{ color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontSize: 13, lineHeight: 1.5 }}>
              La sélection VIP est momentanément indisponible.
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (granted) return <>{children}</>

  if (needsPasswordChange) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080603', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5EDD6', margin: 0 }}>{siteName}</h1>
            <div style={{ fontSize: 11, color: '#C8B99A', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 4 }}>Choisissez votre mot de passe</div>
          </div>

          <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 20, padding: '32px 28px' }}>
            <div style={{ fontSize: 13, color: '#C8B99A', marginBottom: 18, lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif' }}>
              Pour des raisons de sécurité, merci de choisir votre propre mot de passe personnel.
            </div>

            {passwordChangeError && (
              <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#FF6B6B', padding: '10px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.45 }}>
                {passwordChangeError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Nouveau mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#7A6E58', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 4 }}
                >
                  {showNewPassword ? 'Masquer' : 'Voir'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Confirmez le mot de passe
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPasswordConfirm}
                onChange={e => setNewPasswordConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitPasswordChange()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={submitPasswordChange}
              disabled={passwordChangeLoading}
              style={{ width: '100%', padding: '13px', borderRadius: 50, border: 'none', background: passwordChangeLoading ? 'rgba(232,160,32,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14, cursor: passwordChangeLoading ? 'not-allowed' : 'pointer' }}
            >
              {passwordChangeLoading ? 'Enregistrement...' : 'Valider mon nouveau mot de passe'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (needsPasswordChange) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080603', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5EDD6', margin: 0 }}>{siteName}</h1>
            <div style={{ fontSize: 11, color: '#C8B99A', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 4 }}>Choisissez votre mot de passe</div>
          </div>

          <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 20, padding: '32px 28px' }}>
            <div style={{ fontSize: 13, color: '#C8B99A', marginBottom: 18, lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif' }}>
              Pour des raisons de sécurité, merci de choisir votre propre mot de passe personnel.
            </div>

            {passwordChangeError && (
              <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#FF6B6B', padding: '10px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.45 }}>
                {passwordChangeError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Nouveau mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#7A6E58', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 4 }}
                >
                  {showNewPassword ? 'Masquer' : 'Voir'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Confirmez le mot de passe
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPasswordConfirm}
                onChange={e => setNewPasswordConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitPasswordChange()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={submitPasswordChange}
              disabled={passwordChangeLoading}
              style={{ width: '100%', padding: '13px', borderRadius: 50, border: 'none', background: passwordChangeLoading ? 'rgba(232,160,32,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14, cursor: passwordChangeLoading ? 'not-allowed' : 'pointer' }}
            >
              {passwordChangeLoading ? 'Enregistrement...' : 'Valider mon nouveau mot de passe'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (needsPasswordChange) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080603', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5EDD6', margin: 0 }}>{siteName}</h1>
            <div style={{ fontSize: 11, color: '#C8B99A', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 4 }}>Nouveau mot de passe requis</div>
          </div>

          <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 20, padding: '32px 28px' }}>
            <div style={{ color: '#C8B99A', fontSize: 13, lineHeight: 1.5, marginBottom: 20, fontFamily: 'DM Sans, sans-serif' }}>
              Pour votre sécurité, merci de choisir votre propre mot de passe personnel avant de continuer.
            </div>

            {passwordChangeError && (
              <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#FF6B6B', padding: '10px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.45 }}>
                {passwordChangeError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Nouveau mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#7A6E58', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 4 }}
                >
                  {showNewPassword ? 'Masquer' : 'Voir'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Confirmez le mot de passe
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPasswordConfirm}
                onChange={e => setNewPasswordConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitPasswordChange()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={submitPasswordChange}
              disabled={passwordChangeLoading}
              style={{ width: '100%', padding: '13px', borderRadius: 50, border: 'none', background: passwordChangeLoading ? 'rgba(232,160,32,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14, cursor: passwordChangeLoading ? 'not-allowed' : 'pointer' }}
            >
              {passwordChangeLoading ? 'Enregistrement...' : 'Valider mon nouveau mot de passe'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (needsPasswordChange) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080603', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5EDD6', margin: 0 }}>{siteName}</h1>
            <div style={{ fontSize: 11, color: '#C8B99A', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 4 }}>Nouveau mot de passe requis</div>
          </div>

          <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 20, padding: '32px 28px' }}>
            <div style={{ color: '#C8B99A', fontSize: 13, lineHeight: 1.5, marginBottom: 20, fontFamily: 'DM Sans, sans-serif' }}>
              Pour votre sécurité, merci de choisir votre propre mot de passe personnel avant de continuer.
            </div>

            {passwordChangeError && (
              <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#FF6B6B', padding: '10px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.45 }}>
                {passwordChangeError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Nouveau mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#7A6E58', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 4 }}
                >
                  {showNewPassword ? 'Masquer' : 'Voir'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Confirmez le mot de passe
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPasswordConfirm}
                onChange={e => setNewPasswordConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitPasswordChange()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={submitPasswordChange}
              disabled={passwordChangeLoading}
              style={{ width: '100%', padding: '13px', borderRadius: 50, border: 'none', background: passwordChangeLoading ? 'rgba(232,160,32,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14, cursor: passwordChangeLoading ? 'not-allowed' : 'pointer' }}
            >
              {passwordChangeLoading ? 'Enregistrement...' : 'Valider mon nouveau mot de passe'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080603', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
            {siteLogo === null ? (
              <div style={{ width: 64, height: 64 }} />
            ) : siteLogo ? (
              <span role="img" aria-label={siteName} style={{ width: 64, height: 64, display: 'inline-block', backgroundImage: `url(${siteLogo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
            ) : (
              <Logo size={64} />
            )}
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5EDD6', margin: 0 }}>{siteName}</h1>
          <div style={{ fontSize: 11, color: '#C8B99A', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 4 }}>Accès VIP</div>
        </div>

        <style>{`
          @keyframes vip-panel-fade-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {!showRequestForm ? (
          <div key="login" style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 20, padding: '32px 28px', animation: 'vip-panel-fade-in 0.25s ease' }}>
            {(error || settingsError) && (
              <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#FF6B6B', padding: '10px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.45 }}>
                {error || settingsError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Téléphone
              </label>
              <PhoneInput defaultCountryCode="CD" value={phone} onChange={setPhone} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Mot de passe VIP
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={login}
              disabled={loading}
              style={{ width: '100%', padding: '13px', borderRadius: 50, border: 'none', background: loading ? 'rgba(232,160,32,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Vérification...' : 'Accéder à la sélection VIP'}
            </button>

            <button
              type="button"
              onClick={() => setShowRequestForm(true)}
              style={{ width: '100%', padding: '10px', marginTop: 14, borderRadius: 50, border: 'none', background: 'transparent', color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}
            >
              Demander votre accès VIP
            </button>
          </div>
        ) : (
          <div key="request" style={{ animation: 'vip-panel-fade-in 0.25s ease' }}>
            <VipAccessRequestForm defaultCountryCode="CD" />
            <button
              type="button"
              onClick={() => setShowRequestForm(false)}
              style={{ width: '100%', padding: '10px', marginTop: 14, borderRadius: 50, border: 'none', background: 'transparent', color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
