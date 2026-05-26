import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type MarkLivreeRequestBody = {
  orderId?: string
  total?: number
}

type DeliveryCashRow = {
  amount_collected: number | string | null
  driver_fee_total: number | string | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { orderId, total } = (await req.json()) as MarkLivreeRequestBody
  if (!orderId || typeof total !== 'number') {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }

  // 1. orders.status -> livrée
  const { error: orderErr } = await supabase
    .from('orders')
    .update({ status: 'livrée' })
    .eq('id', orderId)
  if (orderErr) return NextResponse.json({ error: `orders: ${orderErr.message}` }, { status: 500 })

  // 2. order_deliveries -> delivered + delivered_at + amount_collected
  const { data: updatedDel, error: delErr } = await supabase
    .from('order_deliveries')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      amount_collected: total,
    })
    .eq('order_id', orderId)
    .select('id, driver_id')
  if (delErr) return NextResponse.json({ error: `order_deliveries: ${delErr.message}` }, { status: 500 })

  const driverId = updatedDel?.[0]?.driver_id
  if (!driverId) return NextResponse.json({ ok: true, driverSessionUpdated: false })

  // 3. Recalcul driver_sessions.collected_cash + net_to_remit
  const { data: sess } = await supabase
    .from('driver_sessions')
    .select('id, opening_cash')
    .eq('driver_id', driverId)
    .eq('session_status', 'open')
    .maybeSingle()
  if (!sess?.id) return NextResponse.json({ ok: true, driverSessionUpdated: false })

  const { data: deliveries } = await supabase
    .from('order_deliveries')
    .select('amount_collected, driver_fee_total')
    .eq('driver_id', driverId)
    .eq('status', 'delivered')
  const openingCash = Number(sess.opening_cash) || 0
  const deliveryRows = (deliveries || []) as DeliveryCashRow[]
  const collected = deliveryRows.reduce((s, d) => s + (Number(d.amount_collected) || 0), 0)
  const feesTotal = deliveryRows.reduce((s, d) => s + (Number(d.driver_fee_total) || 0), 0)
  const { error: sessErr } = await supabase.from('driver_sessions').update({
    collected_cash: collected,
    net_to_remit: openingCash + collected - feesTotal,
  }).eq('id', sess.id)
  if (sessErr) return NextResponse.json({ error: `driver_sessions: ${sessErr.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, driverSessionUpdated: true })
}
