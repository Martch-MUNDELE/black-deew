'use client'

import { useEffect, useMemo, useState } from 'react'
import Logo from '@/components/Logo'
import PhoneInput from '@/components/PhoneInput'
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

function normalizePhone(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return '+' + raw.replace(/[^\d]/g, '')
  if (raw.startsWith('00')) return '+' + raw.slice(2).replace(/[^\d]/g, '')
  return '+' + raw.replace(/[^\d]/g, '')
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
        } else if (window.sessionStorage.getItem(storageKey) === 'true') {
          setGranted(true)
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

    return () => {
      active = false
    }
  }, [storageKey, supabase])

  const login = () => {
    setLoading(true)
    setError('')

    if (!settingsLoaded) {
      setError('Configuration VIP en cours de chargement. Réessayez dans quelques secondes.')
      setLoading(false)
      return
    }

    if (!enabled) {
      window.sessionStorage.removeItem(storageKey)
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
    const cleanAllowedPhones = allowedPhones.map(normalizePhone)
    const phoneOk = cleanAllowedPhones.includes(cleanPhone)
    const passwordOk = commonPassword.length > 0 && password === commonPassword

    if (!cleanPhone || !password) {
      setError('Veuillez saisir votre numéro de téléphone et le mot de passe VIP.')
      setLoading(false)
      return
    }

    if (!phoneOk || !passwordOk) {
      setError('Accès VIP refusé. Vérifiez votre numéro et votre mot de passe.')
      setLoading(false)
      return
    }

    window.sessionStorage.setItem(storageKey, 'true')
    setGranted(true)
    setLoading(false)
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

        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 20, padding: '32px 28px' }}>
          {(error || settingsError) && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#FF6B6B', padding: '10px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.45 }}>
              {error || settingsError}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Téléphone
            </label>
            <PhoneInput value={phone} onChange={setPhone} />
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
        </div>
      </div>
    </div>
  )
}
