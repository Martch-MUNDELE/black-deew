import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendOrderNotification(order: any, currency = 'DH', siteName = 'NOM_CLIENT', adminEmail?: string) {
  const standardItems = order.items?.filter((i: any) => !i.isVip) ?? order.items ?? []

  const itemsHtml = standardItems.map((i: any) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(245,200,66,0.1);color:#F5EDD6;font-size:14px">${i.quantity}× ${i.product_name}</td>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(245,200,66,0.1);color:#F5C842;font-size:14px;font-weight:700;text-align:right">${(i.quantity * i.unit_price).toFixed(2)} ${currency}</td>
    </tr>`
  ).join('')

  const deliveryFee = order.delivery_fee ?? 0
  const standardTotal = standardItems.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
  const totalWithDelivery = standardTotal + deliveryFee

  const vipItems = order.vipItems ?? []
  const vipTotal = order.vipTotal ?? 0
  const vipHtml = vipItems.length > 0 ? `
    <tr>
      <td colspan="2" style="padding:12px 16px;border-bottom:1px solid rgba(245,200,66,0.1)">
        <span style="background:rgba(245,200,66,0.15);color:#F5C842;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.5px">VIP</span>
        <span style="color:#C8B99A;font-size:13px;margin-left:8px">${vipItems.length} article(s) — ${vipTotal.toFixed(2)} ${currency}</span>
      </td>
    </tr>` : ''

  const mapsBtn = order.lat && order.lng
    ? `<a href="https://www.google.com/maps?q=${order.lat},${order.lng}" style="display:inline-block;background:linear-gradient(135deg,#F5C842,#E8A020);color:#080603;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;margin:16px 0">Voir sur Google Maps</a>`
    : ''

  const noteHtml = order.customer_note
    ? `<div style="background:rgba(245,200,66,0.07);border-left:3px solid #F5C842;padding:10px 14px;border-radius:0 6px 6px 0;margin:12px 0">
        <span style="color:#C8B99A;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Note client</span>
        <p style="color:#F5EDD6;font-size:14px;margin:4px 0 0">${order.customer_note}</p>
       </div>`
    : ''

  const toEmail = adminEmail || process.env.ADMIN_EMAIL || 'heupel.martial@gmail.com'

  try {
    await resend.emails.send({
      from: `${siteName} <onboarding@resend.dev>`,
      to: toEmail,
      subject: `Nouvelle commande — ${order.customer_name}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080603">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px;font-family:'DM Sans',Arial,sans-serif">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#131009,#1a1408);border:1px solid rgba(245,200,66,0.2);border-radius:16px 16px 0 0;padding:24px;text-align:center">
      <div style="font-size:11px;font-weight:700;color:#E8A020;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">${siteName}</div>
      <div style="font-size:22px;font-weight:800;color:#F5C842">Nouvelle commande</div>
      <div style="font-size:13px;color:#C8B99A;margin-top:4px">${order.invoice_number ?? ''}</div>
    </div>

    <!-- Client -->
    <div style="background:#131009;border:1px solid rgba(245,200,66,0.1);border-top:none;padding:20px 24px">
      <div style="font-size:11px;font-weight:700;color:#E8A020;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Client</div>
      <div style="color:#F5EDD6;font-size:15px;font-weight:700;margin-bottom:4px">${order.customer_name}</div>
      <a href="tel:${order.customer_phone}" style="color:#F5C842;font-size:14px;text-decoration:none">${order.customer_phone}</a>
      <div style="color:#C8B99A;font-size:13px;margin-top:4px">${order.customer_address}</div>
      ${mapsBtn}
      ${noteHtml}
    </div>

    <!-- Créneau -->
    <div style="background:#131009;border:1px solid rgba(245,200,66,0.1);border-top:none;padding:16px 24px">
      <div style="font-size:11px;font-weight:700;color:#E8A020;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Créneau</div>
      <div style="color:#F5EDD6;font-size:14px">${order.slot?.date ?? ''} &nbsp;·&nbsp; ${order.slot?.time_start?.slice(0,5) ?? ''} – ${order.slot?.time_end?.slice(0,5) ?? ''}</div>
    </div>

    <!-- Commande -->
    <div style="background:#131009;border:1px solid rgba(245,200,66,0.1);border-top:none;border-radius:0 0 16px 16px;overflow:hidden">
      <div style="padding:16px 24px 8px">
        <div style="font-size:11px;font-weight:700;color:#E8A020;letter-spacing:1.5px;text-transform:uppercase">Commande</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>
          ${itemsHtml}
          ${vipHtml}
          ${deliveryFee > 0 ? `<tr><td style="padding:12px 16px;color:#C8B99A;font-size:13px">Livraison</td><td style="padding:12px 16px;color:#C8B99A;font-size:13px;text-align:right">${deliveryFee.toFixed(2)} ${currency}</td></tr>` : ''}
        </tbody>
        <tfoot>
          <tr style="background:rgba(245,200,66,0.08)">
            <td style="padding:14px 16px;color:#F5C842;font-size:15px;font-weight:800">Total</td>
            <td style="padding:14px 16px;color:#F5C842;font-size:15px;font-weight:800;text-align:right">${totalWithDelivery.toFixed(2)} ${currency}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0 8px">
      <div style="font-size:11px;color:rgba(200,185,154,0.4);letter-spacing:1px">${siteName} · Paiement à la livraison</div>
    </div>

  </div>
</body>
</html>`
    })
  } catch (e) {
    console.error('Notification error:', e)
  }
}
