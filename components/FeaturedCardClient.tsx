'use client'
import { useState } from 'react'
import type { Product } from '@/lib/types'
import FeaturedCardButton from '@/components/FeaturedCardButton'
import ProductOverlay from '@/components/ProductOverlay'

export default function FeaturedCardClient({ product, allProducts }: { product: Product, allProducts: Product[] }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  return (
    <>
      {selectedProduct && <ProductOverlay product={selectedProduct} allProducts={allProducts} onClose={() => setSelectedProduct(null)} />}
      <div
        onClick={() => setSelectedProduct(product)}
        style={{ margin: '0 16px 24px', position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(232,160,32,0.2)', minHeight: 'clamp(180px, 50vw, 280px)', cursor: 'pointer' }}
      >
        {product.image_url && (
          <img src={product.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        )}

        {/* Dégradé sombre en bas */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)' }} />

        {/* Badge Signature en haut à gauche */}
        <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(10,8,4,0.75)', border: '1px solid rgba(245,200,66,0.5)', borderRadius: 50, padding: '5px 12px', backdropFilter: 'blur(10px)' }}>
          <span style={{ color: '#F5C842', fontSize: 10 }}>✦</span>
          <span style={{ fontSize: 9, color: '#F5C842', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>Signature du moment</span>
        </div>

        {/* Texte en bas */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <div>
              <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 28, color: '#F5C842', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.price}</span>
              <span style={{ fontSize: 11, color: '#E8A020', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginLeft: 3 }}>DH</span>
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.name}</div>
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
