// BLAC-P3-066 : message WhatsApp "votre commande est en route" envoye par le livreur. Fonctions pures.
import { buildWhatsAppHref } from '@/lib/phone-links'

export type EnRouteMessageInput = {
  customerName?: string | null
  driverName?: string | null
  driverPhone?: string | null
  trackingUrl?: string | null
}

export function buildEnRouteMessage(input: EnRouteMessageInput): string {
  const customer = (input.customerName || '').trim()
  const driverName = (input.driverName || '').trim()
  const driverPhone = (input.driverPhone || '').trim()
  const trackingUrl = (input.trackingUrl || '').trim()

  const lines: string[] = [
    `Bonjour${customer ? ' ' + customer : ''}, votre commande Black Deew est en route ! Notre livreur arrive bientot chez vous.`,
  ]
  const driverParts: string[] = []
  if (driverName) driverParts.push(`Votre livreur : ${driverName}`)
  if (driverPhone) driverParts.push(`Tel : ${driverPhone}`)
  if (driverParts.length > 0) lines.push(driverParts.join(' - '))
  if (trackingUrl) lines.push(`Suivez votre livreur en direct : ${trackingUrl}`)
  return lines.join('\n')
}

export function buildEnRouteWhatsAppUrl(input: { customerPhone?: string | null; message: string }): string | null {
  const phone = (input.customerPhone || '').trim()
  if (!phone || !/\d/.test(phone)) return null
  return buildWhatsAppHref(phone, input.message, { defaultCountryCode: '243' })
}
