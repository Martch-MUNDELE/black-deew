// BLAC-P2-027 : page publique d'une offre de campagne (apercu WhatsApp via Open Graph).
// Logique pure (sans next/server). N'expose que le contenu de la campagne et le nom de sa promotion.
// Table absente ou en erreur : null, jamais d'exception.
import { STOP_LINE, isValidCampaignImageUrl } from '@/lib/campaigns'
import { isRuleActiveAt } from '@/lib/promotion-rules'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PublicDb = { from: (table: string) => any }

export type PublicCampaign = {
  name: string
  message: string
  promotionName: string | null
  startsAt: string | null
  endsAt: string | null
  imageUrl?: string | null
}

// BLAC-P3-015 : image d'apercu (Open Graph / WhatsApp). Image de la campagne si https, sinon repli.
export function resolveCampaignOgImage(imageUrl: unknown, fallback: string): string {
  return isValidCampaignImageUrl(imageUrl) ? imageUrl.trim() : fallback
}

// Adresse de base du site (meme regle que app/actions/facture.ts), sans barre finale.
export function getSiteBase(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://black-deew.vercel.app' : 'http://localhost:3104')
  return base.replace(/\/+$/, '')
}

export function buildCampaignPublicUrl(campaignId: string): string {
  return `${getSiteBase()}/offre?c=${encodeURIComponent(String(campaignId ?? '').trim())}`
}

// Message public : la ligne STOP n'a pas de sens sur une page web.
export function stripStopLine(message: string): string {
  return String(message ?? '').split(STOP_LINE).join('').trim()
}

export async function loadPublicCampaign(
  db: PublicDb,
  campaignId: string,
  now: number = Date.now(),
): Promise<PublicCampaign | null> {
  const id = typeof campaignId === 'string' ? campaignId.trim() : ''
  if (!id) return null
  try {
    let { data, error } = await db
      .from('campaigns')
      .select('id, name, promotion_id, message, starts_at, ends_at, status, image_url')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      // Colonne image absente (ou autre erreur) : relecture sans image_url, image vide.
      const retry = await db
        .from('campaigns')
        .select('id, name, promotion_id, message, starts_at, ends_at, status')
        .eq('id', id)
        .maybeSingle()
      data = retry.data
      error = retry.error
    }
    if (error || !data) return null
    if (data.status !== 'ready') return null
    if (!isRuleActiveAt({ starts_at: data.starts_at ?? null, ends_at: data.ends_at ?? null }, now)) return null

    let promotionName: string | null = null
    if (typeof data.promotion_id === 'string' && data.promotion_id) {
      const { data: rule, error: ruleErr } = await db
        .from('promotion_rules')
        .select('id, name')
        .eq('id', data.promotion_id)
        .maybeSingle()
      if (!ruleErr && rule && typeof rule.name === 'string' && rule.name.trim()) promotionName = rule.name.trim()
    }

    return {
      name: String(data.name ?? ''),
      message: stripStopLine(String(data.message ?? '')),
      promotionName,
      startsAt: data.starts_at ?? null,
      endsAt: data.ends_at ?? null,
      // Cle presente seulement si une image https valide existe (forme de retour inchangee sinon).
      ...(isValidCampaignImageUrl(data.image_url) ? { imageUrl: data.image_url.trim() } : {}),
    }
  } catch {
    return null
  }
}
