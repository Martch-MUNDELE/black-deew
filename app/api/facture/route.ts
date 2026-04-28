import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { FacturePDF } from '@/lib/pdf'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { order_id } = await req.json()

  const { data: order } = await supabase.from('orders').select('*, order_items(*)').eq('id', order_id).single()
  if (!order || !order.customer_email) return NextResponse.json({ error: "Pas d'email" }, { status: 400 })

  let slot = null
  if (order.slot_id) {
    const { data } = await supabase.from('delivery_slots').select('*').eq('id', order.slot_id).single()
    slot = data
  }

  // Numéro de facture BD-YYYYMMDD-NNNN
  const today = new Date().toISOString().split('T')[0]
  const { count: orderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today + 'T00:00:00.000Z')
    .lte('created_at', today + 'T23:59:59.999Z')
  const seqNum = String((orderCount ?? 0) + 1).padStart(4, '0')
  const dateStr = today.replace(/-/g, '')
  const factureNum = `BD-${dateStr}-${seqNum}`

  const { data: settings } = await supabase.from('settings').select('*')
  const logoUrl = settings?.find((s: any) => s.key === 'site_logo')?.value || ''
  const siteName = settings?.find((s: any) => s.key === 'site_name')?.value || 'Black Deew'
  const siteBaseline = settings?.find((s: any) => s.key === 'site_baseline')?.value || 'AGADIR · LIVRAISON'

  // Stocker le numéro de facture en base
  await supabase.from('orders').update({ invoice_number: factureNum }).eq('id', order_id)

  const pdfBuffer = await renderToBuffer(
    FacturePDF({ order, items: order.order_items, slot, siteName, siteBaseline, factureNum }) as any
  )

  await resend.emails.send({
    from: 'Black Deew <onboarding@resend.dev>',
    to: order.customer_email,
    subject: `🧾 Facture ${factureNum} — ${siteName}`,
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0A0804;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(232,160,32,0.15);padding-bottom:20px;margin-bottom:0">
      <tr>
        <td width="56" valign="middle">
          <img src="${logoUrl}" alt="${siteName}" width="52" height="52" style="display:block" onerror="this.style.display='none'" />
        </td>
        <td width="12"></td>
        <td valign="middle">
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#F5C842;letter-spacing:-0.5px;line-height:1">${siteName}</div>
          <div style="font-size:9px;color:#C8B99A;letter-spacing:3px;text-transform:uppercase;margin-top:4px">${siteBaseline}</div>
        </td>
      </tr>
    </table>
    <div style="padding:28px 0">
      <p style="color:#C8B99A;font-size:14px;margin:0 0 8px">Bonjour <strong style="color:#F5EDD6">${order.customer_name}</strong>,</p>
      <p style="color:#C8B99A;font-size:14px;margin:0 0 24px;line-height:1.6">Merci pour votre commande ! Veuillez trouver ci-joint votre facture.</p>
      <div style="background:rgba(232,160,32,0.06);border:1px solid rgba(232,160,32,0.15);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
        <div style="font-size:11px;color:#E8A020;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Total de votre commande</div>
        <div style="font-family:Georgia,serif;font-size:36px;font-weight:900;color:#F5C842">${order.total.toFixed(2)} <span style="font-size:16px">DH</span></div>
        ${order.delivery_mode === 'pickup' ? `<div style="font-size:12px;color:#5BC57A;margin-top:6px">Retrait sur place — Frais : Gratuit</div>` : order.delivery_fee > 0 ? `<div style="font-size:12px;color:#C8B99A;margin-top:6px">Sous-total : ${(order.total - order.delivery_fee).toFixed(2)} DH &nbsp;|&nbsp; Frais de livraison : <span style="color:#F5C842;font-weight:700">${order.delivery_fee.toFixed(2)} DH</span></div>` : `<div style="font-size:12px;color:#5BC57A;margin-top:6px">Livraison gratuite</div>`}
        <div style="font-size:12px;color:#888;margin-top:4px">Paiement à la livraison en cash</div>
      </div>
      <p style="color:#7A6E58;font-size:12px;line-height:1.6;margin:0">
        Votre facture PDF est jointe à cet email. Notre équipe prépare votre commande avec soin et vous livrera dans les meilleurs délais.
      </p>
    </div>
    <div style="border-top:1px solid rgba(232,160,32,0.1);padding-top:20px;text-align:center">
      <div style="font-size:11px;color:#555;line-height:1.8">
        ${siteName} — Agadir, Maroc<br>
        <span style="color:#E8A020">Saveurs du Souss, livrées chez toi.</span>
      </div>
    </div>
  </div>
</body>
</html>`,
    attachments: [{ filename: `${factureNum}.pdf`, content: pdfBuffer }]
  })

  return NextResponse.json({ success: true })
}
