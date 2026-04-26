'use client'
import { useState, useRef, useEffect } from 'react'

const COUNTRIES = [
  { code: 'MA', dial: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'BE', dial: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', dial: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'Espagne' },
  { code: 'IT', dial: '+39', flag: '🇮🇹', name: 'Italie' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Allemagne' },
  { code: 'NL', dial: '+31', flag: '🇳🇱', name: 'Pays-Bas' },
  { code: 'PT', dial: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: 'DZ', dial: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: 'TN', dial: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: 'SN', dial: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: 'CI', dial: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'CM', dial: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: 'LU', dial: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: 'SA', dial: '+966', flag: '🇸🇦', name: 'Arabie Saoudite' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'Émirats' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'États-Unis' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada' },
]

export default function PhoneInput({ value, onChange, initialValue }: { value: string, onChange: (v: string) => void, initialValue?: string }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Parse initialValue pour extraire pays + numéro
  const parseInitial = () => {
    if (!initialValue) return { country: COUNTRIES[0], number: '' }
    const found = COUNTRIES.find(c => initialValue.startsWith(c.dial))
    if (found) return { country: found, number: initialValue.slice(found.dial.length) }
    return { country: COUNTRIES[0], number: initialValue }
  }
  const { country: initCountry, number: initNumber } = parseInitial()
  const [country, setCountry] = useState(initCountry)
  const [number, setNumber] = useState(initNumber)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleNumber = (v: string) => {
    setNumber(v)
    onChange(`${country.dial}${v}`)
  }

  const handleCountry = (c: typeof COUNTRIES[0]) => {
    setCountry(c)
    setOpen(false)
    setSearch('')
    onChange(`${c.dial}${number}`)
  }

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search)
  )

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', gap: 8 }}>
      {/* Sélecteur pays */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 14px', borderRadius: 12, border: '1.5px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.04)', color: '#F5EDD6', cursor: 'pointer', flexShrink: 0, fontSize: 14, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
      >
        <span style={{ fontSize: 18 }}>{country.flag}</span>
        <span style={{ color: '#C8B890' }}>{country.dial}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M2 4L6 8L10 4" stroke="#C8B99A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Numéro */}
      <input
        type="tel"
        placeholder="06 12 34 56 78"
        value={number}
        onChange={e => handleNumber(e.target.value)}
        style={{ flex: 1, padding: '13px 16px', borderRadius: 12, border: '1.5px solid rgba(232,160,32,0.15)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }}
      />

      {/* Dropdown pays */}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 260, background: '#1A1510', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 14, zIndex: 500, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(232,160,32,0.08)' }}>
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(232,160,32,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map(c => (
              <button
                key={c.code + c.dial}
                onClick={() => handleCountry(c)}
                style={{ width: '100%', padding: '10px 14px', background: country.code === c.code ? 'rgba(232,160,32,0.1)' : 'transparent', border: 'none', color: country.code === c.code ? '#F5C842' : '#C8B890', fontFamily: 'DM Sans, sans-serif', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' as const }}
              >
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ color: '#C8B99A', fontSize: 12 }}>{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
