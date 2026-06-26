'use client'
import { useEffect, useState, Suspense } from 'react'
import Image, { type ImageLoaderProps } from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/lib/currency'
import type { Product } from '@/lib/types'

const adminProductImageLoader = ({ src }: ImageLoaderProps) => src

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

// ── Types ──────────────────────────────────────────────────────────────────
type Tab = 'actifs' | 'inactifs' | 'vip'
type Cat = { slug: string; name: string }

// ── Composant principal ────────────────────────────────────────────────────
function ProduitsAdminInner() {
  const supabase = createClient()
  const router = useRouter()
  const currency = useCurrency()

  // État principal
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('actifs')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [cats, setCats] = useState<Cat[]>([])
  const [openCatDropdown, setOpenCatDropdown] = useState(false)
  const [stockEnabled, setStockEnabled] = useState(false)
  const [editingStock, setEditingStock] = useState<{id: string; value: string} | null>(null)
  const [debugV] = useState(1)

  // ── Chargement initial ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [
        { data: prods },
        { data: catsData },
        { data: stockRows }
      ] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('menu_categories').select('slug,name').eq('level', 1).eq('active', true).order('display_order'),
        supabase.from('settings').select('value').eq('key', 'stock_enabled')
      ])
      setAllProducts((prods as Product[]) || [])
      setCats((catsData as Cat[]) || [])
      setStockEnabled(stockRows?.[0]?.value === 'true')
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtrage (tout en mémoire, pas de requête Supabase) ────────────────
  const filtered = allProducts.filter(p => {
    // Filtre tab
    if (tab === 'vip' && !p.is_vip) return false
    if (tab === 'actifs' && (!p.active || p.is_vip)) return false
    if (tab === 'inactifs' && (p.active || p.is_vip)) return false
    // Filtre catégorie
    if (filterCat && p.subcategory !== filterCat) return false
    // Filtre texte
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Grouper par sous-catégorie
  const grouped = filtered.reduce<Record<string, Product[]>>((acc, p) => {
    const key = tab === 'vip' ? 'VIP' : (p.subcategory || 'Autres')
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  // Compteurs onglets
  const countActifs = allProducts.filter(p => p.active && !p.is_vip).length
  const countInactifs = allProducts.filter(p => !p.active && !p.is_vip).length
  const countVip = allProducts.filter(p => p.is_vip).length

  // ── Actions ────────────────────────────────────────────────────────────
  const del = async (id: string) => {
    if (!window.confirm('Supprimer ce produit ?')) return
    const product = allProducts.find(p => p.id === id)
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    if (product?.image_url?.includes('supabase.co')) {
      const path = product.image_url.split('/products/')[1]?.split('?')[0]
      if (path) await supabase.storage.from('products').remove([path])
    }
    setAllProducts(prev => prev.filter(p => p.id !== id))
  }

  const setFeatured = async (id: string) => {
    await supabase.from('products').update({ featured: false }).neq('id', id)
    await supabase.from('products').update({ featured: true }).eq('id', id)
    setAllProducts(prev => prev.map(p => ({ ...p, featured: p.id === id })))
  }

  const setCoupDeCoeur = async (id: string) => {
    await supabase.from('products').update({ is_coup_de_coeur: false }).neq('id', id)
    await supabase.from('products').update({ is_coup_de_coeur: true }).eq('id', id)
    setAllProducts(prev => prev.map(p => ({ ...p, is_coup_de_coeur: p.id === id })))
  }

  const setPopular = async (id: string, subcategory: string | null, isVip: boolean) => {
    if (isVip) {
      await supabase.from('products').update({ popular: false }).eq('is_vip', true)
      await supabase.from('products').update({ popular: true }).eq('id', id)
      setAllProducts(prev => prev.map(p => ({ ...p, popular: p.is_vip ? p.id === id : p.popular })))
    } else {
      await supabase.from('products').update({ popular: false }).eq('subcategory', subcategory)
      await supabase.from('products').update({ popular: true }).eq('id', id)
      setAllProducts(prev => prev.map(p => ({ ...p, popular: p.subcategory === subcategory ? p.id === id : p.popular })))
    }
  }

  const toggleStock = async () => {
    const next = !stockEnabled
    await supabase.from('settings').upsert({ key: 'stock_enabled', value: String(next) })
    setStockEnabled(next)
  }

  const saveStock = async (id: string, val: string) => {
    const parsed = val === '' ? null : parseInt(val)
    await supabase.from('products').update({ stock: parsed }).eq('id', id)
    setAllProducts(prev => prev.map(p => p.id === id ? { ...p, stock: parsed } : p))
    setEditingStock(null)
  }

  // ── Rendu ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>

      {/* Pastille debug */}
      <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 9999, background: '#F5C842', color: '#000', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{debugV}</div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 900, color: '#F5EDD6' }}>Produits</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleStock} style={{ padding: '9px 18px', borderRadius: 50, border: '1px solid', borderColor: stockEnabled ? 'rgba(91,197,122,0.5)' : 'rgba(255,255,255,0.1)', background: stockEnabled ? 'rgba(91,197,122,0.12)' : 'rgba(255,255,255,0.04)', color: stockEnabled ? '#5BC57A' : '#7A6E58', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Stock {stockEnabled ? 'ACTIF' : 'INACTIF'}
          </button>
          <button onClick={() => router.push('/admin/produits/nouveau')} style={{ padding: '9px 18px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            + Ajouter
          </button>
        </div>
      </div>

      {/* Recherche texte */}
      <input
        type="text"
        placeholder="Rechercher un produit..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 16px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.2)', background: '#131009', color: '#F5EDD6', fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
      />

      {/* Filtre catégorie */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <button
          onClick={() => setOpenCatDropdown(o => !o)}
          style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(232,160,32,0.2)', background: '#131009', color: filterCat ? '#F5C842' : '#7A6E58', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', outline: 'none' }}
        >
          <span>{filterCat ? cats.find(c => c.slug === filterCat)?.name : 'Sélectionner une catégorie'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {openCatDropdown && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#131009', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 12, zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <button onClick={() => { setFilterCat(''); setOpenCatDropdown(false) }} style={{ width: '100%', padding: '10px 16px', background: !filterCat ? 'rgba(232,160,32,0.1)' : 'transparent', color: !filterCat ? '#F5C842' : '#C8B99A', fontSize: 13, fontFamily: 'DM Sans, sans-serif', border: 'none', textAlign: 'left' as const, cursor: 'pointer', borderBottom: '1px solid rgba(232,160,32,0.06)' }}>
              Toutes les catégories
            </button>
            {cats.map(c => (
              <button key={c.slug} onClick={() => { setFilterCat(c.slug); setOpenCatDropdown(false) }} style={{ width: '100%', padding: '10px 16px', background: filterCat === c.slug ? 'rgba(232,160,32,0.1)' : 'transparent', color: filterCat === c.slug ? '#F5C842' : '#C8B99A', fontSize: 13, fontFamily: 'DM Sans, sans-serif', border: 'none', textAlign: 'left' as const, cursor: 'pointer', borderBottom: '1px solid rgba(232,160,32,0.06)' }}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['actifs', countActifs], ['inactifs', countInactifs], ['vip', countVip]] as [Tab, number][]).map(([t, count]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 16px', borderRadius: 50, border: '1px solid', borderColor: tab === t ? (t === 'inactifs' ? 'rgba(255,107,107,0.4)' : 'rgba(245,200,66,0.4)') : 'rgba(255,255,255,0.06)', background: tab === t ? (t === 'inactifs' ? 'rgba(255,107,107,0.08)' : 'rgba(245,200,66,0.12)') : 'transparent', color: tab === t ? (t === 'inactifs' ? '#FF6B6B' : '#F5C842') : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' as const }}>
            {t} <span style={{ marginLeft: 4, background: tab === t ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: 50, fontSize: 10 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#7A6E58', fontFamily: 'DM Sans, sans-serif' }}>
          Chargement...
        </div>
      )}

      {/* Aucun résultat */}
      {!loading && Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', color: '#7A6E58', padding: '40px 0', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}>
          Aucun produit trouvé
        </div>
      )}

      {/* Liste produits */}
      {!loading && Object.entries(grouped).map(([sub, items]) => (
        <div key={sub} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#E8A020', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(232,160,32,0.15)' }}>
            {sub} ({items.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(p => (
              <div key={p.id} style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                {p.image_url && <Image loader={adminProductImageLoader} src={p.image_url} alt={p.name} width={64} height={64} unoptimized style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(232,160,32,0.1)' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#F5EDD6' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#C8B99A', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {(p.discount ?? 0) > 0 && <span style={{ textDecoration: 'line-through', color: '#4A4035' }}>{p.price}</span>}
                    <span style={{ color: (p.discount ?? 0) > 0 ? '#FF6B20' : '#C8B99A' }}>{(p.discount ?? 0) > 0 ? (p.price * (1 - (p.discount ?? 0) / 100)).toFixed(2) : p.price} {currency}</span>
                  </div>
                  {stockEnabled && (
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {editingStock?.id === p.id ? (
                        <input autoFocus type="text" inputMode="numeric" value={editingStock.value}
                          onChange={e => setEditingStock({ id: p.id, value: e.target.value })}
                          onBlur={() => saveStock(p.id, editingStock.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveStock(p.id, editingStock.value); if (e.key === 'Escape') setEditingStock(null) }}
                          style={{ width: 80, padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.05)', color: '#F5EDD6', fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
                        />
                      ) : (
                        <button onClick={() => setEditingStock({ id: p.id, value: p.stock === null ? '' : String(p.stock) })}
                          style={{ padding: '1px 8px', borderRadius: 4, border: 'none', background: 'transparent', color: p.stock === null ? '#4A4035' : p.stock === 0 ? '#FF6B6B' : p.stock <= 3 ? '#FF6B20' : '#7A6E58', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          {p.stock === null ? '· ∞' : p.stock === 0 ? '· épuisé' : '· ' + p.stock + ' unités'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setFeatured(p.id)} title="Mettre à la une" style={{ width: 34, height: 34, borderRadius: 8, border: p.featured ? '1px solid rgba(245,200,66,0.6)' : '1px solid rgba(255,255,255,0.08)', background: p.featured ? 'rgba(245,200,66,0.15)' : 'transparent', color: p.featured ? '#F5C842' : '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>★</button>
                  <button onClick={() => setPopular(p.id, p.subcategory, !!p.is_vip)} title="Populaire" style={{ width: 34, height: 34, borderRadius: 8, border: p.popular ? '1px solid rgba(255,107,32,0.6)' : '1px solid rgba(255,255,255,0.08)', background: p.popular ? 'rgba(255,107,32,0.15)' : 'transparent', color: p.popular ? '#FF6B20' : '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔥</button>
                  <button onClick={() => setCoupDeCoeur(p.id)} title="Coup de coeur" style={{ width: 34, height: 34, borderRadius: 8, border: p.is_coup_de_coeur ? '1px solid rgba(255,100,130,0.6)' : '1px solid rgba(255,255,255,0.08)', background: p.is_coup_de_coeur ? 'rgba(255,100,130,0.15)' : 'transparent', color: p.is_coup_de_coeur ? '#FF6482' : '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>❤️</button>
                  <button onClick={() => router.push('/admin/produits/' + p.id + '/modifier')} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(232,160,32,0.06)', color: '#E8A020', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconEdit /></button>
                  <button onClick={() => del(p.id)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,107,107,0.2)', background: 'rgba(255,107,107,0.06)', color: '#FF6B6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconTrash /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <style>{`input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}`}</style>
    </div>
  )
}

export default function ProduitsAdmin() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#C8B99A', fontFamily: 'DM Sans, sans-serif' }}>Chargement...</div>}>
      <ProduitsAdminInner />
    </Suspense>
  )
}
