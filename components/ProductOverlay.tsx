'use client'
import { useState, useRef, useEffect } from 'react'
import Image, { type ImageLoaderProps } from 'next/image'
import { useCart } from '@/store/cart'
import { useCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/lib/types'

const overlayImageLoader = ({ src }: ImageLoaderProps) => src

export default function ProductOverlay({ product, allProducts, onClose }: { product: Product, allProducts: Product[], onClose: () => void }) {
  const { add, items, update } = useCart()
  const [current, setCurrent] = useState(product)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const currency = useCurrency()
  const quantity = items.find(i => i.product.id === current.id)?.quantity || 0
  const [added, setAdded] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [stockEnabled, setStockEnabled] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 280) }

  useEffect(() => {
    const supabase = createClient()
    supabase.from('settings').select('value').eq('key', 'stock_enabled').single().then(({ data }) => {
      setStockEnabled(data?.value === 'true')
    })
  }, [])

  const stockNum = typeof current.stock === 'number' ? current.stock : null
  const hasVariants = current.variants && current.variants.length > 0
  const allSelected = !hasVariants || (current.variants!.every(vt => selectedVariants[vt.type]))
  const stockReached = stockEnabled && stockNum !== null && quantity >= stockNum
  const canAdd = !stockReached && allSelected

  const handleAdd = () => {
    if (!canAdd) return
    add(current, false, hasVariants ? selectedVariants : undefined)
    setAdded(true)
    setTimeout(() => setAdded(false), 800)
  }
  const handleRemove = () => { if (quantity > 0) update(current.id, quantity - 1) }
  const selectVariant = (type: string, option: string) => setSelectedVariants(prev => ({ ...prev, [type]: option }))
  const handleSetCurrent = (p: Product) => { setCurrent(p); setAdded(false); setSelectedVariants({}) }

  const related = allProducts.filter(p => p.subcategory === current.subcategory && p.id !== current.id)
  const variantPriceExtra = (() => {
    if (!current.variants || !selectedVariants) return 0
    return current.variants.reduce((sum, vt) => {
      const chosen = selectedVariants[vt.type]
      if (chosen && vt.prices && vt.prices[chosen] !== undefined) return sum + vt.prices[chosen]
      return sum
    }, 0)
  })()
  const effectiveBasePrice = current.price + variantPriceExtra
  const discountedPrice = current.discount && current.discount > 0 ? Math.ceil(effectiveBasePrice * (1 - current.discount / 100)) : null
  const displayPrice = variantPriceExtra !== 0 && !discountedPrice ? effectiveBasePrice : null

  return (
    <div onClick={handleClose} style={{ position: 'fixed', top: 140, left: 0, right: 0, bottom: 0, height: 'calc(100vh - 140px)', zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', animation: 'fadeIn 0.2s ease' }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes slideDown { from{transform:translateY(0)} to{transform:translateY(100%)} }
        .related-scroll::-webkit-scrollbar { display:none }
        @keyframes heartbeat { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes variantPop { 0%{transform:scale(0.92)} 60%{transform:scale(1.06)} 100%{transform:scale(1)} }
        @keyframes variantPulse { 0%,100%{box-shadow:0 0 0 1px rgba(232,160,32,0.08)} 50%{box-shadow:0 0 0 2px rgba(232,160,32,0.25)} }
      `}</style>
      <div ref={sheetRef} onClick={e => e.stopPropagation()} style={{ background: '#0F0C07', borderRadius: '24px 24px 0 0', maxWidth: 600, width: '100%', margin: '0 auto', animation: isClosing ? 'slideDown 0.28s ease-in forwards' : 'slideUp 0.32s ease-out', height: '88vh', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'relative', flex: '0 0 clamp(180px, 40vh, 400px)', background: '#080603', borderRadius: '0 0 16px 16px', overflow: 'hidden', flexShrink: 0 }}>
          {current.image_url && (
            <Image
              loader={overlayImageLoader}
              src={current.image_url}
              alt={current.name}
              fill
              sizes="(max-width: 600px) 100vw, 600px"
              priority
              unoptimized
              style={{ objectFit: 'cover', objectPosition: 'center' }}
            />
          )}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '20%', background: 'linear-gradient(to top, #0F0C07 0%, transparent 100%)' }} />
          <button onClick={e => { e.stopPropagation(); handleClose() }} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 12, zIndex: 400, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 300, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '10px 20px 0', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, margin: '0 auto 10px' }} />
          <div style={{ fontSize: 9, color: '#E8A020', letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'DM Sans, sans-serif', marginBottom: 6 }}>{current.subcategory?.replace(/_/g, ' ')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              {discountedPrice !== null ? (<><span style={{ background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.3)', color: '#F5C842', fontSize: 10, fontWeight: 800, borderRadius: 5, padding: '2px 7px', marginRight: 6, fontFamily: 'DM Sans, sans-serif', animation: 'heartbeat 1.4s ease-in-out infinite', display: 'inline-block' }}>-{current.discount}%</span><span style={{ fontSize: 13, color: '#7A6E58', textDecoration: 'line-through', fontFamily: 'DM Sans, sans-serif' }}>{current.price} {currency}</span><span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 800, fontSize: 28, color: '#F5C842' }}>{discountedPrice}</span><span style={{ fontSize: 12, color: '#E8A020', fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{currency}</span><span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 20, color: '#F5EDD6', lineHeight: 1.1 }}>{current.name}</span></>) : (<>{displayPrice !== null ? (<><span style={{ fontSize: 13, color: '#7A6E58', textDecoration: 'line-through', fontFamily: 'DM Sans, sans-serif' }}>{current.price} {currency}</span><span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 28, color: '#F5C842' }}>{displayPrice}</span></>) : (<span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 28, color: '#F5C842' }}>{current.price}</span>)}<span style={{ fontSize: 12, color: '#E8A020', fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{currency}</span><span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 20, color: '#F5EDD6', lineHeight: 1.1 }}>{current.name}</span></>)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {quantity > 0 && (<><button onClick={handleRemove} style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(232,160,32,0.25)', background: 'transparent', color: '#C8B890', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button><span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 16, color: '#F5EDD6', minWidth: 16, textAlign: 'center' }}>{quantity}</span></>)}
                <button onClick={handleAdd} disabled={!canAdd} style={{ width: 42, height: 42, background: !canAdd ? 'rgba(255,255,255,0.05)' : added ? 'rgba(232,160,32,0.15)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: added ? 14 : 22, fontWeight: 700, color: !canAdd ? '#444' : added ? '#E8A020' : '#080603', cursor: canAdd ? 'pointer' : 'not-allowed', boxShadow: (!canAdd || added) ? 'none' : '0 4px 16px rgba(232,160,32,0.35)', transition: 'all 0.2s' }}>{added ? '✓' : '+'}</button>
              </div>
              {stockReached && <span style={{ fontSize: 9, color: '#E85C20', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, marginTop: 2 }}>Stock max atteint</span>}
            </div>
          </div>
          {current.description && <div style={{ fontSize: 12, color: '#C8B99A', lineHeight: 1.6, marginBottom: 10 }}>{current.description}</div>}
          {current.ingredients && <div style={{ background: 'rgba(232,160,32,0.05)', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 12, padding: '8px 14px', marginBottom: 12 }}><div style={{ fontSize: 9, color: '#E8A020', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'DM Sans, sans-serif', marginBottom: 3 }}>Ingrédients</div><div style={{ fontSize: 12, color: '#C8B99A', lineHeight: 1.5 }}>{current.ingredients}</div></div>}
          {hasVariants && <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>{current.variants!.map((vt) => { const selected = selectedVariants[vt.type]; return (<div key={vt.type}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ fontSize: 11, color: '#E8A020', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'DM Sans, sans-serif' }}>{vt.type}</span>{!selectedVariants[vt.type] && <span style={{ fontSize: 10, color: '#FF5533', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>Faites votre choix</span>}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{vt.options.map((opt) => { const isSelected = selected === opt; return (<button key={opt} onClick={() => selectVariant(vt.type, opt)} style={{ padding: '8px 16px', borderRadius: 10, border: isSelected ? '1.5px solid #F5C842' : '1px solid rgba(255,255,255,0.12)', background: isSelected ? 'rgba(245,200,66,0.12)' : 'rgba(255,255,255,0.04)', color: isSelected ? '#F5C842' : '#C8B99A', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: isSelected ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s', animation: isSelected ? 'variantPop 0.2s ease' : (!selectedVariants[vt.type] ? 'variantPulse 3s ease-in-out infinite' : 'none'), boxShadow: isSelected ? '0 0 0 1px rgba(245,200,66,0.2)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>{opt}{vt.prices && vt.prices[opt] !== undefined && vt.prices[opt] !== 0 && <span style={{ fontSize: 10, color: isSelected ? '#F5C842' : '#7A6E58', fontWeight: 600 }}>{vt.prices[opt] > 0 ? '+' : ''}{vt.prices[opt]} {currency}</span>}</button>) })}</div></div>) })}</div>}
          {related.length > 0 && <div style={{ flex: 1 }}><div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'DM Sans, sans-serif', marginBottom: 4 }}>Dans la même catégorie</div><div className="related-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 8 }}>{related.map(p => (<div key={p.id} onClick={() => handleSetCurrent(p)} style={{ flexShrink: 0, width: 'clamp(64px, 14vw, 80px)', cursor: 'pointer', textAlign: 'center' }}><div style={{ width: 'clamp(64px, 14vw, 80px)', height: 'clamp(64px, 14vw, 80px)', borderRadius: 8, overflow: 'hidden', background: '#1A1510', marginBottom: 4, border: current.id === p.id ? '1.5px solid rgba(245,200,66,0.5)' : '1px solid rgba(232,160,32,0.08)', position: 'relative' }}>{p.image_url && (
                      <Image
                        loader={overlayImageLoader}
                        src={p.image_url + (p.image_url.includes('supabase.co') ? '?width=100&quality=70' : '')}
                        alt={p.name}
                        fill
                        sizes="80px"
                        unoptimized
                        style={{ objectFit: 'cover' }}
                      />
                    )}</div><div style={{ fontSize: 10, fontWeight: 600, color: '#C8B99A', fontFamily: 'DM Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div><div style={{ fontSize: 10, color: '#E8A020', fontWeight: 700, fontFamily: 'DM Sans, sans-serif' }}>{p.price} {currency}</div></div>))}</div></div>}
        </div>
      </div>
    </div>
  )
}
