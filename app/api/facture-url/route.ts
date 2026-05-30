import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generateFactureToken } from '@/lib/facture-token'

type VipAwareOrderItem = {
  is_vip?: boolean | null
  name?: string | null
  product_name?: string | null
  product_title?: string | null
  title?: string | null
  slug?: string | null
  category?: string | null
  type?: string | null
  tag?: string | null
  subcategory?: string | null
  product?: {
    is_vip?: boolean | null
    name?: string | null
    product_name?: string | null
    product_title?: string | null
    title?: string | null
    slug?: string | null
    category?: string | null
    type?: string | null
    tag?: string | null
    subcategory?: string | null
  } | null
}

function isVipOrderItem(item: VipAwareOrderItem) {
  const searchText = [
    item.name,
    item.product_name,
    item.product_title,
    item.title,
    item.slug,
    item.category,
    item.type,
    item.tag,
    item.subcategory,
    item.product?.name,
    item.product?.product_name,
    item.product?.product_title,
    item.product?.title,
    item.product?.slug,
    item.product?.category,
    item.product?.type,
    item.product?.tag,
    item.product?.subcategory,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const isBlackBox = /\bblack\s*box\b/.test(searchText) || searchText.includes('blackbox')
  const isVipText = searchText.includes('vip')

  return Boolean(item.is_vip ?? item.product?.is_vip) || isBlackBox || isVipText
}


function getRequestBaseUrl(req: Request) {
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const forwardedHost = req.headers.get('x-forwarded-host')
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`
  return new URL(req.url).origin
}

export const dynamic = 'force-dynamic'

type OrderItemRow = { is_vip?: boolean | null }

export async function GET(req: NextRequest) {
  const order_id = req.nextUrl.searchParams.get('order_id')
  if (!order_id) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

  // Pas de lien facturette si la commande est 100 % VIP.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_items(is_vip)')
    .eq('id', order_id)
    .single()
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
  const orderItems = (order.order_items || []) as OrderItemRow[]
  if (!orderItems.some((i) => !isVipOrderItem(i))) {
    return NextResponse.json({ error: 'Facturette non disponible pour une commande 100 % VIP' }, { status: 400 })
  }

  const token = generateFactureToken(order_id)
  const base = getRequestBaseUrl(req)
  const url = `${base}/facture/${order_id}?token=${token}`
  return NextResponse.json({ url })
}
