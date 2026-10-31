import type {
  PromotionAppliedBenefit,
  PromotionApplicationResult,
  PromotionBenefit,
  PromotionCartLine,
  PromotionEngineInputRule,
  PromotionProductCandidate,
  PromotionRejected,
  PromotionRule,
} from './types/promotion'

type SiteCapabilities = {
  vipEnabled?: boolean
}

type ProductRecord = PromotionProductCandidate & Record<string, unknown>

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function getLineRecord(line: PromotionCartLine): Record<string, unknown> {
  return line as unknown as Record<string, unknown>
}

function getProductRecord(product: unknown): ProductRecord {
  return asRecord(product) as ProductRecord
}

function getProductId(product: ProductRecord): string {
  const id = product.id ?? product.product_id
  return typeof id === 'string' ? id : ''
}

function getProductName(product: ProductRecord): string {
  const name = product.name ?? product.product_name ?? product.title
  return typeof name === 'string' ? name : 'Produit offert'
}

function getProductPrice(product: ProductRecord): number {
  return toNumber(product.price ?? product.unit_price ?? product.sale_price, 0)
}

function isVipLine(line: PromotionCartLine): boolean {
  const lineRecord = getLineRecord(line)
  const product = getProductRecord(line.product)

  return Boolean(
    lineRecord.is_vip ??
      lineRecord.isVip ??
      product.is_vip ??
      product.isVip ??
      line.line_type === 'vip',
  )
}

function isPromotionGiftLine(line: PromotionCartLine): boolean {
  return Boolean(line.is_promotion_gift || line.line_type === 'promotion_gift')
}

function canLineTriggerPromotion(line: PromotionCartLine): boolean {
  if (isPromotionGiftLine(line)) return false
  if (line.can_trigger_promotion === false) return false
  return true
}

function isProductSelectable(product: ProductRecord): boolean {
  if (product.active === false) return false
  if (product.visible === false) return false
  if (product.is_visible === false) return false
  if (product.hidden === true) return false
  if (product.disabled === true) return false
  if (product.available === false) return false
  if (product.is_available === false) return false
  if (product.status === 'inactive') return false
  if (product.status === 'disabled') return false
  if (product.status === 'hidden') return false
  return true
}

function getSubtotal(items: PromotionCartLine[]): number {
  return roundMoney(
    items
      .filter((line) => !isPromotionGiftLine(line))
      .reduce((sum, line) => sum + toNumber(line.unit_price) * toNumber(line.quantity), 0),
  )
}

function getQuantity(items: PromotionCartLine[]): number {
  return items
    .filter((line) => !isPromotionGiftLine(line))
    .reduce((sum, line) => sum + toNumber(line.quantity), 0)
}

function hasClassic(items: PromotionCartLine[]): boolean {
  return items.some((line) => canLineTriggerPromotion(line) && !isVipLine(line))
}

function hasVip(items: PromotionCartLine[]): boolean {
  return items.some((line) => canLineTriggerPromotion(line) && isVipLine(line))
}

function ruleScopeMatches(
  rule: PromotionEngineInputRule,
  items: PromotionCartLine[],
  siteCapabilities: SiteCapabilities,
): boolean {
  if (rule.scope === 'all') return true

  if (rule.scope === 'classic') return hasClassic(items)

  if (rule.scope === 'vip') {
    if (siteCapabilities.vipEnabled === false) return false
    return hasVip(items)
  }

  if (rule.scope === 'mixed') {
    if (siteCapabilities.vipEnabled === false) return false
    return hasClassic(items) && hasVip(items)
  }

  return true
}

function lineMatchesProduct(line: PromotionCartLine, productIds: string[]): boolean {
  if (productIds.length === 0) return false
  return productIds.includes(line.product_id)
}

function lineMatchesCategory(line: PromotionCartLine, categoryIds: string[]): boolean {
  if (categoryIds.length === 0) return false

  const product = getProductRecord(line.product)
  const values = [
    product.category_id,
    product.categoryId,
    product.category,
    product.category_slug,
    product.subcategory_id,
    product.subcategoryId,
    product.subcategory,
    product.sub_category,
    product.subSubcategory,
    product.sub_subcategory,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)

  return categoryIds.some((categoryId) => values.some((value) => (
    value === categoryId
    || value.startsWith(`${categoryId}_`)
    || value.startsWith(`${categoryId}-`)
  )))
}

function ruleTriggerMatches(rule: PromotionEngineInputRule, items: PromotionCartLine[]): boolean {
  const triggerableItems = items.filter(canLineTriggerPromotion)

  if ((rule.minimum_order_amount ?? 0) > 0 && getSubtotal(triggerableItems) < (rule.minimum_order_amount ?? 0)) {
    return false
  }

  if ((rule.minimum_quantity ?? 0) > 0 && getQuantity(triggerableItems) < (rule.minimum_quantity ?? 0)) {
    return false
  }

  if (rule.trigger_type === 'cart_amount') {
    return true
  }

  if (rule.trigger_type === 'cart_quantity') {
    return true
  }

  if (rule.trigger_type === 'classic_purchase') return hasClassic(triggerableItems)

  if (rule.trigger_type === 'vip_purchase') return hasVip(triggerableItems)

  if (rule.trigger_type === 'mixed_purchase') {
    return hasClassic(triggerableItems) && hasVip(triggerableItems)
  }

  if (rule.trigger_type === 'product') {
    return triggerableItems.some((line) => lineMatchesProduct(line, rule.trigger_product_ids ?? []))
  }

  if (rule.trigger_type === 'category') {
    return triggerableItems.some((line) => lineMatchesCategory(line, rule.trigger_category_ids ?? []))
  }

  if (rule.trigger_type === 'promo_code') {
    return Boolean(rule.code)
  }

  return true
}

function normalizePromotionBenefits(rule: PromotionEngineInputRule): PromotionBenefit[] {
  if (Array.isArray(rule.benefits) && rule.benefits.length > 0) {
    return [...rule.benefits].sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100))
  }

  if (rule.benefit_type === 'gift_product') {
    return (rule.gift_product_ids ?? []).map((productId, index) => ({
      id: null,
      promotion_rule_id: rule.id,
      benefit_type: 'gift_product',
      product_id: productId,
      quantity: 1,
      discount_percent: null,
      fixed_discount_amount: null,
      free_delivery: false,
      sort_order: 100 + index,
      customer_message: rule.customer_message ?? null,
      admin_note: rule.admin_note ?? null,
    }))
  }

  if (rule.benefit_type === 'percent_discount') {
    return [
      {
        id: null,
        promotion_rule_id: rule.id,
        benefit_type: 'percent_discount',
        product_id: null,
        quantity: null,
        discount_percent: rule.discount_percent ?? null,
        fixed_discount_amount: null,
        free_delivery: false,
        sort_order: 100,
        customer_message: rule.customer_message ?? null,
        admin_note: rule.admin_note ?? null,
      },
    ]
  }

  if (rule.benefit_type === 'free_delivery') {
    return [
      {
        id: null,
        promotion_rule_id: rule.id,
        benefit_type: 'free_delivery',
        product_id: null,
        quantity: null,
        discount_percent: null,
        fixed_discount_amount: null,
        free_delivery: true,
        sort_order: 100,
        customer_message: rule.customer_message ?? null,
        admin_note: rule.admin_note ?? null,
      },
    ]
  }

  return []
}

function makeAppliedBenefit(
  rule: PromotionEngineInputRule,
  benefit: PromotionBenefit,
  amount: number,
  giftProductIds: string[] = [],
  affectedProductIds: string[] = [],
): PromotionAppliedBenefit {
  return {
    promotion_id: rule.id,
    promotion_name: rule.name,
    benefit_type: benefit.benefit_type,
    amount: roundMoney(amount),
    gift_product_ids: giftProductIds,
    affected_product_ids: affectedProductIds,
    promotion_benefit_id: benefit.id ?? null,
    promo_code: rule.code ?? null,
    free_delivery_applied: benefit.benefit_type === 'free_delivery',
    delivery_discount_amount: benefit.benefit_type === 'free_delivery' ? roundMoney(amount) : 0,
  }
}

function getGiftBenefitQuantity(
  items: PromotionCartLine[],
  rule: PromotionEngineInputRule,
  benefit: PromotionBenefit,
): number {
  const baseQuantity = Math.max(1, Math.floor(toNumber(benefit.quantity, 1)))
  const triggerableItems = items.filter(canLineTriggerPromotion)

  if (rule.trigger_type === 'category') {
    const eligibleQuantity = triggerableItems
      .filter((line) => lineMatchesCategory(line, rule.trigger_category_ids ?? []))
      .reduce((sum, line) => sum + toNumber(line.quantity, 0), 0)

    return Math.max(baseQuantity, baseQuantity * Math.max(1, Math.floor(eligibleQuantity)))
  }

  if (rule.trigger_type === 'product') {
    const eligibleQuantity = triggerableItems
      .filter((line) => lineMatchesProduct(line, rule.trigger_product_ids ?? []))
      .reduce((sum, line) => sum + toNumber(line.quantity, 0), 0)

    return Math.max(baseQuantity, baseQuantity * Math.max(1, Math.floor(eligibleQuantity)))
  }

  return baseQuantity
}

function applyGiftProductBenefit(
  items: PromotionCartLine[],
  productCatalog: PromotionProductCandidate[],
  rule: PromotionEngineInputRule,
  benefit: PromotionBenefit,
): {
  items: PromotionCartLine[]
  applied?: PromotionAppliedBenefit
  rejected?: PromotionRejected
  giftValue: number
} {
  const productId = benefit.product_id

  if (!productId) {
    return { items, giftValue: 0 }
  }

  const product = productCatalog.map(getProductRecord).find((candidate) => getProductId(candidate) === productId)

  if (!product || !isProductSelectable(product)) {
    return { items, giftValue: 0 }
  }

  const quantity = getGiftBenefitQuantity(items, rule, benefit)
  const giftValue = roundMoney(getProductPrice(product) * quantity)

  const giftLine: PromotionCartLine = {
    product_id: getProductId(product),
    product_name: getProductName(product),
    quantity,
    unit_price: 0,
    original_unit_price: getProductPrice(product),
    product,
    line_type: 'promotion_gift',
    is_promotion_gift: true,
    promotion_rule_id: rule.id,
    promotion_label: rule.name,
    can_trigger_promotion: false,
    is_vip: false,
  }

  return {
    items: [...items, giftLine],
    applied: makeAppliedBenefit(rule, benefit, giftValue, [productId], []),
    giftValue,
  }
}

function lineCanReceivePercentDiscount(line: PromotionCartLine, rule: PromotionEngineInputRule): boolean {
  if (isPromotionGiftLine(line)) return false
  if (rule.exclude_discounted_products === false) return true
  if (toNumber(getProductRecord(line.product).discount, 0) > 0) return false
  if ((line.discount_percent ?? 0) > 0) return false
  if ((line.discount_amount ?? 0) > 0) return false
  return true
}

function applyPercentDiscountBenefit(
  items: PromotionCartLine[],
  rule: PromotionEngineInputRule,
  benefit: PromotionBenefit,
): {
  items: PromotionCartLine[]
  applied?: PromotionAppliedBenefit
  discountValue: number
} {
  const percent = toNumber(benefit.discount_percent ?? rule.discount_percent, 0)

  if (percent <= 0) {
    return { items, discountValue: 0 }
  }

  const affectedProductIds: string[] = []
  let discountValue = 0

  const nextItems = items.map((line) => {
    if (!lineCanReceivePercentDiscount(line, rule)) return line

    const currentUnitPrice = toNumber(line.unit_price, 0)
    const quantity = toNumber(line.quantity, 0)
    // BLAC-P2-013 : prix remise arrondi a l'entier superieur (comme panier, VIP et serveur)
    const newUnitPrice = Math.max(0, Math.ceil(currentUnitPrice * (1 - percent / 100)))
    const unitDiscount = roundMoney(currentUnitPrice - newUnitPrice)
    const lineDiscount = roundMoney(unitDiscount * quantity)

    if (lineDiscount <= 0) return line

    affectedProductIds.push(line.product_id)
    discountValue += lineDiscount

    return {
      ...line,
      original_unit_price: line.original_unit_price ?? currentUnitPrice,
      unit_price: newUnitPrice,
      discount_percent: percent,
      discount_amount: roundMoney((line.discount_amount ?? 0) + lineDiscount),
      promotion_rule_id: rule.id,
      promotion_label: rule.name,
    }
  })

  discountValue = roundMoney(discountValue)

  return {
    items: nextItems,
    applied: discountValue > 0 ? makeAppliedBenefit(rule, benefit, discountValue, [], affectedProductIds) : undefined,
    discountValue,
  }
}

function applyFixedDiscountBenefit(
  items: PromotionCartLine[],
  rule: PromotionEngineInputRule,
  benefit: PromotionBenefit,
): {
  applied?: PromotionAppliedBenefit
  discountValue: number
} {
  const fixed = toNumber(benefit.fixed_discount_amount, 0)
  if (fixed <= 0) return { discountValue: 0 }

  const eligible = items.filter((line) => lineCanReceivePercentDiscount(line, rule))
  const eligibleTotal = roundMoney(
    eligible.reduce((sum, line) => sum + toNumber(line.unit_price, 0) * toNumber(line.quantity, 0), 0),
  )
  const discountValue = roundMoney(Math.min(fixed, eligibleTotal))
  if (discountValue <= 0) return { discountValue: 0 }

  return {
    applied: makeAppliedBenefit(rule, benefit, discountValue, [], eligible.map((line) => line.product_id)),
    discountValue,
  }
}

function applyFreeDeliveryBenefit(
  rule: PromotionEngineInputRule,
  benefit: PromotionBenefit,
): PromotionAppliedBenefit {
  return makeAppliedBenefit(rule, benefit, 0, [], [])
}

function applyPromotionBenefits(
  items: PromotionCartLine[],
  productCatalog: PromotionProductCandidate[],
  rule: PromotionEngineInputRule,
  benefits: PromotionBenefit[],
): {
  items: PromotionCartLine[]
  applied: PromotionAppliedBenefit[]
  discountTotal: number
  giftTotalValue: number
  freeDeliveryApplied: boolean
} {
  let currentItems = items
  const applied: PromotionAppliedBenefit[] = []
  let discountTotal = 0
  let giftTotalValue = 0
  let freeDeliveryApplied = false
  let percentDiscountApplied = false

  benefits.forEach((benefit) => {
    if (benefit.benefit_type === 'gift_product') {
      const result = applyGiftProductBenefit(currentItems, productCatalog, rule, benefit)
      currentItems = result.items
      giftTotalValue += result.giftValue
      if (result.applied) applied.push(result.applied)
      return
    }

    if (benefit.benefit_type === 'percent_discount') {
      if (percentDiscountApplied) return

      const result = applyPercentDiscountBenefit(currentItems, rule, benefit)
      currentItems = result.items
      discountTotal += result.discountValue
      if (result.applied) {
        applied.push(result.applied)
        percentDiscountApplied = true
      }
      return
    }

    if (benefit.benefit_type === 'fixed_discount') {
      const result = applyFixedDiscountBenefit(currentItems, rule, benefit)
      discountTotal += result.discountValue
      if (result.applied) applied.push(result.applied)
      return
    }

    if (benefit.benefit_type === 'free_delivery') {
      applied.push(applyFreeDeliveryBenefit(rule, benefit))
      freeDeliveryApplied = true
    }
  })

  return {
    items: currentItems,
    applied,
    discountTotal: roundMoney(discountTotal),
    giftTotalValue: roundMoney(giftTotalValue),
    freeDeliveryApplied,
  }
}

export function applyGiftProducts(
  items: PromotionCartLine[],
  productCatalog: PromotionProductCandidate[],
  rule: PromotionRule,
): PromotionCartLine[] {
  const benefits = normalizePromotionBenefits(rule as PromotionEngineInputRule).filter(
    (benefit) => benefit.benefit_type === 'gift_product',
  )

  return benefits.reduce(
    (currentItems, benefit) => applyGiftProductBenefit(currentItems, productCatalog, rule, benefit).items,
    items,
  )
}

export function applyPercentDiscount(
  items: PromotionCartLine[],
  rule: PromotionRule,
): PromotionCartLine[] {
  const benefits = normalizePromotionBenefits(rule as PromotionEngineInputRule).filter(
    (benefit) => benefit.benefit_type === 'percent_discount',
  )

  return benefits.reduce(
    (currentItems, benefit) => applyPercentDiscountBenefit(currentItems, rule, benefit).items,
    items,
  )
}

export function applyPromotions(
  items: PromotionCartLine[],
  productCatalog: PromotionProductCandidate[],
  rules: PromotionEngineInputRule[],
  siteCapabilities: SiteCapabilities = {},
): PromotionApplicationResult {
  let currentItems = items
  const applied: PromotionAppliedBenefit[] = []
  const rejected: PromotionRejected[] = []
  let discountTotal = 0
  let giftTotalValue = 0
  let freeDeliveryApplied = false
  let appliedPromoCode: string | null = null

  // BLAC-P2-013 : selection des regles selon stacking_mode
  type Candidate = { rule: PromotionEngineInputRule; benefits: PromotionBenefit[]; value: number }
  const candidates: Candidate[] = []
  rules.forEach((rule) => {
    if (rule.status !== 'active') return
    if (!ruleScopeMatches(rule, items, siteCapabilities)) return
    if (!ruleTriggerMatches(rule, items)) return
    let benefits = normalizePromotionBenefits(rule)
    if (rule.stacking_mode === 'cumulable_gift_only') {
      benefits = benefits.filter((b) => b.benefit_type === 'gift_product')
    } else if (rule.stacking_mode === 'cumulable_discount_only') {
      benefits = benefits.filter((b) => b.benefit_type === 'percent_discount' || b.benefit_type === 'fixed_discount')
    }
    if (benefits.length === 0) return
    const trial = applyPromotionBenefits(items, productCatalog, rule, benefits)
    const value = trial.discountTotal + trial.giftTotalValue + (trial.freeDeliveryApplied ? 0.01 : 0)
    candidates.push({ rule, benefits, value })
  })

  const exclusive = candidates.find((c) => c.rule.stacking_mode === 'exclusive')
  let selected: Candidate[]
  if (exclusive) {
    selected = [exclusive]
  } else {
    const cumulable = candidates.filter(
      (c) => c.rule.stacking_mode === 'cumulable_gift_only' || c.rule.stacking_mode === 'cumulable_discount_only',
    )
    const competing = candidates.filter((c) => !cumulable.includes(c))
    const best = competing.reduce<Candidate | null>((acc, c) => (!acc || c.value > acc.value ? c : acc), null)
    selected = candidates.filter((c) => cumulable.includes(c) || c === best)
  }

  selected.forEach(({ rule, benefits }) => {
    const result = applyPromotionBenefits(currentItems, productCatalog, rule, benefits)
    currentItems = result.items
    applied.push(...result.applied)
    discountTotal += result.discountTotal
    giftTotalValue += result.giftTotalValue
    if (result.freeDeliveryApplied) freeDeliveryApplied = true
    if (rule.code) appliedPromoCode = rule.code
  })

  return {
    items: currentItems,
    applied,
    rejected,
    discount_total: roundMoney(discountTotal),
    gift_total_value: roundMoney(giftTotalValue),
    free_delivery_applied: freeDeliveryApplied,
    delivery_discount_amount: 0,
    applied_promo_code: appliedPromoCode,
  }
}


// BLAC-P2-013 : filtre des regles selon le code promo saisi (cote serveur)
export function filterRulesForPromoCode(
  rules: PromotionEngineInputRule[],
  promoCode: string | null | undefined,
): { rules: PromotionEngineInputRule[]; codeValid: boolean } {
  const code = (promoCode ?? '').trim().toLowerCase()
  const matching = rules.filter(
    (r) => r.promotion_mode === 'promo_code' && code !== '' && (r.code ?? '').trim().toLowerCase() === code,
  )
  const automatic = rules.filter((r) => r.promotion_mode !== 'promo_code')
  return { rules: [...automatic, ...matching], codeValid: code === '' || matching.length > 0 }
}


// BLAC-P2-014 : limite d'usage globale d'un code promo (verifiee cote serveur)
export function findPromoCodeRule(
  rules: PromotionEngineInputRule[],
  promoCode: string | null | undefined,
): PromotionEngineInputRule | null {
  const code = (promoCode ?? '').trim().toLowerCase()
  if (!code) return null
  return rules.find((r) => r.promotion_mode === 'promo_code' && (r.code ?? '').trim().toLowerCase() === code) ?? null
}

export function checkPromoCodeUsage(
  rule: Pick<PromotionEngineInputRule, 'usage_limit_total' | 'usage_count'> | null | undefined,
): { ok: boolean; error?: string } {
  if (!rule) return { ok: true }
  const limit = rule.usage_limit_total
  if (typeof limit === 'number' && limit > 0 && Number(rule.usage_count ?? 0) >= limit) {
    return { ok: false, error: 'Ce code promo est épuisé : sa limite d\'utilisation est atteinte.' }
  }
  return { ok: true }
}


// BLAC-P2-014 : apercu client indicatif des remises (le serveur recalcule et reste seul juge du prix)
export type PromotionPreviewInput = {
  id: string
  name: string
  customer_message: string | null
  benefit_type: string
  discount_percent: number | null
  minimum_order_amount: number | null
  minimum_quantity: number | null
}

export type PromotionPreview = {
  id: string
  name: string
  message: string | null
  eligible: boolean
  discount: number
  finalPrice: number
  missingAmount: number
}

export function previewPublicPromotions(
  promos: PromotionPreviewInput[],
  subtotal: number,
  quantity: number,
): PromotionPreview[] {
  return promos.map((p) => {
    const minAmount = Number(p.minimum_order_amount ?? 0)
    const minQty = Number(p.minimum_quantity ?? 0)
    const eligible = subtotal > 0 && subtotal >= minAmount && quantity >= minQty
    const pct = Number(p.discount_percent ?? 0)
    const discount = eligible && p.benefit_type === 'percent_discount' && pct > 0
      ? Math.round(subtotal * pct) / 100
      : 0
    return {
      id: p.id,
      name: p.name,
      message: p.customer_message ?? null,
      eligible,
      discount,
      finalPrice: Math.round((subtotal - discount) * 100) / 100,
      missingAmount: minAmount > subtotal ? Math.round((minAmount - subtotal) * 100) / 100 : 0,
    }
  })
}
