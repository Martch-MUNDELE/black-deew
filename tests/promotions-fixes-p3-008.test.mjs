// BLAC-P3-008 : test dedie aux 3 corrections du parcours promotion (aucun reseau, aucune vraie base).
import './helpers/env.mjs'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { install, strictClient, setPhase, seedStrict, getFakeTable, clearLog } from './helpers/strict-fake-db.mjs'
import { makeReq } from './helpers/req.mjs'

install()
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })
Object.defineProperty(Object.prototype, 'rpc', {
  configurable: true, writable: true, enumerable: false,
  value: async (n) => (n === 'get_next_invoice_seq' ? { data: 1, error: null } : { data: null, error: null }),
})
after(() => { delete Object.prototype.rpc })

const commandes = await import('@/app/api/commandes/route')
const publicRoute = await import('@/app/api/promotions/route')
const { validatePromotionRule, loadActivePromotionRules, selectPublicPromotions } = await import('@/lib/promotion-rules')

const rule = (o) => ({
  description: null, status: 'active', starts_at: null, ends_at: null, priority: 1, scope: 'all',
  trigger_type: 'cart_amount', trigger_product_ids: [], trigger_category_ids: [],
  minimum_order_amount: null, minimum_quantity: null, benefit_type: 'percent_discount',
  gift_product_ids: [], discount_percent: null, exclude_discounted_products: true,
  stacking_mode: 'best_offer', customer_message: 'msg', admin_note: 'SECRET ADMIN',
  promotion_mode: 'automatic', code: null, usage_limit_total: null, usage_limit_per_customer: null,
  usage_count: 0, customer_identifier_type: null, is_stackable: false, ...o,
})
const PRODUCTS = [{ id: 'p1', name: 'Produit 1', price: 100, discount: 0, variants: null, is_vip: false, active: true }]
function seed(rules) {
  setPhase('after')
  seedStrict({
    settings: [{ key: 'status', value: 'open' }], products: PRODUCTS,
    delivery_slots: [{ id: 's1', capacity: 50, booked: 0, blocked: false }],
    orders: [], order_items: [], promotion_rules: rules, promotion_benefits: [],
  })
  clearLog()
}
const body = (o = {}) => ({ name: 'Client', phone: '+33622222222', address: '1 rue X', slot_id: 's1', items: [{ product_id: 'p1', product_name: 'x', quantity: 2, unit_price: 1 }], ...o })
const post = (b) => commandes.POST(makeReq('http://x/api/commandes', { body: b }))

test('F1 valeurs invalides refusees avec message francais', () => {
  const bad = [
    { benefit_type: 'percent_discount', discount_percent: 150 },
    { benefit_type: 'percent_discount', discount_percent: -5 },
    { minimum_order_amount: -1 },
    { minimum_quantity: 0 },
    { promotion_mode: 'promo_code', code: '' },
    { promotion_mode: 'promo_code', code: 'A B' },
    { starts_at: '2026-02-01T00:00:00Z', ends_at: '2026-01-01T00:00:00Z' },
    { benefit_type: 'gift_product', gift_product_ids: [] },
  ]
  for (const b of bad) {
    const out = validatePromotionRule(b)
    assert.equal(out.ok, false, JSON.stringify(b))
    assert.ok(out.errors.length > 0)
  }
  assert.equal(validatePromotionRule({ benefit_type: 'percent_discount', discount_percent: 10, minimum_order_amount: 150 }).ok, true)
})

test('F1b commande : regle invalide ignoree cote serveur', async () => {
  seed([rule({ id: 'bad', name: 'pct150', discount_percent: 150, minimum_order_amount: 100 })])
  const res = await post(body())
  assert.equal(res.status, 200)
  assert.equal(getFakeTable('order_items')[0].unit_price, 100)
})

test('F2 limite par client : 2e commande du meme telephone refusee en 409', async () => {
  seed([rule({ id: 'rc', name: 'Code', trigger_type: 'promo_code', promotion_mode: 'promo_code', code: 'PROMO10', discount_percent: 10, usage_limit_per_customer: 1 })])
  assert.equal((await post(body({ promo_code: 'PROMO10' }))).status, 200)
  const r2 = await post(body({ promo_code: 'PROMO10' }))
  assert.equal(r2.status, 409)
  assert.ok(/limite/i.test((await r2.json()).error))
  // un autre telephone n'est pas bloque
  assert.equal((await post(body({ promo_code: 'PROMO10', phone: '+33633333333' }))).status, 200)
})

test('F3 visiteur anonyme : lecture directe vide, route publique renvoie les promotions sans fuite', async () => {
  seed([rule({ id: 'r1', name: 'Remise 10', discount_percent: 10, minimum_order_amount: 150 })])
  assert.deepEqual(selectPublicPromotions(await loadActivePromotionRules(strictClient('anon'))), [])
  const res = await publicRoute.GET()
  const json = await res.json()
  assert.deepEqual(json.promotions.map((p) => p.id), ['r1'])
  assert.ok(!JSON.stringify(json).includes('SECRET ADMIN'))
})

test('F3b cle de service absente : liste vide sans erreur', async () => {
  seed([rule({ id: 'r1', name: 'Remise 10', discount_percent: 10 })])
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const res = await publicRoute.GET()
    assert.equal(res.status, 200)
    assert.deepEqual((await res.json()).promotions, [])
  } finally { if (saved !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved }
})
