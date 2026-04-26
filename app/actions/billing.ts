'use server'
import { createClient } from '@/lib/supabase/server'
import type { CommissionRule, BillingPeriod } from '@/lib/types/billing'

export async function recalculatePeriod(periodId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // 1. Charger la période
  const { data: period, error: pErr } = await supabase
    .from('billing_periods')
    .select('*')
    .eq('id', periodId)
    .single()

  if (pErr || !period) return { success: false, error: 'Période introuvable' }
  if (period.status !== 'en_cours') return { success: false, error: 'Période clôturée — recalcul impossible' }

  // 2. Charger le contrat + règles
  const { data: contract } = await supabase
    .from('client_contracts')
    .select('*, commission_rules(*)')
    .eq('client_id', period.client_id)
    .eq('is_active', true)
    .single()

  if (!contract) return { success: false, error: 'Contrat introuvable' }

  // 3. Commandes livrées dans la période
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, delivery_fee, status, created_at')
    .eq('status', 'livrée')
    .gte('created_at', period.period_start)
    .lte('created_at', period.period_end + 'T23:59:59')

  const validOrders = orders || []
  const ordersCount = validOrders.length

  // Base globale : total - frais livraison
  const baseAmount = validOrders.reduce((sum, o) => {
    return sum + Math.max((o.total ?? 0) - (o.delivery_fee ?? 0), 0)
  }, 0)

  const rules: CommissionRule[] = contract.commission_rules || []
  let commission = 0

  switch (contract.billing_mode) {

    case 'flat_only':
      commission = 0
      break

    case 'flat_percent': {
      const rule = rules.find(r => r.rule_type === 'flat_percent')
      if (rule?.rate_percent) commission = (baseAmount * rule.rate_percent) / 100
      break
    }

    case 'flat_tiered': {
      const tiers = rules
        .filter(r => r.rule_type === 'tier')
        .sort((a, b) => (a.tier_from ?? 0) - (b.tier_from ?? 0))
      let remaining = baseAmount
      for (const tier of tiers) {
        if (remaining <= 0) break
        const from = tier.tier_from ?? 0
        const to   = tier.tier_to ?? Infinity
        const rate = (tier.rate_percent ?? 0) / 100
        const slice = Math.min(remaining, to - from)
        commission += slice * rate
        remaining  -= slice
      }
      break
    }

    case 'flat_category': {
      // Charger tous les order_items des commandes livrées avec la subcategory du produit
      if (validOrders.length > 0) {
        const orderIds = validOrders.map(o => o.id)

        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, product_id, quantity, unit_price')
          .in('order_id', orderIds)

        if (items && items.length > 0) {
          // Récupérer les subcategories des produits concernés
          const productIds = [...new Set(items.map(i => i.product_id))]
          const { data: products } = await supabase
            .from('products')
            .select('id, subcategory')
            .in('id', productIds)

          const productMap: Record<string, string> = {}
          ;(products || []).forEach(p => { productMap[p.id] = p.subcategory })

          // Calcul par catégorie
          const catRules = rules.filter(r => r.rule_type === 'category')

          for (const item of items) {
            const subcategory = productMap[item.product_id]
            if (!subcategory) continue
            const rule = catRules.find(r => r.category_slug === subcategory)
            if (!rule?.rate_percent) continue
            const itemTotal = (item.unit_price ?? 0) * (item.quantity ?? 1)
            commission += (itemTotal * rule.rate_percent) / 100
          }
        }
      }
      break
    }

    case 'flat_per_order': {
      const rule = rules.find(r => r.rule_type === 'per_order')
      if (rule?.amount_per_order) commission = ordersCount * rule.amount_per_order
      break
    }
  }

  // 4. Minimum garanti / plafond
  if (contract.minimum_guarantee && commission < contract.minimum_guarantee) {
    commission = contract.minimum_guarantee
  }
  if (contract.maximum_cap && commission > contract.maximum_cap) {
    commission = contract.maximum_cap
  }

  // 5. Ajustements
  const { data: adjustments } = await supabase
    .from('billing_adjustments')
    .select('amount, type')
    .eq('billing_period_id', periodId)

  const adjustmentsTotal = (adjustments || []).reduce((sum, a) => {
    return (a.type === 'remise' || a.type === 'avoir')
      ? sum - Math.abs(a.amount)
      : sum + Math.abs(a.amount)
  }, 0)

  // 6. Total dû
  const totalDue = period.flat_fee_amount + commission + adjustmentsTotal

  // 7. Mettre à jour la période
  await supabase
    .from('billing_periods')
    .update({
      orders_count:       ordersCount,
      orders_base_amount: Math.round(baseAmount * 100) / 100,
      commission_amount:  Math.round(commission * 100) / 100,
      adjustments_total:  Math.round(adjustmentsTotal * 100) / 100,
      total_due:          Math.round(totalDue * 100) / 100,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', periodId)

  return { success: true }
}
