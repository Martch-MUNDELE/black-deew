// BLAC-P3-051 : le livreur marque sa livraison comme livree. L'identifiant livreur vient uniquement de la session (getAdminRole), jamais de la requete.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminRole } from '@/lib/admin-role-server'
import { markOrderDelivered } from '@/lib/mark-delivered'

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
      .select('id, order_id, status')
      .eq('id', deliveryId)
      .eq('driver_id', driverId)
      .maybeSingle()
    if (delErr) {
      return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
    }
    if (!delivery) {
      return NextResponse.json({ error: 'Livraison introuvable' }, { status: 404, headers: NO_STORE })
    }

    const state = String(delivery.status ?? '').trim().toLowerCase()
    if (state === 'delivered') {
      return NextResponse.json({ ok: true, already: true }, { headers: NO_STORE })
    }
    if (state === 'cancelled') {
      return NextResponse.json({ error: 'Livraison annulee' }, { status: 409, headers: NO_STORE })
    }
    if (!delivery.order_id) {
      return NextResponse.json({ error: 'Livraison introuvable' }, { status: 404, headers: NO_STORE })
    }

    // Le montant est relu cote serveur (orders.total), jamais fourni par le navigateur
    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .select('total')
      .eq('id', delivery.order_id)
      .maybeSingle()
    const orderTotal = Number(orderRow?.total)
    if (orderErr || !orderRow || !Number.isFinite(orderTotal)) {
      return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
    }

    // Numero de test : traite comme une commande normale (aucune suppression cote livreur)
    const result = await markOrderDelivered(supabase, delivery.order_id, orderTotal)
    if (!result.ok) {
      return NextResponse.json({ error: 'Mise a jour impossible' }, { status: result.status, headers: NO_STORE })
    }
    return NextResponse.json({ ok: true, already: false, driverSessionUpdated: result.driverSessionUpdated }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Mise a jour impossible' }, { status: 500, headers: NO_STORE })
  }
}
