'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import { useCurrency } from '@/lib/currency'
import type { Product } from '@/lib/types'

export default function VipPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const { add, update, items } = useCart()
  const currency = useCurrency()
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('is_vip', true)
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        setProducts((data as Product[]) || [])
        setLoading(false)
      })
  }, [])

  // Sync quantities with cart
  useEffect(() => {
    const q: Record<string, number> = {}
    items.forEach(i => { q[i.product.id] = i.quantity })
    setQuantities(q)
  }, [items])

  const handleAdd = (product: Product) => {
    add(product, true)
  }

  const handleUpdate = (productId: string, qty: number) => {
    update(productId, qty)
  }

  const cartCount = items.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080603',
      fontFamily: 'DM Sans, sans-serif',
      paddingBottom: 120,
    }}>
      {/* HEADER */}
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

      {/* CONTENU */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 0' }}>
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
                    <img
                      src={product.image_url.includes('supabase.co') ? product.image_url + '?width=120&quality=75' : product.image_url}
                      alt={product.name}
                      style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(245,200,66,0.1)' }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#F5EDD6', marginBottom: 2 }}>{product.name}</div>
                    {product.description && (
                      <div style={{ fontSize: 12, color: '#7A6E58', marginBottom: 6, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{product.description}</div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#F5C842' }}>{product.price} {currency}</div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {qty === 0 ? (
                      <button
                        onClick={() => handleAdd(product)}
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          border: 'none',
                          background: 'linear-gradient(135deg,#F5C842,#E8A020)',
                          color: '#0A0804', fontSize: 20, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >+</button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => handleUpdate(product.id, qty - 1)}
                          style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(245,200,66,0.3)', background: 'transparent', color: '#F5C842', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >−</button>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#F5EDD6', minWidth: 16, textAlign: 'center' }}>{qty}</span>
                        <button
                          onClick={() => handleUpdate(product.id, qty + 1)}
                          style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#F5C842,#E8A020)', color: '#0A0804', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >+</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* BOUTON BOISSONS FROIDES */}
        {!loading && (
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#7A6E58', marginBottom: 12 }}>Une petite soif ?</div>
            <button
              onClick={() => { window.location.href = '/#froides' }}
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
        )}
      </div>

      {/* BARRE PANIER FIXE */}
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
  )
}
