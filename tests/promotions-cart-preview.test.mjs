// BLAC-P3-009 : apercu panier cote serveur, base simulee STRICTE (aucun reseau, aucune vraie base).
import './helpers/env.mjs'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { install, setPhase, seedStrict, getFakeTable, getLog, clearLog } from './helpers/strict-fake-db.mjs'
import { makeReq } from './helpers/req.mjs'

install()
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })
Object.defineProperty(Object.prototype, 'rpc', {
  configurable: true, writable: true, enumerable: false,
  value: async (n) => (n === 'get_next_invoice_seq' ? { data: 1, error: null } : { data: null, error: null }),
})
after(() => { delete Object.prototype.rpc })

const preview = await import('@/app/api/promotions/preview/route')
const commandes = await import('@/app/api/commandes/route')
const { createVipSessionValue, VIP_COOKIE_NAME } = await import('@/lib/vip-session')

const VIP_PHONE = '+33612345678'
const base = (o) => ({
  description: null, status: 'active', starts_at: null, ends_at: null, priority: 1, scope: 'all',
  trigger_type: 'cart_amount', trigger_product_ids: [], trigger_category_ids: [],
  minimum_order_amount: 1, minimum_quantity: null, benefit_type: 'percent_discount',
  gift_product_ids: [], discount_percent: 10, exclude_discounted_products: true,
  stacking_mode: 'best_offer', customer_message: 'msg', admin_note: null,
  promotion_mode: 'automatic', code: null, usage_limit_total: null, usage_limit_per_customer: null,
  usage_count: 0, customer_identifier_type: null, is_stackable: false, ...o,
})
const PRODUCTS = [
  { id: 'p1', name: 'Produit 1', price: 100, discount: 0, variants: null, is_vip: false, active: true },
  { id: 'p2', name: 'Produit remise', price: 200, discount: 20, variants: null, is_vip: false, active: true },
  { id: 'pv', name: 'Produit VIP', price: 100, discount: 0, variants: null, is_vip: true, active: true },
  { id: 'g1', name: 'Cadeau', price: 50, discount: 0, variants: null, is_vip: false, active: true, stock: 10 },
]
function seed(rules) {
  setPhase('after')
  seedStrict({
    settings: [
      { key: 'status', value: 'open' },
      { key: 'vip_access_enabled', value: 'true' },
      { key: 'vip_allowed_phones', value: JSON.stringify([VIP_PHONE]) },
    ],
    products: PRODUCTS,
    delivery_slots: [{ id: 's1', capacity: 50, booked: 0, blocked: false }],
    orders: [], order_items: [],
    promotion_rules: rules, promotion_benefits: [],
  })
  clearLog()
}
const vipCookie = () => `${VIP_COOKIE_NAME}=${createVipSessionValue(VIP_PHONE)}`
const prev = async (items, extra = {}) => {
  const res = await preview.POST(makeReq('http://x/api/promotions/preview', { body: { items, ...extra.body }, cookie: extra.cookie }))
  return res.json()
}

test('(a) promotion VIP, client sans produit VIP : aucune remise annoncee', async () => {
  seed([base({ id: 'rv', name: 'VIP 5', scope: 'vip', discount_percent: 5 })])
  const out = await prev([{ product_id: 'p1', quantity: 2 }])
  assert.equal(out.discount_total, 0)
  assert.deepEqual(out.labels, [])
})

test('(b) promotion VIP avec produit VIP : remise egale a la route de commande', async () => {
  seed([base({ id: 'rv', name: 'VIP 5', scope: 'vip', discount_percent: 5 })])
  const out = await prev([{ product_id: 'pv', quantity: 3 }], { cookie: vipCookie() })
  assert.ok(out.discount_total > 0, 'remise attendue')
  const res = await commandes.POST(makeReq('http://x/api/commandes', {
    cookie: vipCookie(),
    body: { name: 'C', phone: VIP_PHONE, address: 'a', slot_id: 's1', items: [{ product_id: 'pv', product_name: 'x', quantity: 3, unit_price: 1 }] },
  }))
  assert.equal(res.status, 200, 'commande refusee')
  const row = getFakeTable('order_items')[0]
  const orderDiscount = (100 - row.unit_price) * 3
  assert.equal(out.discount_total, orderDiscount)
})

test('(c) pourcentage avec seuil : non atteint puis atteint', async () => {
  seed([base({ id: 'r1', name: 'Remise 10', minimum_order_amount: 150 })])
  assert.equal((await prev([{ product_id: 'p1', quantity: 1 }])).discount_total, 0)
  assert.equal((await prev([{ product_id: 'p1', quantity: 2 }])).discount_total, 20)
})

test('(d) produit offert', async () => {
  seed([base({ id: 'r2', name: 'Cadeau', benefit_type: 'gift_product', gift_product_ids: ['g1'], discount_percent: null, minimum_order_amount: 150 })])
  const out = await prev([{ product_id: 'p1', quantity: 2 }])
  assert.equal(out.gifts.length, 1)
  assert.equal(out.gifts[0].product_id, 'g1')
})

test('(e) produit deja remis exclu', async () => {
  seed([base({ id: 'r1', name: 'Remise 10', minimum_order_amount: 150, exclude_discounted_products: true })])
  const out = await prev([{ product_id: 'p2', quantity: 1 }])
  assert.equal(out.discount_total, 0)
})

test('(f) prix falsifie envoye par le client ignore', async () => {
  seed([base({ id: 'r1', name: 'Remise 10', minimum_order_amount: 150 })])
  const out = await prev([{ product_id: 'p1', quantity: 2, unit_price: 1, price: 1 }])
  assert.equal(out.discount_total, 20)
})

test('(g) aucune ecriture en base, compteur d usage inchange', async () => {
  seed([base({ id: 'rc', name: 'Code', trigger_type: 'promo_code', promotion_mode: 'promo_code', code: 'PROMO10', usage_limit_total: 5, usage_count: 2 })])
  const out = await prev([{ product_id: 'p1', quantity: 2 }], { body: { promo_code: 'PROMO10' } })
  assert.ok(out.discount_total > 0)
  assert.deepEqual(getLog().filter((l) => l.op !== 'select'), [])
  assert.equal(getFakeTable('promotion_rules')[0].usage_count, 2)
  assert.equal(getFakeTable('orders').length, 0)
})

test('(h) cles serveur absentes : reponse vide sans erreur', async () => {
  seed([base({ id: 'r1', name: 'Remise 10', minimum_order_amount: 150 })])
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const res = await preview.POST(makeReq('http://x/api/promotions/preview', { body: { items: [{ product_id: 'p1', quantity: 2 }] } }))
    assert.equal(res.status, 200)
    const out = await res.json()
    assert.equal(out.discount_total, 0)
    assert.deepEqual(out.gifts, [])
    assert.deepEqual(out.labels, [])
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
    process.env.SUPABASE_SERVICE_ROLE_KEY = key
  }
})
