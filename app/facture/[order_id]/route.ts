import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { FacturePDF } from '@/lib/pdf'
import { calculateOrderTaxSummary } from '@/lib/tax'
import { resolveTaxSettings } from '@/lib/tax-dev-override'
import { verifyFactureToken } from '@/lib/facture-token'
import type { ReactElement } from 'react'

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


function forceBlackDeewTaxSettings(settings: { taxEnabled: boolean; taxRate: number }) {
  if (settings.taxEnabled && settings.taxRate > 0) return settings
  return { taxEnabled: true, taxRate: 16 }
}

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
  const currency = settingsRows.find((s) => s.key === 'currency')?.value || 'DH'

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
  const hasClassicTaxableItems = orderItems.some((i) => !isVipOrderItem(i))
  const itemsForPdf = orderItems.filter((i) => !isVipOrderItem(i))

  // Garde-fou : commande 100 % VIP => pas de facturette PDF Black Deew.
  if (!hasClassicTaxableItems) {
    return new Response('Facturette non disponible pour une commande 100 % VIP', { status: 404 })
  }

  // Récapitulatif TVA — VIP facturable mais non taxable ; TVA extraite du TTC.
  const taxSettings = forceBlackDeewTaxSettings(resolveTaxSettings(settings))
  const taxLines = orderItems.map((i) => ({
    quantity: i.quantity ?? 0,
    unit_price: i.unit_price ?? 0,
    invoiceable: !isVipOrderItem(i),
    taxable: !isVipOrderItem(i),
  }))
  const summary = calculateOrderTaxSummary(taxLines, taxSettings, {
    deliveryFee: order.delivery_fee || 0,
    deliveryInvoiceable: hasClassicTaxableItems,
    deliveryTaxable: hasClassicTaxableItems,
  })
  const tax = { enabled: summary.taxEnabled, rate: summary.taxRate, ht: summary.ht, tax: summary.tax, ttc: summary.ttc, taxableTtc: summary.taxableTtc }

  const buffer = await renderToBuffer(
    FacturePDF({ order, items: itemsForPdf, slot, siteName, siteBaseline, factureNum, currency, tax }) as ReactElement<DocumentProps>
  )

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
    },
  })
}
