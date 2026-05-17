'use client'
import { useState } from 'react'
import { useCurrency } from '@/lib/currency'
import type { Product } from '@/lib/types'
import FeaturedCardButton from '@/components/FeaturedCardButton'
import ProductOverlay from '@/components/ProductOverlay'

export default function CoupDeCoeurCard({ product, allProducts }: { product: Product; allProducts: Product[] }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const currency = useCurrency()

  return (
    <>
      {selectedProduct && (
        <ProductOverlay product={selectedProduct} allProducts={allProducts} onClose={() => setSelectedProduct(null)} />
      )}
      <div
        onClick={() => setSelectedProduct(product)}
        style={{
          position: 'relative',
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid rgba(255,100,130,0.3)',
          height: '100%',
          minHeight: 'clamp(180px, 50vw, 280px)',
          cursor: 'pointer',
        }}
      >
        {product.image_url && (
          <img
            src={product.image_url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          />
        )}

        {/* Dégradé */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.78) 100%)' }} />

        {/* Badge Coup de Coeur */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(10,8,4,0.75)',
          border: '1px solid rgba(255,100,130,0.5)',
          borderRadius: 50, padding: '4px 10px',
          backdropFilter: 'blur(10px)',
        }}>
          <span style={{ fontSize: 10 }}>❤️</span>
          <span style={{ fontSize: 8, color: '#FF6482', letterSpacing: '1.8px', textTransform: 'uppercase', fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>Coup de coeur</span>
        </div>

        {/* Texte en bas */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2, padding: '12px 14px 48px' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(14px, 4vw, 18px)', color: '#fff', lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.9)', marginBottom: 3 }}>
            {product.name}
          </div>
          <div>
            <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(18px, 5vw, 22px)', color: '#FF6482', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.price}</span>
            <span style={{ fontSize: 11, color: '#FF8C9E', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginLeft: 3 }}>{currency}</span>
          </div>
        </div>

        {/* Bouton + */}
        <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 3 }} onClick={e => e.stopPropagation()}>
          <FeaturedCardButton product={product} />
        </div>
      </div>
    </>
  )
}
