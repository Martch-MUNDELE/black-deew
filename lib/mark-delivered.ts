// BLAC-P3-051 : logique "marquer livree" partagee entre la route admin (/api/mark-livree)
// et la route livreur (/api/driver/mark-delivered). Aucune suppression de commande ici :
// la branche numero de test reste dans la route admin.
import type { SupabaseClient } from '@supabase/supabase-js'
import { recalculatePeriodCore } from '@/app/actions/billing'
import {
  addStockMovement,
  listCashMovements,
  listStockMovements,
  sessionCashSummary,
} from '@/lib/driver-ledger-data'
import { vipQuantities, type OrderLineInput } from '@/lib/driver-stock-alert'
import type { LedgerDelivery } from '@/lib/driver-ledger'

export type MarkDeliveredResult =
  | { ok: true; driverSessionUpdated: boolean }
  | { ok: false; status: number; error: string }

export async function markOrderDelivered(
  supabase: SupabaseClient,
  orderId: string,
  total: number
): Promise<MarkDeliveredResult> {
  // Statut actuel pour l'historique
  const { data: currentOrderRow } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .maybeSingle()

  // 1. orders.status -> livrée
  const { error: orderErr } = await supabase
    .from('orders')
    .update({ status: 'livrée' })
    .eq('id', orderId)
  if (orderErr) return { ok: false, status: 500, error: `orders: ${orderErr.message}` }

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
  if (delErr) return { ok: false, status: 500, error: `order_deliveries: ${delErr.message}` }

  const driverId = updatedDel?.[0]?.driver_id
  if (!driverId) return { ok: true, driverSessionUpdated: false }

  // 3. Session ouverte du livreur
  const { data: sess } = await supabase
    .from('driver_sessions')
    .select('*')
    .eq('driver_id', driverId)
    .eq('session_status', 'open')
    .maybeSingle()
  if (!sess?.id) return { ok: true, driverSessionUpdated: false }

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
  if (sessErr) return { ok: false, status: 500, error: `driver_sessions: ${sessErr.message}` }

  return { ok: true, driverSessionUpdated: true }
}
