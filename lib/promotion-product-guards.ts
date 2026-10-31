import type { PromotionProductCandidate } from './types/promotion'

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function isProductActive(product: PromotionProductCandidate | null | undefined): boolean {
  if (!product) return false
  if (product.active === false) return false
  if (product.disabled === true) return false
  return true
}

export function isProductVisible(product: PromotionProductCandidate | null | undefined): boolean {
  if (!product) return false
  if (product.hidden === true) return false
  if (product.visible === false) return false
  if (product.is_visible === false) return false
  return true
}

export function isProductAvailable(product: PromotionProductCandidate | null | undefined): boolean {
  if (!product) return false
  if (product.available === false) return false
  if (typeof product.stock === 'number' && product.stock <= 0) return false
  return true
}

export function hasProductDiscount(product: PromotionProductCandidate | null | undefined): boolean {
  if (!product) return false
  return toNumber(product.discount, 0) > 0
}

export function isPromotionEligibleProduct(product: PromotionProductCandidate | null | undefined): boolean {
  return isProductActive(product) && isProductVisible(product) && isProductAvailable(product)
}

export function isVipProduct(product: PromotionProductCandidate | null | undefined): boolean {
  if (!product) return false
  return Boolean(product.is_vip ?? product.isVip ?? false)
}

export function getProductPrice(product: PromotionProductCandidate | null | undefined): number {
  return Math.max(0, toNumber(product?.price, 0))
}

export function getProductCategoryKeys(product: PromotionProductCandidate | null | undefined): string[] {
  if (!product) return []
  return [product.category, product.subcategory].filter((value): value is string => Boolean(value))
}
