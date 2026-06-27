import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendOrderNotification } from '@/lib/notifications'

type CommandeItemInput = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  isVip?: boolean
  selected_variants?: unknown
  variant_price_extra?: number
  variant_name?: string | null
  variant_price?: number | null
}

type CommandeRequestBody = {
  name?: string
  phone?: string
  address?: string
  note?: string | null
  slot_id?: string
  items?: CommandeItemInput[]
  lat?: number | null
  lng?: number | null
  geo_address?: string | null
  email?: string | null
  wantFacture?: boolean
  delivery_mode?: string | null
  delivery_fee?: number | null
  distance_km?: number | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getRequestBaseUrl(req: Request) {
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const forwardedHost = req.headers.get('x-forwarded-host')
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`
  return new URL(req.url).origin
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CommandeRequestBody

  const { data: shopStatus } = await supabase.from('settings').select('value').eq('key', 'status').single()
  if (shopStatus?.value === 'closed') {
    return NextResponse.json({ error: 'Le shop est actuellement fermé' }, { status: 403 })
  }
  const { data: currencyRow } = await supabase.from('settings').select('value').eq('key', 'currency').single()
  const currency = currencyRow?.value || 'USD'
  const { data: siteNameRow } = await supabase.from('settings').select('value').eq('key', 'site_name').single()
  const siteName = siteNameRow?.value || 'Black Deew'
  const { data: adminEmailRow } = await supabase.from('settings').select('value').eq('key', 'notification_email').single()
  const adminEmail = adminEmailRow?.value || undefined
  const { name, phone, address, note, slot_id, lat, lng, geo_address, email, wantFacture, delivery_mode, delivery_fee, distance_km } = body
  const items = Array.isArray(body.items) ? body.items : []
  const vipItems = items.filter((i) => i.isVip)
  const vipTotal = vipItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  const { data: slot } = await supabase.from('delivery_slots').select('*').eq('id', slot_id).single()
  if (!slot || slot.blocked || slot.booked >= slot.capacity) {
    return NextResponse.json({ error: 'Créneau non disponible' }, { status: 400 })
  }

  // Verification stock si module actif
  const { data: stockEnabledRow } = await supabase.from('settings').select('value').eq('key', 'stock_enabled').single()
  if (stockEnabledRow?.value === 'true') {
    for (const item of items) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single()
      if (prod && prod.stock !== null) {
        if (prod.stock <= 0) {
          return NextResponse.json({ error: `${item.product_name} est epuise` }, { status: 409 })
        }
        if (prod.stock < item.quantity) {
          return NextResponse.json({ error: `Stock insuffisant pour ${item.product_name} (${prod.stock} disponible(s))`, stock: prod.stock }, { status: 409 })
        }
      }
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
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

  await supabase.from('order_items').insert(items.map((item) => ({ order_id: order.id, product_id: item.product_id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, is_vip: item.isVip ?? false, selected_variants: item.selected_variants ?? null, variant_price_extra: item.variant_price_extra ?? 0, variant_name: item.variant_name ?? null, variant_price: item.variant_price ?? null })))
  await supabase.from('delivery_slots').update({ booked: slot.booked + 1 }).eq('id', slot_id)

  // Decrementation stock si module actif
  if (stockEnabledRow?.value === 'true') {
    for (const item of items) {
      await supabase.rpc('decrement_stock', { product_id: item.product_id, qty: item.quantity })
    }
  }
  await sendOrderNotification({ ...order, items, slot, vipItems, vipTotal }, currency, siteName, adminEmail)

  // Push notification PWA
  try {
    const hasVip = items.some((i: CommandeItemInput) => i.isVip)
    await fetch(`${getRequestBaseUrl(req)}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: hasVip ? '⭐ Nouvelle commande VIP !' : '🛒 Nouvelle commande !',
        body: `${body.name || 'Client'} — ${items.length} article(s)`,
        tag: 'nouvelle-commande',
        url: '/admin/commandes'
      })
    })
  } catch (e) { console.error('[Push commande]', e) }

  if (wantFacture && email) {
    try {
      await fetch(`${getRequestBaseUrl(req)}/api/facture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, excludeVip: true })
      })
    } catch (e) { console.error('Facture error:', e) }
  }

  return NextResponse.json(order)
}
