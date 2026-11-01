// BLAC-P3-012 : declencheurs de promotion permis selon le perimetre (logique pure, sans acces base)
import type { PromotionScope, PromotionTriggerType } from './types/promotion'

export type SelectableTriggerType = Exclude<PromotionTriggerType, 'promo_code'>

export const DEFAULT_PROMOTION_TRIGGER: SelectableTriggerType = 'cart_amount'

export const PROMOTION_TRIGGERS_BY_SCOPE: Record<PromotionScope, readonly SelectableTriggerType[]> = {
  all: ['cart_amount', 'cart_quantity', 'classic_purchase', 'vip_purchase', 'mixed_purchase', 'product', 'category'],
  classic: ['cart_amount', 'cart_quantity', 'classic_purchase', 'product', 'category'],
  vip: ['cart_amount', 'cart_quantity', 'vip_purchase', 'product', 'category'],
  mixed: ['cart_amount', 'cart_quantity', 'mixed_purchase', 'product', 'category'],
}

export function getAllowedTriggers(scope: PromotionScope | string | null | undefined): readonly SelectableTriggerType[] {
  if (scope && Object.prototype.hasOwnProperty.call(PROMOTION_TRIGGERS_BY_SCOPE, scope)) {
    return PROMOTION_TRIGGERS_BY_SCOPE[scope as PromotionScope]
  }
  return []
}

export function isTriggerAllowedForScope(
  scope: PromotionScope | string | null | undefined,
  trigger: PromotionTriggerType | string | null | undefined,
): boolean {
  return getAllowedTriggers(scope).includes(trigger as SelectableTriggerType)
}

// Renvoie le declencheur conserve s il est permis, sinon le declencheur par defaut (le montant).
export function getDefaultTriggerForScope(
  scope: PromotionScope | string | null | undefined,
  currentTrigger?: PromotionTriggerType | string | null,
): SelectableTriggerType {
  if (currentTrigger && isTriggerAllowedForScope(scope, currentTrigger)) return currentTrigger as SelectableTriggerType
  return DEFAULT_PROMOTION_TRIGGER
}

export const TRIGGER_LABELS_FR: Record<SelectableTriggerType, string> = {
  cart_amount: 'Panier a partir d un montant',
  cart_quantity: 'Quantite minimum',
  classic_purchase: 'Achat classique',
  vip_purchase: 'Achat VIP',
  mixed_purchase: 'Achat mixte',
  product: 'Produit precis',
  category: 'Categorie',
}

export const SCOPE_LABELS_FR: Record<PromotionScope, string> = {
  all: 'Tous les paniers',
  classic: 'Ventes classiques',
  vip: 'Ventes VIP',
  mixed: 'Ventes mixtes',
}

export function describeTriggerScopeMismatch(
  scope: PromotionScope | string | null | undefined,
  trigger: PromotionTriggerType | string | null | undefined,
): string | null {
  if (isTriggerAllowedForScope(scope, trigger)) return null
  const t = TRIGGER_LABELS_FR[trigger as SelectableTriggerType] ?? String(trigger)
  const s = SCOPE_LABELS_FR[scope as PromotionScope] ?? String(scope)
  return `Le declencheur "${t}" n existe pas pour le perimetre "${s}" : cette promotion ne pourrait jamais se declencher.`
}
