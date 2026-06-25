'use client'

import Image, { type ImageLoaderProps } from 'next/image'
import PopularVipCard from '@/components/PopularVipCard'
import VipAccessGate from '@/components/VipAccessGate'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import { useCurrency } from '@/lib/currency'
import type { Product } from '@/lib/types'

type ProductWithStock = Product & {
  stock?: number | null
  image_url?: string | null
}

type ProductVisibilityCandidate = ProductWithStock & Record<string, unknown>

function isClassicProductSellableForVipSuggestion(product: ProductVisibilityCandidate, options: { stockEnabled?: boolean } = {}): boolean {
  const falseMeansUnavailable = [
    'active',
    'is_active',
    'enabled',
    'visible',
    'available',
    'is_available',
    'sellable',
    'is_sellable',
    'published',
  ]

  for (const field of falseMeansUnavailable) {
    if (Object.prototype.hasOwnProperty.call(product, field) && product[field] === false) {
      return false
    }
  }

  const trueMeansUnavailable = [
    'hidden',
    'disabled',
    'archived',
    'unavailable',
    'is_hidden',
    'is_disabled',
    'is_archived',
  ]

  for (const field of trueMeansUnavailable) {
    if (Object.prototype.hasOwnProperty.call(product, field) && product[field] === true) {
      return false
    }
  }

  const rawStatus = product.status
  if (typeof rawStatus === 'string') {
    const status = rawStatus.trim().toLowerCase()
    if (['inactive', 'disabled', 'hidden', 'archived', 'unavailable', 'draft', 'deleted'].includes(status)) {
      return false
    }
  }

  if (options.stockEnabled === true) {
    const stockFields = ['stock', 'quantity', 'qty']
    for (const field of stockFields) {
      const value = product[field]
      if (typeof value === 'number' && Number.isFinite(value) && value <= 0) {
        return false
      }
    }
  }

  return true
}

const productImageLoader = ({ src }: ImageLoaderProps) => src

export default function VipPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([])
  const [classicSuggestions, setClassicSuggestions] = useState<ProductWithStock[]>([])
  const [loading, setLoading] = useState(true)
  const { add, update, items } = useCart()
  const currency = useCurrency()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const cartIds = items.map(i => i.product.id)
      const [{ data }, { data: stockRow }, { data: classicData }, { data: menuCategories }] = await Promise.all([
        supabase.from('products').select('*').eq('is_vip', true).eq('active', true).order('name'),
        supabase.from('settings').select('value').eq('key', 'stock_enabled').single(),
        supabase.from('products').select('*').eq('is_vip', false).eq('active', true).order('name'),
        supabase.from('menu_categories').select('id, slug, parent_id, level, active, is_visible').eq('active', true),
      ])

      if (cancelled) return

      const stockEnabled = stockRow?.value === 'true'
      const rawProducts = (data ?? []) as ProductWithStock[]
      const filtered = stockEnabled
        ? rawProducts.filter((p) => p.stock === null || p.stock === undefined || p.stock > 0)
        : rawProducts

      const visibleMenuCategories = (menuCategories ?? []).filter((category: {
        id?: string | null
        active?: boolean | null
        is_visible?: boolean | null
        level?: number | null
      }) => category.active === true && category.is_visible !== false)

      const visibleParentCategoryIds = new Set(
        visibleMenuCategories
          .filter((category: { id?: string | null; level?: number | null }) => category.level === 0 && Boolean(category.id))
          .map((category: { id?: string | null }) => category.id as string)
      )

      const activeMenuSubcategorySlugs = new Set(
        visibleMenuCategories
          .filter((category: { slug?: string | null; parent_id?: string | null; level?: number | null }) => {
            if (!category.slug) return false
            if (category.level === 0) return true
            if (category.level === 1) return Boolean(category.parent_id && visibleParentCategoryIds.has(category.parent_id))
            return false
          })
          .map((category: { slug?: string | null }) => category.slug)
          .filter((slug): slug is string => Boolean(slug))
      )

      const classicPool = ((classicData ?? []) as ProductWithStock[]).filter((product) => {
        const subcategory = typeof product.subcategory === 'string' ? product.subcategory : ''
        return !cartIds.includes(product.id)
          && isClassicProductSellableForVipSuggestion(product as ProductVisibilityCandidate, { stockEnabled })
          && activeMenuSubcategorySlugs.has(subcategory)
      })

      const orderedClassicSuggestions = classicPool
        .sort((a, b) => {
          const popularScore = Number(Boolean(b.popular)) - Number(Boolean(a.popular))
          if (popularScore !== 0) return popularScore
          return (b.discount ?? 0) - (a.discount ?? 0)
        })
        .slice(0, 3)

      setProducts(filtered)
      setClassicSuggestions(orderedClassicSuggestions)
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [items, supabase])

  const quantities = useMemo(() => {
    const q: Record<string, number> = {}
    items.forEach(i => {
      q[i.product.id] = i.quantity
    })
    return q
  }, [items])

  const handleAdd = (product: Product) => {
    add(product, true)
  }

  const handleUpdate = (productId: string, qty: number) => {
    update(productId, qty)
  }

  const cartCount = items.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = items.reduce((s, i) => {
    const discount = i.product.discount ?? 0
    const price = discount > 0 ? i.product.price * (1 - discount / 100) : i.product.price
    return s + price * i.quantity
  }, 0)

  return (
    <VipAccessGate storageKey="black_deew_vip_access_granted_v4">
      <div style={{
      minHeight: '100vh',
      background: '#080603',
      fontFamily: 'DM Sans, sans-serif',
      paddingBottom: 120,
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #131009 0%, #080603 100%)',
        borderBottom: '1px solid rgba(245,200,66,0.12)',
        padding: '48px 20px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '2.5px',
          textTransform: 'uppercase',
          color: '#0A0804',
          background: 'linear-gradient(135deg,#F5C842,#E8A020)',
          padding: '4px 14px',
          borderRadius: 50,
          marginBottom: 16,
        }}>
          Accès privé
        </div>
        <h1 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 32,
          fontWeight: 900,
          color: '#F5EDD6',
          margin: '0 0 10px',
          lineHeight: 1.2,
        }}>
          Sélection VIP
        </h1>
        <p style={{
          fontSize: 14,
          color: '#C8B99A',
          margin: 0,
          maxWidth: 320,
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6,
        }}>
          Une sélection privée réservée à nos meilleurs clients.
        </p>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 0' }}>
        <PopularVipCard />
        {loading && (
          <div style={{ textAlign: 'center', color: '#7A6E58', padding: '60px 0', fontSize: 14 }}>
            Chargement...
          </div>
        )}

        {!loading && products.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7A6E58', padding: '60px 0', fontSize: 14 }}>
            Aucun produit disponible pour le moment.
          </div>
        )}

        {!loading && products.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {products.map(product => {
              const qty = quantities[product.id] || 0
              const stockMax = product.stock !== null && product.stock !== undefined ? product.stock : null
              const atMax = stockMax !== null && qty >= stockMax
              const epuise = stockMax !== null && stockMax <= 0
              const discount = product.discount ?? 0
              const finalPrice = discount > 0 ? product.price * (1 - discount / 100) : product.price

              return (
                <div key={product.id} style={{
                  background: '#131009',
                  border: '1px solid rgba(245,200,66,0.12)',
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                }}>
                  {product.image_url && (
                    <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(245,200,66,0.1)' }}>
                      <Image
                        loader={productImageLoader}
                        src={product.image_url}
                        alt={product.name}
                        fill
                        sizes="72px"
                        unoptimized
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#F5EDD6', marginBottom: 2 }}>{product.name}</div>
                    {product.description && (
                      <div style={{ fontSize: 12, color: '#7A6E58', marginBottom: 6, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{product.description}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {discount > 0 && (
                        <span style={{ fontSize: 11, color: '#7A6E58', textDecoration: 'line-through', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>{product.price.toFixed(2)}</span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#F5C842' }}>{finalPrice.toFixed(2)} {currency}</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {epuise ? (
                      <span style={{ fontSize: 11, color: '#FF6B6B', fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>Épuisé</span>
                    ) : qty === 0 ? (
                      <button
                        onClick={() => handleAdd(product)}
                        style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#F5C842,#E8A020)', color: '#0A0804', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >+</button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => handleUpdate(product.id, qty - 1)}
                          style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(245,200,66,0.3)', background: 'transparent', color: '#F5C842', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >−</button>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#F5EDD6', minWidth: 16, textAlign: 'center' }}>{qty}</span>
                        <button
                          onClick={() => { if (!atMax) handleUpdate(product.id, qty + 1) }}
                          style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: atMax ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#F5C842,#E8A020)', color: atMax ? '#555' : '#0A0804', fontSize: 18, cursor: atMax ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >+</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && classicSuggestions.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#7A6E58', textTransform: 'uppercase', letterSpacing: '1.4px', fontWeight: 800 }}>
                Suggestions classiques
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {classicSuggestions.map(product => {
                const discount = product.discount ?? 0
                const finalPrice = discount > 0 ? product.price * (1 - discount / 100) : product.price

                return (
                  <div key={product.id} style={{
                    background: 'rgba(15,12,7,0.75)',
                    border: '1px solid rgba(232,160,32,0.16)',
                    borderRadius: 16,
                    padding: 10,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}>
                    {product.image_url && (
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(232,160,32,0.12)' }}>
                        <Image
                          loader={productImageLoader}
                          src={product.image_url}
                          alt={product.name}
                          fill
                          sizes="33vw"
                          unoptimized
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 12, color: '#F5EDD6', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, minHeight: 18 }}>
                        {discount > 0 && (
                          <span style={{ fontSize: 10, color: '#7A6E58', textDecoration: 'line-through', fontWeight: 600 }}>{product.price.toFixed(2)}</span>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#F5C842' }}>{finalPrice.toFixed(2)} {currency}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => add(product)}
                      style={{ width: '100%', height: 34, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontSize: 18, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 'auto' }}
                    >
                      +
                    </button>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: 22, textAlign: 'center' }}>
              <button
                onClick={() => { window.location.href = '/' }}
                style={{
                  padding: '14px 28px',
                  borderRadius: 50,
                  border: '1px solid rgba(245,200,66,0.25)',
                  background: 'rgba(245,200,66,0.06)',
                  color: '#F5C842',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Une petite gourmandise en plus ?
              </button>
            </div>
          </div>
        )}
      </div>

      {cartCount > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: 16,
          right: 16,
          maxWidth: 528,
          margin: '0 auto',
          zIndex: 50,
        }}>
          <button
            onClick={() => { window.location.href = '/panier' }}
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: 16,
              border: 'none',
              background: 'linear-gradient(135deg,#F5C842,#FF6B20)',
              color: '#0A0804',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: 'DM Sans, sans-serif',
              boxShadow: '0 8px 32px rgba(245,200,66,0.25)',
            }}
          >
            <span style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 50, padding: '2px 10px', fontSize: 13 }}>{cartCount}</span>
            <span>Voir mon panier</span>
            <span>{cartTotal.toFixed(0)} {currency}</span>
          </button>
        </div>
      )}
    </div>
    </VipAccessGate>
  )
}
