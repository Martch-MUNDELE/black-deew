'use client'

import { useCallback, useEffect, useState } from 'react'
import CampaignsPanel from '@/components/admin/CampaignsPanel'
import CampaignResults from '@/components/admin/CampaignResults'
import ClientOffersPanel from '@/components/admin/ClientOffersPanel'

// Message affiché quand il n'y a aucune campagne (transmis au panneau).
const EMPTY_TITLE = "Aucune campagne pour l'instant"
const EMPTY_TEXT = 'Prépare une première campagne avec le formulaire ci-dessus. Rien n’est envoyé à ce stade.'

const TABS = [
  { id: 'campagnes', label: 'Campagnes' },
  { id: 'offres', label: 'Offres clients' },
  { id: 'resultats', label: 'Résultats' },
] as const
type TabId = (typeof TABS)[number]['id']

function tabFromHash(hash: string): TabId {
  const id = hash.replace(/^#/, '')
  return TABS.some((t) => t.id === id) ? (id as TabId) : 'campagnes'
}

export default function MarketingPage() {
  const [active, setActive] = useState<TabId>('campagnes')

  // L'onglet actif est gardé dans le hash de l'adresse (lien partageable).
  useEffect(() => {
    setActive(tabFromHash(window.location.hash))
    const onHash = () => setActive(tabFromHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const select = useCallback((id: TabId) => {
    setActive(id)
    try {
      window.history.replaceState(null, '', `#${id}`)
    } catch {
      /* hash non modifiable : l'onglet reste choisi localement */
    }
  }, [])

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next < 0) return
    e.preventDefault()
    select(TABS[next].id)
    document.getElementById(`marketing-tab-${TABS[next].id}`)?.focus()
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1180, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#E8A020', margin: '0 0 6px' }}>Marketing</h1>
      <p style={{ fontSize: 14, color: '#8A7A5C', margin: '0 0 20px' }}>
        Envoie des offres aux clients VIP par WhatsApp, avec leur accord.
      </p>

      <div role="tablist" aria-label="Sections du Marketing"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid rgba(232,160,32,0.15)', marginBottom: 20 }}>
        {TABS.map((t, i) => {
          const selected = active === t.id
          return (
            <button key={t.id} type="button" role="tab" id={`marketing-tab-${t.id}`}
              aria-selected={selected} aria-controls={`marketing-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)} onKeyDown={(e) => onKeyDown(e, i)}
              style={{
                minHeight: 44, padding: '0 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                background: 'transparent', border: 'none', marginBottom: -1,
                color: selected ? '#E8A020' : '#8A7A5C',
                borderBottom: selected ? '2px solid #E8A020' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id="marketing-panel-campagnes" aria-labelledby="marketing-tab-campagnes" hidden={active !== 'campagnes'}>
        <CampaignsPanel emptyTitle={EMPTY_TITLE} emptyText={EMPTY_TEXT} />
      </div>
      <div role="tabpanel" id="marketing-panel-offres" aria-labelledby="marketing-tab-offres" hidden={active !== 'offres'}>
        <ClientOffersPanel />
      </div>
      <div role="tabpanel" id="marketing-panel-resultats" aria-labelledby="marketing-tab-resultats" hidden={active !== 'resultats'}>
        <CampaignResults />
      </div>
    </div>
  )
}
