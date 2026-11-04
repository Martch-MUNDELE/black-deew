'use client'

import { useEffect, useRef, useState } from 'react'

// Encart « Des offres rien que pour toi ? » : feuille qui monte du bas de la page VIP.
// Affichee uniquement pour un VIP connecte dont le consentement n'a jamais ete donne.
export const VIP_CONSENT_LATER_KEY = 'bd_vip_marketing_consent_later_v1'
export const VIP_CONSENT_LATER_DELAY_MS = 7 * 24 * 60 * 60 * 1000

function postponedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(VIP_CONSENT_LATER_KEY)
    const at = raw ? Number(raw) : 0
    return Number.isFinite(at) && at > 0 && Date.now() - at < VIP_CONSENT_LATER_DELAY_MS
  } catch {
    return false
  }
}

function rememberLater() {
  try {
    window.localStorage.setItem(VIP_CONSENT_LATER_KEY, String(Date.now()))
  } catch {
    /* sans effet pour le visiteur */
  }
}

export default function VipMarketingConsentSheet() {
  const [open, setOpen] = useState(false)
  const [optIn, setOptIn] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    if (postponedRecently()) return
    fetch('/api/vip/marketing-consent', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { state?: string; available?: boolean } | null) => {
        if (cancelled || !d) return
        if (d.available === true && d.state === 'unknown') setOpen(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (open) sheetRef.current?.focus()
  }, [open])

  if (!open) return null

  async function confirm() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/vip/marketing-consent', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opt_in: optIn }),
      })
      if (!res.ok) throw new Error('echec')
      setOpen(false)
    } catch {
      setError('Ton choix n’a pas pu être enregistré. Réessaie dans un instant.')
    } finally {
      setSaving(false)
    }
  }

  function later() {
    rememberLater()
    setOpen(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(8,6,3,0.72)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vip-consent-title"
        tabIndex={-1}
        style={{
          width: '100%', maxWidth: 520, background: '#131009', outline: 'none',
          borderTop: '1px solid rgba(245,200,66,0.25)', borderRadius: '24px 24px 0 0',
          padding: '24px 20px calc(24px + env(safe-area-inset-bottom))',
          fontFamily: 'DM Sans, sans-serif', animation: 'bdConsentUp 0.28s ease-out',
        }}
      >
        <style>{`@keyframes bdConsentUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <h2
          id="vip-consent-title"
          style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 900, color: '#F5EDD6', margin: '0 0 10px', lineHeight: 1.2 }}
        >
          Des offres rien que pour toi ?
        </h2>
        <p style={{ fontSize: 14, color: '#C8B99A', lineHeight: 1.5, margin: '0 0 16px' }}>
          En tant que VIP, tu peux recevoir par WhatsApp des offres réservées : remises, cadeaux, accès en avant-première. Pas plus d’une par semaine.
        </p>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${optIn ? 'rgba(232,160,32,0.35)' : 'rgba(232,160,32,0.12)'}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div id="vip-consent-label" style={{ fontSize: 14, fontWeight: 700, color: '#F5EDD6', marginBottom: 2 }}>
              Recevoir les offres VIP
            </div>
            <div style={{ fontSize: 12, color: '#C8B99A', lineHeight: 1.45 }}>
              {optIn
                ? 'Tu recevras nos offres réservées aux VIP.'
                : 'Tu ne recevras aucune offre. Tu garderas ton accès VIP.'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={optIn}
            aria-labelledby="vip-consent-label"
            onClick={() => setOptIn((v) => !v)}
            style={{
              minWidth: 64, minHeight: 44, borderRadius: 22, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 800, fontFamily: 'DM Sans, sans-serif',
              background: optIn ? 'linear-gradient(135deg, #F5C842 0%, #E8A020 100%)' : 'rgba(255,255,255,0.1)',
              color: optIn ? '#1A1006' : '#7A6E58',
            }}
          >
            {optIn ? 'Oui' : 'Non'}
          </button>
        </div>
        {error && (
          <div role="alert" style={{ fontSize: 13, color: '#FF6B6B', marginTop: 12 }}>
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={confirm}
          disabled={saving}
          style={{
            width: '100%', minHeight: 48, marginTop: 16, borderRadius: 14, border: 'none',
            fontSize: 15, fontWeight: 800, fontFamily: 'DM Sans, sans-serif', color: '#1A1006',
            cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            background: 'linear-gradient(135deg, #F5C842 0%, #E8A020 100%)',
          }}
        >
          Confirmer mon choix
        </button>
        <button
          type="button"
          onClick={later}
          style={{
            width: '100%', minHeight: 44, marginTop: 6, background: 'transparent', border: 'none',
            color: '#C8B99A', fontSize: 13, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          Me le redemander plus tard
        </button>
        <p style={{ fontSize: 11, color: '#7A6E58', textAlign: 'center', lineHeight: 1.4, margin: '8px 0 0' }}>
          Tu peux changer ce choix à tout moment depuis ton compte VIP.
        </p>
      </div>
    </div>
  )
}
