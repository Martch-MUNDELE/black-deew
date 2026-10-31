// BLAC-P2-013 : tests du moteur de promotions Black Deew (lancer avec node --test)
import test from 'node:test'
import assert from 'node:assert/strict'

const { applyPromotions } = await import('../lib/promotions.ts')

const catalog = [
  { id: 'p1', name: 'Produit 1', price: 50, active: true, is_vip: false, discount: 0 },
  { id: 'p2', name: 'Produit 2', price: 30, active: true, is_vip: false, discount: 0 },
  { id: 'p3', name: 'Produit remisé', price: 40, active: true, is_vip: false, discount: 20 },
  { id: 'g1', name: 'Cadeau', price: 10, active: true, is_vip: false, discount: 0 },
]

const line = (id, qty = 1, extra = {}) => {
  const product = catalog.find((p) => p.id === id)
  return {
    product_id: id,
    product_name: product.name,
    quantity: qty,
    unit_price: product.price,
    original_unit_price: product.price,
    product,
    is_vip: false,
    ...extra,
  }
}

const rule = (overrides = {}, benefit = { benefit_type: 'percent_discount', discount_percent: 10 }) => ({
  id: 'r1',
  name: 'Règle test',
  status: 'active',
  scope: 'all',
  trigger_type: 'cart_amount',
  minimum_order_amount: 0,
  benefit_type: benefit.benefit_type,
  discount_percent: benefit.discount_percent ?? null,
  exclude_discounted_products: true,
  stacking_mode: 'best_offer',
  benefits: [benefit],
  ...overrides,
})

test('règle brouillon : aucun avantage appliqué', () => {
  const res = applyPromotions([line('p1', 2)], catalog, [rule({ status: 'draft' })])
  assert.equal(res.applied.length, 0)
  assert.equal(res.discount_total, 0)
})

test('règle inactive : aucun avantage appliqué', () => {
  const res = applyPromotions([line('p1', 2)], catalog, [rule({ status: 'inactive' })])
  assert.equal(res.applied.length, 0)
})

test('règle active : avantage appliqué', () => {
  const res = applyPromotions([line('p1', 2)], catalog, [rule()])
  assert.equal(res.applied.length, 1)
  assert.ok(res.discount_total > 0)
})

test('déclencheur montant : sous le seuil rien, au-dessus oui', () => {
  const r = rule({ trigger_type: 'cart_amount', minimum_order_amount: 100 })
  assert.equal(applyPromotions([line('p1', 1)], catalog, [r]).applied.length, 0)
  assert.equal(applyPromotions([line('p1', 2)], catalog, [r]).applied.length, 1)
})

test('déclencheur quantité : sous le seuil rien, au seuil oui', () => {
  const r = rule({ trigger_type: 'cart_quantity', minimum_quantity: 3 })
  assert.equal(applyPromotions([line('p1', 2)], catalog, [r]).applied.length, 0)
  assert.equal(applyPromotions([line('p1', 3)], catalog, [r]).applied.length, 1)
})

test('pourcentage : 10 % de 100 = 10', () => {
  const res = applyPromotions([line('p1', 2)], catalog, [rule()])
  assert.equal(res.discount_total, 10)
})

test('montant fixe : remise fixe appliquée', () => {
  const r = rule({}, { benefit_type: 'fixed_discount', fixed_discount_amount: 15 })
  const res = applyPromotions([line('p1', 2)], catalog, [r])
  assert.equal(res.applied.length, 1)
  assert.equal(res.discount_total, 15)
})

test('produit offert : ligne cadeau ajoutée', () => {
  const r = rule({}, { benefit_type: 'gift_product', product_id: 'g1', quantity: 1 })
  const res = applyPromotions([line('p1', 2)], catalog, [r])
  assert.ok(res.items.some((i) => i.is_promotion_gift === true && i.product_id === 'g1'))
})

test('livraison gratuite : drapeau activé', () => {
  const r = rule({}, { benefit_type: 'free_delivery', free_delivery: true })
  const res = applyPromotions([line('p1', 2)], catalog, [r])
  assert.equal(res.free_delivery_applied, true)
})

test('produit déjà remisé exclu du pourcentage par défaut', () => {
  const res = applyPromotions([line('p3', 5)], catalog, [rule()])
  assert.equal(res.discount_total, 0)
})

test('arrondi : prix remisé arrondi à l’entier supérieur (10 % de 33 -> 30)', () => {
  const cat = [...catalog, { id: 'p4', name: 'Produit 33', price: 33, active: true, is_vip: false, discount: 0 }]
  const l = { ...line('p1', 1), product_id: 'p4', unit_price: 33, original_unit_price: 33, product: cat[4] }
  const res = applyPromotions([l], cat, [rule()])
  assert.equal(res.items[0].unit_price, Math.ceil(33 * 0.9))
  assert.equal(res.items[0].unit_price, 30)
})

test('arrondi : identique à la formule panier / VIP / serveur', () => {
  for (const [price, pct] of [[33, 10], [50, 15], [199, 7], [10, 33]]) {
    const cat = [{ id: 'x', name: 'X', price, active: true, is_vip: false, discount: 0 }]
    const l = { product_id: 'x', product_name: 'X', quantity: 1, unit_price: price, original_unit_price: price, product: cat[0] }
    const r = rule({ discount_percent: pct }, { benefit_type: 'percent_discount', discount_percent: pct })
    const res = applyPromotions([l], cat, [r])
    assert.equal(res.items[0].unit_price, Math.ceil(price * (1 - pct / 100)))
  }
})

function fakeSupabase(tables) {
  const make = (rows) => {
    const chain = {
      select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
      then: (resolve) => resolve({ data: rows, error: null }),
    }
    return chain
  }
  return { from: (t) => make(tables[t] ?? []) }
}

test('règle expirée / future filtrée au chargement, règle en cours conservée', async () => {
  const { loadActivePromotionRules } = await import('../lib/promotion-rules.ts')
  const past = new Date(Date.now() - 86400000 * 2).toISOString()
  const past1 = new Date(Date.now() - 86400000).toISOString()
  const future = new Date(Date.now() + 86400000).toISOString()
  const base = { status: 'active', scope: 'all', trigger_type: 'cart_amount', benefit_type: 'free_delivery', priority: 1 }
  const rows = [
    { ...base, id: 'expiree', name: 'Expirée', starts_at: past, ends_at: past1 },
    { ...base, id: 'future', name: 'Future', starts_at: future, ends_at: null },
    { ...base, id: 'en-cours', name: 'En cours', starts_at: past, ends_at: future },
  ]
  const rules = await loadActivePromotionRules(fakeSupabase({ promotion_rules: rows }))
  assert.deepEqual(rules.map((r) => r.id), ['en-cours'])
})

const { filterRulesForPromoCode } = await import('../lib/promotions.ts')

test('code promo valide : règle à code incluse (insensible à la casse)', () => {
  const r = rule({ id: 'c1', promotion_mode: 'promo_code', code: 'BIENVENUE' })
  const res = filterRulesForPromoCode([r], ' bienvenue ')
  assert.equal(res.codeValid, true)
  assert.equal(res.rules.length, 1)
})

test('code promo invalide : refusé, règle à code exclue', () => {
  const r = rule({ id: 'c1', promotion_mode: 'promo_code', code: 'BIENVENUE' })
  const res = filterRulesForPromoCode([r], 'FAUX')
  assert.equal(res.codeValid, false)
  assert.equal(res.rules.length, 0)
})

test('sans code saisi : règles à code ignorées, automatiques conservées', () => {
  const rc = rule({ id: 'c1', promotion_mode: 'promo_code', code: 'X1' })
  const ra = rule({ id: 'a1', promotion_mode: 'automatic' })
  const res = filterRulesForPromoCode([rc, ra], '')
  assert.equal(res.codeValid, true)
  assert.deepEqual(res.rules.map((x) => x.id), ['a1'])
})

test('cumul best_offer : seule la meilleure règle s’applique', () => {
  const r10 = rule({ id: 'r10', stacking_mode: 'best_offer' })
  const r20 = rule({ id: 'r20', stacking_mode: 'best_offer', discount_percent: 20 }, { benefit_type: 'percent_discount', discount_percent: 20 })
  const res = applyPromotions([line('p1', 2)], catalog, [r10, r20])
  assert.equal(res.applied.length, 1)
  assert.equal(res.applied[0].promotion_id, 'r20')
})

test('cumul exclusive : une règle exclusive écarte les autres', () => {
  const ex = rule({ id: 'ex', stacking_mode: 'exclusive' }, { benefit_type: 'fixed_discount', fixed_discount_amount: 5 })
  const other = rule({ id: 'o', stacking_mode: 'cumulable_discount_only', discount_percent: 50 }, { benefit_type: 'percent_discount', discount_percent: 50 })
  const res = applyPromotions([line('p1', 2)], catalog, [ex, other])
  assert.deepEqual(res.applied.map((a) => a.promotion_id), ['ex'])
})

test('cumul cumulable_gift_only : cadeau cumulé avec la meilleure remise', () => {
  const gift = rule({ id: 'g', stacking_mode: 'cumulable_gift_only' }, { benefit_type: 'gift_product', product_id: 'g1', quantity: 1 })
  const pct = rule({ id: 'p', stacking_mode: 'best_offer' })
  const res = applyPromotions([line('p1', 2)], catalog, [gift, pct])
  assert.equal(res.applied.length, 2)
  assert.ok(res.items.some((i) => i.is_promotion_gift))
  assert.ok(res.discount_total > 0)
})
