// BLAC-P3-066 : message WhatsApp "votre commande est en route" envoye par le livreur. Fonctions pures.
// BLAC-P3-077 : articles de la commande dans le message + helper du bouton "Prevenir le client".
import { buildWhatsAppHref } from '@/lib/phone-links'

export type EnRouteItem = {
  name?: string | null
  quantity?: number | null
}

export type EnRouteMessageInput = {
  customerName?: string | null
  driverName?: string | null
  driverPhone?: string | null
  trackingUrl?: string | null
  items?: EnRouteItem[] | null
}

export const EN_ROUTE_MAX_ITEMS = 8

function buildItemsLine(items: EnRouteItem[] | null | undefined): string | null {
  if (!Array.isArray(items)) return null
  const cleaned = items
    .map((it) => {
      const name = (it?.name || '').toString().trim()
      const q = Number(it?.quantity)
      const quantity = Number.isFinite(q) && q > 0 ? Math.round(q) : 1
      return { name, quantity }
    })
    .filter((it) => it.name.length > 0)
  if (cleaned.length === 0) return null
  const shown = cleaned.slice(0, EN_ROUTE_MAX_ITEMS).map((it) => `${it.quantity} x ${it.name}`)
  const extra = cleaned.length - EN_ROUTE_MAX_ITEMS
  const list = extra > 0 ? `${shown.join(', ')}, et ${extra} autre${extra > 1 ? 's' : ''}` : shown.join(', ')
  return `Votre commande : ${list}`
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
  const itemsLine = buildItemsLine(input.items)
  if (itemsLine) lines.push(itemsLine)
  if (trackingUrl) lines.push(`Suivez votre livreur en direct : ${trackingUrl}`)
  return lines.join('\n')
}

export function buildEnRouteWhatsAppUrl(input: { customerPhone?: string | null; message: string }): string | null {
  const phone = (input.customerPhone || '').trim()
  if (!phone || !/\d/.test(phone)) return null
  return buildWhatsAppHref(phone, input.message, { defaultCountryCode: '243' })
}

export type ShareTrackingResult = { ok: true } | { ok: false; error: string }

// Bouton "Prevenir le client et partager mon suivi" : appelle la route (chemin deja accepte) puis ouvre whatsappUrl.
export async function shareTrackingViaWhatsApp(deps: {
  deliveryId: string
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
  open: (url: string) => void
}): Promise<ShareTrackingResult> {
  try {
    const res = await deps.fetchImpl('/api/driver/accept-delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_id: deps.deliveryId }),
    })
    if (!res.ok) return { ok: false, error: "Le message n'a pas pu être préparé. Réessaie." }
    let data: { whatsappUrl?: unknown } | null = null
    try {
      data = (await res.json()) as { whatsappUrl?: unknown }
    } catch {
      data = null
    }
    const url = typeof data?.whatsappUrl === 'string' ? data.whatsappUrl : ''
    if (!url) return { ok: false, error: 'Numéro du client ou suivi indisponible. Réessaie.' }
    deps.open(url)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Connexion impossible. Réessaie.' }
  }
}
