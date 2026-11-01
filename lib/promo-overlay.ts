// BLAC-P3-010 : logique pure de l'overlay promotionnel (aucun acces DOM, reseau ni base)
export type PromoSurface = 'classic' | 'vip'

export type OverlayPromotion = {
  id: string
  name: string
  customer_message?: string | null
  benefit_type?: string | null
  discount_percent?: number | string | null
  fixed_discount_amount?: number | string | null
  scope?: string | null
  priority?: number | string | null
  status?: string | null
  starts_at?: string | null
  ends_at?: string | null
  promotion_mode?: string | null
  code?: string | null
}

export const PROMO_OVERLAY_STORAGE_KEY = 'black-deew:promo-overlay:dismissed'

function toNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function scopeMatches(scope: unknown, surface: PromoSurface): boolean {
  if (scope === 'all' || scope === 'mixed') return true
  return scope === surface
}

function timeOk(value: unknown, now: number, kind: 'start' | 'end'): boolean {
  if (value === null || value === undefined || value === '') return true
  if (typeof value !== 'string') return false
  const t = new Date(value).getTime()
  if (!Number.isFinite(t)) return false
  return kind === 'start' ? t <= now : t >= now
}

// Valeur d'avantage servant au classement "la plus avantageuse"
export function promotionAdvantage(promo: OverlayPromotion): number {
  const percent = toNum(promo.discount_percent)
  if (promo.benefit_type === 'percent_discount' && percent !== null) return percent
  if (promo.benefit_type === 'fixed_discount') return toNum(promo.fixed_discount_amount) ?? 0
  return percent ?? 0
}

export function isEligiblePromotion(
  raw: unknown,
  surface: PromoSurface,
  dismissedIds: readonly string[] = [],
  now: number = Date.now(),
): raw is OverlayPromotion {
  if (!isRecord(raw)) return false
  if (typeof raw.id !== 'string' || raw.id === '') return false
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return false
  if (dismissedIds.includes(raw.id)) return false
  if (!scopeMatches(raw.scope, surface)) return false
  if (raw.status !== undefined && raw.status !== null && raw.status !== 'active') return false
  if (raw.promotion_mode === 'promo_code') return false
  if (typeof raw.code === 'string' && raw.code !== '') return false
  if (!timeOk(raw.starts_at, now, 'start')) return false
  if (!timeOk(raw.ends_at, now, 'end')) return false
  return true
}

// Choisit UNE promotion : priorite (plus petit nombre d'abord, sinon ordre de la route publique),
// puis avantage le plus eleve. Ne leve jamais d'erreur.
export function selectPromotionForSurface(
  list: unknown,
  surface: PromoSurface,
  dismissedIds: readonly string[] = [],
  now: number = Date.now(),
): OverlayPromotion | null {
  try {
    if (!Array.isArray(list)) return null
    const dismissed = Array.isArray(dismissedIds) ? dismissedIds : []
    const candidates: { promo: OverlayPromotion; index: number; priority: number; advantage: number }[] = []
    list.forEach((item, index) => {
      if (!isEligiblePromotion(item, surface, dismissed, now)) return
      candidates.push({
        promo: item,
        index,
        priority: toNum(item.priority) ?? index,
        advantage: promotionAdvantage(item),
      })
    })
    if (candidates.length === 0) return null
    candidates.sort((a, b) => a.priority - b.priority || b.advantage - a.advantage || a.index - b.index)
    return candidates[0].promo
  } catch {
    return null
  }
}

// Surface selon le chemin : accueil = classic, /vip = vip, tout le reste (panier, confirmation, admin, reset) = aucune
export function getOverlaySurface(pathname: string | null | undefined): PromoSurface | null {
  if (typeof pathname !== 'string') return null
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (p === '/') return 'classic'
  if (p === '/vip') return 'vip'
  return null
}

export function parseDismissedIds(raw: string | null | undefined): string[] {
  if (typeof raw !== 'string' || raw === '') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function addDismissedId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id]
}

// Texte du grand badge
export function formatPromotionBadge(promo: OverlayPromotion): { value: number | null; text: string; suffix: string } {
  if (promo.benefit_type === 'percent_discount') {
    const v = toNum(promo.discount_percent)
    if (v !== null && v > 0) return { value: v, text: `-${v}%`, suffix: '%' }
  }
  if (promo.benefit_type === 'fixed_discount') {
    const v = toNum(promo.fixed_discount_amount)
    if (v !== null && v > 0) return { value: v, text: `-${v}`, suffix: '' }
  }
  if (promo.benefit_type === 'free_delivery') return { value: null, text: 'LIVRAISON OFFERTE', suffix: '' }
  if (promo.benefit_type === 'gift_product') return { value: null, text: 'CADEAU OFFERT', suffix: '' }
  return { value: null, text: 'OFFRE SPECIALE', suffix: '' }
}
