'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { useCatalogue } from '@/store/catalogue'
import { useCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/lib/types'
import FeaturedCardButton from '@/components/FeaturedCardButton'
import ProductOverlay from '@/components/ProductOverlay'
import CoupDeCoeurCard from '@/components/CoupDeCoeurCard'

export default function PopularCard({ fallback }: { fallback?: React.ReactNode }) {
  const { activeSous, hasSelected } = useCatalogue()
  const currency = useCurrency()
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [coupProduct, setCoupProduct] = useState<Product | null>(null)

  useEffect(() => {
    if (!hasSelected) { setProduct(null); return }
    const supabase = createClient()
    supabase.from('products').select('*').eq('subcategory', activeSous).eq('active', true).eq('is_vip', false).then(async ({ data: rawData }) => {
      const { data: stockRow } = await supabase.from('settings').select('value').eq('key', 'stock_enabled').single()
      const stockEnabled = stockRow?.value === 'true'
      const data = stockEnabled ? (rawData || []).filter((p: any) => p.stock === null || p.stock > 0) : (rawData || [])
      const all = (data as Product[]) || []
      setAllProducts(all)
      setProduct(all.find(p => p.popular) || null)
      const { data: coupRaw } = await supabase.from('products').select('*').eq('is_coup_de_coeur', true).eq('active', true).single()
      setCoupProduct(coupRaw as Product | null)
    })
  }, [activeSous, hasSelected])

  if (!hasSelected) return fallback ?? null
  if (!product) return null

  return (
    <>
    {selectedProduct && <ProductOverlay product={selectedProduct} allProducts={allProducts} onClose={() => setSelectedProduct(null)} />}
    {coupProduct ? (
      <div style={{ margin: '0 16px 24px', display: 'flex', gap: 10, minHeight: 'clamp(180px, 50vw, 280px)' }}>
        <div
          onClick={() => setSelectedProduct(product)}
          style={{ flex: '0 0 68%', position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,107,32,0.2)', cursor: 'pointer' }}
        >
          {product.image_url && (
            <img src={product.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)' }} />
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #FF6B20, #E8501A)', borderRadius: 50, padding: '5px 12px' }}>
            <span style={{ fontSize: 10 }}>\U0001F525</span>
            <span style={{ fontSize: 8, color: '#fff', letterSpacing: '1.8px', textTransform: 'uppercase', fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>Populaire</span>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2, padding: '12px 14px 48px' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(14px, 3.5vw, 20px)', color: '#fff', lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.9)', marginBottom: 3 }}>{product.name}</div>
            <div>
              <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(18px, 5vw, 26px)', color: '#FF6B20', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.price}</span>
              <span style={{ fontSize: 10, color: '#FF8C42', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginLeft: 3 }}>{currency}</span>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 3 }} onClick={e => e.stopPropagation()}>
            <FeaturedCardButton product={product} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <CoupDeCoeurCard product={coupProduct} allProducts={allProducts} />
        </div>
      </div>
    ) : (
      <div
        onClick={() => setSelectedProduct(product)}
        style={{ margin: '0 16px 24px', position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,107,32,0.2)', minHeight: 'clamp(180px, 50vw, 280px)', cursor: 'pointer' }}
      >
        {product.image_url && (
          <img src={product.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)' }} />
        <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #FF6B20, #E8501A)', borderRadius: 50, padding: '5px 12px' }}>
          <span style={{ fontSize: 10 }}>\U0001F525</span>
          <span style={{ fontSize: 9, color: '#fff', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>Populaire du moment</span>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <div>
              <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(26px, 8vw, 36px)', color: '#FF6B20', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.price}</span>
              <span style={{ fontSize: 13, color: '#FF8C42', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginLeft: 3 }}>{currency}</span>
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(18px, 5.5vw, 24px)', color: '#fff', lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.name}</div>
          </div>
          {product.description && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, maxWidth: 'min(280px, 70%)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{product.description}</div>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 3 }} onClick={e => e.stopPropagation()}>
          <FeaturedCardButton product={product} />
        </div>
      </div>
    )}
    </>
  )
}
