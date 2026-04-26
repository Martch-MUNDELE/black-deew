'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'

export default function ConfirmationPage() {
  const params = useParams()
  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [slot, setSlot] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const clear = useCart(s => s.clear)

  useEffect(() => { clear() }, [])

  useEffect(() => {
    const fetchOrder = async () => {
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', params.id).single()
      if (orderData) {
        setOrder(orderData)
        const { data: itemsData } = await supabase.from('order_items').select('*').eq('order_id', params.id)
        if (itemsData) setItems(itemsData)
        if (orderData.slot_id) {
          const { data: slotData } = await supabase.from('delivery_slots').select('*').eq('id', orderData.slot_id).single()
          if (slotData) setSlot(slotData)
        }
      }
      setLoading(false)
    }
    fetchOrder()
  }, [params.id])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: '#C8B99A' }}>Chargement...</div>
  )

  if (!order) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <p style={{ color: '#C8B99A' }}>Commande introuvable</p>
      <Link href="/" style={{ color: '#E8A020' }}>Retour à l'accueil</Link>
    </div>
  )

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const IconCalendar = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )

  const IconPin = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.69 2 6 4.69 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.31-2.69-6-6-6z"/>
      <circle cx="12" cy="8" r="2.5" fill="#FF6B20" stroke="none"/>
    </svg>
  )

  const hasCoords = order.lat && order.lng
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${order.lng - 0.003},${order.lat - 0.003},${order.lng + 0.003},${order.lat + 0.003}&layer=mapnik&marker=${order.lat},${order.lng}`
    : null

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px 80px' }}>

      <div style={{ textAlign: 'center', padding: '48px 0 40px' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(232,160,32,0.4)' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M6 16L13 23L26 9" stroke="#0A0804" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 28, color: '#F5EDD6', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
          Commande confirmée !
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Merci <strong style={{ color: '#F5EDD6' }}>{order.customer_name}</strong>.<br/>On prépare ta commande avec soin.
        </p>
        <div style={{ display: 'inline-block', marginTop: 16, background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 50, padding: '6px 16px', fontSize: 11, color: '#E8A020', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
          #{String(order.id).slice(0, 8).toUpperCase()}
        </div>
      </div>

      {slot && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 18, padding: '20px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 14 }}>Livraison prévue</div>

          {/* Date */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconCalendar />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#F5EDD6', textTransform: 'capitalize' as const }}>{formatDate(slot.date)}</div>
              <div style={{ fontSize: 13, color: '#E8A020', fontWeight: 600, marginTop: 2 }}>{slot.time_start?.slice(0,5)} — {slot.time_end?.slice(0,5)}</div>
            </div>
          </div>

          {/* Adresse + carte */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,107,32,0.08)', border: '1px solid rgba(255,107,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconPin />
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              {order.customer_address ? (
                <div style={{ fontSize: 13, color: '#F5EDD6', fontWeight: 600, lineHeight: 1.5, marginBottom: hasCoords ? 10 : 0 }}>{order.customer_address}</div>
              ) : !hasCoords ? (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Adresse non renseignée</div>
              ) : null}
              {order.customer_note && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: hasCoords ? 10 : 0 }}>{order.customer_note}</div>
              )}
              {hasCoords && mapSrc && (
                <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(232,160,32,0.2)', height: 160 }}>
                  <iframe
                    src={mapSrc}
                    width="100%"
                    height="160"
                    style={{ border: 'none', display: 'block', filter: 'saturate(0.7) brightness(0.85)' }}
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Paiement */}
          <div style={{ padding: '12px 14px', background: 'rgba(232,160,32,0.06)', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#C8B890', fontWeight: 600 }}>Paiement à la livraison</span>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#F5C842' }}>{order.total?.toFixed(2)} DH</span>
          </div>
        </div>
      )}

      <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 18, padding: '20px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 14 }}>Récapitulatif</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {items.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(232,160,32,0.06)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(232,160,32,0.1)', color: '#E8A020', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>{item.quantity}×</span>
                <span style={{ fontSize: 13, color: '#F5EDD6', fontWeight: 500 }}>{item.product_name}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#C8B890', fontFamily: 'DM Sans, sans-serif' }}>{(item.unit_price * item.quantity).toFixed(2)} DH</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(232,160,32,0.12)' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#F5EDD6' }}>Total</span>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 20, color: '#F5C842', letterSpacing: '-0.5px' }}>{order.total?.toFixed(2)} DH</span>
        </div>
      </div>

      <Link href="/" style={{ textDecoration: 'none', display: 'block', textAlign: 'center', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', padding: '16px', borderRadius: 50, fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 15, boxShadow: '0 4px 20px rgba(232,160,32,0.25)' }}>
        Commander autre chose
      </Link>

    </div>
  )
}
