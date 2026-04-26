'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UtensilsCrossed, Utensils, ChefHat, Pizza, Sandwich, Coffee,
  CupSoda, Wine, Beer, Soup, Salad, Apple, Beef, Fish, Egg, Cookie, Cake,
  IceCream, Candy, Carrot, Wheat, Flame, Snowflake, Droplets, Star, Heart,
  Leaf, Sun, Moon, Clock, MapPin, Home, ShoppingBag, ShoppingCart, Package,
  Tag, Percent, Gift, Award, Zap, Sparkles, ThumbsUp,
  type LucideIcon,
} from 'lucide-react'

type Category = {
  id: string
  slug: string
  name: string
  parent_id: string | null
  display_order: number
  active: boolean
  icon_type: string
  icon_value: string
  level: number
}

type FormState = {
  name: string
  slug: string
  parent_id: string
  display_order: string
  active: boolean
  icon_type: string
  icon_value: string
}

const LUCIDE_ICONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'Coffee', label: 'Café', Icon: Coffee },
  { value: 'CupSoda', label: 'Boisson', Icon: CupSoda },
  { value: 'Wine', label: 'Vin', Icon: Wine },
  { value: 'Beer', label: 'Bière', Icon: Beer },
  { value: 'Soup', label: 'Soupe', Icon: Soup },
  { value: 'Utensils', label: 'Couverts', Icon: Utensils },
  { value: 'UtensilsCrossed', label: 'Croisés', Icon: UtensilsCrossed },
  { value: 'ChefHat', label: 'Chef', Icon: ChefHat },
  { value: 'Pizza', label: 'Pizza', Icon: Pizza },
  { value: 'Sandwich', label: 'Sandwich', Icon: Sandwich },
  { value: 'Salad', label: 'Salade', Icon: Salad },
  { value: 'Apple', label: 'Pomme', Icon: Apple },
  { value: 'Beef', label: 'Viande', Icon: Beef },
  { value: 'Fish', label: 'Poisson', Icon: Fish },
  { value: 'Egg', label: 'Œuf', Icon: Egg },
  { value: 'Cookie', label: 'Cookie', Icon: Cookie },
  { value: 'Cake', label: 'Gâteau', Icon: Cake },
  { value: 'IceCream', label: 'Glace', Icon: IceCream },
  { value: 'Candy', label: 'Bonbon', Icon: Candy },
  { value: 'Carrot', label: 'Carotte', Icon: Carrot },
  { value: 'Wheat', label: 'Blé', Icon: Wheat },
  { value: 'Flame', label: 'Chaud', Icon: Flame },
  { value: 'Snowflake', label: 'Froid', Icon: Snowflake },
  { value: 'Droplets', label: 'Gouttes', Icon: Droplets },
  { value: 'Leaf', label: 'Feuille', Icon: Leaf },
  { value: 'Star', label: 'Étoile', Icon: Star },
  { value: 'Heart', label: 'Cœur', Icon: Heart },
  { value: 'Sparkles', label: 'Magie', Icon: Sparkles },
  { value: 'Sun', label: 'Soleil', Icon: Sun },
  { value: 'Moon', label: 'Lune', Icon: Moon },
  { value: 'Zap', label: 'Flash', Icon: Zap },
  { value: 'Award', label: 'Trophée', Icon: Award },
  { value: 'ThumbsUp', label: 'Top', Icon: ThumbsUp },
  { value: 'Gift', label: 'Cadeau', Icon: Gift },
  { value: 'Percent', label: 'Promo', Icon: Percent },
  { value: 'Tag', label: 'Tag', Icon: Tag },
  { value: 'Package', label: 'Colis', Icon: Package },
  { value: 'ShoppingBag', label: 'Sac', Icon: ShoppingBag },
  { value: 'ShoppingCart', label: 'Panier', Icon: ShoppingCart },
  { value: 'MapPin', label: 'Lieu', Icon: MapPin },
  { value: 'Home', label: 'Maison', Icon: Home },
  { value: 'Clock', label: 'Heure', Icon: Clock },
]

const LUCIDE_MAP: Record<string, LucideIcon> = Object.fromEntries(
  LUCIDE_ICONS.map(i => [i.value, i.Icon])
)

const renderIcon = (id: string, size = 18): React.ReactNode => {
  const LIcon = LUCIDE_MAP[id]
  if (LIcon) return <LIcon size={size} />
  const s = size < 20 ? 20 : size
  const flamme = <svg width={s} height={s} viewBox='0 0 38 38' fill='none'><path d='M19 9 C17 14 12 17 12 22 C12 27.5 15 32 19 33 C23 32 26 27.5 26 22 C26 17 21 14 19 9Z' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.2)' strokeLinecap='round' strokeLinejoin='round'/></svg>
  const flocon = <svg width={s} height={s} viewBox='0 0 40 40' fill='none'><line x1='20' y1='4' x2='20' y2='36' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'/><line x1='4' y1='20' x2='36' y2='20' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'/><line x1='8' y1='8' x2='32' y2='32' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'/><line x1='32' y1='8' x2='8' y2='32' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'/><circle cx='20' cy='20' r='2.5' fill='currentColor'/></svg>
  const burger = <svg width={s} height={s} viewBox='0 0 40 40' fill='none'><path d='M8 19 Q8 7 20 7 Q32 7 32 19Z' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.15)' strokeLinecap='round' strokeLinejoin='round'/><path d='M7 21 Q10 18.5 13 21 Q16 18.5 20 21 Q24 18.5 27 21 Q30 18.5 33 21' stroke='currentColor' strokeWidth='2' fill='none' strokeLinecap='round'/><rect x='8' y='23' width='24' height='3.5' rx='1.8' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.15)'/><path d='M8 28.5 Q8 35 20 35 Q32 35 32 28.5Z' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.15)' strokeLinecap='round' strokeLinejoin='round'/></svg>
  const tasse = <svg width={s} height={s} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M17 8h1a4 4 0 0 1 0 8h-1'/><path d='M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z'/><line x1='6' y1='2' x2='6' y2='4'/><line x1='10' y1='2' x2='10' y2='4'/><line x1='14' y1='2' x2='14' y2='4'/></svg>
  const salade = <svg width={s} height={s} viewBox='0 0 38 38' fill='none'><path d='M19 4 C21 4 23 5 23 7 C25 5 28 6 28 9 C31 8 33 11 31 14 C34 14 35 18 33 20 C35 22 33 26 30 26 C31 29 29 32 26 31 C25 34 22 35 19 34 C16 35 13 34 12 31 C9 32 7 29 8 26 C5 26 3 22 5 20 C3 18 4 14 7 14 C5 11 7 8 10 9 C10 6 13 5 15 7 C15 5 17 4 19 4Z' stroke='currentColor' strokeWidth='2' fill='rgba(232,160,32,0.1)' strokeLinejoin='round'/><circle cx='19' cy='19' r='2.5' fill='currentColor' opacity='0.85'/></svg>
  const legacy: Record<string, React.ReactNode> = { boissons: tasse, chaudes: flamme, froides: flocon, sandwichs: burger, chauds: flamme, froids: flocon, salades: salade }
  return legacy[id] ?? null
}

function IconGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 10, padding: 8, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
        {LUCIDE_ICONS.map(({ value: v, label, Icon }) => {
          const selected = value === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              title={label}
              style={{
                width: 44, height: 44, borderRadius: 8,
                border: selected ? '1.5px solid #F5C842' : '1px solid rgba(232,160,32,0.1)',
                background: selected ? 'rgba(245,200,66,0.15)' : 'transparent',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                color: selected ? '#F5C842' : '#C8B99A', padding: 3,
                transition: 'border-color 0.1s, background 0.1s',
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: 7, lineHeight: 1, textAlign: 'center', fontFamily: 'DM Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 38 }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[ùûü]/g, 'u')
    .replace(/[ôö]/g, 'o').replace(/[îï]/g, 'i').replace(/ç/g, 'c')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

const EMPTY_FORM: FormState = { name: '', slug: '', parent_id: '', display_order: '0', active: true, icon_type: 'builtin', icon_value: 'Coffee' }

const INP: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, background: '#1A1510', border: '1px solid rgba(232,160,32,0.2)', color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6, display: 'block' }

const IconEdit = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IconTrash = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IconGrip = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
    <circle cx="2.5" cy="2" r="1.5"/>
    <circle cx="7.5" cy="2" r="1.5"/>
    <circle cx="2.5" cy="7" r="1.5"/>
    <circle cx="7.5" cy="7" r="1.5"/>
    <circle cx="2.5" cy="12" r="1.5"/>
    <circle cx="7.5" cy="12" r="1.5"/>
  </svg>
)

const BTN_ORDER: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%', border: 'none',
  background: 'rgba(232,160,32,0.1)', color: '#E8A020',
  fontSize: 14, lineHeight: 1, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

function CatRow({
  cat, indent = false, onEdit, onDelete,
  isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd,
  isFirst = false, isLast = false, onMoveUp, onMoveDown,
}: {
  cat: Category
  indent?: boolean
  onEdit: (c: Category) => void
  onDelete: (id: string) => void
  isDragging: boolean
  isDragOver: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
  isFirst?: boolean
  isLast?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        background: '#131009',
        border: isDragOver ? '1px dashed #F5C842' : '1px solid rgba(232,160,32,0.1)',
        borderRadius: 14,
        padding: '12px 16px',
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        marginLeft: indent ? 28 : 0,
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.15s',
        ...(indent ? { borderLeft: isDragOver ? '2px dashed #F5C842' : '2px solid rgba(232,160,32,0.25)' } : {}),
      }}
    >
      <div style={{ color: '#4A4030', flexShrink: 0, cursor: 'grab', display: 'flex', alignItems: 'center', padding: '0 2px' }}>
        <IconGrip />
      </div>
      <div style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: 9, background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.15)', alignItems: 'center', justifyContent: 'center', color: '#E8A020', flexShrink: 0 }}>
        {cat.icon_type === 'builtin'
          ? renderIcon(cat.icon_value, 14)
          : cat.icon_value
            ? <img src={cat.icon_value} style={{ width: 20, height: 20, objectFit: 'contain' }} alt="" />
            : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif' }}>{cat.name}</div>
        <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 2, fontFamily: 'DM Sans, sans-serif' }}>{cat.slug}</div>
      </div>
      <span style={{ padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', background: cat.active ? 'rgba(80,200,120,0.12)' : 'rgba(255,107,107,0.12)', color: cat.active ? '#50C878' : '#FF6B6B', flexShrink: 0 }}>
        {cat.active ? 'Actif' : 'Inactif'}
      </span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {isFirst ? <div style={{ width: 28 }} /> : <button onClick={onMoveUp} style={BTN_ORDER}>↑</button>}
        {isLast  ? <div style={{ width: 28 }} /> : <button onClick={onMoveDown} style={BTN_ORDER}>↓</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={() => onEdit(cat)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(232,160,32,0.06)', color: '#E8A020', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconEdit />
        </button>
        <button onClick={() => onDelete(cat.id)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,107,107,0.2)', background: 'rgba(255,107,107,0.06)', color: '#FF6B6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconTrash />
        </button>
      </div>
    </div>
  )
}

const INP_SM: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }

export default function MenuAdmin() {
  const [cats, setCats] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [iconUploadError, setIconUploadError] = useState('')

  const [menuPlaceholder, setMenuPlaceholder] = useState("Qu'est-ce qui te fait envie ?")
  const [menuPlaceholderIcon, setMenuPlaceholderIcon] = useState('')
  const [menuPlaceholderIconType, setMenuPlaceholderIconType] = useState<'builtin' | 'custom'>('builtin')
  const [menuPlaceholderBuiltinIcon, setMenuPlaceholderBuiltinIcon] = useState('Coffee')
  const [uploadingMenuIcon, setUploadingMenuIcon] = useState(false)
  const [savingPlaceholder, setSavingPlaceholder] = useState(false)
  const [savedPlaceholder, setSavedPlaceholder] = useState(false)

  // Drag & drop state
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragGroupKey, setDragGroupKey] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [savedOrder, setSavedOrder] = useState(false)
  // Ref for immediate access in event handlers (avoids stale closure on fast drags)
  const dragRef = useRef<{ id: string | null; groupKey: string | null }>({ id: null, groupKey: null })

  const supabase = createClient()

  const load = async () => {
    const { data } = await supabase.from('menu_categories').select('*').order('display_order')
    setCats((data as Category[]) || [])
  }

  useEffect(() => {
    load()
    supabase.from('settings').select('*').then(({ data }) => {
      data?.forEach((s: { key: string; value: string }) => {
        if (s.key === 'menu_placeholder') setMenuPlaceholder(s.value)
        if (s.key === 'menu_placeholder_icon') setMenuPlaceholderIcon(s.value)
        if (s.key === 'menu_placeholder_icon_type') setMenuPlaceholderIconType(s.value as 'builtin' | 'custom')
        if (s.key === 'menu_placeholder_builtin_icon') setMenuPlaceholderBuiltinIcon(s.value)
      })
    })
  }, [])

  const parents = cats.filter(c => c.level === 0).sort((a, b) => a.display_order - b.display_order)
  const childrenOf = (pid: string) => cats.filter(c => c.parent_id === pid).sort((a, b) => a.display_order - b.display_order)

  const openNew = () => { setEditingId(null); setForm(EMPTY_FORM); setIconUploadError(''); setShowForm(true) }
  const openEdit = (cat: Category) => {
    setEditingId(cat.id)
    setForm({ name: cat.name, slug: cat.slug, parent_id: cat.parent_id ?? '', display_order: String(cat.display_order), active: cat.active, icon_type: cat.icon_type, icon_value: cat.icon_value })
    setIconUploadError('')
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setIconUploadError('') }

  const setField = (k: keyof FormState, v: string | boolean) =>
    setForm(f => ({
      ...f,
      [k]: v,
      ...(k === 'name' ? { slug: slugify(v as string) } : {}),
      ...(k === 'icon_type' ? { icon_value: v === 'builtin' ? 'Coffee' : '' } : {}),
    }))

  const uploadMenuPlaceholderIcon = async (file: File) => {
    if (file.size > 200 * 1024) { alert('Fichier trop lourd (max 200 KB)'); return }
    setUploadingMenuIcon(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const fileName = `menu-placeholder-icon-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-icons').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('menu-icons').getPublicUrl(fileName)
      setMenuPlaceholderIcon(data.publicUrl)
      await supabase.from('settings').upsert({ key: 'menu_placeholder_icon', value: data.publicUrl })
    }
    setUploadingMenuIcon(false)
  }

  const saveMenuPlaceholder = async () => {
    setSavingPlaceholder(true)
    await Promise.all([
      supabase.from('settings').upsert({ key: 'menu_placeholder', value: menuPlaceholder }),
      supabase.from('settings').upsert({ key: 'menu_placeholder_icon', value: menuPlaceholderIcon }),
      supabase.from('settings').upsert({ key: 'menu_placeholder_icon_type', value: menuPlaceholderIconType }),
      supabase.from('settings').upsert({ key: 'menu_placeholder_builtin_icon', value: menuPlaceholderBuiltinIcon }),
    ])
    setSavingPlaceholder(false)
    setSavedPlaceholder(true)
    setTimeout(() => setSavedPlaceholder(false), 2000)
  }

  const handleIconFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIconUploadError('')
    if (file.size > 500 * 1024) {
      setIconUploadError('Fichier trop lourd (max 500 KB)')
      return
    }
    if (!file.type.startsWith('image/')) {
      setIconUploadError('Format invalide (PNG/SVG recommandé)')
      return
    }
    setUploadingIcon(true)
    try {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `menu-icon-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('menu-icons').upload(path, file, { upsert: true })
      if (upErr) { setIconUploadError('Erreur upload : ' + upErr.message); return }
      const { data: urlData } = supabase.storage.from('menu-icons').getPublicUrl(path)
      setField('icon_value', urlData.publicUrl)
    } finally {
      setUploadingIcon(false)
    }
  }

  const del = async (id: string) => {
    if (!window.confirm('Supprimer cette catégorie ?')) return
    const { error } = await supabase.from('menu_categories').delete().eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    await load()
  }

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) return
    setSaving(true)
    try {
      const level = form.parent_id ? 1 : 0
      const payload = {
        slug: form.slug,
        name: form.name,
        parent_id: form.parent_id || null,
        display_order: parseInt(form.display_order) || 0,
        active: form.active,
        icon_type: form.icon_type,
        icon_value: form.icon_value,
        level,
      }
      let saveError = null
      if (editingId) {
        const { error } = await supabase.from('menu_categories').update(payload).eq('id', editingId)
        saveError = error
      } else {
        const { error } = await supabase.from('menu_categories').insert(payload)
        saveError = error
      }
      if (saveError) { alert('Erreur : ' + saveError.message); return }
      await load()
      closeForm()
    } finally {
      setSaving(false)
    }
  }

  const startDrag = (id: string, groupKey: string) => {
    dragRef.current = { id, groupKey }
    setDragId(id)
    setDragGroupKey(groupKey)
  }

  const moveInGroup = async (group: Category[], fromIdx: number, direction: 1 | -1) => {
    const toIdx = fromIdx + direction
    if (toIdx < 0 || toIdx >= group.length) return
    const a = group[fromIdx]
    const b = group[toIdx]
    const orderA = b.display_order
    const orderB = a.display_order
    setCats(prev => prev.map(c => {
      if (c.id === a.id) return { ...c, display_order: orderA }
      if (c.id === b.id) return { ...c, display_order: orderB }
      return c
    }))
    setSavingOrder(true)
    await Promise.all([
      supabase.from('menu_categories').update({ display_order: orderA }).eq('id', a.id),
      supabase.from('menu_categories').update({ display_order: orderB }).eq('id', b.id),
    ])
    setSavingOrder(false)
    setSavedOrder(true)
    setTimeout(() => setSavedOrder(false), 2000)
  }

  const clearDrag = () => {
    dragRef.current = { id: null, groupKey: null }
    setDragId(null)
    setDragGroupKey(null)
    setDragOverId(null)
  }

  const handleDrop = async (dropId: string, groupKey: string) => {
    const { id: currentDragId, groupKey: draggedGroupKey } = dragRef.current
    clearDrag()
    if (!currentDragId || draggedGroupKey !== groupKey || currentDragId === dropId) return

    const group = groupKey === 'root'
      ? [...parents]
      : cats.filter(c => c.parent_id === groupKey).sort((a, b) => a.display_order - b.display_order)

    const fromIdx = group.findIndex(c => c.id === currentDragId)
    const toIdx = group.findIndex(c => c.id === dropId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...group]
    const [removed] = reordered.splice(fromIdx, 1)
    reordered.splice(fromIdx < toIdx ? toIdx - 1 : toIdx, 0, removed)

    const updates = reordered.map((c, i) => ({ ...c, display_order: i }))
    setCats(prev => {
      const map = new Map(updates.map(c => [c.id, c]))
      return prev.map(c => map.get(c.id) ?? c)
    })

    setSavingOrder(true)
    await Promise.all(updates.map(c =>
      supabase.from('menu_categories').update({ display_order: c.display_order }).eq('id', c.id)
    ))
    setSavingOrder(false)
    setSavedOrder(true)
    setTimeout(() => setSavedOrder(false), 2000)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 900, color: '#F5EDD6' }}>Menu</h1>
        <button onClick={openNew} style={{ padding: '9px 18px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
          + Ajouter
        </button>
      </div>

      {/* MENU — BOUTON PRINCIPAL */}
      <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Menu — Bouton principal</div>

        <label style={LBL}>Texte du placeholder</label>
        <input type="text" value={menuPlaceholder} onChange={e => setMenuPlaceholder(e.target.value)} style={{ ...INP_SM, marginBottom: 14 }} />

        <label style={LBL}>Type d&apos;icône</label>
        <select
          value={menuPlaceholderIconType}
          onChange={e => setMenuPlaceholderIconType(e.target.value as 'builtin' | 'custom')}
          style={{ ...INP_SM, marginBottom: 14, cursor: 'pointer' }}
        >
          <option value="builtin">Icône intégrée</option>
          <option value="custom">Image personnalisée</option>
        </select>

        {menuPlaceholderIconType === 'builtin' ? (
          <>
            <label style={LBL}>Icône</label>
            <div style={{ marginBottom: 14 }}>
              <IconGrid value={menuPlaceholderBuiltinIcon} onChange={setMenuPlaceholderBuiltinIcon} />
            </div>
          </>
        ) : (
          <>
            <label style={LBL}>Icône du placeholder (PNG/SVG, max 200 KB)</label>
            {menuPlaceholderIcon && (
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={menuPlaceholderIcon} alt="Icône placeholder" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8, background: 'rgba(232,160,32,0.1)', padding: 4 }} />
                <button onClick={() => setMenuPlaceholderIcon('')} style={{ background: 'transparent', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
              </div>
            )}
            <label style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 10, border: '1.5px dashed rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.03)', color: uploadingMenuIcon ? '#C8B99A' : '#E8A020', cursor: uploadingMenuIcon ? 'wait' : 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box', marginBottom: 14 }}>
              {uploadingMenuIcon ? 'Upload en cours...' : 'Choisir une icône (PNG/SVG)'}
              <input type="file" accept="image/png,image/svg+xml" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadMenuPlaceholderIcon(e.target.files[0]) }} />
            </label>
          </>
        )}

        <button
          onClick={saveMenuPlaceholder}
          disabled={savingPlaceholder}
          style={{ padding: '10px 24px', borderRadius: 50, border: savedPlaceholder ? '1px solid rgba(91,197,122,0.3)' : 'none', background: savedPlaceholder ? 'rgba(91,197,122,0.15)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: savedPlaceholder ? '#5BC57A' : '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 13, cursor: savingPlaceholder ? 'wait' : 'pointer' }}
        >
          {savedPlaceholder ? 'Enregistré' : savingPlaceholder ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {/* FORMULAIRE */}
      {showForm && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.25)', borderRadius: 16, padding: 28, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#F5EDD6' }}>
              {editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </span>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', color: '#C8B99A', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>×</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={LBL}>Nom</label>
              <input value={form.name} onChange={e => setField('name', e.target.value)} style={INP} placeholder="ex: Boissons Chaudes" />
            </div>
            <div>
              <label style={LBL}>Slug</label>
              <input value={form.slug} onChange={e => setField('slug', e.target.value)} style={INP} placeholder="ex: boissons_chaudes" />
            </div>
            <div>
              <label style={LBL}>Catégorie parente</label>
              <select value={form.parent_id} onChange={e => setField('parent_id', e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
                <option value="">— Catégorie principale —</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Ordre d&apos;affichage</label>
              <input type="number" min={0} value={form.display_order} onChange={e => setField('display_order', e.target.value)} style={INP} />
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <label style={LBL}>Type d&apos;icône</label>
              <select value={form.icon_type} onChange={e => { setField('icon_type', e.target.value); setIconUploadError('') }} style={{ ...INP, cursor: 'pointer' }}>
                <option value="builtin">Icône intégrée</option>
                <option value="custom">Image personnalisée</option>
              </select>
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <label style={LBL}>Icône</label>
              {form.icon_type === 'builtin' ? (
                <IconGrid value={form.icon_value} onChange={v => setField('icon_value', v)} />
              ) : (
                <>
                  <input type="file" accept="image/png,image/svg+xml,image/*" onChange={handleIconFileChange} disabled={uploadingIcon} style={{ ...INP, padding: '8px 14px' }} />
                  {uploadingIcon && <div style={{ fontSize: 11, color: '#C8B99A', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>Upload en cours…</div>}
                  {iconUploadError && <div style={{ fontSize: 11, color: '#FF6B6B', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>{iconUploadError}</div>}
                  {form.icon_value && !uploadingIcon && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      <img src={form.icon_value} width={32} height={32} style={{ objectFit: 'contain', borderRadius: 8, border: '1px solid rgba(232,160,32,0.2)' }} alt="" />
                      <span style={{ fontSize: 12, color: '#C8B99A', fontFamily: 'DM Sans, sans-serif' }}>Aperçu icône</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="cat-active" checked={form.active} onChange={e => setField('active', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#F5C842', cursor: 'pointer' }} />
              <label htmlFor="cat-active" style={{ ...LBL, marginBottom: 0, cursor: 'pointer' }}>Catégorie active</label>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={closeForm} style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'transparent', color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={save} disabled={saving || uploadingIcon} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: (saving || uploadingIcon) ? 'rgba(245,200,66,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 13, cursor: (saving || uploadingIcon) ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Enregistrement…' : editingId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {/* LISTE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(savingOrder || savedOrder) && (
          <div style={{ textAlign: 'center', padding: '8px 16px', borderRadius: 10, background: savedOrder ? 'rgba(80,200,120,0.08)' : 'rgba(232,160,32,0.06)', border: `1px solid ${savedOrder ? 'rgba(80,200,120,0.25)' : 'rgba(232,160,32,0.2)'}`, color: savedOrder ? '#5BC57A' : '#C8B99A', fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
            {savedOrder ? 'Ordre sauvegardé ✓' : 'Sauvegarde en cours…'}
          </div>
        )}
        {parents.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7A6E58', padding: '40px 0', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}>
            Aucune catégorie — cliquez sur + Ajouter
          </div>
        )}
        {parents.map((parent, pi) => {
          const children = childrenOf(parent.id)
          return (
            <div key={parent.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CatRow
                cat={parent}
                onEdit={openEdit}
                onDelete={del}
                isDragging={dragId === parent.id}
                isDragOver={dragOverId === parent.id && dragGroupKey === 'root'}
                onDragStart={() => startDrag(parent.id, 'root')}
                onDragOver={e => { e.preventDefault(); if (dragRef.current.groupKey === 'root') setDragOverId(parent.id) }}
                onDrop={() => handleDrop(parent.id, 'root')}
                onDragEnd={clearDrag}
                isFirst={pi === 0}
                isLast={pi === parents.length - 1}
                onMoveUp={() => moveInGroup(parents, pi, -1)}
                onMoveDown={() => moveInGroup(parents, pi, 1)}
              />
              {children.map((child, ci) => (
                <CatRow
                  key={child.id}
                  cat={child}
                  indent
                  onEdit={openEdit}
                  onDelete={del}
                  isDragging={dragId === child.id}
                  isDragOver={dragOverId === child.id && dragGroupKey === parent.id}
                  onDragStart={() => startDrag(child.id, parent.id)}
                  onDragOver={e => { e.preventDefault(); if (dragRef.current.groupKey === parent.id) setDragOverId(child.id) }}
                  onDrop={() => handleDrop(child.id, parent.id)}
                  onDragEnd={clearDrag}
                  isFirst={ci === 0}
                  isLast={ci === children.length - 1}
                  onMoveUp={() => moveInGroup(children, ci, -1)}
                  onMoveDown={() => moveInGroup(children, ci, 1)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
