import type {
  PromotionBenefit,
  PromotionBenefitType,
  PromotionRule,
  PromotionRuleWithBenefits,
} from './types/promotion'
import { describeTriggerScopeMismatch } from '@/lib/promotion-triggers'

type DbError = {
  message?: string
}

type QueryResult<T> = {
  data: T | null
  error: DbError | null
}

type PromotionRuleRow = {
  id: string
  name: string
  description?: string | null
  status: PromotionRule['status']
  starts_at?: string | null
  ends_at?: string | null
  priority?: number | null
  scope: PromotionRule['scope']
  trigger_type: PromotionRule['trigger_type']
  trigger_product_ids?: string[] | null
  trigger_category_ids?: string[] | null
  minimum_order_amount?: number | string | null
  minimum_quantity?: number | null
  benefit_type: PromotionRule['benefit_type']
  gift_product_ids?: string[] | null
  discount_percent?: number | string | null
  exclude_discounted_products?: boolean | null
  stacking_mode?: PromotionRule['stacking_mode'] | null
  customer_message?: string | null
  admin_note?: string | null

  promotion_mode?: 'automatic' | 'promo_code' | null
  code?: string | null
  usage_limit_total?: number | null
  usage_limit_per_customer?: number | null
  usage_count?: number | null
  customer_identifier_type?: 'phone' | 'email' | 'customer_id' | null
  is_stackable?: boolean | null
}

type PromotionBenefitRow = {
  id: string
  promotion_rule_id: string
  benefit_type: PromotionBenefitType
  product_id?: string | null
  quantity?: number | null
  discount_percent?: number | string | null
  fixed_discount_amount?: number | string | null
  free_delivery?: boolean | null
  sort_order?: number | null
  customer_message?: string | null
  admin_note?: string | null
}

type PromotionRuleOrderQuery = {
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<QueryResult<PromotionRuleRow[]>>
}

type PromotionRuleEqQuery = {
  eq: (column: string, value: string) => PromotionRuleOrderQuery
}

type PromotionRuleTable = {
  select: (columns: string) => PromotionRuleEqQuery
}

type PromotionBenefitOrderQuery = {
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<QueryResult<PromotionBenefitRow[]>>
}

type PromotionBenefitFilterQuery = {
  in: (column: string, values: string[]) => PromotionBenefitOrderQuery
}

type PromotionBenefitTable = {
  select: (columns: string) => PromotionBenefitFilterQuery
}

type PromotionRuleClient = {
  from: (table: string) => unknown
}

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toStringArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

function mapPromotionBenefitRow(row: PromotionBenefitRow): PromotionBenefit {
  return {
    id: row.id,
    promotion_rule_id: row.promotion_rule_id,
    benefit_type: row.benefit_type,
    product_id: row.product_id ?? null,
    quantity: row.quantity ?? 1,
    discount_percent: toNumberOrNull(row.discount_percent),
    fixed_discount_amount: toNumberOrNull(row.fixed_discount_amount),
    free_delivery: row.free_delivery ?? false,
    sort_order: row.sort_order ?? 100,
    customer_message: row.customer_message ?? null,
    admin_note: row.admin_note ?? null,
  }
}

function buildLegacyBenefits(rule: PromotionRule): PromotionBenefit[] {
  if (rule.benefit_type === 'gift_product') {
    const giftProductIds = toStringArray(rule.gift_product_ids)

    return giftProductIds.map((productId, index) => ({
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

export function mapPromotionRuleRow(row: PromotionRuleRow): PromotionRuleWithBenefits {
  const rule: PromotionRule = {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    status: row.status,
    starts_at: row.starts_at ?? null,
    ends_at: row.ends_at ?? null,
    priority: row.priority ?? 100,
    scope: row.scope,
    trigger_type: row.trigger_type,
    trigger_product_ids: toStringArray(row.trigger_product_ids),
    trigger_category_ids: toStringArray(row.trigger_category_ids),
    minimum_order_amount: toNumberOrNull(row.minimum_order_amount),
    minimum_quantity: row.minimum_quantity ?? null,
    benefit_type: row.benefit_type,
    gift_product_ids: toStringArray(row.gift_product_ids),
    discount_percent: toNumberOrNull(row.discount_percent),
    exclude_discounted_products: row.exclude_discounted_products ?? true,
    stacking_mode: row.stacking_mode ?? 'best_offer',
    customer_message: row.customer_message ?? null,
    admin_note: row.admin_note ?? null,
  }

  return {
    ...rule,
    promotion_mode: row.promotion_mode ?? 'automatic',
    code: row.code ?? null,
    usage_limit_total: row.usage_limit_total ?? null,
    usage_limit_per_customer: row.usage_limit_per_customer ?? null,
    usage_count: row.usage_count ?? 0,
    customer_identifier_type: row.customer_identifier_type ?? null,
    is_stackable: row.is_stackable ?? false,
    benefits: buildLegacyBenefits(rule),
  }
}

async function loadPromotionBenefits(
  supabase: PromotionRuleClient,
  ruleIds: string[],
): Promise<PromotionBenefit[]> {
  if (ruleIds.length === 0) return []

  try {
    const table = supabase.from('promotion_benefits') as PromotionBenefitTable

    const { data, error } = await table
      .select('*')
      .in('promotion_rule_id', ruleIds)
      .order('sort_order', { ascending: true })

    if (error || !data) return []

    return data.map(mapPromotionBenefitRow)
  } catch {
    return []
  }
}

function attachBenefitsToRules(
  rules: PromotionRuleWithBenefits[],
  benefits: PromotionBenefit[],
): PromotionRuleWithBenefits[] {
  if (benefits.length === 0) return rules

  const benefitsByRuleId = new Map<string, PromotionBenefit[]>()

  benefits.forEach((benefit) => {
    const ruleId = benefit.promotion_rule_id

    if (!ruleId) return

    const current = benefitsByRuleId.get(ruleId) ?? []
    current.push(benefit)
    benefitsByRuleId.set(ruleId, current)
  })

  return rules.map((rule) => {
    const attachedBenefits = benefitsByRuleId.get(rule.id)

    return {
      ...rule,
      benefits: attachedBenefits && attachedBenefits.length > 0 ? attachedBenefits : rule.benefits,
    }
  })
}

// BLAC-P2-016 : regle unique des bornes de dates, utilisee par le panier et par la commande.
// Debut inclus, fin incluse jusqu'a la milliseconde indiquee, date absente ou invalide = pas de limite.
export function isRuleActiveAt(
  rule: { starts_at?: string | null; ends_at?: string | null },
  now: number = Date.now(),
): boolean {
  const startsAt = rule.starts_at ? new Date(rule.starts_at).getTime() : Number.NaN
  const endsAt = rule.ends_at ? new Date(rule.ends_at).getTime() : Number.NaN

  if (Number.isFinite(startsAt) && startsAt > now) return false
  if (Number.isFinite(endsAt) && endsAt < now) return false

  return true
}

export async function loadActivePromotionRules(
  supabaseClient: unknown,
): Promise<PromotionRuleWithBenefits[]> {
  const supabase = supabaseClient as PromotionRuleClient

  try {
    const table = supabase.from('promotion_rules') as PromotionRuleTable

    const { data, error } = await table
      .select('*')
      .eq('status', 'active')
      .order('priority', { ascending: true })

    if (error || !data) return []

    const now = Date.now()
    const rules = data
      .map(mapPromotionRuleRow)
      .filter((rule) => isRuleActiveAt(rule, now))

    const benefits = await loadPromotionBenefits(
      supabase,
      rules.map((rule) => rule.id),
    )

    return attachBenefitsToRules(rules, benefits)
  } catch {
    return []
  }
}


// BLAC-P2-014 : vue publique des regles (liste blanche : jamais admin_note ni code)
export type PublicPromotion = {
  id: string
  name: string
  customer_message: string | null
  benefit_type: string
  discount_percent: number | null
  minimum_order_amount: number | null
  minimum_quantity: number | null
  scope: string
  // BLAC-P3-011 : present uniquement pour une regle a produit offert
  gifts?: PublicGift[]
}

// BLAC-P3-011 : produit offert expose au public (liste blanche : jamais prix de revient, stock ni champ interne)
export type PublicGift = {
  product_id: string
  name: string
  image_url: string | null
  quantity: number
}

export function toPublicPromotion(rule: PromotionRuleWithBenefits): PublicPromotion {
  return {
    id: rule.id,
    name: rule.name,
    customer_message: rule.customer_message ?? null,
    benefit_type: rule.benefit_type,
    discount_percent: rule.discount_percent ?? null,
    minimum_order_amount: rule.minimum_order_amount ?? null,
    minimum_quantity: rule.minimum_quantity ?? null,
    scope: rule.scope,
  }
}

export function selectPublicPromotions(rules: PromotionRuleWithBenefits[], now = Date.now()): PublicPromotion[] {
  return rules
    .filter((r) => r.status === 'active')
    .filter((r) => r.promotion_mode !== 'promo_code' && !r.code)
    .filter((r) => isRuleActiveAt(r, now))
    .map(toPublicPromotion)
}


// BLAC-P3-008 : validation des valeurs d'une regle de promotion (messages en francais)
export type PromotionRuleValidationInput = {
  scope?: string | null
  trigger_type?: string | null
  benefit_type?: string | null
  discount_percent?: number | string | null
  minimum_order_amount?: number | string | null
  minimum_quantity?: number | string | null
  promotion_mode?: string | null
  code?: string | null
  starts_at?: string | null
  ends_at?: string | null
  gift_product_ids?: string[] | null
  benefits?: Array<{
    benefit_type?: string | null
    product_id?: string | null
    quantity?: number | string | null
    discount_percent?: number | string | null
    fixed_discount_amount?: number | string | null
  }> | null
}

function isBlankValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function parseValue(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value.trim().replace(',', '.'))
  return Number.NaN
}

export function validatePromotionRule(rule: PromotionRuleValidationInput): { ok: boolean; errors: string[] } {
  const errors: string[] = []

  const checkPercent = (value: unknown, label: string) => {
    if (isBlankValue(value)) return
    const n = parseValue(value)
    if (!Number.isFinite(n) || n < 1 || n > 100) errors.push(`${label} doit etre compris entre 1 et 100.`)
  }
  const checkNotNegative = (value: unknown, label: string) => {
    if (isBlankValue(value)) return
    const n = parseValue(value)
    if (!Number.isFinite(n) || n < 0) errors.push(`${label} ne peut pas etre negatif.`)
  }
  const checkPositiveQuantity = (value: unknown, label: string) => {
    if (isBlankValue(value)) return
    const n = parseValue(value)
    if (!Number.isFinite(n) || n <= 0) errors.push(`${label} doit etre superieure a zero.`)
  }

  if (rule.benefit_type === 'percent_discount' && isBlankValue(rule.discount_percent)) {
    errors.push('Le pourcentage de remise est obligatoire.')
  }
  checkPercent(rule.discount_percent, 'Le pourcentage de remise')
  checkNotNegative(rule.minimum_order_amount, 'Le montant minimum de commande')
  checkPositiveQuantity(rule.minimum_quantity, 'La quantite minimum')

  if (rule.promotion_mode === 'promo_code') {
    const code = typeof rule.code === 'string' ? rule.code : ''
    if (code.trim() === '') errors.push('Le code promo est obligatoire.')
    else if (/\s/.test(code)) errors.push('Le code promo ne doit pas contenir d\'espaces.')
  }

  if (!isBlankValue(rule.starts_at) && !isBlankValue(rule.ends_at)) {
    const start = new Date(String(rule.starts_at)).getTime()
    const end = new Date(String(rule.ends_at)).getTime()
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
      errors.push('La date de fin ne peut pas etre avant la date de debut.')
    }
  }

  const benefits = Array.isArray(rule.benefits) ? rule.benefits : []
  for (const benefit of benefits) {
    checkPercent(benefit.discount_percent, 'Le pourcentage de remise de l\'avantage')
    checkNotNegative(benefit.fixed_discount_amount, 'Le montant de remise de l\'avantage')
    checkPositiveQuantity(benefit.quantity, 'La quantite de l\'avantage')
  }

  if (rule.benefit_type === 'gift_product') {
    const hasGiftIds = Array.isArray(rule.gift_product_ids) && rule.gift_product_ids.some((id) => typeof id === 'string' && id.trim() !== '')
    const hasGiftBenefit = benefits.some((b) => b.benefit_type === 'gift_product' && typeof b.product_id === 'string' && b.product_id.trim() !== '')
    if (!hasGiftIds && !hasGiftBenefit) errors.push('Un cadeau doit avoir un produit.')
  }

  // BLAC-P3-012 : coherence perimetre / declencheur (le declencheur promo_code est hors table, non controle ici)
  if (!isBlankValue(rule.scope) && !isBlankValue(rule.trigger_type) && rule.trigger_type !== 'promo_code') {
    const mismatch = describeTriggerScopeMismatch(rule.scope, rule.trigger_type)
    if (mismatch) errors.push(mismatch)
  }

  return { ok: errors.length === 0, errors }
}


// BLAC-P3-011 : ajoute la liste des cadeaux aux promotions publiques de type produit offert.
// Sources : avantages lies a la regle (promotion_benefits) puis identifiants de produits cadeaux de la regle.
// Produit introuvable ou inactif : ignore (la promotion reste valide, sans cadeau). Produit VIP : seulement si portee VIP.
export async function attachPublicGifts(
  supabaseClient: unknown,
  rules: PromotionRuleWithBenefits[],
  promotions: PublicPromotion[],
): Promise<PublicPromotion[]> {
  try {
    const ruleById = new Map(rules.map((rule) => [rule.id, rule]))
    const wanted = new Map<string, { productId: string; quantity: number }[]>()
    const allIds = new Set<string>()

    for (const promo of promotions) {
      if (promo.benefit_type !== 'gift_product') continue
      const rule = ruleById.get(promo.id)
      if (!rule) continue
      const list: { productId: string; quantity: number }[] = []
      const seen = new Set<string>()
      const push = (productId: unknown, quantity: unknown) => {
        if (typeof productId !== 'string' || productId === '' || seen.has(productId)) return
        seen.add(productId)
        const q = typeof quantity === 'number' && Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1
        list.push({ productId, quantity: q })
        allIds.add(productId)
      }
      for (const benefit of rule.benefits ?? []) {
        if (benefit.benefit_type === 'gift_product') push(benefit.product_id, benefit.quantity)
      }
      for (const id of rule.gift_product_ids ?? []) push(id, 1)
      wanted.set(promo.id, list)
    }

    if (wanted.size === 0) return promotions

    type ProductRow = { id: string; name?: string | null; image_url?: string | null; is_vip?: boolean | null; active?: boolean | null }
    const client = supabaseClient as {
      from: (table: string) => {
        select: (columns: string) => { in: (column: string, values: string[]) => PromiseLike<QueryResult<ProductRow[]>> }
      }
    }
    const { data, error } = await client.from('products').select('id, name, image_url, is_vip, active').in('id', [...allIds])
    const products = new Map<string, ProductRow>()
    if (!error && Array.isArray(data)) data.forEach((row) => products.set(row.id, row))

    return promotions.map((promo) => {
      const list = wanted.get(promo.id)
      if (!list) return promo
      const gifts: PublicGift[] = []
      for (const entry of list) {
        const product = products.get(entry.productId)
        if (!product || product.active !== true) continue
        if (product.is_vip === true && promo.scope !== 'vip') continue
        if (typeof product.name !== 'string' || product.name.trim() === '') continue
        const image = typeof product.image_url === 'string' && product.image_url.trim() !== '' ? product.image_url.trim() : null
        gifts.push({ product_id: product.id, name: product.name, image_url: image, quantity: entry.quantity })
      }
      return { ...promo, gifts }
    })
  } catch {
    return promotions
  }
}
