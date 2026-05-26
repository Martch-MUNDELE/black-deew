'use client'
import Link from 'next/link'
import Image, { type ImageLoaderProps } from 'next/image'
import { useCart } from '@/store/cart'
import { usePathname } from 'next/navigation'
import { useCatalogue } from '@/store/catalogue'
import { useEffect, useMemo, useState, useRef } from 'react'
import Logo from '@/components/Logo'
import { createClient } from '@/lib/supabase/client'
import {
  UtensilsCrossed, Utensils, ChefHat, Pizza, Sandwich, Coffee,
  CupSoda, Wine, Beer, Soup, Salad, Apple, Beef, Fish, Egg, Cookie, Cake,
  IceCream, Candy, Carrot, Wheat, Flame, Snowflake, Droplets, Star, Heart,
  Leaf, Sun, Moon, Clock, MapPin, Home, ShoppingBag, ShoppingCart, Package,
  Tag, Percent, Gift, Award, Zap, Sparkles, ThumbsUp,
  type LucideIcon,
} from 'lucide-react'

const navbarImageLoader = ({ src }: ImageLoaderProps) => src

type SettingRow = { key: string; value: string | null }

const LUCIDE_NAVBAR_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed, Utensils, ChefHat, Pizza, Sandwich, Coffee,
  CupSoda, Wine, Beer, Soup, Salad, Apple, Beef, Fish, Egg, Cookie, Cake,
  IceCream, Candy, Carrot, Wheat, Flame, Snowflake, Droplets, Star, Heart,
  Leaf, Sun, Moon, Clock, MapPin, Home, ShoppingBag, ShoppingCart, Package,
  Tag, Percent, Gift, Award, Zap, Sparkles, ThumbsUp,
}

type GroupeItem = { id: string; label: string; emoji: string; icon_type: string; sous: { id: string; label: string; emoji: string; icon_type: string }[] }

interface MenuCat {
  id: string; slug: string; name: string; parent_id: string | null
  display_order: number; active: boolean; icon_type: string; icon_value: string | null; level: number
  is_visible?: boolean
}

function buildGroupes(cats: MenuCat[]): GroupeItem[] {
  const l0 = cats.filter(c => c.level === 0 && c.active && c.is_visible !== false).sort((a, b) => a.display_order - b.display_order)
  const l1 = cats.filter(c => c.level === 1 && c.active && c.is_visible !== false).sort((a, b) => a.display_order - b.display_order)
  return l0.map(g => ({
    id: g.slug, label: g.name, emoji: g.icon_value ?? g.slug, icon_type: g.icon_type,
    sous: l1.filter(s => s.parent_id === g.id).map(s => ({ id: s.slug, label: s.name, emoji: s.icon_value ?? s.slug, icon_type: s.icon_type }))
  }))
}

const GROUPES: GroupeItem[] = [
  { id: 'boissons', label: 'Boissons', emoji: 'boissons', icon_type: 'builtin', sous: [{ id: 'chaudes', label: 'Boissons Chaudes', emoji: 'chaudes', icon_type: 'builtin' }, { id: 'froides', label: 'Boissons Froides', emoji: 'froides', icon_type: 'builtin' }] },
  { id: 'sandwichs', label: 'Sandwichs', emoji: 'sandwichs', icon_type: 'builtin', sous: [{ id: 'sandwichs_chauds', label: 'Sandwichs Chauds', emoji: 'chauds', icon_type: 'builtin' }, { id: 'sandwichs_froids', label: 'Sandwichs Froids', emoji: 'froids', icon_type: 'builtin' }] },
  { id: 'salades', label: 'Salades', emoji: 'salades', icon_type: 'builtin', sous: [] },
]

const renderIcon = (id: string, size = 16): React.ReactNode => {
  // Lucide icon by name
  const LIcon = LUCIDE_NAVBAR_MAP[id]
  if (LIcon) return <LIcon size={size} />
  // Legacy SVG fallbacks for old slug-based values
  const s = size < 20 ? 20 : size
  const flamme = <svg width={s} height={s} viewBox='0 0 38 38' fill='none'><path d='M19 9 C17 14 12 17 12 22 C12 27.5 15 32 19 33 C23 32 26 27.5 26 22 C26 17 21 14 19 9Z' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.2)' strokeLinecap='round' strokeLinejoin='round'/></svg>
  const flocon = <svg width={s} height={s} viewBox='0 0 40 40' fill='none'><line x1='20' y1='4' x2='20' y2='36' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'/><line x1='4' y1='20' x2='36' y2='20' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'/><line x1='8' y1='8' x2='32' y2='32' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'/><line x1='32' y1='8' x2='8' y2='32' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'/><circle cx='20' cy='20' r='2.5' fill='currentColor'/></svg>
  const burger = <svg width={s} height={s} viewBox='0 0 40 40' fill='none'><path d='M8 19 Q8 7 20 7 Q32 7 32 19Z' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.15)' strokeLinecap='round' strokeLinejoin='round'/><path d='M7 21 Q10 18.5 13 21 Q16 18.5 20 21 Q24 18.5 27 21 Q30 18.5 33 21' stroke='currentColor' strokeWidth='2' fill='none' strokeLinecap='round'/><rect x='8' y='23' width='24' height='3.5' rx='1.8' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.15)'/><path d='M8 28.5 Q8 35 20 35 Q32 35 32 28.5Z' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.15)' strokeLinecap='round' strokeLinejoin='round'/></svg>
  const tasse = <svg width={s} height={s} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M17 8h1a4 4 0 0 1 0 8h-1'/><path d='M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z'/><line x1='6' y1='2' x2='6' y2='4'/><line x1='10' y1='2' x2='10' y2='4'/><line x1='14' y1='2' x2='14' y2='4'/></svg>
  const salade = <svg width={s} height={s} viewBox='0 0 38 38' fill='none'><path d='M19 4 C21 4 23 5 23 7 C25 5 28 6 28 9 C31 8 33 11 31 14 C34 14 35 18 33 20 C35 22 33 26 30 26 C31 29 29 32 26 31 C25 34 22 35 19 34 C16 35 13 34 12 31 C9 32 7 29 8 26 C5 26 3 22 5 20 C3 18 4 14 7 14 C5 11 7 8 10 9 C10 6 13 5 15 7 C15 5 17 4 19 4Z' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.1)' strokeLinejoin='round'/><circle cx='19' cy='19' r='2.5' fill='currentColor' opacity='0.85'/></svg>
  const legacy: Record<string, React.ReactNode> = { boissons: tasse, chaudes: flamme, froides: flocon, sandwichs: burger, chauds: flamme, froids: flocon, salades: salade }
  return legacy[id] ?? null
}

const renderMenuIcon = (icon_type: string, icon_value: string, size = 16): React.ReactNode => {
  if (icon_type === 'custom' && icon_value) {
    return (
      <Image
        loader={navbarImageLoader}
        src={icon_value}
        alt=""
        width={size}
        height={size}
        unoptimized
        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }}
      />
    )
  }
  if (icon_type === 'builtin') {
    return renderIcon(icon_value, size)
  }
  return null
}

export default function Navbar() {
  const count = useCart(s => s.count())
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [siteName, setSiteName] = useState('Black Deew')
  const [siteBaseline, setSiteBaseline] = useState('AGADIR · LIVRAISON')
  const [siteLogo, setSiteLogo] = useState<string | null>(null)
  const [menuPlaceholder, setMenuPlaceholder] = useState("Qu'est-ce qui te fait envie ?")
  const [menuPlaceholderIcon, setMenuPlaceholderIcon] = useState('')
  const [menuPlaceholderIconType, setMenuPlaceholderIconType] = useState<'builtin' | 'custom'>('builtin')
  const [menuPlaceholderBuiltinIcon, setMenuPlaceholderBuiltinIcon] = useState('Coffee')
  const { activeGroupe, activeSous, hasSelected, setGroupe, setHasSelected, menuGroupes: storeGroupes } = useCatalogue()
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [openDropdown, setOpenDropdown] = useState(false)
  const [groupes, setGroupes] = useState<GroupeItem[]>(GROUPES)
  const supabase = useMemo(() => createClient(), [])

  // Sync depuis store quand menuGroupes disponibles (chargés par CatalogueClient)
  useEffect(() => {
    if (!storeGroupes || storeGroupes.length === 0) return

    Promise.resolve().then(() => {
      setGroupes(prev => storeGroupes.map(sg => {
        const existing = prev.find(p => p.id === sg.id)
        return {
          id: sg.id,
          label: sg.label,
          emoji: existing?.emoji ?? sg.id,
          icon_type: existing?.icon_type ?? 'builtin',
          sous: sg.sous.map(ss => {
            const exs = existing?.sous.find(p => p.id === ss.id)
            return { id: ss.id, label: ss.label, emoji: exs?.emoji ?? ss.id, icon_type: exs?.icon_type ?? 'builtin' }
          })
        }
      }))
    })
  }, [storeGroupes])
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(() => {
      if (!cancelled) setMounted(true)
    })

    supabase.from('settings').select('*').then(({ data }) => {
      if (cancelled) return

      data?.forEach((s: SettingRow) => {
        if (s.key === 'status') setIsOpen(s.value === 'open')
        if (s.key === 'site_name') setSiteName(s.value ?? 'Black Deew')
        if (s.key === 'site_baseline') setSiteBaseline(s.value ?? 'AGADIR · LIVRAISON')
        if (s.key === 'site_logo') {
          if (s.value) {
            const base = s.value.split('?')[0]
            setSiteLogo(base + '?t=' + Date.now())
          } else {
            setSiteLogo('')
          }
        }
        if (s.key === 'menu_placeholder') setMenuPlaceholder(s.value ?? "Qu'est-ce qui te fait envie ?")
        if (s.key === 'menu_placeholder_icon') setMenuPlaceholderIcon(s.value ?? '')
        if (s.key === 'menu_placeholder_icon_type') setMenuPlaceholderIconType(s.value === 'custom' ? 'custom' : 'builtin')
        if (s.key === 'menu_placeholder_builtin_icon') setMenuPlaceholderBuiltinIcon(s.value ?? 'Coffee')
      })
    })

    supabase.from('menu_categories').select('*').then(({ data }) => {
      if (cancelled) return
      if (data && data.length > 0) {
        const built = buildGroupes(data as MenuCat[])
        if (built.length > 0) setGroupes(built)
      }
    })

    const handleClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpenDropdown(false)
    }

    document.addEventListener('mousedown', handleClick)

    return () => {
      cancelled = true
      document.removeEventListener('mousedown', handleClick)
    }
  }, [supabase])

  const handleSelect = (groupeId: string, sousId?: string) => {
    const g = groupes.find(g => g.id === groupeId)
    if (!g) return
    setGroupe(groupeId, sousId || (g.sous[0]?.id ?? groupeId))
    setHasSelected(true)
    setOpenDropdown(false)
  }

  const groupe = groupes.find(g => g.id === activeGroupe) ?? groupes[0]
  const currentSous = groupe?.sous.find(s => s.id === activeSous)
  const currentLabel = currentSous ? currentSous.label : (groupe?.label ?? '')
  const currentEmoji = currentSous ? currentSous.emoji : (groupe?.emoji ?? '')
  const currentIconType = currentSous ? currentSous.icon_type : (groupe?.icon_type ?? 'builtin')

  return (
    <nav style={{ background: 'rgba(8,6,3,0.94)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 }}>
      {/* LIGNE 1 — logo + panier */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 clamp(12px, 4vw, 24px)', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }} onClick={() => { setHasSelected(false) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {siteLogo === null ? <div style={{ width: 64, height: 64, flexShrink: 0 }} /> : siteLogo ? (
                <Image
                  loader={navbarImageLoader}
                  src={siteLogo}
                  alt={siteName}
                  width={64}
                  height={64}
                  unoptimized
                  style={{ objectFit: 'contain', borderRadius: 8, flexShrink: 0 }}
                />
              ) : (
                <Logo size={52} />
              )}
            <div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 15, background: 'linear-gradient(90deg,#FFD060,#E8901A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.3px', lineHeight: 1.1 }}>{siteName}</div>
              <div style={{ fontSize: 9, color: '#C8B99A', letterSpacing: '2px', textTransform: 'uppercase', lineHeight: 1, marginTop: 3 }}>{siteBaseline}</div>
            </div>
          </div>
        </Link>
        {isOpen && mounted && count > 0 && (
          <Link href="/panier" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', padding: '9px 18px', borderRadius: 50, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 16px rgba(232,160,32,0.28)' }}>
              <span>Panier</span>
              <span style={{ background: '#0A0804', color: '#FFFFFF', borderRadius: 50, padding: '2px 8px', fontSize: 11, fontWeight: 800, lineHeight: 1.4 }}>{count}</span>
            </div>
          </Link>
        )}
      </div>

      {/* LIGNE 2 — dropdown menu */}
      {isOpen && isHome && (
        <div ref={dropRef} style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px 12px', position: 'relative' }}>
          <button
            onClick={() => setOpenDropdown(o => !o)}
            style={{ width: '100%', padding: '13px 18px', background: '#131009', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 14, color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' as const }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 9, background: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', alignItems: 'center', justifyContent: 'center', color: '#E8A020' }}>
                {hasSelected
                  ? renderMenuIcon(currentIconType, currentEmoji, 15)
                  : renderMenuIcon(menuPlaceholderIconType, menuPlaceholderIconType === 'builtin' ? menuPlaceholderBuiltinIcon : menuPlaceholderIcon, 15)
                    ?? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8A020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                }
              </span>
              <span style={{ fontStyle: hasSelected ? 'normal' : 'italic', color: hasSelected ? '#F5EDD6' : '#C8B99A' }}>
                {hasSelected ? currentLabel : menuPlaceholder}
              </span>
            </span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: openDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
              <path d="M3 6L8 11L13 6" stroke="#C8B99A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {openDropdown && (
            <div style={{ position: 'absolute', top: 'calc(100% - 12px)', left: 16, right: 16, background: '#1A1510', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 14, overflow: 'hidden', zIndex: 60, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', maxHeight: 'min(400px, 65vh)', overflowY: 'auto' }}>
              {groupes.map((g, gi) => (
                <div key={g.id}>
                  <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#C8B99A', letterSpacing: '1.5px', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#E8A020' }}>{renderMenuIcon(g.icon_type, g.emoji, 11)}</span>
                    {g.label}
                  </div>
                  {g.sous.length > 0 ? g.sous.map(s => {
                    const isActive = activeGroupe === g.id && activeSous === s.id && hasSelected
                    return (
                      <button key={s.id} onClick={() => handleSelect(g.id, s.id)} style={{ width: '100%', padding: '11px 16px 11px 28px', background: isActive ? 'rgba(232,160,32,0.1)' : 'transparent', border: 'none', borderLeft: isActive ? '3px solid #F5C842' : '3px solid transparent', color: isActive ? '#F5C842' : '#C8B890', fontFamily: 'DM Sans, sans-serif', fontWeight: isActive ? 700 : 500, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' as const }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: 8, background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.15)', alignItems: 'center', justifyContent: 'center', color: '#E8A020', flexShrink: 0 }}>
                            {renderMenuIcon(s.icon_type, s.emoji, 14)}
                          </span>
                          {s.label}
                        </span>
                      </button>
                    )
                  }) : (
                    <button onClick={() => handleSelect(g.id)} style={{ width: '100%', padding: '11px 16px 11px 28px', background: activeGroupe === g.id && hasSelected ? 'rgba(232,160,32,0.1)' : 'transparent', border: 'none', borderLeft: activeGroupe === g.id && hasSelected ? '3px solid #F5C842' : '3px solid transparent', color: activeGroupe === g.id && hasSelected ? '#F5C842' : '#C8B890', fontFamily: 'DM Sans, sans-serif', fontWeight: activeGroupe === g.id && hasSelected ? 700 : 500, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', textAlign: 'left' as const }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: 8, background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.15)', alignItems: 'center', justifyContent: 'center', color: '#E8A020', flexShrink: 0 }}>
                          {renderMenuIcon(g.icon_type, g.emoji, 14)}
                        </span>
                        {g.label}
                      </span>
                    </button>
                  )}
                  {gi < groupes.length - 1 && <div style={{ height: 1, background: 'rgba(232,160,32,0.08)', margin: '4px 0' }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
