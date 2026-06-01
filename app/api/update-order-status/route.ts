import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  BUSINESS_ACTIVE_ORDER_STATUSES,
  canonicalizeOrderStatus,
  isCancelledOrderStatus,
} from '@/lib/order-status'

type OrderRow = {
  id: string
  status: string | null
  slot_id: string | null
  previous_status_before_cancel?: string | null
  cancelled_at?: string | null
  purge_after?: string | null
}

function twoHoursFromNowIso() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  const { orderId, status, action } = body as {
    orderId?: string
    status?: string
    action?: 'restore_cancel'
  }

  if (!orderId) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }

  const syncDeliverySlotBookingFromOrders = async (slotId: string | null | undefined) => {
    if (!slotId) return { synced: false, booked: null }

    const { count, error: countError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', slotId)
      .in('status', BUSINESS_ACTIVE_ORDER_STATUSES)

    if (countError) {
      return { synced: false, booked: null, error: countError.message }
    }

    const nextBooked = Math.max(Number(count ?? 0), 0)

    const { error: slotError } = await supabase
      .from('delivery_slots')
      .update({ booked: nextBooked })
      .eq('id', slotId)

    if (slotError) {
      return { synced: false, booked: nextBooked, error: slotError.message }
    }

    return { synced: true, booked: nextBooked }
  }

  const isSlotAvailable = async (slotId: string | null | undefined) => {
    if (!slotId) return { available: false, reason: 'missing_slot' }

    const { data: slotRaw, error: slotError } = await supabase
      .from('delivery_slots')
      .select('id, capacity, blocked')
      .eq('id', slotId)
      .maybeSingle()

    if (slotError) return { available: false, reason: slotError.message }

    const slot = slotRaw as { id: string; capacity: number | null; blocked: boolean | null } | null

    if (!slot) return { available: false, reason: 'slot_not_found' }
    if (slot.blocked) return { available: false, reason: 'slot_blocked' }

    const { count, error: countError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', slotId)
      .in('status', BUSINESS_ACTIVE_ORDER_STATUSES)

    if (countError) return { available: false, reason: countError.message }

    const activeCount = Number(count ?? 0)
    const capacity = Number(slot.capacity ?? 0)

    return {
      available: activeCount < capacity,
      reason: activeCount < capacity ? null : 'slot_full',
    }
  }

  const { data: currentOrderRaw, error: currentError } = await supabase
    .from('orders')
    .select('id, status, slot_id, previous_status_before_cancel, cancelled_at, purge_after')
    .eq('id', orderId)
    .maybeSingle()

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 })
  }

  const currentOrder = currentOrderRaw as OrderRow | null

  if (!currentOrder) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 })
  }

  if (action === 'restore_cancel') {
    if (!isCancelledOrderStatus(currentOrder.status)) {
      return NextResponse.json({ error: 'order is not cancelled' }, { status: 400 })
    }

    const previousStatus = canonicalizeOrderStatus(currentOrder.previous_status_before_cancel) || 'nouvelle'
    const slotCheck = await isSlotAvailable(currentOrder.slot_id)

    const updatePayload: Record<string, unknown> = {
      status: previousStatus,
      previous_status_before_cancel: null,
      cancelled_at: null,
      purge_after: null,
    }

    let slotNeedsReprogramming = false

    if (!slotCheck.available) {
      updatePayload.slot_id = null
      slotNeedsReprogramming = true
    }

    const { error: restoreError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)

    if (restoreError) {
      return NextResponse.json({ error: restoreError.message }, { status: 500 })
    }

    const slotSync = currentOrder.slot_id
      ? await syncDeliverySlotBookingFromOrders(currentOrder.slot_id)
      : null

    return NextResponse.json({
      ok: true,
      restored: true,
      status: previousStatus,
      slotNeedsReprogramming,
      slotReason: slotCheck.reason,
      slotSync,
    })
  }

  const nextStatus = canonicalizeOrderStatus(status)

  if (!nextStatus) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }

  const wasCancelled = isCancelledOrderStatus(currentOrder.status)
  const willBeCancelled = isCancelledOrderStatus(nextStatus)

  const updatePayload: Record<string, unknown> = { status: nextStatus }

  if (willBeCancelled && !wasCancelled) {
    updatePayload.previous_status_before_cancel = canonicalizeOrderStatus(currentOrder.status) || currentOrder.status || 'nouvelle'
    updatePayload.cancelled_at = new Date().toISOString()
    updatePayload.purge_after = twoHoursFromNowIso()
  }

  if (!willBeCancelled) {
    updatePayload.previous_status_before_cancel = null
    updatePayload.cancelled_at = null
    updatePayload.purge_after = null
  }

  const { error } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('id', orderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let slotSync: Awaited<ReturnType<typeof syncDeliverySlotBookingFromOrders>> | null = null

  if (willBeCancelled && !wasCancelled) {
    slotSync = await syncDeliverySlotBookingFromOrders(currentOrder.slot_id)

    await supabase
      .from('order_deliveries')
      .update({ status: 'cancelled' })
      .eq('order_id', orderId)
      .neq('status', 'delivered')
  }

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    cancelled: willBeCancelled,
    slotSync,
  })
}
