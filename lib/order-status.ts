import type { OrderStatus } from '@/lib/types'

export const ORDER_STATUSES: OrderStatus[] = [
  'nouvelle',
  'confirmée',
  'en_preparation',
  'en_livraison',
  'livrée',
  'annulée',
]

export const BUSINESS_ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'nouvelle',
  'confirmée',
  'en_preparation',
  'en_livraison',
  'livrée',
]

const CANCELLED_STATUS_KEYS = new Set([
  'annulee',
  'annule',
  'annulation',
  'cancelled',
  'canceled',
  'cancel',
])

const STATUS_BY_KEY: Record<string, OrderStatus> = {
  nouvelle: 'nouvelle',
  confirmee: 'confirmée',
  confirme: 'confirmée',
  en_preparation: 'en_preparation',
  preparation: 'en_preparation',
  en_livraison: 'en_livraison',
  livraison: 'en_livraison',
  livree: 'livrée',
  livre: 'livrée',
  annulee: 'annulée',
  annule: 'annulée',
  annulation: 'annulée',
  cancelled: 'annulée',
  canceled: 'annulée',
  cancel: 'annulée',
}

export function normalizeOrderStatus(status: unknown): string {
  return String(status ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

export function canonicalizeOrderStatus(status: unknown): OrderStatus | null {
  const key = normalizeOrderStatus(status)
  return STATUS_BY_KEY[key] ?? null
}

export function isCancelledOrderStatus(status: unknown): boolean {
  return CANCELLED_STATUS_KEYS.has(normalizeOrderStatus(status))
}

export function isBusinessActiveOrder<T extends { status?: unknown }>(
  order: T | null | undefined
): order is T {
  if (!order) return false
  return !isCancelledOrderStatus(order.status)
}
