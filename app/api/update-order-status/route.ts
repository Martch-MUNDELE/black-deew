import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_STATUSES = ['nouvelle', 'confirmée', 'en_preparation', 'en_livraison', 'livrée', 'annulée']

export async function POST(req: NextRequest) {
  const { orderId, status } = await req.json()
  if (!orderId || !status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
