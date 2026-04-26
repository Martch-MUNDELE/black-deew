import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendOrderNotification } from '@/lib/notifications'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()

  const { data: shopStatus } = await supabase.from('settings').select('value').eq('key', 'status').single()
  if (shopStatus?.value === 'closed') {
    return NextResponse.json({ error: 'Le shop est actuellement fermé' }, { status: 403 })
  }
  const { name, phone, address, note, slot_id, items, total, lat, lng, geo_address, email, wantFacture, delivery_mode, delivery_fee, distance_km } = body

  const { data: slot } = await supabase.from('delivery_slots').select('*').eq('id', slot_id).single()
  if (!slot || slot.blocked || slot.booked >= slot.capacity) {
    return NextResponse.json({ error: 'Créneau non disponible' }, { status: 400 })
  }

  const subtotal = items.reduce((sum: number, item: any) => sum + item.unit_price * item.quantity, 0)
  const calculatedTotal = subtotal + (delivery_fee ?? 0)

  const { data: order, error } = await supabase.from('orders').insert({
    customer_name: name, customer_phone: phone, customer_address: address,
    customer_note: note, slot_id, total: calculatedTotal, payment_method: 'livraison', status: 'nouvelle',
    lat: lat || null, lng: lng || null, geo_address: geo_address || null,
    customer_email: (wantFacture && email) ? email : null,
    delivery_mode: delivery_mode || null, delivery_fee: delivery_fee ?? null, distance_km: distance_km ?? null,
  }).select().single()

  if (error || !order) return NextResponse.json({ error: 'Erreur création commande' }, { status: 500 })

  await supabase.from('order_items').insert(items.map((item: any) => ({ ...item, order_id: order.id })))
  await supabase.from('delivery_slots').update({ booked: slot.booked + 1 }).eq('id', slot_id)
  await sendOrderNotification({ ...order, items, slot })

  if (wantFacture && email) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/facture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id })
      })
    } catch (e) { console.error('Facture error:', e) }
  }

  return NextResponse.json(order)
}
