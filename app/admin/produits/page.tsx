'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Product = { id: string; name: string; price: number; image_url: string; subcategory: string; active: boolean; featured: boolean; popular: boolean }



const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

function ProduitsAdminInner() {
  const [products, setProducts] = useState<Product[]>([])
  const [subcats, setSubcats] = useState<{slug: string, name: string}[]>([])
  const [parentCats, setParentCats] = useState<{id: string, slug: string, name: string}[]>([])
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'actifs')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [openCatDropdown, setOpenCatDropdown] = useState(false)
  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && t !== tab) setTab(t)
  }, [searchParams])
  const supabase = createClient()
  const router = useRouter()

  const loadCats = async () => {
    const [{ data: parents }, { data: children }] = await Promise.all([
      supabase.from('menu_categories').select('id,slug,name').eq('level', 0).eq('active', true).order('display_order'),
      supabase.from('menu_categories').select('slug,name,parent_id').eq('level', 1).eq('active', true).order('display_order'),
    ])
    setParentCats((parents as {id: string, slug: string, name: string}[]) || [])
    setSubcats((children as {slug: string, name: string, parent_id: string}[]) || [])
  }

  const loadProducts = async (cat: string) => {
    if (!cat) { setProducts([]); return }
    const { data: prods } = await supabase.from('products').select('*').eq('subcategory', cat).order('name')
    setProducts((prods as Product[]) || [])
  }

  const searchProducts = async (q: string) => {
    if (!q.trim()) { setProducts([]); return }
    const { data: prods } = await supabase.from('products').select('*').ilike('name', '%' + q + '%').order('name')
    setProducts((prods as Product[]) || [])
  }

  useEffect(() => {
    loadCats()
  }, [])

  useEffect(() => {
    if (!search) { if (filterCat) loadProducts(filterCat); else setProducts([]); return }
    const t = setTimeout(() => searchProducts(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (filterCat) { setSearch(''); loadProducts(filterCat) }
  }, [filterCat])

  const del = async (id: string) => {
    if (!window.confirm('Supprimer ce produit ?')) return
    const product = products.find(p => p.id === id)
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    if (product?.image_url && product.image_url.includes('supabase.co')) {
      const path = product.image_url.split('/products/')[1]?.split('?')[0]
      if (path) await supabase.storage.from('products').remove([path])
    }
    await loadProducts(filterCat)
  }

  const setFeatured = async (id: string) => {
    await supabase.from('products').update({ featured: false }).neq('id', id)
    await supabase.from('products').update({ featured: true }).eq('id', id)
    setProducts(prev => prev.map(p => ({ ...p, featured: p.id === id })))
  }

  const setPopular = async (id: string, subcategory: string) => {
    await supabase.from('products').update({ popular: false }).eq('subcategory', subcategory)
    await supabase.from('products').update({ popular: true }).eq('id', id)
    setProducts(prev => prev.map(p => ({
      ...p,
      popular: p.subcategory === subcategory ? p.id === id : p.popular
    })))
  }

  const filtered = products.filter(p => tab === 'actifs' ? p.active : !p.active)

  // Grouper par sous-catégorie dynamiquement
  const allSubs = subcats.length > 0
    ? subcats.map(s => s.slug)
    : [...new Set(filtered.map(p => p.subcategory))]
  const subcatLabel = (slug: string) => subcats.find(s => s.slug === slug)?.name ?? slug
  const grouped = allSubs.reduce<Record<string, Product[]>>((acc, sub) => {
    const items = filtered.filter(p => p.subcategory === sub)
    if (items.length > 0) acc[sub] = items
    return acc
  }, {})
  // Ajouter les produits avec subcategory hors liste
  filtered.forEach(p => {
    if (!allSubs.includes(p.subcategory) && p.subcategory) {
      if (!grouped[p.subcategory]) grouped[p.subcategory] = []
      if (!grouped[p.subcategory].find(x => x.id === p.id)) grouped[p.subcategory].push(p)
    }
  })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 900, color: '#F5EDD6' }}>Produits</h1>
        <button onClick={() => router.push('/admin/produits/nouveau')} style={{ padding: '9px 18px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
          + Ajouter
        </button>
      </div>

      {/* RECHERCHE */}
      <input
        type="text"
        placeholder="Rechercher un produit..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: 16, boxSizing: 'border-box' as const }}
      />
      {/* FILTRE CATEGORIE */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <button
          onClick={() => setOpenCatDropdown(o => !o)}
          style={{ width: '100%', padding: '10px 16px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.2)', background: '#131009', color: filterCat ? '#F5C842' : '#7A6E58', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', outline: 'none' }}
        >
          <span>{filterCat ? (subcats as any[]).find((s: any) => s.slug === filterCat)?.name : 'Sélectionner une catégorie'}</span>
          <span style={{ fontSize: 12, transition: 'transform 0.2s', display: 'inline-block', transform: openCatDropdown ? 'rotate(180deg)' : 'rotate(0deg)', color: '#E8A020' }}>⌄</span>
        </button>
        {openCatDropdown && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#1A1510', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 14, overflow: 'hidden', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {filterCat && (
              <button
                onClick={() => { setFilterCat(''); setOpenCatDropdown(false) }}
                style={{ width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(232,160,32,0.1)', color: '#7A6E58', fontSize: 11, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
              >
                ✕ Effacer le filtre
              </button>
            )}
            {parentCats.map(parent => {
              const children = (subcats as any[]).filter((s: any) => s.parent_id === parent.id)
              const hasChildren = children.length > 0
              return (
                <div key={parent.id}>
                  {hasChildren ? (
                    <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 800, color: '#E8A020', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif', borderBottom: '1px solid rgba(232,160,32,0.06)' }}>
                      {parent.name}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setFilterCat(parent.slug); setOpenCatDropdown(false) }}
                      style={{ width: '100%', padding: '9px 16px', background: filterCat === parent.slug ? 'rgba(245,200,66,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(232,160,32,0.06)', color: filterCat === parent.slug ? '#F5C842' : '#E8A020', fontSize: 11, fontFamily: 'DM Sans, sans-serif', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      {parent.name}
                      {filterCat === parent.slug && <span style={{ fontSize: 10, color: '#F5C842' }}>✓</span>}
                    </button>
                  )}
                  {children.map((s: any) => (
                    <button
                      key={s.slug}
                      onClick={() => { setFilterCat(s.slug); setOpenCatDropdown(false) }}
                      style={{ width: '100%', padding: '9px 16px 9px 28px', background: filterCat === s.slug ? 'rgba(245,200,66,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(232,160,32,0.04)', color: filterCat === s.slug ? '#F5C842' : '#C8B99A', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: filterCat === s.slug ? 700 : 400, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      {s.name}
                      {filterCat === s.slug && <span style={{ fontSize: 10, color: '#F5C842' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* ONGLETS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' as const }}>
        <button onClick={() => setTab('actifs')} style={{ padding: '6px 16px', borderRadius: 50, border: '1px solid', borderColor: tab === 'actifs' ? 'rgba(245,200,66,0.4)' : 'rgba(255,255,255,0.06)', background: tab === 'actifs' ? 'rgba(245,200,66,0.12)' : 'transparent', color: tab === 'actifs' ? '#F5C842' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          Actifs <span style={{ marginLeft: 4, background: tab === 'actifs' ? 'rgba(245,200,66,0.2)' : 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: 50, fontSize: 10 }}>{products.filter(p => p.active).length}</span>
        </button>
        <button onClick={() => setTab('inactifs')} style={{ padding: '6px 16px', borderRadius: 50, border: '1px solid', borderColor: tab === 'inactifs' ? 'rgba(255,107,107,0.4)' : 'rgba(255,255,255,0.06)', background: tab === 'inactifs' ? 'rgba(255,107,107,0.08)' : 'transparent', color: tab === 'inactifs' ? '#FF6B6B' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          Inactifs <span style={{ marginLeft: 4, background: tab === 'inactifs' ? 'rgba(255,107,107,0.2)' : 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: 50, fontSize: 10 }}>{products.filter(p => !p.active).length}</span>
        </button>
      </div>

      {/* LISTE PAR SOUS-CATEGORIE */}
      {!filterCat && !search && (
        <div style={{ textAlign: 'center', color: '#7A6E58', padding: '40px 0', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}>
          Recherchez un produit ou sélectionnez une catégorie
        </div>
      )}
      {(filterCat || search) && Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', color: '#7A6E58', padding: '40px 0', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}>
          Aucun produit {tab === 'actifs' ? 'actif' : 'inactif'}
        </div>
      )}

      {(filterCat || search) && Object.entries(grouped).map(([sub, items]) => (
        <div key={sub} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#E8A020', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(232,160,32,0.15)' }}>
            {subcatLabel(sub)} ({(items as Product[]).length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(p => (
              <div key={p.id} style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                {p.image_url && <img src={p.image_url} alt={p.name} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(232,160,32,0.1)' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#F5EDD6' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#C8B99A', marginTop: 2 }}>{p.price} DH</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setFeatured(p.id)} title="Mettre à la une" style={{ width: 34, height: 34, borderRadius: 8, border: p.featured ? '1px solid rgba(245,200,66,0.6)' : '1px solid rgba(255,255,255,0.08)', background: p.featured ? 'rgba(245,200,66,0.15)' : 'transparent', color: p.featured ? '#F5C842' : '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    ★
                  </button>
                  <button onClick={() => setPopular(p.id, p.subcategory)} title="Populaire" style={{ width: 34, height: 34, borderRadius: 8, border: p.popular ? '1px solid rgba(255,107,32,0.6)' : '1px solid rgba(255,255,255,0.08)', background: p.popular ? 'rgba(255,107,32,0.15)' : 'transparent', color: p.popular ? '#FF6B20' : '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔥</button>
                  <button onClick={() => router.push('/admin/produits/' + p.id + '/modifier')} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(232,160,32,0.06)', color: '#E8A020', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconEdit />
                  </button>
                  <button onClick={() => del(p.id)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,107,107,0.2)', background: 'rgba(255,107,107,0.06)', color: '#FF6B6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
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
