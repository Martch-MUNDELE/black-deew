'use client'
import { useEffect, useState } from 'react'
import { useCatalogue } from '@/store/catalogue'
import { createClient } from '@/lib/supabase/client'

type Feature = { icon: string; title: string; desc: string }

const DEFAULTS: Feature[] = [
  { icon: 'chef', title: 'Préparé à Agadir', desc: 'Par chez vous à Agadir, repas cuisinés avec soin par nos équipes.' },
  { icon: 'delivery', title: 'Livraison rapide', desc: 'On vous livre rapidement et directement à votre porte.' },
  { icon: 'fresh', title: 'Frais du jour', desc: 'Profitez de produits toujours frais, choisis chaque jour.' },
]

function Icon({ name }: { name: string }) {
  switch (name) {
    case 'chef': return (
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="10" r="5" fill="#F5C842"/>
        <circle cx="9" cy="13" r="4" fill="#F5C842"/>
        <circle cx="19" cy="13" r="4" fill="#F5C842"/>
        <rect x="8" y="15" width="12" height="5" fill="#F5C842"/>
        <rect x="7" y="19" width="14" height="3" rx="1.5" fill="#F5C842"/>
      </svg>
    )
    case 'delivery': return (
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <circle cx="7" cy="21" r="3" stroke="#F5C842" strokeWidth="1.5"/>
        <circle cx="21" cy="21" r="3" stroke="#F5C842" strokeWidth="1.5"/>
        <path d="M10 21h8M17 21V14l-2-5h-5l-2 5v2" stroke="#F5C842" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M17 14h4l1-4h-4" stroke="#F5C842" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
    case 'fresh': return (
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <path d="M10 13C10 8.5 18 8.5 18 13" stroke="#F5C842" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M7 13h14l-2 9H9L7 13z" fill="#F5C842"/>
        <line x1="9.5" y1="17.5" x2="18.5" y2="17.5" stroke="#131009" strokeWidth="0.8"/>
        <line x1="8.5" y1="20.5" x2="19.5" y2="20.5" stroke="#131009" strokeWidth="0.8"/>
      </svg>
    )
    case 'star': return (
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <path d="M14 4l2.5 7.5H24l-6.5 4.7 2.5 7.5L14 19.3l-6.5 4.4 2.5-7.5L3.5 11.5H11L14 4z" fill="#F5C842"/>
      </svg>
    )
    case 'clock': return (
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="10" stroke="#F5C842" strokeWidth="1.5"/>
        <path d="M14 8v6l4 2" stroke="#F5C842" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
    case 'heart': return (
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <path d="M14 22C13.5 21.6 5 15.8 5 10.5C5 7.5 7.5 5 10 5c1.8 0 3.3 1 4 2.5C14.7 6 16.2 5 18 5c2.5 0 5 2.5 5 5.5C23 15.8 14.5 21.6 14 22z" fill="#F5C842"/>
      </svg>
    )
    case 'shield': return (
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <path d="M14 4l8 3v7c0 5.5-4.5 9.5-8 10-3.5-.5-8-4.5-8-10V7l8-3z" fill="#F5C842"/>
        <path d="M10 14l3 3 5-5" stroke="#131009" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
    case 'fire': return (
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <path d="M14 4c-1 4-6 6-6 11a6 6 0 0 0 12 0c0-3-2-5-3-7-1 3-2 5-3 5 0-3-1-6 0-9z" fill="#F5C842"/>
      </svg>
    )
    default: return (
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <path d="M14 4l2.5 7.5H24l-6.5 4.7 2.5 7.5L14 19.3l-6.5 4.4 2.5-7.5L3.5 11.5H11L14 4z" fill="#F5C842"/>
      </svg>
    )
  }
}

export default function FeaturesBar({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const { hasSelected } = useCatalogue()
  const [features, setFeatures] = useState<Feature[]>(DEFAULTS)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => {
      if (!data) return
      const parsed = DEFAULTS.map((d, i) => {
        const row = data.find((s: any) => s.key === `feature_${i + 1}`)
        if (!row) return d
        try { return JSON.parse(row.value) } catch { return d }
      })
      setFeatures(parsed)
    })
  }, [])

  if (!alwaysShow && hasSelected) return null

  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 16px', marginBottom: 24 }}>
      {features.map((f, i) => (
        <div key={i} style={{
          background: 'rgba(19,16,9,0.85)',
          border: '1px solid rgba(232,160,32,0.12)',
          borderRadius: 14,
          padding: '14px 12px',
          flex: 1,
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Icon name={f.icon} />
          </div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 12, color: '#F5EDD6', marginTop: 8, marginBottom: 4 }}>
            {f.title}
          </div>
          <div style={{ fontSize: 10, color: '#C8B99A', lineHeight: 1.4 }}>
            {f.desc}
          </div>
        </div>
      ))}
    </div>
  )
}
