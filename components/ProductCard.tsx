'use client'
import { useState, useEffect } from 'react'
import ProductOverlay from '@/components/ProductOverlay'
import { useCart } from '@/store/cart'
import type { Product } from '@/lib/types'

export default function ProductCard({ product, featured = false, isOpen, allProducts = [] }: { product: Product, featured?: boolean, isOpen: boolean, allProducts?: Product[] }) {
  const [added, setAdded] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const add = useCart(s => s.add)

  useEffect(() => {
    if (document.getElementById('discount-glow-style')) return
    const s = document.createElement('style')
    s.id = 'discount-glow-style'
    s.textContent = '@keyframes discountGlow{from{box-shadow:0 0 0 1px rgba(245,200,66,0.15)}to{box-shadow:0 0 0 3px rgba(245,200,66,0.08)}}.discount-glow{animation:discountGlow 2s ease-in-out infinite alternate}'
    document.head.appendChild(s)
  }, [])

  const handleAdd = () => {
    if (!isOpen) return
    add(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  if (featured) return (
    <div style={{ background: '#0F0C07', borderRadius: 18, border: '1px solid rgba(255,107,32,0.25)', overflow: 'hidden', cursor: 'default', position: 'relative', transition: 'border-color 0.2s' }}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2, background: 'linear-gradient(90deg,#FF6B20,#FF3D00)', color: 'white', padding: '4px 12px', borderRadius: 50, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px' }}>★ Populaire</div>
      {product.discount && product.discount > 0 && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,120,120,0.3)', color: '#FF8080', fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '3px 7px', fontFamily: 'DM Sans, sans-serif' }}>-{product.discount}%</div>
      )}
      <div style={{ height: 'clamp(120px, 28vw, 160px)', overflow: 'hidden', position: 'relative' }}>
        <img src={product.image_url + (product.image_url.includes('supabase.co') ? '?width=150&quality=75' : '')} alt={product.name} loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(19,16,9,0.95) 0%,rgba(19,16,9,0.2) 60%,transparent 100%)' }} />
        <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: '#F5EDD6' }}>{product.name}</div>
          {product.discount && product.discount > 0 ? (
            <div style={{ flexShrink: 0, marginLeft: 8, textAlign: 'right' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: '#7A6E58', textDecoration: 'line-through' }}>{product.price} DH</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: '#F5C842' }}>{Math.ceil(product.price * (1 - product.discount / 100))} DH</div>
            </div>
          ) : (
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, background: 'linear-gradient(90deg,#F5C842,#FF6B20)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', flexShrink: 0, marginLeft: 8 }}>{product.price} DH</div>
          )}
        </div>
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontSize: 12, color: '#C8B99A', marginBottom: 12, lineHeight: 1.5 }}>{product.description}</div>
        <button onClick={handleAdd} disabled={!isOpen} style={{ width: '100%', background: !isOpen ? 'rgba(255,255,255,0.05)' : added ? 'rgba(232,160,32,0.15)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: !isOpen ? '#666' : added ? '#E8A020' : '#080603', border: 'none', borderRadius: 12, padding: '13px', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, cursor: isOpen ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: (!isOpen || added) ? 'none' : '0 4px 16px rgba(232,160,32,0.25)' }}>
          {!isOpen ? 'Fermé' : added ? '✓ Ajouté au panier !' : 'Ajouter au panier'}
        </button>
      </div>
    </div>
  )

  return (
    <>
    <div className={product.discount && product.discount > 0 ? 'discount-glow' : undefined} style={{ background: '#0F0C07', borderRadius: 16, border: '1px solid rgba(232,160,32,0.18)', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'default', transition: 'border-color 0.2s, box-shadow 0.2s', position: 'relative' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(232,160,32,0.25)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(232,160,32,0.06)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(232,160,32,0.08)'; (e.currentTarget as HTMLDivElement).style.boxShadow = product.discount && product.discount > 0 ? '' : 'none' }}
    >
      <div onClick={() => setShowOverlay(true)} style={{ width: 'clamp(56px, 16vw, 72px)', height: 'clamp(56px, 16vw, 72px)', borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#1E1A10', cursor: 'pointer', position: 'relative' }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🥙</div>
        }
        {product.discount && product.discount > 0 && (
          <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.3)', color: '#F5C842', fontSize: 9, fontWeight: 800, borderRadius: 5, padding: '2px 6px', fontFamily: 'DM Sans, sans-serif', zIndex: 2 }}>-{product.discount}%</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div onClick={() => setShowOverlay(true)} style={{ cursor: 'pointer' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, marginBottom: 3, color: '#F5EDD6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
          <div style={{ fontSize: 11, color: '#C8B99A', marginBottom: 8, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{product.description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {product.discount && product.discount > 0 ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: '#7A6E58', textDecoration: 'line-through' }}>{product.price} DH</span>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: '#F5C842' }}>{Math.ceil(product.price * (1 - product.discount / 100))} DH</span>
            </div>
          ) : (
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, background: 'linear-gradient(90deg,#F5C842,#E8901A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{product.price} DH</div>
          )}
          <button onClick={handleAdd} disabled={!isOpen} style={{ width: 34, height: 34, background: !isOpen ? 'rgba(255,255,255,0.05)' : added ? 'rgba(232,160,32,0.15)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: added ? 14 : 20, fontWeight: 700, color: !isOpen ? '#555' : added ? '#E8A020' : '#080603', cursor: isOpen ? 'pointer' : 'not-allowed', flexShrink: 0, boxShadow: (!isOpen || added) ? 'none' : '0 3px 12px rgba(232,160,32,0.3)', transition: 'all 0.2s' }}>
            {added ? '✓' : '+'}
          </button>
        </div>
      </div>
    </div>
    {showOverlay && <ProductOverlay product={product} allProducts={allProducts} onClose={() => setShowOverlay(false)} />}
    </>
  )
}
