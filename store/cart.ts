'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product } from '@/lib/types'

export function getVariantPriceExtra(product: Product, selectedVariants?: Record<string, string>): number {
  if (!product.variants || !selectedVariants) return 0
  return product.variants.reduce((sum, vt) => {
    const chosen = selectedVariants[vt.type]
    if (chosen && vt.prices && vt.prices[chosen] !== undefined) return sum + vt.prices[chosen]
    return sum
  }, 0)
}

interface CartStore {
  items: CartItem[]
  hydrated: boolean
  setHydrated: () => void
  add: (product: Product, isVip?: boolean, selectedVariants?: Record<string, string>) => void
  remove: (productId: string) => void
  update: (productId: string, quantity: number) => void
  clear: () => void
  total: () => number
  count: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      add: (product, isVip = false, selectedVariants?) => {
        const items = get().items
        const existing = items.find(i => i.product.id === product.id && JSON.stringify(i.selectedVariants) === JSON.stringify(selectedVariants))
        if (existing) {
          set({ items: items.map(i => i.product.id === product.id && JSON.stringify(i.selectedVariants) === JSON.stringify(selectedVariants) ? { ...i, quantity: i.quantity + 1 } : i) })
        } else {
          set({ items: [...items, { product, quantity: 1, isVip, selectedVariants }] })
        }
      },
      remove: (productId) => set({ items: get().items.filter(i => i.product.id !== productId) }),
      update: (productId, quantity) => {
        if (quantity <= 0) get().remove(productId)
        else set({ items: get().items.map(i => i.product.id === productId ? { ...i, quantity } : i) })
      },
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => {
        const basePrice = (i.product.discount ?? 0) > 0
          ? Math.ceil(i.product.price * (1 - (i.product.discount ?? 0) / 100))
          : i.product.price
        let variantExtra = 0
        if (i.selectedVariants && i.product.variants) {
          for (const vt of i.product.variants) {
            const chosen = i.selectedVariants[vt.type]
            if (chosen && vt.prices && vt.prices[chosen] !== undefined) {
              variantExtra += vt.prices[chosen]
            }
          }
        }
        return sum + (basePrice + variantExtra) * i.quantity
      }, 0),
      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'black-deew-cart', onRehydrateStorage: () => (state) => { state?.setHydrated() } }
  )
)
