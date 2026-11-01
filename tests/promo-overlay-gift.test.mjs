// BLAC-P3-011 : route publique + logique de l'overlay pour les promotions a produit offert (aucun reseau, aucune vraie base).
import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { install, setPhase, seedStrict, declareTable, clearLog } from './helpers/strict-fake-db.mjs'

install()
const publicRoute = await import('@/app/api/promotions/route')
const overlay = await import('@/lib/promo-overlay')

declareTable('products', ['id', 'name', 'image_url', 'is_vip', 'active', 'price', 'cost_price', 'stock', 'description'])

const rule = (o) => ({
  description: null, status: 'active', starts_at: null, ends_at: null, priority: 1, scope: 'all',
  trigger_type: 'cart_amount', trigger_product_ids: [], trigger_category_ids: [],
  minimum_order_amount: null, minimum_quantity: null, benefit_type: 'gift_product',
  gift_product_ids: [], discount_percent: null, exclude_discounted_products: true,
  stacking_mode: 'best_offer', customer_message: 'msg', admin_note: 'SECRET ADMIN',
  promotion_mode: 'automatic', code: null, usage_limit_total: null, usage_limit_per_customer: null,
  usage_count: 0, customer_identifier_type: null, is_stackable: false, ...o,
})
const product = (o) => ({
  id: 'g1', name: 'Ambassade', image_url: 'https://img.test/ambassade.png', is_vip: false, active: true,
  price: 10, cost_price: 4, stock: 99, description: 'INTERNE', ...o,
})
const benefit = (o) => ({
  id: 'b1', promotion_rule_id: 'r1', benefit_type: 'gift_product', product_id: 'g1', quantity: 1,
  sort_order: 100, ...o,
})
function seed({ rules, products = [], benefits = [] }) {
  setPhase('after')
  seedStrict({ promotion_rules: rules, promotion_benefits: benefits, products })
  clearLog()
}
const fetchPromos = async () => (await (await publicRoute.GET()).json()).promotions

test('(a) regle cadeau : nom, photo, quantite et aucun champ interne', async () => {
  seed({ rules: [rule({ id: 'r1', name: 'Grande reserve', gift_product_ids: ['g1'] })], products: [product()] })
  const promos = await fetchPromos()
  assert.equal(promos.length, 1)
  assert.deepEqual(promos[0].gifts, [{ product_id: 'g1', name: 'Ambassade', image_url: 'https://img.test/ambassade.png', quantity: 1 }])
  const raw = JSON.stringify(promos)
  for (const forbidden of ['cost_price', 'stock', 'INTERNE', 'SECRET ADMIN', 'price']) assert.ok(!raw.includes(forbidden), forbidden)
})

test('(b) cadeau par identifiants de la regle ET par avantage lie', async () => {
  seed({
    rules: [rule({ id: 'r1', name: 'Par ids', gift_product_ids: ['g1'] }), rule({ id: 'r2', name: 'Par avantage', priority: 2 })],
    products: [product(), product({ id: 'g2', name: 'Briquet', image_url: 'https://img.test/briquet.png' })],
    benefits: [benefit({ promotion_rule_id: 'r2', product_id: 'g2', quantity: 2 })],
  })
  const promos = await fetchPromos()
  assert.deepEqual(promos.find((p) => p.id === 'r1').gifts.map((g) => g.product_id), ['g1'])
  const byBenefit = promos.find((p) => p.id === 'r2').gifts
  assert.deepEqual(byBenefit.map((g) => [g.product_id, g.quantity]), [['g2', 2]])
})

test('(c) produit inactif ou introuvable : promotion renvoyee sans cadeau', async () => {
  seed({
    rules: [rule({ id: 'r1', name: 'Inactif', gift_product_ids: ['g1'] }), rule({ id: 'r2', name: 'Introuvable', priority: 2, gift_product_ids: ['absent'] })],
    products: [product({ active: false })],
  })
  const promos = await fetchPromos()
  assert.equal(promos.length, 2)
  assert.deepEqual(promos.find((p) => p.id === 'r1').gifts, [])
  assert.deepEqual(promos.find((p) => p.id === 'r2').gifts, [])
})

test('(d) produit VIP : cache en portee tous, renvoye en portee VIP', async () => {
  seed({
    rules: [rule({ id: 'r1', name: 'Tous', scope: 'all', gift_product_ids: ['v1'] }), rule({ id: 'r2', name: 'VIP', scope: 'vip', priority: 2, gift_product_ids: ['v1'] })],
    products: [product({ id: 'v1', name: 'Reserve VIP', is_vip: true })],
  })
  const promos = await fetchPromos()
  assert.deepEqual(promos.find((p) => p.id === 'r1').gifts, [])
  assert.deepEqual(promos.find((p) => p.id === 'r2').gifts.map((g) => g.product_id), ['v1'])
})

test('(e) regle pourcentage : aucun cadeau dans la reponse', async () => {
  seed({
    rules: [rule({ id: 'r1', name: 'Remise', benefit_type: 'percent_discount', discount_percent: 10, gift_product_ids: ['g1'] })],
    products: [product()],
  })
  const promos = await fetchPromos()
  assert.equal(promos.length, 1)
  assert.ok(!('gifts' in promos[0]))
})

const gift = (o) => ({ product_id: 'g1', name: 'Ambassade', image_url: 'https://img.test/a.png', quantity: 1, ...o })
const promoWith = (gifts, o = {}) => ({ id: 'r1', name: 'Grande reserve', benefit_type: 'gift_product', scope: 'all', gifts, ...o })

test('(f) presentation cadeau seulement si un cadeau a une photo', () => {
  assert.equal(overlay.selectOverlayPresentation(promoWith([gift()])).mode, 'gift')
  assert.equal(overlay.selectOverlayPresentation(promoWith([gift({ image_url: null })])).mode, 'default')
  assert.equal(overlay.selectOverlayPresentation(promoWith([])).mode, 'default')
  assert.equal(overlay.selectOverlayPresentation(promoWith(undefined)).mode, 'default')
  assert.equal(overlay.selectOverlayPresentation(promoWith([gift()], { benefit_type: 'percent_discount' })).mode, 'default')
  assert.equal(overlay.selectOverlayPresentation(null).mode, 'default')
})

test('(g) plusieurs cadeaux : premier choisi, compteur des autres et libelle', () => {
  const p = overlay.selectOverlayPresentation(promoWith([
    gift({ product_id: 'a', name: 'Premier', quantity: 2 }),
    gift({ product_id: 'b', name: 'Second' }),
    gift({ product_id: 'c', name: 'Troisieme' }),
  ]))
  assert.equal(p.mode, 'gift')
  assert.equal(p.primary.product_id, 'a')
  assert.equal(p.othersCount, 2)
  assert.equal(p.label, '2 x Premier')
  const sansPhoto = overlay.selectOverlayPresentation(promoWith([gift({ product_id: 'a', image_url: null }), gift({ product_id: 'b', name: 'Avec photo' })]))
  assert.equal(sansPhoto.primary.product_id, 'b')
  assert.equal(sansPhoto.othersCount, 1)
})
