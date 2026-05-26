import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { FacturePDF } from '@/lib/pdf'
import { verifyFactureToken } from '@/lib/facture-token'
import type { ReactElement } from 'react'

export const dynamic = 'force-dynamic'

type SettingRow = {
  key: string
  value: string | null
}

type OrderItemRow = {
  is_vip?: boolean | null
  quantity?: number | null
  unit_price?: number | null
  product_id?: string | null
  product_name?: string | null
}


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ order_id: string }> }
) {
  const { order_id } = await params
  const token = new URL(req.url).searchParams.get('token')

  if (!token || !verifyFactureToken(order_id, token)) {
    return new Response('Lien expiré', { status: 403 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', order_id)
    .single()

  if (!order) return new Response('Commande introuvable', { status: 404 })

  let slot = null
  if (order.slot_id) {
    const { data } = await supabase
      .from('delivery_slots')
      .select('*')
      .eq('id', order.slot_id)
      .single()
    slot = data
  }

  const { data: settings } = await supabase.from('settings').select('*')
  const settingsRows = (settings || []) as SettingRow[]
  const siteName = settingsRows.find((s) => s.key === 'site_name')?.value || 'Black Deew'
  const siteBaseline = settingsRows.find((s) => s.key === 'site_baseline')?.value || 'Kinshasa · Livraison à domicile'

  let factureNum = order.invoice_number
  if (!factureNum) {
    const today = new Date().toISOString().split('T')[0]
    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00.000Z')
      .lte('created_at', today + 'T23:59:59.999Z')
    const seqNum = String((orderCount ?? 0) + 1).padStart(4, '0')
    factureNum = `BD-${today.replace(/-/g, '')}-${seqNum}`
  }

  const orderItems = (order.order_items || []) as OrderItemRow[]
  const itemsForPdf = orderItems.filter((i) => !i.is_vip)

  const buffer = await renderToBuffer(
    FacturePDF({ order, items: itemsForPdf, slot, siteName, siteBaseline, factureNum }) as ReactElement<DocumentProps>
  )

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
    },
  })
}
