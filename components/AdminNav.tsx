'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Logo from '@/components/Logo'

const NAV_GROUPS = [
  {
    label: 'BOUTIQUE',
    links: [
      { href: '/admin', label: 'Dashboard', exact: true },
      { href: '/admin/commandes', label: 'Commandes', sub: [
        { label: 'Nouvelles', anchor: 'nouvelle', url: '/admin/commandes?tab=nouvelle' },
        { label: 'Confirmées', anchor: 'confirmee', url: '/admin/commandes?tab=confirmée' },
        { label: 'Préparation', anchor: 'preparation', url: '/admin/commandes?tab=en_preparation' },
        { label: 'Livraison', anchor: 'livraison', url: '/admin/commandes?tab=en_livraison' },
        { label: 'Livrées', anchor: 'livree', url: '/admin/commandes?tab=livrée' },
        { label: 'Annulées', anchor: 'annulee', url: '/admin/commandes?tab=annulée' },
        { label: 'Retrait', anchor: 'retrait', url: '/admin/commandes?tab=retrait' },
      ]},
      { href: '/admin/produits', label: 'Produits', sub: [
        { label: '+ Ajouter', anchor: 'nouveau', url: '/admin/produits/nouveau' },
        { label: 'Actifs', anchor: 'actifs', url: '/admin/produits?tab=actifs' },
        { label: 'Inactifs', anchor: 'inactifs', url: '/admin/produits?tab=inactifs' },
      ]},
    ],
  },
  {
    label: 'CONFIGURATION',
    links: [
      { href: '/admin/menu', label: 'Menu' },
      { href: '/admin/livraison', label: 'Livraison', sub: [
        { label: 'Mode', anchor: 'mode', url: '/admin/livraison?tab=mode' },
        { label: 'Position boutique', anchor: 'position', url: '/admin/livraison?tab=position' },
        { label: 'Zone & tarifs', anchor: 'zone', url: '/admin/livraison?tab=zone' },
        { label: 'Simulateur', anchor: 'simulateur', url: '/admin/livraison?tab=simulateur' },
      ]},
      { href: '/admin/creneaux', label: 'Créneaux', sub: [
        { label: 'Horaires', anchor: 'horaires', url: '/admin/creneaux?tab=horaires' },
        { label: 'Pause déjeuner', anchor: 'pause', url: '/admin/creneaux?tab=pause' },
        { label: 'Jours fermés', anchor: 'fermeture', url: '/admin/creneaux?tab=fermeture' },
        { label: 'Génération', anchor: 'generation', url: '/admin/creneaux?tab=generation' },
      ]},
      { href: '/admin/settings', label: 'Paramètres', sub: [
        { label: 'Statut service', anchor: 'statut', url: '/admin/settings?tab=statut' },
        { label: 'Identité du site', anchor: 'identite', url: '/admin/settings?tab=identite' },
        { label: 'Fond de page', anchor: 'fond', url: '/admin/settings?tab=fond' },
        { label: 'Image hero', anchor: 'hero', url: '/admin/settings?tab=hero' },
        { label: 'Arguments produit', anchor: 'arguments', url: '/admin/settings?tab=arguments' },
      ]},
    ],
  },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [siteName, setSiteName] = useState('Black Deew')
  const [siteLogo, setSiteLogo] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedHref, setExpandedHref] = useState<string | null>(null)
  const [toast, setToast] = useState<{ name: string; total: number } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevOrderIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)

  useEffect(() => {
    const anchor = sessionStorage.getItem('aj_scroll_to')
    if (anchor) {
      sessionStorage.removeItem('aj_scroll_to')
      setTimeout(() => { document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }) }, 400)
    }
  }, [pathname])

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => {
      data?.forEach((s: any) => {
        if (s.key === 'site_name') setSiteName(s.value)
        if (s.key === 'site_logo') setSiteLogo(s.value || '')
      })
    })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const email = session?.user?.email
      if (email) {
        const { data: admin } = await supabase
          .from('admins')
          .select('role')
          .eq('email', email)
          .single()
        setIsSuperAdmin(admin?.role === 'superadmin')
      }
    })
  }, [])

  useEffect(() => {
    const sb = createClient()
    // Charge les IDs existants sans déclencher de toast
    sb.from('orders').select('id').then(({ data }) => {
      prevOrderIds.current = new Set((data || []).map((o: any) => o.id))
      isFirstLoad.current = false
    })

    const channel = sb
      .channel('adminnav-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const o = payload.new as any
        if (!prevOrderIds.current.has(o.id)) {
          prevOrderIds.current.add(o.id)
          if (toastTimer.current) clearTimeout(toastTimer.current)
          setToast({ name: o.customer_name, total: o.total || 0 })
          toastTimer.current = setTimeout(() => setToast(null), 8000)
        }
      })
      .subscribe()

    return () => {
      sb.removeChannel(channel)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const close = () => { setMenuOpen(false); setExpandedHref(null) }

  const allGroups = [
    ...NAV_GROUPS,
    { label: 'FACTURATION', links: [{ href: '/admin/abonnement', label: 'Mon abonnement' }] },
    ...(isSuperAdmin
      ? [{ label: 'ADMIN', links: [{ href: '/admin/superadmin', label: 'Super Admin', sub: [
        { label: 'Administrateurs', url: '/admin/superadmin' },
        { label: 'Journal', url: '/admin/superadmin' },
        { label: 'Clients & Contrats', url: '/admin/superadmin/facturation/contrats' },
        { label: 'Périodes', url: '/admin/superadmin/facturation/periodes' },
        { label: 'Ajustements', url: '/admin/superadmin/facturation/ajustements' },
      ] }] }]
      : []),
  ]

  const renderLogo = (size: number) =>
    siteLogo === null ? (
      <div style={{ width: size, height: size, flexShrink: 0 }} />
    ) : siteLogo ? (
      <img src={siteLogo} alt={siteName} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
    ) : (
      <Logo size={size} />
    )

  return (
    <>
      {/* Toast nouvelle commande — global toutes pages admin */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 64,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          background: 'linear-gradient(135deg, #1A1408, #231C0A)',
          border: '1px solid rgba(245,200,66,0.5)',
          borderRadius: 14,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          minWidth: 260,
          maxWidth: 'calc(100vw - 32px)',
          animation: 'slide-in-toast 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          <style>{`
            @keyframes slide-in-toast {
              from { transform: translate(-50%, -80px); opacity: 0; }
              to   { transform: translate(-50%, 0);    opacity: 1; }
            }
          `}</style>
          <div style={{ fontSize: 20 }}>🛎️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#F5C842', fontWeight: 700, marginBottom: 2 }}>
              Nouvelle commande !
            </div>
            <div style={{ fontSize: 13, color: '#F5EDD6', fontWeight: 600 }}>
              {toast.name} — {toast.total.toFixed(0)} DH
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: '#7A6E58', cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Fixed header */}
      <header style={{
        height: 56,
        background: '#0D0B07',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid rgba(232,160,32,0.1)',
      }}>
        <Link href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          {renderLogo(28)}
          <div style={{
            fontFamily: 'Playfair Display, serif',
            fontWeight: 700,
            fontSize: 14,
            background: 'linear-gradient(90deg,#FFD060,#E8901A)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {siteName}
          </div>
        </Link>

        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#F5C842',
            fontSize: 22,
            lineHeight: 1,
          }}
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {menuOpen ? '✕' : '≡'}
        </button>
      </header>
      {/* Sous-navigation supprimée — chaque page a ses propres onglets */}

      {/* Transparent overlay to close on outside click */}
      {menuOpen && (
        <div
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 98,
          }}
        />
      )}

      {/* Dropdown below header */}
      {menuOpen && (
        <div style={{
          position: 'fixed',
          top: 56,
          left: 0,
          right: 0,
          background: '#0D0B07',
          zIndex: 99,
          borderBottom: '1px solid rgba(232,160,32,0.15)',
          maxHeight: 'calc(100vh - 56px)',
          overflowY: 'auto',
        }}>
          <div style={{ padding: '8px 0' }}>
            {allGroups.map(group => (
              <div key={group.label}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#7A6E58',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const,
                  padding: '12px 16px 4px',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                  {group.label}
                </div>
                {group.links.map(link => {
                  const active = isActive(link.href, (link as any).exact)
                  const sub = (link as any).sub
                  return (
                    <div key={link.href}>
                      <div
                        onClick={() => {
                          close()
                          window.location.href = link.href
                        }}
                        style={{ textDecoration: 'none', display: 'block', cursor: 'pointer' }}
                      >
                        <div style={{
                          padding: '9px 16px',
                          fontSize: 21,
                          fontWeight: 500,
                          fontFamily: 'DM Sans, sans-serif',
                          color: active ? '#F5C842' : '#FFFFFF',
                          background: active ? 'rgba(245,200,66,0.08)' : 'transparent',
                          borderLeft: active ? '2px solid #F5C842' : '2px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}>
                          {link.label}
                          
                        </div>
                      </div>
                      {sub && (
                        <div style={{
                          borderLeft: '1px solid rgba(232,160,32,0.1)',
                          marginLeft: 16,
                        }}>
                          {sub.map((s: any) => (
                            <div
                              key={s.anchor}
                              onClick={() => {
                                close()
                                if (s.url) {
                                  window.location.href = s.url
                                } else {
                                  setTimeout(() => {
                                    document.getElementById(s.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                  }, 100)
                                }
                              }}
                              style={{
                                padding: '6px 16px',
                                fontSize: 15,
                                fontWeight: 500,
                                fontFamily: 'DM Sans, sans-serif',
                                color: '#FFFFFF',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#E8A020')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#FFFFFF')}
                            >
                              › {s.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(232,160,32,0.08)', padding: '8px 0' }}>
            <button
              onClick={() => { close(); logout() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'DM Sans, sans-serif',
                color: '#FF6B6B',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left' as const,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </>
  )
}
