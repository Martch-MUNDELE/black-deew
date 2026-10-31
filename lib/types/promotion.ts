export type PromotionStatus = 'draft' | 'active' | 'inactive'

export type PromotionScope = 'all' | 'classic' | 'vip' | 'mixed'

export type PromotionTriggerType =
  | 'cart_amount'
  | 'cart_quantity'
  | 'product'
  | 'category'
  | 'vip_purchase'
  | 'classic_purchase'
  | 'mixed_purchase'
  | 'promo_code'

export type PromotionBenefitType = 'gift_product' | 'percent_discount' | 'free_delivery' | 'fixed_discount'

export type PromotionStackingMode =
  | 'exclusive'
  | 'best_offer'
  | 'cumulable_gift_only'
  | 'cumulable_discount_only'

export type PromotionLineType = 'classic' | 'vip' | 'promotion_gift'

export type PromotionRejectionReason =
  | 'promotion_inactive'
  | 'promotion_not_started'
  | 'promotion_expired'
  | 'scope_not_matched'
  | 'trigger_not_matched'
  | 'no_eligible_line'
  | 'gift_product_not_found'
  | 'gift_product_not_eligible'
  | 'discount_product_already_discounted'
  | 'discount_value_invalid'
  | 'site_vip_disabled'
  | 'promo_code_missing'
  | 'promo_code_invalid'
  | 'promo_code_expired'
  | 'benefit_not_supported'
  | 'benefit_configuration_invalid'

export interface PromotionProductCandidate {
  id: string
  name?: string | null
  price?: number | string | null
  subcategory?: string | null
  category?: string | null
  active?: boolean | null
  is_visible?: boolean | null
  visible?: boolean | null
  hidden?: boolean | null
  disabled?: boolean | null
  available?: boolean | null
  stock?: number | null
  discount?: number | string | null
  is_vip?: boolean | null
  isVip?: boolean | null
}

export interface PromotionCartLine {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  product?: PromotionProductCandidate | null
  is_vip?: boolean | null
  isVip?: boolean | null
  line_type?: PromotionLineType
  original_unit_price?: number
  discount_percent?: number | null
  discount_amount?: number | null
  is_promotion_gift?: boolean
  promotion_rule_id?: string | null
  promotion_label?: string | null
  can_trigger_promotion?: boolean
}

export interface PromotionRule {
  id: string
  name: string
  description?: string | null
  status: PromotionStatus
  starts_at?: string | null
  ends_at?: string | null
  priority?: number | null
  scope: PromotionScope
  trigger_type: PromotionTriggerType
  trigger_product_ids?: string[] | null
  trigger_category_ids?: string[] | null
  minimum_order_amount?: number | null
  minimum_quantity?: number | null
  benefit_type: PromotionBenefitType
  gift_product_ids?: string[] | null
  discount_percent?: number | null
  exclude_discounted_products?: boolean | null
  stacking_mode?: PromotionStackingMode | null
  customer_message?: string | null
  admin_note?: string | null
}

export interface PromotionEngineContext {
  now?: Date
  vipEnabled?: boolean
  currency?: string
}

export interface PromotionAppliedBenefit {
  promotion_id: string
  promotion_name: string
  benefit_type: PromotionBenefitType
  amount: number
  gift_product_ids: string[]
  affected_product_ids: string[]
  promotion_benefit_id?: string | null
  promo_code?: string | null
  free_delivery_applied?: boolean
  delivery_discount_amount?: number
}

export interface PromotionRejected {
  promotion_id: string
  promotion_name: string
  reason: PromotionRejectionReason
  detail?: string
}

export interface PromotionApplicationResult {
  items: PromotionCartLine[]
  applied: PromotionAppliedBenefit[]
  rejected: PromotionRejected[]
  discount_total: number
  gift_total_value: number
  free_delivery_applied?: boolean
  delivery_discount_amount?: number
  applied_promo_code?: string | null
}


// BF-P2-001 LOT8C PROMOTION TYPES V2
// Types V2 préparant les avantages multiples, les codes promo et la livraison offerte.
// Compatibilité V1 conservée : benefit_type, gift_product_ids et discount_percent restent disponibles.

export type PromotionMode = 'automatic' | 'promo_code'

export type PromotionCustomerIdentifierType = 'phone' | 'email' | 'customer_id'

export interface PromotionCodeFields {
  promotion_mode?: PromotionMode | null
  code?: string | null
  usage_limit_total?: number | null
  usage_limit_per_customer?: number | null
  usage_count?: number | null
  customer_identifier_type?: PromotionCustomerIdentifierType | null
  is_stackable?: boolean | null
}

export interface PromotionBenefit {
  id?: string | null
  promotion_rule_id?: string | null
  benefit_type: PromotionBenefitType
  product_id?: string | null
  product_name?: string | null
  quantity?: number | null
  discount_percent?: number | null
  fixed_discount_amount?: number | null
  free_delivery?: boolean | null
  sort_order?: number | null
  customer_message?: string | null
  admin_note?: string | null
}

export interface PromotionRuleWithBenefits extends PromotionRule, PromotionCodeFields {
  benefits: PromotionBenefit[]
}

export interface PromotionEngineInputRule extends PromotionRule, PromotionCodeFields {
  benefits?: PromotionBenefit[] | null
}

export interface PromotionAppliedFreeDelivery {
  promotion_id: string
  promotion_name: string
  promotion_benefit_id?: string | null
  promo_code?: string | null
  delivery_discount_amount: number
}

export interface PromotionCodeValidationContext {
  promo_code?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  customer_id?: string | null
}
