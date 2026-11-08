// BLAC-P3-050 : notifie le livreur assigne a une commande (reserve a l'admin).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminRole } from '@/lib/admin-role-server'
import { buildAssignmentPush, sendDriverPush } from '@/lib/driver-push'

export async function POST(req: NextRequest) {
  const info = await getAdminRole()
  if (!info) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (info.role === 'driver') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const body = await req.json().catch(() => null)
    const orderId = typeof body?.order_id === 'string' ? body.order_id.trim() : ''
    if (!orderId) return NextResponse.json({ error: 'order_id requis' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      console.warn('[notify-assignment] configuration serveur absente')
      return NextResponse.json({ sent: 0 })
    }
    const supabase = createClient(url, serviceKey)

    // Le livreur est relu cote serveur : jamais un driver_id venu du client.
    const { data: order } = await supabase
      .from('orders')
      .select('driver_id, slot_id')
      .eq('id', orderId)
      .maybeSingle()
    if (!order?.driver_id) return NextResponse.json({ sent: 0 })

    let slot = null
    if (order.slot_id) {
      const { data } = await supabase
        .from('delivery_slots')
        .select('date, time_start, time_end')
        .eq('id', order.slot_id)
        .maybeSingle()
      slot = data
    }

    const result = await sendDriverPush(String(order.driver_id), buildAssignmentPush(slot))
    return NextResponse.json(result)
  } catch (err) {
    console.error('[notify-assignment]', err)
    return NextResponse.json({ sent: 0 })
  }
}
