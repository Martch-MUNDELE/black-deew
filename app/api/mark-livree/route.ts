import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { recalculatePeriodCore } from '@/app/actions/billing'
import { isTestPhone } from '@/lib/test-orders'

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

  // 0. Recuperation statut actuel pour historique
  const { data: currentOrderRow } = await supabase
    .from('orders')
    .select('status, customer_phone')
    .eq('id', orderId)
    .maybeSingle()

  // BF-P2-013 : numero de test - suppression au lieu de marquage livree
  if (isTestPhone(currentOrderRow?.customer_phone)) {
    await supabase.from('order_items').delete().eq('order_id', orderId)
    await supabase.from('order_status_history').delete().eq('order_id', orderId)
    await supabase.from('order_deliveries').delete().eq('order_id', orderId)
    await supabase.from('orders').delete().eq('id', orderId)
    return NextResponse.json({ ok: true, testOrderDeleted: true })
  }

  // 1. orders.status -> livrée
  const { error: orderErr } = await supabase
    .from('orders')
    .update({ status: 'livrée' })
    .eq('id', orderId)
  if (orderErr) return NextResponse.json({ error: `orders: ${orderErr.message}` }, { status: 500 })

  // BF-P2-013 : historique statuts pour funnel operationnel
  supabase.from('order_status_history').insert({
    order_id: orderId,
    from_status: currentOrderRow?.status ?? null,
    to_status: 'livrée',
  }).then(() => {}, () => {})

  // BF-P2-013 : recalcul automatique facturation (best-effort, ne bloque jamais la reponse)
  ;(async () => {
    const { data: openPeriod } = await supabase
      .from('billing_periods')
      .select('id')
      .eq('status', 'en_cours')
      .lte('period_start', new Date().toISOString().slice(0, 10))
      .gte('period_end', new Date().toISOString().slice(0, 10))
      .maybeSingle()
    if (openPeriod?.id) {
      recalculatePeriodCore(openPeriod.id, supabase).catch(() => {})
    }
  })()

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
