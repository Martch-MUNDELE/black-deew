'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validatePromotionRule } from '@/lib/promotion-rules'
import {
  describeTriggerScopeMismatch,
  getDefaultTriggerForScope,
  isTriggerAllowedForScope,
} from '@/lib/promotion-triggers'
// BLAC-P2-013 : Black Deew n'a pas lib/features.ts ; le VIP est toujours actif ici
const ENABLE_VIP_FEATURE = true
import type {
  PromotionBenefitType,
  PromotionRule,
  PromotionScope,
  PromotionStatus,
  PromotionStackingMode,
  PromotionTriggerType,
} from '@/lib/types/promotion'

type DbError = {
  message?: string
}

type QueryResult<T> = {
  data: T | null
  error: DbError | null
}

type SelectQuery = {
  order: (column: string, options?: { ascending?: boolean }) => Promise<QueryResult<unknown[]>>
  eq: (column: string, value: string) => SelectQuery
}

type UpdateQuery = {
  eq: (column: string, value: string) => Promise<QueryResult<unknown>>
}

type DeleteQuery = {
  eq: (column: string, value: string) => Promise<QueryResult<unknown>>
}

type DbTable = {
  select: (columns: string) => SelectQuery
  insert: (values: Record<string, unknown>) => Promise<QueryResult<unknown>>
  update: (values: Record<string, unknown>) => UpdateQuery
  delete: () => DeleteQuery
}

type DbClient = {
  from: (table: string) => DbTable
}

type ProductOption = {
  id: string
  name: string
  category?: string | null
  category_id?: string | null
  category_slug?: string | null
  subcategory?: string | null
  subcategory_id?: string | null
  price?: number | string | null
  active?: boolean | null
  visible?: boolean | null
  is_visible?: boolean | null
  hidden?: boolean | null
  disabled?: boolean | null
  available?: boolean | null
}

type PromotionCategoryOption = {
  id: string
  slug?: string | null
  name: string
  parent_id?: string | null
  level?: number | null
  active?: boolean | null
  is_visible?: boolean | null
  display_order?: number | null
}

type PromotionRow = PromotionRule & {
  created_at?: string | null
  updated_at?: string | null
}

type PromotionFormState = {
  name: string
  status: PromotionStatus
  scope: PromotionScope
  trigger_type: PromotionTriggerType
  benefit_type: PromotionBenefitType
  priority: string
  minimum_order_amount: string
  minimum_quantity: string
  trigger_category_parent_slug: string
  trigger_category_id: string
  trigger_product_parent_slug: string
  trigger_product_category_slug: string
  trigger_product_id: string
  gift_product_parent_slug: string
  gift_product_category_slug: string
  gift_product_id: string
  discount_percent: string
  stacking_mode: PromotionStackingMode
  exclude_discounted_products: boolean
  customer_message: string
  admin_note: string
}

const initialForm: PromotionFormState = {
  name: '',
  status: 'draft',
  scope: 'all',
  trigger_type: 'cart_amount',
  benefit_type: 'gift_product',
  priority: '100',
  minimum_order_amount: '',
  minimum_quantity: '',
  trigger_category_parent_slug: '',
  trigger_category_id: '',
  trigger_product_parent_slug: '',
  trigger_product_category_slug: '',
  trigger_product_id: '',
  gift_product_parent_slug: '',
  gift_product_category_slug: '',
  gift_product_id: '',
  discount_percent: '',
  stacking_mode: 'best_offer',
  exclude_discounted_products: true,
  customer_message: '',
  admin_note: '',
}

const scopeOptions: { value: PromotionScope; label: string }[] = [
  { value: 'all', label: 'Tous les paniers' },
  { value: 'classic', label: 'Ventes classiques' },
  { value: 'vip', label: 'Ventes VIP' },
  { value: 'mixed', label: 'Classique + VIP' },
]

const triggerOptions: { value: PromotionTriggerType; label: string }[] = [
  { value: 'cart_amount', label: 'Panier à partir d’un montant' },
  { value: 'cart_quantity', label: 'Quantité minimum' },
  { value: 'classic_purchase', label: 'Achat classique' },
  { value: 'vip_purchase', label: 'Achat VIP' },
  { value: 'mixed_purchase', label: 'Achat mixte' },
  { value: 'product', label: 'Produit précis' },
  { value: 'category', label: 'Catégorie' },
]

function db(): DbClient {
  return createClient() as unknown as DbClient
}

// BF-P2-001 LOT8K-D0-A3 STAGING REMOTE WRITE GUARD
function shouldBlockRemoteAdminWrites(): boolean {
  if (typeof window === 'undefined') return false

  const host = window.location.hostname
  const isLocalhost = host === 'localhost' || host === '127.0.0.1'
  const allowRemoteWrites = process.env.NEXT_PUBLIC_ALLOW_REMOTE_ADMIN_WRITES === 'true'
  const supabaseTarget = process.env.NEXT_PUBLIC_SUPABASE_TARGET ?? ''
  const stagingHost = process.env.NEXT_PUBLIC_SUPABASE_STAGING_HOST ?? ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  try {
    const supabaseHost = new URL(supabaseUrl).hostname
    const isRemoteSupabase = supabaseHost.endsWith('.supabase.co')
    const stagingExplicitlyAllowed =
      allowRemoteWrites &&
      supabaseTarget === 'staging' &&
      stagingHost.length > 0 &&
      supabaseHost === stagingHost

    return isLocalhost && isRemoteSupabase && !stagingExplicitlyAllowed
  } catch {
    return isLocalhost && !allowRemoteWrites
  }
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

// BF-P2-001 LOT8J-B2-B BUILD BENEFIT ROWS
function buildPromotionBenefitRows(form: PromotionFormState, ruleId: string): Record<string, unknown>[] {
  const customerMessage = form.customer_message.trim()
    || (form.benefit_type === 'free_delivery' ? 'Livraison offerte' : null)

  if (form.benefit_type === 'gift_product') {
    return [{
      promotion_rule_id: ruleId,
      benefit_type: 'gift_product',
      product_id: form.gift_product_id,
      quantity: 1,
      discount_percent: null,
      fixed_discount_amount: null,
      free_delivery: false,
      sort_order: 100,
      customer_message: customerMessage,
      admin_note: form.admin_note.trim() || null,
    }]
  }

  if (form.benefit_type === 'percent_discount') {
    return [{
      promotion_rule_id: ruleId,
      benefit_type: 'percent_discount',
      product_id: null,
      quantity: 1,
      discount_percent: toNumberOrNull(form.discount_percent),
      fixed_discount_amount: null,
      free_delivery: false,
      sort_order: 100,
      customer_message: customerMessage,
      admin_note: form.admin_note.trim() || null,
    }]
  }

  if (form.benefit_type === 'free_delivery') {
    return [{
      promotion_rule_id: ruleId,
      benefit_type: 'free_delivery',
      product_id: null,
      quantity: 1,
      discount_percent: null,
      fixed_discount_amount: null,
      free_delivery: true,
      sort_order: 100,
      customer_message: customerMessage,
      admin_note: form.admin_note.trim() || null,
    }]
  }

  return []
}

function normalizePromotionRow(value: unknown): PromotionRow | null {
  if (!value || typeof value !== 'object') return null

  const row = value as Record<string, unknown>

  if (typeof row.id !== 'string' || typeof row.name !== 'string') return null

  return {
    id: row.id,
    name: row.name,
    description: typeof row.description === 'string' ? row.description : null,
    status: (row.status as PromotionStatus) || 'draft',
    starts_at: typeof row.starts_at === 'string' ? row.starts_at : null,
    ends_at: typeof row.ends_at === 'string' ? row.ends_at : null,
    priority: typeof row.priority === 'number' ? row.priority : 100,
    scope: (row.scope as PromotionScope) || 'all',
    trigger_type: (row.trigger_type as PromotionTriggerType) || 'cart_amount',
    trigger_product_ids: toStringArray(row.trigger_product_ids),
    trigger_category_ids: toStringArray(row.trigger_category_ids),
    minimum_order_amount: typeof row.minimum_order_amount === 'number' ? row.minimum_order_amount : null,
    minimum_quantity: typeof row.minimum_quantity === 'number' ? row.minimum_quantity : null,
    benefit_type: (row.benefit_type as PromotionBenefitType) || 'gift_product',
    gift_product_ids: toStringArray(row.gift_product_ids),
    discount_percent: typeof row.discount_percent === 'number' ? row.discount_percent : null,
    exclude_discounted_products: typeof row.exclude_discounted_products === 'boolean' ? row.exclude_discounted_products : true,
    stacking_mode: (row.stacking_mode as PromotionStackingMode) || 'best_offer',
    customer_message: typeof row.customer_message === 'string' ? row.customer_message : null,
    admin_note: typeof row.admin_note === 'string' ? row.admin_note : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

function normalizeProduct(value: unknown): ProductOption | null {
  if (!value || typeof value !== 'object') return null

  const row = value as Record<string, unknown>

  if (typeof row.id !== 'string') return null

  return {
    id: row.id,
    name: typeof row.name === 'string' ? row.name : 'Produit sans nom',
    price: typeof row.price === 'number' || typeof row.price === 'string' ? row.price : null,
    category: typeof row.category === 'string' ? row.category : null,
    category_id: typeof row.category_id === 'string' ? row.category_id : null,
    category_slug: typeof row.category_slug === 'string' ? row.category_slug : null,
    subcategory: typeof row.subcategory === 'string' ? row.subcategory : null,
    subcategory_id: typeof row.subcategory_id === 'string' ? row.subcategory_id : null,
    active: typeof row.active === 'boolean' ? row.active : null,
    visible: typeof row.visible === 'boolean' ? row.visible : null,
    is_visible: typeof row.is_visible === 'boolean' ? row.is_visible : null,
    hidden: typeof row.hidden === 'boolean' ? row.hidden : null,
    disabled: typeof row.disabled === 'boolean' ? row.disabled : null,
    available: typeof row.available === 'boolean' ? row.available : null,
  }
}

function isProductSelectable(product: ProductOption): boolean {
  if (product.active === false) return false
  if (product.visible === false) return false
  if (product.is_visible === false) return false
  if (product.hidden === true) return false
  if (product.disabled === true) return false
  if (product.available === false) return false
  return true
}


function getPromotionStatusLabel(status?: PromotionStatus | string | null): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'inactive':
      return 'Inactive'
    case 'draft':
      return 'Brouillon'
    default:
      return 'Brouillon'
  }
}

function getPromotionScopeLabel(scope?: PromotionScope | string | null): string {
  switch (scope) {
    case 'all':
      return 'Tous les paniers'
    case 'classic':
      return 'Ventes classiques'
    case 'vip':
      return 'Ventes VIP'
    case 'mixed':
      return 'Classique + VIP'
    default:
      return 'Ventes classiques'
  }
}

function getPromotionTriggerLabel(trigger?: PromotionTriggerType | string | null): string {
  switch (trigger) {
    case 'cart_amount':
      return 'Montant du panier'
    case 'cart_quantity':
      return 'Quantité minimum'
    case 'classic_purchase':
      return 'Achat classique'
    case 'vip_purchase':
      return 'Achat VIP'
    case 'mixed_purchase':
      return 'Achat mixte'
    case 'product':
      return 'Produit précis'
    case 'category':
      return 'Catégorie'
    default:
      return 'Déclencheur'
  }
}

function getPromotionBenefitLabel(benefit?: PromotionBenefitType | string | null): string {
  switch (benefit) {
    case 'gift_product':
      return 'Produit offert'
    case 'percent_discount':
      return 'Remise en pourcentage'
    case 'free_delivery':
      return 'Livraison offerte'
    default:
      return 'Avantage promotionnel'
  }
}

function formatPromotionSummary(promotion: PromotionRow): string {
  return [
    getPromotionScopeLabel(promotion.scope),
    getPromotionTriggerLabel(promotion.trigger_type),
    getPromotionBenefitLabel(promotion.benefit_type),
    `Priorité ${promotion.priority ?? 100}`,
  ].join(' • ')
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [categories, setCategories] = useState<PromotionCategoryOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [form, setForm] = useState<PromotionFormState>(initialForm)
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // BLAC-P3-012 : message visible quand le declencheur est remis sur le defaut apres un changement de perimetre
  const [triggerResetMessage, setTriggerResetMessage] = useState<string | null>(null)

  // BF-P2-001 LOT8J-C4-S TARGETED SYNC STORE REMOTE WRITE GUARD
  const remoteWriteBlocked = useSyncExternalStore(
    () => () => {},
    shouldBlockRemoteAdminWrites,
    () => false,
  )

  const selectableProducts = useMemo(
    () => products.filter(isProductSelectable),
    [products],
  )

  async function loadPromotionCategories() {
    const categoryResult = await db()
      .from('menu_categories')
      .select('id, slug, name, parent_id, level, active, is_visible, display_order')
      .order('display_order', { ascending: true })

    if (categoryResult.error) {
      setCategories([])
      return
    }

    const rawRows = ((categoryResult.data ?? []) as PromotionCategoryOption[])
      .filter((category) => category.id && category.slug && category.name)
      .filter((category) => category.active === true && category.is_visible === true)

    const visibleParentIds = new Set(
      rawRows
        .filter((category) => category.level === 0)
        .map((category) => category.id),
    )

    const rows = rawRows.filter((category) => {
      if (category.level === 1) {
        return Boolean(category.parent_id && visibleParentIds.has(category.parent_id))
      }

      return true
    })

    setCategories(rows)
  }

  async function loadPromotions() {
    setLoading(true)
    setError(null)

    const promotionResult = await db()
      .from('promotion_rules')
      .select('*')
      .order('priority', { ascending: true })

    if (promotionResult.error) {
      setError(
        "La table promotion_rules n'est pas encore disponible. Appliquez la migration validée avant d'utiliser cette page.",
      )
      setPromotions([])
    } else {
      setPromotions((promotionResult.data ?? []).map(normalizePromotionRow).filter((row): row is PromotionRow => Boolean(row)))
    }

    const productResult = await db()
      .from('products')
      .select('*')
      .order('name', { ascending: true })

    if (!productResult.error) {
      setProducts((productResult.data ?? []).map(normalizeProduct).filter((row): row is ProductOption => Boolean(row)))
    }

    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPromotions()
      void loadPromotionCategories()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  // BF-P2-001 BASEFOOD ADMIN MOCK CLEANUP
  async function createPromotion() {
    setSaving(true)
    setError(null)
    setNotice(null)

    if (shouldBlockRemoteAdminWrites()) {
      setError('Enregistrement bloqué : localhost pointe vers une base Supabase distante non déclarée comme staging.')
      setSaving(false)
      return
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      status: form.status,
      scope: effectiveScope,
      trigger_type: form.trigger_type,
      trigger_product_ids: form.trigger_type === 'product' && form.trigger_product_id ? [form.trigger_product_id] : [],
      trigger_category_ids: form.trigger_type === 'category' && form.trigger_category_id ? [form.trigger_category_id] : [],
      priority: toNumberOrNull(form.priority) ?? 100,
      minimum_order_amount: toNumberOrNull(form.minimum_order_amount),
      minimum_quantity: toNumberOrNull(form.minimum_quantity),
      benefit_type: form.benefit_type,
      gift_product_ids: form.gift_product_id ? [form.gift_product_id] : [],
      discount_percent: toNumberOrNull(form.discount_percent),
      exclude_discounted_products: form.exclude_discounted_products,
      stacking_mode: form.stacking_mode,
      customer_message: form.customer_message.trim() || null,
      admin_note: form.admin_note.trim() || null,
    }

    if (!payload.name) {
      setError('Le nom de la promotion est obligatoire.')
      setSaving(false)
      return
    }

    if (form.trigger_type === 'category' && !form.trigger_category_id) {
      setError('Sélectionnez une catégorie concernée pour ce déclencheur.')
      setSaving(false)
      return
    }

    if (form.trigger_type === 'product' && !form.trigger_product_id) {
      setError('Sélectionnez un produit concerné pour ce déclencheur.')
      setSaving(false)
      return
    }

    if (form.benefit_type === 'gift_product' && !form.gift_product_id) {
      setError('Choisissez un produit cadeau actif et visible.')
      setSaving(false)
      return
    }

    if (form.benefit_type === 'percent_discount' && !toNumberOrNull(form.discount_percent)) {
      setError('Indiquez un pourcentage de remise valide.')
      setSaving(false)
      return
    }

    if (form.benefit_type === 'free_delivery') {
      payload.gift_product_ids = []
      payload.discount_percent = null
      payload.customer_message = payload.customer_message || 'Livraison offerte'
    }

    const ruleValidation = validatePromotionRule({
      scope: payload.scope as string,
      trigger_type: payload.trigger_type as string,
      benefit_type: payload.benefit_type as string,
      discount_percent: payload.discount_percent as number | null,
      minimum_order_amount: payload.minimum_order_amount as number | null,
      minimum_quantity: payload.minimum_quantity as number | null,
      starts_at: (payload.starts_at as string | null | undefined) ?? null,
      ends_at: (payload.ends_at as string | null | undefined) ?? null,
      gift_product_ids: payload.gift_product_ids as string[],
      promotion_mode: (payload.promotion_mode as string | null | undefined) ?? null,
      code: (payload.code as string | null | undefined) ?? null,
    })
    if (!ruleValidation.ok) {
      setError(ruleValidation.errors.join(' '))
      setSaving(false)
      return
    }

    const ruleId = editingPromotionId ?? crypto.randomUUID()
    const benefitRows = buildPromotionBenefitRows(form, ruleId)

    if (benefitRows.length === 0) {
      setError('Aucun avantage valide à enregistrer.')
      setSaving(false)
      return
    }

    const result = editingPromotionId
      ? await db().from('promotion_rules').update(payload).eq('id', editingPromotionId)
      : await db().from('promotion_rules').insert({ ...payload, id: ruleId })

    if (result.error) {
      setError(result.error.message || "Impossible d'enregistrer la promotion.")
      setSaving(false)
      return
    }

    if (editingPromotionId) {
      const cleanupResult = await db()
        .from('promotion_benefits')
        .delete()
        .eq('promotion_rule_id', editingPromotionId)

      if (cleanupResult.error) {
        setError(cleanupResult.error.message || "Impossible de préparer la mise à jour de l'avantage.")
        setSaving(false)
        return
      }
    }

    for (const benefitRow of benefitRows) {
      const benefitResult = await db().from('promotion_benefits').insert(benefitRow)

      if (benefitResult.error) {
        if (!editingPromotionId) {
          await db().from('promotion_rules').delete().eq('id', ruleId)
        }
        setError(benefitResult.error.message || "Impossible d'enregistrer l'avantage de la promotion.")
        setSaving(false)
        return
      }
    }

    setNotice(editingPromotionId ? 'Promotion modifiée.' : 'Promotion créée.')
    setEditingPromotionId(null)
    setForm(initialForm)
    await loadPromotions()

    setSaving(false)
  }

  // BLAC-P3-012 : changement de perimetre, remise du declencheur sur le defaut si l ancien n existe plus
  function handleScopeChange(nextScope: PromotionScope) {
    if (isTriggerAllowedForScope(nextScope, form.trigger_type)) {
      setTriggerResetMessage(null)
      setForm((current) => ({ ...current, scope: nextScope }))
      return
    }

    const fallbackTrigger = getDefaultTriggerForScope(nextScope)
    setTriggerResetMessage('Déclencheur remis sur Panier à partir d’un montant : l’ancien choix n’existe pas pour ce périmètre')
    setForm((current) => ({
      ...current,
      scope: nextScope,
      trigger_type: fallbackTrigger,
      minimum_order_amount: '',
      minimum_quantity: '',
      trigger_category_parent_slug: '',
      trigger_category_id: '',
      trigger_product_parent_slug: '',
      trigger_product_category_slug: '',
      trigger_product_id: '',
    }))
  }

  function cancelPromotionEdit() {
    setTriggerResetMessage(null)
    setEditingPromotionId(null)
    setError(null)
    setNotice(null)
    setForm(initialForm)
  }

  function startPromotionEdit(promotion: PromotionRow) {
    const triggerCategoryId = promotion.trigger_category_ids?.[0] ?? ''
    const triggerProductId = promotion.trigger_product_ids?.[0] ?? ''
    const giftProductId = promotion.gift_product_ids?.[0] ?? ''

    const findCategory = (value: string) => categories.find((category) => (
      category.id === value || category.slug === value
    ))

    const getParentSlug = (value: string) => {
      const category = findCategory(value)
      if (!category) return ''
      if (category.level === 1 && category.parent_id) {
        const parent = categories.find((candidate) => candidate.id === category.parent_id)
        return parent?.slug ?? parent?.id ?? ''
      }
      return category.slug ?? category.id
    }

    const getProductCategorySlug = (productId: string) => {
      const product = selectableProducts.find((candidate) => candidate.id === productId)
      return product?.subcategory
        ?? product?.category_slug
        ?? product?.category
        ?? product?.subcategory_id
        ?? product?.category_id
        ?? ''
    }

    const triggerProductCategorySlug = getProductCategorySlug(triggerProductId)
    const giftProductCategorySlug = getProductCategorySlug(giftProductId)

    setTriggerResetMessage(null)
    setEditingPromotionId(promotion.id)
    setForm({
      name: promotion.name ?? '',
      status: promotion.status ?? 'draft',
      scope: promotion.scope ?? 'classic',
      trigger_type: promotion.trigger_type ?? 'cart_amount',
      benefit_type: promotion.benefit_type ?? 'gift_product',
      priority: String(promotion.priority ?? 100),
      minimum_order_amount: promotion.minimum_order_amount == null ? '' : String(promotion.minimum_order_amount),
      minimum_quantity: promotion.minimum_quantity == null ? '' : String(promotion.minimum_quantity),
      trigger_category_parent_slug: triggerCategoryId ? getParentSlug(triggerCategoryId) : '',
      trigger_category_id: triggerCategoryId,
      trigger_product_parent_slug: triggerProductCategorySlug ? getParentSlug(triggerProductCategorySlug) : '',
      trigger_product_category_slug: triggerProductCategorySlug,
      trigger_product_id: triggerProductId,
      gift_product_parent_slug: giftProductCategorySlug ? getParentSlug(giftProductCategorySlug) : '',
      gift_product_category_slug: giftProductCategorySlug,
      gift_product_id: giftProductId,
      discount_percent: promotion.discount_percent == null ? '' : String(promotion.discount_percent),
      stacking_mode: promotion.stacking_mode ?? 'best_offer',
      exclude_discounted_products: promotion.exclude_discounted_products ?? true,
      customer_message: promotion.customer_message ?? '',
      admin_note: promotion.admin_note ?? '',
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
    setNotice('Promotion chargée en modification.')
  }

  async function updateStatus(id: string, status: PromotionStatus) {
    setError(null)
    setNotice(null)

    // BLAC-P3-012 : une promotion au perimetre et declencheur incoherents ne peut pas etre activee
    if (status === 'active') {
      const target = promotions.find((promotion) => promotion.id === id)
      const mismatch = target && target.trigger_type !== 'promo_code'
        ? describeTriggerScopeMismatch(target.scope, target.trigger_type)
        : null
      if (mismatch) {
        setError(`Activation refusee : ${mismatch} Modifiez la promotion pour choisir un declencheur permis.`)
        return
      }
    }

    const result = await db()
      .from('promotion_rules')
      .update({ status })
      .eq('id', id)

    if (result.error) {
      setError(result.error.message || 'Impossible de changer le statut.')
    } else {
      setNotice('Statut mis à jour.')
      await loadPromotions()
    }
  }

  async function deletePromotion(id: string) {
    const confirmed = window.confirm('Supprimer cette promotion ?')
    if (!confirmed) return

    setError(null)
    setNotice(null)

    const result = await db()
      .from('promotion_rules')
      .delete()
      .eq('id', id)

    if (result.error) {
      setError(result.error.message || 'Impossible de supprimer la promotion.')
    } else {
      setNotice('Promotion supprimée.')
      await loadPromotions()
    }
  }

  const isGiftBenefit = form.benefit_type === 'gift_product'
  const isPercentBenefit = form.benefit_type === 'percent_discount'
  const isFreeDeliveryBenefit = form.benefit_type === 'free_delivery'
  const isAmountTrigger = form.trigger_type === 'cart_amount'
  const isQuantityTrigger = form.trigger_type === 'cart_quantity'
  const isCategoryTrigger = form.trigger_type === 'category'
  const isProductTrigger = form.trigger_type === 'product'
  const scopeEnabled = ENABLE_VIP_FEATURE
  const effectiveScope: PromotionScope = scopeEnabled ? form.scope : 'classic'
  // BLAC-P3-012 : la liste n affiche que les declencheurs permis pour le perimetre (le choix actuel incoherent d une promotion enregistree reste visible, marque)
  const triggerMismatchWarning = form.trigger_type === 'promo_code'
    ? null
    : describeTriggerScopeMismatch(effectiveScope, form.trigger_type)
  const triggerOptionsBase = (ENABLE_VIP_FEATURE
    ? triggerOptions
    : triggerOptions.filter((option) => !['classic_purchase', 'vip_purchase', 'mixed_purchase'].includes(option.value))
  ).filter((option) => isTriggerAllowedForScope(effectiveScope, option.value))
  const currentIncompatibleOption = triggerMismatchWarning
    ? triggerOptions.find((option) => option.value === form.trigger_type)
    : undefined
  const triggerOptionsForSite = currentIncompatibleOption
    ? [...triggerOptionsBase, { ...currentIncompatibleOption, label: `${currentIncompatibleOption.label} (incompatible avec ce périmètre)` }]
    : triggerOptionsBase
  const selectableProductCategorySlugs = new Set(
    selectableProducts
      .flatMap((product) => [product.category, product.category_slug, product.subcategory])
      .filter((value): value is string => Boolean(value)),
  )
  const categoryHasSelectableProducts = (category: PromotionCategoryOption) => {
    if (!category.slug) return false

    const childSlugs = categories
      .filter((child) => child.parent_id === category.id && child.slug)
      .map((child) => child.slug as string)

    return selectableProductCategorySlugs.has(category.slug)
      || childSlugs.some((slug) => selectableProductCategorySlugs.has(slug))
  }
  const rootTriggerCategoryOptions = categories
    .filter((category) => category.level === 0 && category.slug)
    .filter(categoryHasSelectableProducts)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const getChildTriggerCategoryOptions = (parentId?: string | null) => categories
    .filter((category) => category.parent_id === parentId && category.slug)
    .filter((category) => selectableProductCategorySlugs.has(category.slug as string))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const selectedTriggerCategoryParent = rootTriggerCategoryOptions.find((category) => category.slug === form.trigger_category_parent_slug)
  const childTriggerCategoryOptions = selectedTriggerCategoryParent
    ? getChildTriggerCategoryOptions(selectedTriggerCategoryParent.id)
    : []
  const selectedTriggerProductParent = rootTriggerCategoryOptions.find((category) => category.slug === form.trigger_product_parent_slug)
  const productChildCategoryOptions = selectedTriggerProductParent
    ? getChildTriggerCategoryOptions(selectedTriggerProductParent.id)
    : []
  const selectedTriggerProductCategory = form.trigger_product_category_slug || form.trigger_category_id
  const triggerProductsForSelectedCategory = selectableProducts.filter((product) => {
    if (!selectedTriggerProductCategory) return false

    return [
      product.category,
      product.category_id,
      product.category_slug,
      product.subcategory,
      product.subcategory_id,
    ].some((value) => value === selectedTriggerProductCategory)
  })
  const selectedGiftProductParent = rootTriggerCategoryOptions.find((category) => category.slug === form.gift_product_parent_slug)
  const giftProductChildCategoryOptions = selectedGiftProductParent
    ? getChildTriggerCategoryOptions(selectedGiftProductParent.id)
    : []
  const selectedGiftProductCategory = form.gift_product_category_slug
  const giftProductsForSelectedCategory = selectableProducts.filter((product) => {
    if (!selectedGiftProductCategory) return false

    return [
      product.category,
      product.category_id,
      product.category_slug,
      product.subcategory,
      product.subcategory_id,
    ].some((value) => value === selectedGiftProductCategory)
  })
  const zone1Complete = Boolean(form.name.trim()) && Boolean(form.priority.trim())
  const zone2Complete = form.trigger_type === 'cart_amount'
    ? Boolean(form.minimum_order_amount.trim())
    : form.trigger_type === 'cart_quantity'
      ? Boolean(form.minimum_quantity.trim())
      : form.trigger_type === 'category'
        ? Boolean(form.trigger_category_id)
        : form.trigger_type === 'product'
          ? Boolean(form.trigger_product_id)
          : true
  const zone3Complete = form.benefit_type === 'gift_product'
    ? Boolean(form.gift_product_id)
    : form.benefit_type === 'percent_discount'
      ? Boolean(form.discount_percent.trim())
      : true
  const zone2Accessible = zone1Complete
  const zone3Accessible = zone1Complete && zone2Complete
  const zone4Accessible = zone1Complete && zone2Complete && zone3Complete
  const canSubmitPromotionForm = zone4Accessible
  const scopeLabel = scopeEnabled
    ? scopeOptions.find((option) => option.value === form.scope)?.label ?? form.scope
    : 'Ventes classiques'
  const triggerLabel = triggerOptions.find((option) => option.value === form.trigger_type)?.label ?? form.trigger_type
  const categoryLabel = categories.find((category) => category.slug === form.trigger_category_id)?.name
  const triggerProductCategoryLabel = categories.find((category) => category.slug === form.trigger_product_category_slug)?.name
  const triggerProductLabel = selectableProducts.find((product) => product.id === form.trigger_product_id)?.name
  const benefitLabel = form.benefit_type === 'gift_product'
    ? 'Produit offert'
    : form.benefit_type === 'percent_discount'
      ? 'Pourcentage de réduction'
      : 'Livraison offerte'
  const giftProductLabel = selectableProducts.find((product) => product.id === form.gift_product_id)?.name
  // BF-P2-001 LOT8JD9B UX CLEANUP - visible newlines removed
  const choicePanelClass = 'rounded-2xl border border-white/10 bg-black/25 p-4 shadow-inner shadow-black/20'
  const choiceHelpClass = 'mt-1 text-xs leading-relaxed text-white/45'
  const choiceButtonClass = (isSelected: boolean) => `inline-flex min-h-10 items-center justify-center rounded-2xl border px-4 py-2 text-sm transition ${
    isSelected
      ? 'border-amber-300/70 bg-amber-400/20 font-semibold text-amber-100 shadow-[0_0_18px_rgba(245,197,66,0.12)]'
      : 'border-white/10 bg-white/[0.03] text-stone-300 hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-100'
  }`
  const productChoiceClass = (isSelected: boolean) => `rounded-2xl border px-4 py-4 text-left text-sm transition ${
    isSelected
      ? 'border-amber-300/70 bg-amber-400/20 font-semibold text-amber-100 shadow-[0_0_18px_rgba(245,197,66,0.12)]'
      : 'border-white/10 bg-black/30 text-stone-300 hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-100'
  }`

  // BF-P2-001 LOT8I-E3 ADMIN CONDITIONAL UX SAFE
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 text-white">
      <section>
        <h1 className="mt-2 text-3xl font-bold">Promotions</h1>
        <p className="mt-3 max-w-3xl text-sm text-white/60">
          Module V1 pour gérer des produits offerts et des remises en pourcentage.
          Les produits cadeaux doivent rester actifs, visibles et disponibles.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      <section className="rounded-3xl border border-amber-500/20 bg-black/30 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            {editingPromotionId ? 'Modifier une promotion' : 'Créer une promotion'}
          </h2>
          {editingPromotionId ? (
            <button
              type="button"
              onClick={cancelPromotionEdit}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 hover:border-amber-400/40 hover:text-amber-100"
            >
              Annuler la modification
            </button>
          ) : null}
        </div>

        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-amber-500/20 bg-black/20 p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/70">Zone 1</p>
                <h3 className="mt-1 text-lg font-semibold">Identité de la promotion</h3>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                {zone1Complete ? 'Complète' : 'À compléter'}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {scopeEnabled && (
                <label className="flex flex-col gap-2 text-sm">
                  Périmètre
                  <select
                    className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                    value={form.scope}
                    onChange={(event) => handleScopeChange(event.target.value as PromotionScope)}
                  >
                    {scopeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-2 text-sm">
                Nom
                <input
                  className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Exemple : Boisson offerte dès 300 DH"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Statut
                <select
                  className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PromotionStatus }))}
                >
                  <option value="draft">Brouillon</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Priorité
                <input
                  className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  inputMode="numeric"
                />
              </label>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 ${zone2Accessible ? 'border-amber-500/20 bg-black/20' : 'border-white/10 bg-white/[0.03] opacity-60'}`}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/70">Zone 2</p>
                <h3 className="mt-1 text-lg font-semibold">Déclencheur</h3>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                {zone2Complete ? 'Complète' : zone2Accessible ? 'À compléter' : 'Verrouillée'}
              </span>
            </div>

            {zone2Accessible ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Déclencheur
                  <select
                    className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                    value={form.trigger_type}
                    onChange={(event) => {
                      const triggerType = event.target.value as PromotionTriggerType

                      setTriggerResetMessage(null)
                      setForm((current) => ({
                        ...current,
                        trigger_type: triggerType,
                        trigger_category_parent_slug: triggerType === 'category' ? current.trigger_category_parent_slug : '',
                        trigger_category_id: triggerType === 'category' ? current.trigger_category_id : '',
                        trigger_product_parent_slug: triggerType === 'product' ? current.trigger_product_parent_slug : '',
                        trigger_product_category_slug: triggerType === 'product' ? current.trigger_product_category_slug : '',
                        trigger_product_id: triggerType === 'product' ? current.trigger_product_id : '',
                      }))
                    }}
                  >
                    {triggerOptionsForSite.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                {triggerResetMessage && (
                  <div className="rounded-xl border border-amber-400/40 bg-amber-950/30 p-3 text-sm text-amber-100 md:col-span-2">
                    {triggerResetMessage}
                  </div>
                )}

                {triggerMismatchWarning && (
                  <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100 md:col-span-2">
                    Attention : {triggerMismatchWarning} Choisissez un déclencheur permis pour enregistrer.
                  </div>
                )}

                {isCategoryTrigger && (
                  <div className="space-y-5 md:col-span-2">
                    {/* BF-P2-001 LOT8JD7 HIERARCHICAL CATEGORY PICKER */}
                    <div className={choicePanelClass}>
                      <span className="text-sm font-medium text-stone-100">Catégorie principale</span>                      <p className={choiceHelpClass}>Choisissez la famille principale. Si elle contient des sous-catégories, vous pourrez préciser juste après.</p>
                      {rootTriggerCategoryOptions.length === 0 ? (
                        <span className="block text-xs text-amber-200/70">
                          Aucune catégorie client visible avec produit actif disponible.
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {rootTriggerCategoryOptions.map((category) => {
                            const categoryValue = category.slug ?? category.id
                            const isSelected = form.trigger_category_parent_slug === categoryValue

                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => setForm((current) => ({
                                  ...current,
                                  trigger_category_parent_slug: categoryValue,
                                  trigger_category_id: categoryValue,
                                }))}
                                className={choiceButtonClass(isSelected)}
                              >
                                {category.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {form.trigger_category_parent_slug && childTriggerCategoryOptions.length > 0 && (
                      <div className={choicePanelClass}>
                        <span className="text-sm font-medium text-stone-100">Sous-catégorie concernée <span className="text-white/40">(optionnel)</span></span>                        <p className={choiceHelpClass}>Ne choisissez rien ici pour appliquer la promotion à toute la catégorie principale.</p>
                        <div className="flex flex-wrap gap-2">
                          {childTriggerCategoryOptions.map((category) => {
                            const categoryValue = category.slug ?? category.id
                            const isSelected = form.trigger_category_id === categoryValue

                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => setForm((current) => ({ ...current, trigger_category_id: categoryValue }))}
                                className={choiceButtonClass(isSelected)}
                              >
                                {category.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isProductTrigger && (
                  <div className="space-y-5 md:col-span-2">
                    {/* BF-P2-001 LOT8JD7 HIERARCHICAL CATEGORY PICKER */}
                    <div className={choicePanelClass}>
                      <span className="text-sm font-medium text-stone-100">Catégorie principale du produit</span>                      <p className={choiceHelpClass}>Cette catégorie sert à filtrer les produits concernés par le déclencheur.</p>
                      {rootTriggerCategoryOptions.length === 0 ? (
                        <span className="block text-xs text-amber-200/70">
                          Aucune catégorie client visible avec produit actif disponible.
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {rootTriggerCategoryOptions.map((category) => {
                            const categoryValue = category.slug ?? category.id
                            const isSelected = form.trigger_product_parent_slug === categoryValue
                            const childOptions = getChildTriggerCategoryOptions(category.id)

                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => setForm((current) => ({
                                  ...current,
                                  trigger_product_parent_slug: categoryValue,
                                  trigger_product_category_slug: childOptions.length === 0 ? categoryValue : '',
                                  trigger_product_id: '',
                                }))}
                                className={choiceButtonClass(isSelected)}
                              >
                                {category.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {form.trigger_product_parent_slug && productChildCategoryOptions.length > 0 && (
                      <div className={choicePanelClass}>
                        <span className="text-sm font-medium text-stone-100">Sous-catégorie de recherche</span>                        <p className={choiceHelpClass}>Affinez la liste pour retrouver rapidement le bon produit.</p>
                        <div className="flex flex-wrap gap-2">
                          {productChildCategoryOptions.map((category) => {
                            const categoryValue = category.slug ?? category.id
                            const isSelected = form.trigger_product_category_slug === categoryValue

                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => setForm((current) => ({
                                  ...current,
                                  trigger_product_category_slug: categoryValue,
                                  trigger_product_id: '',
                                }))}
                                className={choiceButtonClass(isSelected)}
                              >
                                {category.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className={choicePanelClass}>
                      <span className="text-sm font-medium text-stone-100">Produit concerné</span>                      <p className={choiceHelpClass}>Ce produit déclenchera la promotion lorsqu’il sera présent dans le panier.</p>
                      {!form.trigger_product_category_slug ? (
                        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
                          Choisissez d’abord une catégorie principale puis une sous-catégorie si disponible.
                        </p>
                      ) : triggerProductsForSelectedCategory.length === 0 ? (
                        <span className="block text-xs text-amber-200/70">
                          Aucun produit actif et visible dans cette catégorie.
                        </span>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {triggerProductsForSelectedCategory.map((product) => {
                            const isSelected = form.trigger_product_id === product.id

                            return (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => setForm((current) => ({ ...current, trigger_product_id: product.id }))}
                                className={productChoiceClass(isSelected)}
                              >
                                {product.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isAmountTrigger && (
                  <label className="flex flex-col gap-2 text-sm">
                    Seuil minimum du panier
                    <input
                      className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                      value={form.minimum_order_amount}
                      onChange={(event) => setForm((current) => ({ ...current, minimum_order_amount: event.target.value }))}
                      placeholder="Exemple : 300"
                      inputMode="decimal"
                    />
                  </label>
                )}

                {isQuantityTrigger && (
                  <label className="flex flex-col gap-2 text-sm">
                    Quantité minimum
                    <input
                      className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                      value={form.minimum_quantity}
                      onChange={(event) => setForm((current) => ({ ...current, minimum_quantity: event.target.value }))}
                      placeholder="Exemple : 2"
                      inputMode="numeric"
                    />
                  </label>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/50">Complétez la zone 1 pour choisir le déclencheur.</p>
            )}
          </div>

          <div className={`rounded-2xl border p-5 ${zone3Accessible ? 'border-amber-500/20 bg-black/20' : 'border-white/10 bg-white/[0.03] opacity-60'}`}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/70">Zone 3</p>
                <h3 className="mt-1 text-lg font-semibold">Avantage</h3>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                {zone3Complete ? 'Complète' : zone3Accessible ? 'À compléter' : 'Verrouillée'}
              </span>
            </div>

            {zone3Accessible ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Avantage
                  <select
                    className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                    value={form.benefit_type}
                    onChange={(event) => {
                      const benefitType = event.target.value as PromotionBenefitType

                      setForm((current) => ({
                        ...current,
                        benefit_type: benefitType,
                        gift_product_parent_slug: benefitType === 'gift_product' ? current.gift_product_parent_slug : '',
                        gift_product_category_slug: benefitType === 'gift_product' ? current.gift_product_category_slug : '',
                        gift_product_id: benefitType === 'gift_product' ? current.gift_product_id : '',
                        discount_percent: benefitType === 'percent_discount' ? current.discount_percent : '',
                      }))
                    }}
                  >
                    <option value="gift_product">Produit offert</option>
                    <option value="percent_discount">Pourcentage de réduction</option>
                    <option value="free_delivery">Livraison offerte</option>
                  </select>
                </label>

                {isFreeDeliveryBenefit && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Cette promotion offrira les frais de livraison au client. Aucun produit cadeau ni pourcentage de remise n’est nécessaire.
                  </div>
                )}

                {isGiftBenefit && (
                  <div className="space-y-5 md:col-span-2">
                    {/* BF-P2-001 LOT8JD8 GIFT PRODUCT HIERARCHY */}
                    <div className={choicePanelClass}>
                      <span className="text-sm font-medium text-stone-100">Catégorie principale du cadeau</span>                      <p className={choiceHelpClass}>Choisissez d’abord la famille du produit qui sera offert.</p>
                      {rootTriggerCategoryOptions.length === 0 ? (
                        <span className="block text-xs text-amber-200/70">
                          Aucune catégorie client visible avec produit actif disponible.
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {rootTriggerCategoryOptions.map((category) => {
                            const categoryValue = category.slug ?? category.id
                            const isSelected = form.gift_product_parent_slug === categoryValue
                            const childOptions = getChildTriggerCategoryOptions(category.id)

                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => setForm((current) => ({
                                  ...current,
                                  gift_product_parent_slug: categoryValue,
                                  gift_product_category_slug: childOptions.length === 0 ? categoryValue : '',
                                  gift_product_id: '',
                                }))}
                                className={choiceButtonClass(isSelected)}
                              >
                                {category.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {form.gift_product_parent_slug && giftProductChildCategoryOptions.length > 0 && (
                      <div className={choicePanelClass}>
                        <span className="text-sm font-medium text-stone-100">Sous-catégorie du cadeau</span>                        <p className={choiceHelpClass}>Affinez la sélection du cadeau si la catégorie contient plusieurs sous-catégories.</p>
                        <div className="flex flex-wrap gap-2">
                          {giftProductChildCategoryOptions.map((category) => {
                            const categoryValue = category.slug ?? category.id
                            const isSelected = form.gift_product_category_slug === categoryValue

                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => setForm((current) => ({
                                  ...current,
                                  gift_product_category_slug: categoryValue,
                                  gift_product_id: '',
                                }))}
                                className={choiceButtonClass(isSelected)}
                              >
                                {category.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className={choicePanelClass}>
                      <span className="text-sm font-medium text-stone-100">Produit offert</span>                      <p className={choiceHelpClass}>Ce produit sera ajouté comme avantage de promotion.</p>
                      {!form.gift_product_category_slug ? (
                        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
                          Choisissez d’abord une catégorie principale puis une sous-catégorie si disponible.
                        </p>
                      ) : giftProductsForSelectedCategory.length === 0 ? (
                        <span className="block text-xs text-amber-200/70">
                          Aucun produit actif et visible dans cette catégorie.
                        </span>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {giftProductsForSelectedCategory.map((product) => {
                            const isSelected = form.gift_product_id === product.id

                            return (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => setForm((current) => ({ ...current, gift_product_id: product.id }))}
                                className={productChoiceClass(isSelected)}
                              >
                                {product.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isPercentBenefit && (
                  <label className="flex flex-col gap-2 text-sm">
                    Pourcentage de réduction
                    <input
                      className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                      value={form.discount_percent}
                      onChange={(event) => setForm((current) => ({ ...current, discount_percent: event.target.value }))}
                      placeholder="Exemple : 10"
                      inputMode="decimal"
                    />
                  </label>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/50">Complétez la zone 2 pour choisir l’avantage.</p>
            )}
            {zone3Accessible && isPercentBenefit && (
              <label className="mt-3 flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-[rgba(212,175,55,0.24)] bg-[rgba(212,175,55,0.045)] px-4 py-4 transition hover:border-[rgba(212,175,55,0.42)] hover:bg-[rgba(212,175,55,0.075)]">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[rgba(212,175,55,0.42)] bg-black/30">
                  <input
                    type="checkbox"
                    checked={form.exclude_discounted_products}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        exclude_discounted_products: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 cursor-pointer"
                    style={{ accentColor: '#d6a21e' }}
                  />
                </span>
                {/* BF-P2-001 TEMPLATE DISCOUNTED PRODUCTS CHECKBOX UI V4 */}
                <span className="block min-w-0">
                  <span className="block text-sm font-semibold text-white">
                    Exclure les produits déjà remisés
                  </span>
                  <span className="mt-1 block max-w-xl text-xs leading-relaxed text-white/55">
                    La remise ne s’appliquera pas aux produits qui ont déjà un prix barré ou une promotion.
                  </span>
                </span>
              </label>
            )}
          </div>

          <div className={`rounded-2xl border p-5 ${zone4Accessible ? 'border-amber-500/20 bg-black/20' : 'border-white/10 bg-white/[0.03] opacity-60'}`}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/70">Zone 4</p>
                <h3 className="mt-1 text-lg font-semibold">Communication et validation</h3>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                {zone4Accessible ? 'Accessible' : 'Verrouillée'}
              </span>
            </div>

            {zone4Accessible ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    Message client
                    <input
                      className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                      value={form.customer_message}
                      onChange={(event) => setForm((current) => ({ ...current, customer_message: event.target.value }))}
                      placeholder="Exemple : Votre boisson est offerte"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    Note interne
                    <textarea
                      className="min-h-24 rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white"
                      value={form.admin_note}
                      onChange={(event) => setForm((current) => ({ ...current, admin_note: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-400/20 bg-gradient-to-br from-white/[0.06] to-amber-400/[0.04] p-5 text-sm text-white/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/70">Résumé avant test</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35">Périmètre</p>
                      <p className="mt-1 font-medium text-white">{scopeLabel}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35">Déclencheur</p>
                      <p className="mt-1 font-medium text-white">{triggerLabel}{categoryLabel ? ` · ${categoryLabel}` : ''}{triggerProductLabel ? ` · ${triggerProductCategoryLabel ?? 'Produit'} / ${triggerProductLabel}` : ''}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3 md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35">Avantage</p>
                      <p className="mt-1 font-medium text-white">{benefitLabel}{giftProductLabel ? ` · ${giftProductLabel}` : ''}{isPercentBenefit && form.discount_percent ? ` · ${form.discount_percent}%` : ''}</p>
                    </div>
                  </div>
                </div>

                {remoteWriteBlocked && (
                  <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-100">
                    Création bloquée : localhost pointe vers une base Supabase distante non déclarée comme staging.
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  
                  {/* BF-P2-001 BASEFOOD ADMIN SYNC FROM AJ

                      Bouton mock local masque dans le template : les tests doivent passer par Supabase de test ou projet cible controle. */}

                  <button
                    type="button"
                    onClick={createPromotion}
                    disabled={saving || remoteWriteBlocked || !canSubmitPromotionForm}
                    className="rounded-full bg-amber-400 px-6 py-3 font-semibold text-black disabled:opacity-50"
                  >
                    {saving ? 'Enregistrement...' : remoteWriteBlocked ? 'Création bloquée' : editingPromotionId ? 'Enregistrer les modifications' : 'Créer la promotion'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-white/50">Complétez la zone 3 pour ajouter les messages et tester la promotion.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Promotions existantes</h2>
          <button
            type="button"
            onClick={loadPromotions}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/70"
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-white/50">Chargement...</p>
        ) : promotions.length === 0 ? (
          <p className="mt-6 text-sm text-white/50">Aucune promotion à afficher.</p>
        ) : (
          <div className="mt-6 grid gap-4">
            {promotions.map((promotion) => (
              <article key={promotion.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{promotion.name}</h3>
                    <p className="mt-1 text-sm text-white/50">{formatPromotionSummary(promotion)}</p>
                    {promotion.trigger_type !== 'promo_code' && describeTriggerScopeMismatch(promotion.scope, promotion.trigger_type) && (
                      <p className="mt-2 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-100">
                        Attention : {describeTriggerScopeMismatch(promotion.scope, promotion.trigger_type)} Modifiez cette promotion pour la rendre utilisable.
                      </p>
                    )}
                  </div>
                  <span className="rounded-full border border-amber-400/30 px-3 py-1 text-xs uppercase text-amber-200">
                    {getPromotionStatusLabel(promotion.status)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startPromotionEdit(promotion)}
                    title={formatPromotionSummary(promotion)}
                    className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/20"
                  >
                    Modifier
                  </button>
                  {promotion.status !== 'active' && (

                    <button

                      type="button"

                      onClick={() => updateStatus(promotion.id, 'active')}

                      className="rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30"

                    >

                      {/* BF-P2-001 BASEFOOD ADMIN ACTIVE BUTTON SYNC FROM AJ */}

                      Activer

                    </button>

                  )}
                  {promotion.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => updateStatus(promotion.id, 'inactive')}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/70"
                  >
                    Désactiver
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deletePromotion(promotion.id)}
                    className="rounded-full bg-red-500/20 px-4 py-2 text-sm text-red-100"
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
