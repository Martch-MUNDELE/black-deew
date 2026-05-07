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
  const { data: currencyRow } = await supabase.from('settings').select('value').eq('key', 'currency').single()
  const currency = currencyRow?.value || 'DH'
  const { name, phone, address, note, slot_id, items, total, lat, lng, geo_address, email, wantFacture, delivery_mode, delivery_fee, distance_km } = body
  const standardItems = items.filter((i: any) => !i.isVip)
  const vipItems = items.filter((i: any) => i.isVip)
  const vipTotal = vipItems.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)

  const { data: slot } = await supabase.from('delivery_slots').select('*').eq('id', slot_id).single()
  if (!slot || slot.blocked || slot.booked >= slot.capacity) {
    return NextResponse.json({ error: 'Créneau non disponible' }, { status: 400 })
  }

  const subtotal = items.reduce((sum: number, item: any) => sum + item.unit_price * item.quantity, 0)
  const calculatedTotal = subtotal + (delivery_fee ?? 0)

  const today = new Date().toISOString().split('T')[0]
  const { count: orderCount } = await supabase.from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today + 'T00:00:00.000Z')
    .lte('created_at', today + 'T23:59:59.999Z')
  const seqNum = String((orderCount ?? 0) + 1).padStart(4, '0')
  const invoice_number = `BD-${today.replace(/-/g, '')}-${seqNum}`

  const { data: order, error } = await supabase.from('orders').insert({
    customer_name: name, customer_phone: phone, customer_address: address,
    customer_note: note, slot_id, total: calculatedTotal, payment_method: 'livraison', status: 'nouvelle',
    lat: lat || null, lng: lng || null, geo_address: geo_address || null,
    customer_email: (wantFacture && email) ? email : null,
    delivery_mode: delivery_mode || null, delivery_fee: delivery_fee ?? null, distance_km: distance_km ?? null,
    invoice_number,
  }).select().single()

  if (error || !order) { return NextResponse.json({ error: 'Erreur création commande' }, { status: 500 }) }

  await supabase.from('order_items').insert(items.map((item: any) => ({ order_id: order.id, product_id: item.product_id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, is_vip: item.isVip ?? false })))
  await supabase.from('delivery_slots').update({ booked: slot.booked + 1 }).eq('id', slot_id)
  await sendOrderNotification({ ...order, items, slot, vipItems, vipTotal }, currency)

  if (wantFacture && email) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/facture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, excludeVip: true })
      })
    } catch (e) { console.error('Facture error:', e) }
  }

  return NextResponse.json(order)
}
