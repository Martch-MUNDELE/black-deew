'use client'

import { useEffect, useMemo, useState } from 'react'
import Logo from '@/components/Logo'
import PhoneInput from '@/components/PhoneInput'
import VipAccessRequestForm from '@/components/VipAccessRequestForm'
import VipPasswordResetRequestForm from '@/components/VipPasswordResetRequestForm'
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
const DEFAULT_ENABLED_SETTING = 'vip_access_enabled'
const VIP_PHONE_PREFILL_KEY = 'base_food_vip_prefill_phone'

function normalizePhone(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return '+' + raw.replace(/[^\d]/g, '')
  if (raw.startsWith('00')) return '+' + raw.slice(2).replace(/[^\d]/g, '')
  return '+' + raw.replace(/[^\d]/g, '')
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

// Session VIP : cookie signe pose par le serveur (HttpOnly, 30 jours). Le navigateur ne conserve plus de session en localStorage.
function clearVipSession(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {}
  fetch('/api/vip/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
}
type VipLoginResult = { ok?: boolean; needsPasswordChange?: boolean; phone?: string; error?: string }
// A3 : la verification de l'acces se fait cote serveur ; le navigateur ne lit plus ni mots de passe ni liste de numeros.
async function checkVipSession(): Promise<boolean | null> {
  try {
    const res = await fetch('/api/vip/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      credentials: 'same-origin',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { granted?: boolean }
    return data.granted === true
  } catch {
    return null
  }
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
  const [settingsError, setSettingsError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showResetForm, setShowResetForm] = useState(false)
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false)
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false)
  const [pendingPhoneForPasswordChange, setPendingPhoneForPasswordChange] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordChangeError, setPasswordChangeError] = useState('')
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false)

  useEffect(() => {
    // Au chargement, le serveur decide (cookie signe) : le localStorage ne donne plus aucun acces
    let active = true
    checkVipSession().then((ok) => {
      if (active && ok === true) setGranted(true)
    })
    return () => {
      active = false
    }
  }, [storageKey])
  useEffect(() => {
    let active = true
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    async function loadSettings(attempt = 0) {
      try {
        const response = await timeout(
          supabase
            .from('settings')
            .select('key,value')
            .in('key', ['site_name', 'site_logo', DEFAULT_ENABLED_SETTING]),
          10000,
        )
        if (!active) return
        const rows = (response.data || []) as SettingRow[]
        let nextSiteName = DEFAULT_SITE_NAME
        let nextSiteLogo: string | null = ''
        let nextEnabled = true
        rows.forEach((setting) => {
          const value = setting.value ?? ''
          if (setting.key === 'site_name') nextSiteName = value || DEFAULT_SITE_NAME
          if (setting.key === 'site_logo') nextSiteLogo = value || ''
          if (setting.key === DEFAULT_ENABLED_SETTING) nextEnabled = value !== 'false'
        })
        setSiteName(nextSiteName)
        setSiteLogo(nextSiteLogo)
        setEnabled(nextEnabled)
        if (response.error) {
          setSettingsError('Configuration VIP indisponible. Vérifiez les réglages VIP dans l’admin.')
        } else {
          setSettingsError('')
        }
        // A1 : on ne retire l'acces que si les reglages sont lus sans erreur
        if (!nextEnabled) {
          clearVipSession(storageKey)
          setGranted(false)
        } else if (!response.error) {
          const stillAllowed = await checkVipSession()
          if (!active) return
          if (stillAllowed === true) {
            setGranted(true)
          } else if (stillAllowed === false) {
            clearVipSession(storageKey)
            setGranted(false)
          }
        }
      } catch {
        if (active) {
          // A2 : lecture lente ou echouee : nouvelle tentative automatique (3 max), puis message clair
          if (attempt < 3) {
            setSettingsError('Chargement des réglages VIP lent (réseau). Nouvelle tentative en cours...')
            retryTimer = setTimeout(() => { if (active) loadSettings(attempt + 1) }, 3000 * (attempt + 1))
          } else {
            setSettingsError('Les réglages VIP n’ont pas pu être chargés (réseau lent ou indisponible). Vous pouvez réessayer de vous connecter.')
          }
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
      if (retryTimer) clearTimeout(retryTimer)
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
    // A2 : un echec de lecture des reglages ne bloque plus la connexion (le serveur verifie et renvoie le message adapte)

    const cleanPhone = normalizePhone(phone)
    if (!cleanPhone || !password) {
      setError('Veuillez saisir votre numéro de téléphone et le mot de passe VIP.')
      setLoading(false)
      return
    }
    // A3 : verification cote serveur, aucun mot de passe ne revient au navigateur
    let result: VipLoginResult | null = null
    let networkError = false
    try {
      const res = await fetch('/api/vip/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password }),
      })
      result = (await res.json().catch(() => null)) as VipLoginResult | null
    } catch {
      networkError = true
    }
    if (networkError) {
      setError('Connexion impossible. Vérifiez votre réseau et réessayez.')
      setLoading(false)
      return
    }
    if (!result || !result.ok) {
      setError(result?.error || 'Accès VIP refusé. Vérifiez votre numéro et votre mot de passe.')
      setLoading(false)
      return
    }
    window.sessionStorage.removeItem(storageKey)
    window.sessionStorage.setItem(VIP_PHONE_PREFILL_KEY, cleanPhone)
    if (result.needsPasswordChange) {
      setPendingPhoneForPasswordChange(cleanPhone)
      setNeedsPasswordChange(true)
      setLoading(false)
      return
    }
    // BF-P2-013 : tracking connexion - VIP
    fetch('/api/track-connexion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'vip',
        client_phone: cleanPhone,
      }),
    }).catch(() => {})

    setGranted(true)
    setLoading(false)
  }

  useEffect(() => {
    if (autoLoginAttempted || !settingsLoaded) return

    let raw: string | null = null
    try {
      raw = window.sessionStorage.getItem('base_food_vip_autologin')
    } catch {
      raw = null
    }

    if (!raw) {
      setAutoLoginAttempted(true)
      return
    }

    setAutoLoginAttempted(true)
    window.sessionStorage.removeItem('base_food_vip_autologin')

    try {
      const parsed = JSON.parse(raw) as { phone?: string; password?: string }
      if (parsed.phone && parsed.password) {
        setPhone(parsed.phone)
        setPassword(parsed.password)
      }
    } catch {}
  }, [settingsLoaded, autoLoginAttempted])

  useEffect(() => {
    if (!autoLoginAttempted) return
    if (!phone || !password) return
    if (granted) return

    login()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoginAttempted])

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

    // A3 : changement de mot de passe cote serveur (verifie le mot de passe actuel)
    let upsertError = false
    try {
      const res = await fetch('/api/vip/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: pendingPhoneForPasswordChange,
          currentPassword: password,
          newPassword: newPassword.trim(),
        }),
      })
      upsertError = !res.ok
    } catch {
      upsertError = true
    }

    setPasswordChangeLoading(false)

    if (upsertError) {
      setPasswordChangeError('Impossible d’enregistrer votre nouveau mot de passe. Réessayez.')
      return
    }

    // BF-P2-013 : tracking connexion - VIP (apres changement mot de passe)
    fetch('/api/track-connexion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'vip',
        client_phone: pendingPhoneForPasswordChange,
      }),
    }).catch(() => {})

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

        {!showRequestForm && !showResetForm ? (
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

            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowRequestForm(true)}
                style={{ padding: '10px 0', borderRadius: 50, border: 'none', background: 'transparent', color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}
              >
                Demander votre accès VIP
              </button>
              <button
                type="button"
                onClick={() => setShowResetForm(true)}
                style={{ padding: '10px 0', borderRadius: 50, border: 'none', background: 'transparent', color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}
              >
                Mot de passe perdu ?
              </button>
            </div>
          </div>
        ) : showResetForm ? (
          <div key="reset" style={{ animation: 'vip-panel-fade-in 0.25s ease' }}>
            <VipPasswordResetRequestForm defaultCountryCode="CD" />
            <button
              type="button"
              onClick={() => setShowResetForm(false)}
              style={{ width: '100%', padding: '10px', marginTop: 14, borderRadius: 50, border: 'none', background: 'transparent', color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}
            >
              Retour à la connexion
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
