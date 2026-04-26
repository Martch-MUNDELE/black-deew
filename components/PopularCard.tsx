'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { useCatalogue } from '@/store/catalogue'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/lib/types'
import FeaturedCardButton from '@/components/FeaturedCardButton'
import ProductOverlay from '@/components/ProductOverlay'

export default function PopularCard({ fallback }: { fallback?: React.ReactNode }) {
  const { activeSous, hasSelected } = useCatalogue()
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [allProducts, setAllProducts] = useState<Product[]>([])

  useEffect(() => {
    if (!hasSelected) { setProduct(null); return }
    const supabase = createClient()
    supabase.from('products').select('*').eq('subcategory', activeSous).eq('active', true).then(({ data }) => {
      const all = (data as Product[]) || []
      setAllProducts(all)
      setProduct(all.find(p => p.popular) || null)
    })
  }, [activeSous, hasSelected])

  if (!hasSelected) return fallback ?? null
  if (!product) return null

  return (
    <>
    {selectedProduct && <ProductOverlay product={selectedProduct} allProducts={allProducts} onClose={() => setSelectedProduct(null)} />}
    <div
      onClick={() => setSelectedProduct(product)}
      style={{ margin: '0 16px 24px', position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,107,32,0.2)', minHeight: 'clamp(180px, 50vw, 280px)', cursor: 'pointer' }}
    >
      {/* Image plein fond */}
      {product.image_url && (
        <img src={product.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      )}

      {/* Dégradé sombre en bas pour lisibilité texte */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)' }} />

      {/* Badge POPULAIRE en haut à gauche */}
      <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #FF6B20, #E8501A)', borderRadius: 50, padding: '5px 12px' }}>
        <span style={{ fontSize: 10 }}>🔥</span>
        <span style={{ fontSize: 9, color: '#fff', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>Populaire du moment</span>
      </div>

      {/* Texte en bas */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <div>
            <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(26px, 8vw, 36px)', color: '#FF6B20', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.price}</span>
            <span style={{ fontSize: 13, color: '#FF8C42', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginLeft: 3 }}>DH</span>
          </div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(18px, 5.5vw, 24px)', color: '#fff', lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.name}</div>
        </div>
        {product.description && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, maxWidth: 'min(280px, 70%)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{product.description}</div>
        )}
      </div>

      {/* Bouton + */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 3 }} onClick={e => e.stopPropagation()}>
        <FeaturedCardButton product={product} />
      </div>
    </div>
    </>
  )
}