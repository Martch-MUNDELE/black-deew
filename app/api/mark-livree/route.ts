import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isTestPhone } from '@/lib/test-orders'
import { markOrderDelivered } from '@/lib/mark-delivered'

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

  // BLAC-P3-051 : etapes 1 a 4 partagees avec la route livreur
  const result = await markOrderDelivered(supabase, orderId, total)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, driverSessionUpdated: result.driverSessionUpdated })
}
