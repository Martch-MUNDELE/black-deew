import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function jsonError(step: string, message: string, status = 500) {
  return NextResponse.json({ ok: false, step, error: message }, { status })
}

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const dummyId = '00000000-0000-0000-0000-000000000000'

  const { count: ordersBefore, error: countBeforeError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })

  if (countBeforeError) {
    return jsonError('count_orders_before', countBeforeError.message)
  }

  const { error: deliveriesError } = await supabase
    .from('order_deliveries')
    .delete()
    .neq('id', dummyId)

  if (deliveriesError) {
    return jsonError('delete_order_deliveries', deliveriesError.message)
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .neq('id', dummyId)

  if (itemsError) {
    return jsonError('delete_order_items', itemsError.message)
  }

  const { error: ordersError } = await supabase
    .from('orders')
    .delete()
    .neq('id', dummyId)

  if (ordersError) {
    return jsonError('delete_orders', ordersError.message)
  }

  const { error: slotsError } = await supabase
    .from('delivery_slots')
    .update({ booked: 0 })
    .neq('id', dummyId)

  if (slotsError) {
    return jsonError('reset_delivery_slots', slotsError.message)
  }

  const { count: ordersAfter, error: countAfterError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })

  if (countAfterError) {
    return jsonError('count_orders_after', countAfterError.message)
  }

  return NextResponse.json({
    ok: true,
    ordersBefore: ordersBefore ?? 0,
    ordersAfter: ordersAfter ?? 0,
    ordersDeleted: Math.max(Number(ordersBefore ?? 0) - Number(ordersAfter ?? 0), 0),
  })
}
