'use client'
import { useCart } from '@/store/cart'
import { useState } from 'react'
import type { Product } from '@/lib/types'

export default function FeaturedCardButton({ product }: { product: Product }) {
  const { add, items, update } = useCart()
  const [added, setAdded] = useState(false)
  const quantity = items.find(i => i.product.id === product.id)?.quantity || 0

  const handleAdd = () => {
    add(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1000)
  }

  const handleRemove = () => {
    if (quantity > 0) update(product.id, quantity - 1)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
      {quantity > 0 && (
        <>
          <button onClick={handleRemove} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(232,160,32,0.3)', background: 'rgba(255,255,255,0.04)', color: '#C8B890', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500 }}>−</button>
          <span style={{ color: '#F5EDD6', fontWeight: 700, fontSize: 14, minWidth: 20, textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>{quantity}</span>
        </>
      )}
      <button onClick={handleAdd} style={{ width: 34, height: 34, background: added ? 'rgba(232,160,32,0.15)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: added ? '#E8A020' : '#080603', cursor: 'pointer', boxShadow: added ? 'none' : '0 3px 12px rgba(232,160,32,0.3)', transition: 'all 0.2s' }}>
        {added ? '✓' : '+'}
      </button>
    </div>
  )
}
