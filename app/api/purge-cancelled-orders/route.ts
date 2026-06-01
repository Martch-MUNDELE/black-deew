import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { BUSINESS_ACTIVE_ORDER_STATUSES } from '@/lib/order-status'

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const syncDeliverySlotBookingFromOrders = async (slotId: string | null | undefined) => {
    if (!slotId) return

    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', slotId)
      .in('status', BUSINESS_ACTIVE_ORDER_STATUSES)

    await supabase
      .from('delivery_slots')
      .update({ booked: Math.max(Number(count ?? 0), 0) })
      .eq('id', slotId)
  }

  const now = new Date().toISOString()

  const { data: orders, error: selectError } = await supabase
    .from('orders')
    .select('id, slot_id')
    .eq('status', 'annulée')
    .not('purge_after', 'is', null)
    .lte('purge_after', now)

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 })
  }

  const orderIds = (orders || []).map(o => o.id)
  const slotIds = [...new Set((orders || []).map(o => o.slot_id).filter(Boolean))] as string[]

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: true, purged: 0 })
  }

  await supabase.from('order_items').delete().in('order_id', orderIds)
  await supabase.from('order_deliveries').delete().in('order_id', orderIds)

  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .in('id', orderIds)
    .eq('status', 'annulée')

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  for (const slotId of slotIds) {
    await syncDeliverySlotBookingFromOrders(slotId)
  }

  return NextResponse.json({ ok: true, purged: orderIds.length })
}
