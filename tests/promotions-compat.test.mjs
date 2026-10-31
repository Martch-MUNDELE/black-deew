// BLAC-P3-006 : compatibilite de la route de commande avec une base SANS migration promotions.
import './helpers/env.mjs'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb, getFakeTable, createClient } from './helpers/fake-supabase.mjs'
import { makeReq } from './helpers/req.mjs'

// Le faux client n'a pas de rpc : on en fournit un localement (helpers non modifies).
Object.defineProperty(Object.prototype, 'rpc', {
  configurable: true, writable: true, enumerable: false,
  value: async (name) => (name === 'get_next_invoice_seq' ? { data: 1, error: null } : { data: null, error: null }),
})
after(() => { delete Object.prototype.rpc })

const commandes = await import('@/app/api/commandes/route')

const PROMO_COLS = ['line_type', 'original_unit_price', 'discount_percent', 'discount_amount', 'is_promotion_gift', 'promotion_rule_id', 'promotion_label', 'can_trigger_promotion']
const BASE_COLS = ['order_id', 'product_id', 'product_name', 'quantity', 'unit_price', 'is_vip', 'selected_variants', 'variant_price_extra', 'variant_name', 'variant_price']

function seed({ rules = [] } = {}) {
  resetFakeDb({
    settings: [{ key: 'status', value: 'open' }],
    products: [
      { id: 'p1', name: 'Produit 1', price: 100, discount: 0, variants: null, is_vip: false, active: true },
    ],
    delivery_slots: [{ id: 's1', capacity: 10, booked: 0, blocked: false }],
    promotion_rules: rules,
    orders: [],
    order_items: [],
  })
}
const body = {
  name: 'Client Test', phone: '+33612345678', address: '1 rue du Test', slot_id: 's1',
  items: [{ product_id: 'p1', product_name: 'x', quantity: 2, unit_price: 1 }],
}
const percentRule = {
  id: 'r1', name: 'Remise 10', status: 'active', scope: 'all', trigger_type: 'cart_amount',
  benefit_type: 'percent_discount', discount_percent: 10, minimum_order_amount: 0,
  priority: 1, benefits: [],
}

// Simule une base de production sans les colonnes de promotion : l'insertion dans order_items
// renvoie une erreur de colonne inconnue (comme PostgREST) des qu'une colonne promotion est envoyee.
function simulateMissingColumns() {
  const proto = Object.getPrototypeOf(createClient().from('x'))
  const realRun = proto._run
  const calls = []
  proto._run = function () {
    if (this.table === 'order_items' && this.op === 'insert') {
      const list = Array.isArray(this.patch) ? this.patch : [this.patch]
      calls.push(list.map((r) => Object.keys(r)))
      if (list.some((r) => PROMO_COLS.some((c) => c in r))) {
        return { data: null, error: { code: '42703', message: 'column "line_type" of relation "order_items" does not exist' } }
      }
    }
    return realRun.call(this)
  }
  return { calls, restore: () => { proto._run = realRun } }
}

test('commande sans promotion : colonnes d origine uniquement', async () => {
  seed()
  const res = await commandes.POST(makeReq('http://x/api/commandes', { body }))
  assert.equal(res.status, 200)
  const rows = getFakeTable('order_items')
  assert.equal(rows.length, 1)
  assert.deepEqual(Object.keys(rows[0]).sort(), [...BASE_COLS].sort())
  for (const c of PROMO_COLS) assert.ok(!(c in rows[0]), `colonne promotion presente : ${c}`)
})

test('commande avec promotion : colonnes de promotion presentes', async () => {
  seed({ rules: [percentRule] })
  const res = await commandes.POST(makeReq('http://x/api/commandes', { body }))
  assert.equal(res.status, 200)
  const rows = getFakeTable('order_items')
  const promoRow = rows.find((r) => r.promotion_rule_id === 'r1')
  assert.ok(promoRow, 'ligne avec remise attendue')
  for (const c of PROMO_COLS) assert.ok(c in promoRow, `colonne manquante : ${c}`)
})

test('base sans colonnes promotion : la commande aboutit grace au second essai', async () => {
  seed({ rules: [percentRule] })
  const sim = simulateMissingColumns()
  const logged = []
  const origError = console.error
  console.error = (...a) => { logged.push(a) }
  let res
  try {
    res = await commandes.POST(makeReq('http://x/api/commandes', { body }))
  } finally {
    console.error = origError
    sim.restore()
  }
  assert.equal(res.status, 200)
  assert.equal(sim.calls.length, 2, 'un premier essai puis exactement un second essai')
  assert.ok(sim.calls[0][0].some((c) => PROMO_COLS.includes(c)), 'premier essai avec colonnes promotion')
  assert.deepEqual([...sim.calls[1][0]].sort(), [...BASE_COLS].sort(), 'second essai avec colonnes d origine')
  assert.equal(getFakeTable('orders').length, 1, 'la commande est conservee')
  assert.equal(getFakeTable('order_items').length, 1, 'les lignes sont enregistrees')
  const flat = JSON.stringify(logged)
  assert.ok(logged.length >= 1, 'incident journalise')
  assert.ok(!flat.includes('Client Test') && !flat.includes('+33612345678') && !flat.includes('1 rue du Test'), 'aucune donnee client dans le journal')
})
