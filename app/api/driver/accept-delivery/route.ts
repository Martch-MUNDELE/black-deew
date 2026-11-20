// BLAC-P3-058 : le livreur accepte sa course. L'identifiant livreur vient uniquement de la session (getAdminRole), jamais de la requete.
// BLAC-P3-066 : la commande passe en 'en_livraison', le suivi est cree et le lien WhatsApp "en route" est renvoye.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminRole } from '@/lib/admin-role-server'
import { nextStatusOnAccept } from '@/lib/accept-delivery'
import { generateTrackingToken, buildTrackingUrl } from '@/lib/delivery-tracking'
import { buildEnRouteMessage, buildEnRouteWhatsAppUrl } from '@/lib/delivery-whatsapp'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const info = await getAdminRole()
  if (!info) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401, headers: NO_STORE })
  }
  if (info.role !== 'driver' || !info.driver?.id) {
    return NextResponse.json({ error: 'Acces reserve aux livreurs' }, { status: 403, headers: NO_STORE })
  }
  const driverId = info.driver.id

  let payload: { delivery_id?: unknown } | null = null
  try {
    payload = (await req.json()) as { delivery_id?: unknown }
  } catch {
    payload = null
  }
  const deliveryId = typeof payload?.delivery_id === 'string' ? payload.delivery_id : ''
  if (!UUID_RE.test(deliveryId)) {
    return NextResponse.json({ error: 'Livraison invalide' }, { status: 400, headers: NO_STORE })
  }

  try {
    // Livraison du livreur de la session uniquement : inconnue ou d'un autre livreur => 404
    const { data: delivery, error: delErr } = await supabase
      .from('order_deliveries')
      .select('id, status, order_id')
      .eq('id', deliveryId)
      .eq('driver_id', driverId)
      .maybeSingle()
    if (delErr) {
      return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
    }
    if (!delivery) {
      return NextResponse.json({ error: 'Livraison introuvable' }, { status: 404, headers: NO_STORE })
    }

    const next = nextStatusOnAccept(delivery.status)
    if (!next.ok) {
      return NextResponse.json({ error: next.reason }, { status: 409, headers: NO_STORE })
    }
    if (next.already) {
      const extra = await buildWhatsappInfo(deliveryId, delivery.order_id, driverId, req.nextUrl.origin, false)
      return NextResponse.json(
        { ok: true, already: true, trackingUrl: extra.trackingUrl, whatsappUrl: extra.whatsappUrl },
        { headers: NO_STORE }
      )
    }

    const { error: updErr } = await supabase
      .from('order_deliveries')
      .update({ status: next.status, picked_up_at: new Date().toISOString() })
      .eq('id', deliveryId)
      .eq('driver_id', driverId)
    if (updErr) {
      return NextResponse.json({ error: 'Mise a jour impossible' }, { status: 500, headers: NO_STORE })
    }

    await markOrderEnLivraison(delivery.order_id)
    const extra = await buildWhatsappInfo(deliveryId, delivery.order_id, driverId, req.nextUrl.origin, true)
    return NextResponse.json(
      { ok: true, already: false, trackingUrl: extra.trackingUrl, whatsappUrl: extra.whatsappUrl },
      { headers: NO_STORE }
    )
  } catch {
    return NextResponse.json({ error: 'Mise a jour impossible' }, { status: 500, headers: NO_STORE })
  }
}

// Commande -> 'en_livraison' (statut precedent lu pour l'historique ; echecs d'historique ignores)
async function markOrderEnLivraison(orderId: unknown): Promise<void> {
  if (typeof orderId !== 'string' || !orderId) return
  try {
    const { data: order } = await supabase.from('orders').select('id, status').eq('id', orderId).maybeSingle()
    if (!order) return
    const fromStatus = order.status ?? null
    if (fromStatus === 'en_livraison') return
    const { error } = await supabase.from('orders').update({ status: 'en_livraison' }).eq('id', orderId)
    if (error) return
    try {
      await supabase
        .from('order_status_history')
        .insert({ order_id: orderId, from_status: fromStatus, to_status: 'en_livraison' })
    } catch {
      // historique non bloquant
    }
  } catch {
    // non bloquant
  }
}

// BLAC-P3-077 : articles de la commande (order_items). Tout echec => liste vide, jamais d'exception.
async function fetchOrderItems(orderId: unknown): Promise<{ name: string; quantity: number }[]> {
  if (typeof orderId !== 'string' || !orderId) return []
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select('product_name, quantity')
      .eq('order_id', orderId)
    if (error || !Array.isArray(data)) return []
    return data.map((row: { product_name?: unknown; quantity?: unknown }) => ({
      name: typeof row.product_name === 'string' ? row.product_name : '',
      quantity: Number(row.quantity),
    }))
  } catch {
    return []
  }
}

// Suivi actif (cree si absent quand create=true) + lien WhatsApp. Tout echec => null, jamais d'exception.
async function buildWhatsappInfo(
  deliveryId: string,
  orderId: unknown,
  driverId: string,
  origin: string,
  create: boolean
): Promise<{ trackingUrl: string | null; whatsappUrl: string | null }> {
  let trackingUrl: string | null = null
  try {
    const { data: existing, error: selErr } = await supabase
      .from('delivery_tracking')
      .select('token')
      .eq('delivery_id', deliveryId)
      .eq('active', true)
      .maybeSingle()
    if (!selErr && existing?.token) {
      trackingUrl = buildTrackingUrl(origin, existing.token as string)
    } else if (!selErr && create) {
      const token = generateTrackingToken()
      const { error: insErr } = await supabase
        .from('delivery_tracking')
        .insert({ delivery_id: deliveryId, token, active: true })
      if (!insErr) trackingUrl = buildTrackingUrl(origin, token)
    }
  } catch {
    trackingUrl = null
  }

  if (!create && !trackingUrl) return { trackingUrl: null, whatsappUrl: null }

  let whatsappUrl: string | null = null
  try {
    let customer: { customer_name?: string | null; customer_phone?: string | null } | null = null
    if (typeof orderId === 'string' && orderId) {
      const { data } = await supabase
        .from('orders')
        .select('customer_name, customer_phone')
        .eq('id', orderId)
        .maybeSingle()
      customer = data
    }
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('full_name, phone')
      .eq('id', driverId)
      .maybeSingle()
    const items = await fetchOrderItems(orderId)
    const message = buildEnRouteMessage({
      items,
      customerName: customer?.customer_name,
      driverName: driver?.full_name,
      driverPhone: driver?.phone,
      trackingUrl,
    })
    whatsappUrl = buildEnRouteWhatsAppUrl({ customerPhone: customer?.customer_phone, message })
  } catch {
    whatsappUrl = null
  }
  return { trackingUrl, whatsappUrl }
}
