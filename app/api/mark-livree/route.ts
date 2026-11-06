import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { recalculatePeriodCore } from '@/app/actions/billing'
import { isTestPhone } from '@/lib/test-orders'
import {
  addStockMovement,
  listCashMovements,
  listStockMovements,
  sessionCashSummary,
} from '@/lib/driver-ledger-data'
import { vipQuantities, type OrderLineInput } from '@/lib/driver-stock-alert'
import type { LedgerDelivery } from '@/lib/driver-ledger'

type MarkLivreeRequestBody = {
  orderId?: string
  total?: number
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Finition VIP : action reservee aux administrateurs (verifiee cote serveur)
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
  }
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
  })().catch(() => {})

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

  // 3. Session ouverte du livreur
  const { data: sess } = await supabase
    .from('driver_sessions')
    .select('*')
    .eq('driver_id', driverId)
    .eq('session_status', 'open')
    .maybeSingle()
  if (!sess?.id) return NextResponse.json({ ok: true, driverSessionUpdated: false })

  // BLAC-P3-034 : stock VIP embarque - mouvement delivered par produit VIP (idempotent).
  // N'ecrit QUE dans le journal du livreur ; products.stock n'est jamais touche ici.
  // Un echec est journalise cote serveur et ne bloque jamais la livraison.
  try {
    const { data: itemRows } = await supabase.from('order_items').select('*').eq('order_id', orderId)
    const wanted = vipQuantities((itemRows || []) as OrderLineInput[])
    const productIds = Object.keys(wanted)
    if (productIds.length > 0) {
      const existing = await listStockMovements(supabase, sess.id)
      for (const productId of productIds) {
        const already = existing.some(
          (m) => m.kind === 'delivered' && m.order_id === orderId && m.product_id === productId
        )
        if (already) continue
        try {
          await addStockMovement(supabase, {
            session_id: sess.id,
            driver_id: driverId,
            product_id: productId,
            kind: 'delivered',
            quantity: wanted[productId],
            order_id: orderId,
          })
        } catch (e) {
          console.error('[mark-livree] journal stock VIP non ecrit', orderId, productId, e)
        }
      }
    }
  } catch (e) {
    console.error('[mark-livree] journal stock VIP en echec', orderId, e)
  }

  // 4. Recalcul driver_sessions.collected_cash + net_to_remit sur les livraisons de la SESSION,
  //    avec le fonds reel (ouverture + complements du journal ; repli sur opening_cash sans journal)
  const { data: deliveries } = await supabase
    .from('order_deliveries')
    .select('*')
    .eq('driver_id', driverId)
    .eq('status', 'delivered')
  let cashMovements: Awaited<ReturnType<typeof listCashMovements>> | undefined
  try {
    cashMovements = await listCashMovements(supabase, sess.id)
  } catch (e) {
    console.error('[mark-livree] journal monnaie illisible, repli sur opening_cash', e)
  }
  const cash = sessionCashSummary(
    {
      driver_id: driverId,
      started_at: sess.started_at,
      closed_at: sess.closed_at ?? null,
      opening_cash: Number(sess.opening_cash) || 0,
    },
    (deliveries || []) as LedgerDelivery[],
    cashMovements
  )
  const { error: sessErr } = await supabase.from('driver_sessions').update({
    collected_cash: cash.collected,
    net_to_remit: cash.netToRemit,
  }).eq('id', sess.id)
  if (sessErr) return NextResponse.json({ error: `driver_sessions: ${sessErr.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, driverSessionUpdated: true })
}
