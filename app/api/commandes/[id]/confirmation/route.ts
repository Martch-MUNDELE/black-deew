import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NO_STORE = { 'Cache-Control': 'no-store' }

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const { id } = await context.params

  if (!id || !UUID_RE.test(id)) {
    return json({ error: 'Identifiant de commande invalide' }, 400)
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, customer_name, customer_address, customer_note, lat, lng, slot_id, total, delivery_fee, delivery_mode')
    .eq('id', id)
    .maybeSingle()

  if (orderError) {
    return json({ error: 'Lecture de la commande impossible' }, 500)
  }
  if (!order) {
    return json({ error: 'Commande introuvable' }, 404)
  }

  const { data: items, error: itemsError } = await db
    .from('order_items')
    .select('id, quantity, product_name, unit_price')
    .eq('order_id', id)

  if (itemsError) {
    return json({ error: 'Lecture des lignes impossible' }, 500)
  }

  let slot: { date: string; time_start: string | null; time_end: string | null } | null = null
  if (order.slot_id) {
    const { data: slotData } = await db
      .from('delivery_slots')
      .select('date, time_start, time_end')
      .eq('id', order.slot_id)
      .maybeSingle()
    slot = slotData ?? null
  }

  return json({ order, items: items ?? [], slot })
}
