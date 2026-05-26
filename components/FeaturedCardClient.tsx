'use client'
import { useState } from 'react'
import { useCurrency } from '@/lib/currency'
import type { Product } from '@/lib/types'
import FeaturedCardButton from '@/components/FeaturedCardButton'
import ProductOverlay from '@/components/ProductOverlay'
import CoupDeCoeurCard from '@/components/CoupDeCoeurCard'

export default function FeaturedCardClient({
  product,
  allProducts,
  coupProduct,
}: {
  product: Product
  allProducts: Product[]
  coupProduct?: Product | null
}) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const currency = useCurrency()

  return (
    <>
      {selectedProduct && (
        <ProductOverlay product={selectedProduct} allProducts={allProducts} onClose={() => setSelectedProduct(null)} />
      )}
      {coupProduct ? (
        <div style={{ margin: '0 16px 24px', display: 'flex', gap: 10, minHeight: 'clamp(180px, 50vw, 280px)' }}>
          <div
            onClick={() => setSelectedProduct(product)}
            style={{ flex: '0 0 68%', position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(232,160,32,0.2)', cursor: 'pointer' }}
          >
            {product.image_url && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  backgroundImage: `url(${product.image_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)' }} />
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(10,8,4,0.75)', border: '1px solid rgba(245,200,66,0.5)', borderRadius: 50, padding: '4px 10px', backdropFilter: 'blur(10px)' }}>
              <span style={{ color: '#F5C842', fontSize: 9 }}>\u2726</span>
              <span style={{ fontSize: 8, color: '#F5C842', letterSpacing: '1.8px', textTransform: 'uppercase', fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>Signature</span>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2, padding: '12px 14px 48px' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(14px, 3.5vw, 20px)', color: '#fff', lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.9)', marginBottom: 3 }}>{product.name}</div>
              <div>
                <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(18px, 5vw, 26px)', color: '#F5C842', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.price}</span>
                <span style={{ fontSize: 10, color: '#E8A020', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginLeft: 3 }}>{currency}</span>
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
          style={{ margin: '0 16px 24px', position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(232,160,32,0.2)', minHeight: 'clamp(180px, 50vw, 280px)', cursor: 'pointer' }}
        >
          {product.image_url && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                backgroundImage: `url(${product.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)' }} />
          <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(10,8,4,0.75)', border: '1px solid rgba(245,200,66,0.5)', borderRadius: 50, padding: '5px 12px', backdropFilter: 'blur(10px)' }}>
            <span style={{ color: '#F5C842', fontSize: 10 }}>\u2726</span>
            <span style={{ fontSize: 9, color: '#F5C842', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>Signature du moment</span>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <div>
                <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 28, color: '#F5C842', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.price}</span>
                <span style={{ fontSize: 11, color: '#E8A020', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginLeft: 3 }}>{currency}</span>
              </div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{product.name}</div>
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
