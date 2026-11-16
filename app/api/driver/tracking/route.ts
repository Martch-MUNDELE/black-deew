// BLAC-P3-060 : le telephone du livreur envoie sa position. L'identifiant livreur vient uniquement de la session (getAdminRole).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminRole } from '@/lib/admin-role-server'
import { generateTrackingToken, parsePositionBody } from '@/lib/delivery-tracking'

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

  let payload: unknown = null
  try {
    payload = await req.json()
  } catch {
    payload = null
  }
  const deliveryId =
    payload && typeof payload === 'object' && typeof (payload as { delivery_id?: unknown }).delivery_id === 'string'
      ? ((payload as { delivery_id: string }).delivery_id)
      : ''
  if (!UUID_RE.test(deliveryId)) {
    return NextResponse.json({ error: 'Livraison invalide' }, { status: 400, headers: NO_STORE })
  }
  const pos = parsePositionBody(payload)
  if (!pos.ok) {
    return NextResponse.json({ error: pos.error }, { status: 400, headers: NO_STORE })
  }

  try {
    // Livraison du livreur de la session uniquement : inconnue ou d'un autre livreur => 404
    const { data: delivery, error: delErr } = await supabase
      .from('order_deliveries')
      .select('id, status')
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
    if (state === 'delivered' || state === 'cancelled') {
      return NextResponse.json({ error: 'Livraison terminee' }, { status: 409, headers: NO_STORE })
    }

    const readActive = async () =>
      supabase
        .from('delivery_tracking')
        .select('id, token')
        .eq('delivery_id', deliveryId)
        .eq('active', true)
        .maybeSingle()

    let { data: tracking, error: readErr } = await readActive()
    if (readErr) {
      return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
    }
    if (!tracking) {
      const { data: created, error: insErr } = await supabase
        .from('delivery_tracking')
        .insert({ delivery_id: deliveryId, token: generateTrackingToken(), active: true })
        .select('id, token')
        .maybeSingle()
      if (insErr || !created) {
        // Course concurrente : un suivi actif vient d'etre cree, on le relit
        const again = await readActive()
        if (again.error || !again.data) {
          return NextResponse.json({ error: 'Creation impossible' }, { status: 500, headers: NO_STORE })
        }
        tracking = again.data
      } else {
        tracking = created
      }
    }

    const { error: updErr } = await supabase
      .from('delivery_tracking')
      .update({
        lat: pos.lat,
        lng: pos.lng,
        accuracy_m: pos.accuracy_m,
        position_updated_at: new Date().toISOString(),
      })
      .eq('id', tracking.id)
    if (updErr) {
      return NextResponse.json({ error: 'Mise a jour impossible' }, { status: 500, headers: NO_STORE })
    }
    return NextResponse.json({ ok: true, token: tracking.token }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Mise a jour impossible' }, { status: 500, headers: NO_STORE })
  }
}
