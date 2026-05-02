import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendOrderNotification(order: any) {
  const itemsHtml = order.items?.map((i: any) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.quantity}× ${i.product_name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${(i.quantity * i.unit_price).toFixed(2)} DH</td></tr>`
  ).join('') || ''

  const toEmail = process.env.ADMIN_EMAIL || 'heupel.martial@gmail.com'
  try {
    await resend.emails.send({
      from: 'Black Deew <onboarding@resend.dev>',
      to: toEmail,
      subject: `🛒 Nouvelle commande — ${order.customer_name}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h1 style="color:#2D6A4F">🥙 Nouvelle commande Black Deew</h1>
          <p><strong>Client :</strong> ${order.customer_name}<br>
          <strong>Téléphone :</strong> <a href="tel:${order.customer_phone}">${order.customer_phone}</a><br>
          <strong>Adresse :</strong> ${order.customer_address}</p>
          ${order.lat && order.lng ? `<a href="https://www.google.com/maps?q=${order.lat},${order.lng}" style="display:inline-block;background:#2D6A4F;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;margin:8px 0">📍 Voir sur Google Maps</a>` : ''}
          ${order.customer_note ? `<p><strong>Note :</strong> ${order.customer_note}</p>` : ''}
          <p><strong>Créneau :</strong> ${order.slot?.date} de ${order.slot?.time_start?.slice(0,5)} à ${order.slot?.time_end?.slice(0,5)}</p>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left;padding:8px;background:#f5f5f0">Produit</th><th style="text-align:right;padding:8px;background:#f5f5f0">Prix</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <p style="font-size:18px;font-weight:700;color:#2D6A4F">Total : ${order.total?.toFixed(2)} DH — Cash à la livraison</p>
        </div>
      `
    })
  } catch (e) {
    console.error('Email error:', e)
    // SMS extension point — décommenter quand prêt
  }
}
