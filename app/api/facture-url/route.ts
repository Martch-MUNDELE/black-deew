import { NextRequest, NextResponse } from 'next/server'
import { generateFactureToken } from '@/lib/facture-token'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const order_id = req.nextUrl.searchParams.get('order_id')
  if (!order_id) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
  const token = generateFactureToken(order_id)
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://black-deew.vercel.app'
  const url = `${base}/facture/${order_id}?token=${token}`
  return NextResponse.json({ url })
}
