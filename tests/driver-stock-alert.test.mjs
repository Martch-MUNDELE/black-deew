// BLAC-P3-034 : fonctions pures de lib/driver-stock-alert.ts (sans réseau, sans base).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  vipQuantities,
  hasVipLines,
  missingVipProducts,
  missingVipWarning,
  driverVipAlerts,
  alertMessage,
  driverVipNote,
} from '../lib/driver-stock-alert.ts'

const lines = [
  { product_id: 'p1', quantity: 2, is_vip: true },
  { product_id: 'p1', quantity: 1, is_vip: true },
  { product_id: 'p2', quantity: 4, is_vip: true },
  { product_id: 'p3', quantity: 9, is_vip: false },
]

test('vipQuantities additionne les lignes VIP et ignore les non VIP', () => {
  assert.deepEqual(vipQuantities(lines), { p1: 3, p2: 4 })
  assert.equal(hasVipLines(lines), true)
  assert.equal(hasVipLines([{ product_id: 'p3', quantity: 1, is_vip: false }]), false)
  assert.equal(hasVipLines([]), false)
})

test('missingVipProducts : quantité demandée supérieure à la quantité en main', () => {
  const missing = missingVipProducts(lines, [
    { product_id: 'p1', onHand: 3 },
    { product_id: 'p2', onHand: 1 },
  ])
  assert.deepEqual(missing, [{ product_id: 'p2', requested: 4, onHand: 1, missing: 3 }])
})

test('missingVipProducts : produit absent du solde = 0 en main, stock suffisant = rien', () => {
  const none = missingVipProducts(lines, [])
  assert.equal(none.length, 2)
  assert.ok(none.every((m) => m.onHand === 0))
  assert.deepEqual(
    missingVipProducts(lines, [
      { product_id: 'p1', onHand: 3 },
      { product_id: 'p2', onHand: 10 },
    ]),
    []
  )
  assert.deepEqual(missingVipProducts(lines, [{ product_id: 'p1', onHand: -2 }, { product_id: 'p2', onHand: 4 }]).map((m) => m.product_id), ['p1'])
})

test('missingVipWarning : texte français, vide quand rien ne manque', () => {
  assert.equal(missingVipWarning([]), '')
  const w = missingVipWarning([{ product_id: 'p2', requested: 4, onHand: 1, missing: 3 }], { p2: 'Cuvée Or' })
  assert.match(w, /Stock VIP insuffisant/)
  assert.match(w, /Cuvée Or/)
  assert.match(w, /demandé 4, en main 1/)
})

test('driverVipAlerts : niveaux empty et low, rien au-dessus du seuil', () => {
  const alerts = driverVipAlerts(
    [
      { driver_id: 'd1', driver_name: 'Jean', balances: [{ product_id: 'p1', onHand: 2 }, { product_id: 'p2', onHand: 0 }, { product_id: 'p3', onHand: 8 }] },
      { driver_id: 'd2', driver_name: 'Paul', balances: [{ product_id: 'p1', onHand: 3 }, { product_id: 'p2', onHand: 4 }] },
    ],
    { p1: 'Rouge', p2: 'Blanc', p3: 'Rosé' }
  )
  assert.deepEqual(
    alerts.map((a) => [a.driver_name, a.product_name, a.level, a.onHand]),
    [
      ['Jean', 'Blanc', 'empty', 0],
      ['Jean', 'Rouge', 'low', 2],
      ['Paul', 'Rouge', 'low', 3],
    ]
  )
  assert.equal(alertMessage(alerts[0]), 'Livreur Jean : plus de produit Blanc')
  assert.equal(alertMessage(alerts[1]), 'Livreur Jean : stock bas de Rouge : 2 restant')
})

test('driverVipAlerts : aucune alerte quand tout est au-dessus du seuil ou sans livreur', () => {
  assert.deepEqual(driverVipAlerts([{ driver_id: 'd1', driver_name: 'Jean', balances: [{ product_id: 'p1', onHand: 20 }] }]), [])
  assert.deepEqual(driverVipAlerts([]), [])
})

test('driverVipNote : quantité en main et avertissement non bloquant', () => {
  const stock = {
    drivers: [{ driver_id: 'd1', driver_name: 'Jean', balances: [{ product_id: 'p1', onHand: 3 }, { product_id: 'p2', onHand: 1 }] }],
    names: { p1: 'Rouge', p2: 'Blanc' },
  }
  const note = driverVipNote(lines, stock, 'd1')
  assert.match(note.summary, /Rouge 3/)
  assert.match(note.summary, /Blanc 1/)
  assert.match(note.warning, /Blanc/)
  const other = driverVipNote(lines, stock, 'inconnu')
  assert.match(other.summary, /Rouge 0/)
  assert.notEqual(other.warning, '')
})

// ---------------------------------------------------------------------------
// Route POST /api/mark-livree avec faux Supabase en mémoire
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
await import('./helpers/env.mjs')
const { resetFakeDb, getFakeTable } = await import('./helpers/fake-supabase.mjs')
const { makeReq } = await import('./helpers/req.mjs')
const { vipStockBalance } = await import('../lib/driver-ledger.ts')
const route = await import('../app/api/mark-livree/route.ts')

const origError = console.error
const SESSION_START = '2026-11-06T00:00:00.000Z'

function seed(extra = {}) {
  globalThis.__FAKE_AUTH__ = { email: 'admin@example.test' }
  resetFakeDb({
    admins: [{ email: 'admin@example.test', role: 'owner', status: 'active' }],
    products: [
      { id: 'p1', name: 'Rouge', is_vip: true, stock: 10 },
      { id: 'p2', name: 'Blanc', is_vip: true, stock: 7 },
      { id: 'p3', name: 'Rosé', is_vip: false, stock: 5 },
    ],
    orders: [
      { id: 'o1', status: 'en_livraison', customer_phone: '+243810000001' },
      { id: 'o2', status: 'en_livraison', customer_phone: '+243810000002' },
    ],
    order_items: [
      { order_id: 'o1', product_id: 'p1', quantity: 2, is_vip: true },
      { order_id: 'o1', product_id: 'p3', quantity: 1, is_vip: false },
      { order_id: 'o2', product_id: 'p3', quantity: 4, is_vip: false },
    ],
    order_deliveries: [
      { id: 'del1', order_id: 'o1', driver_id: 'd1', status: 'assigned', driver_fee_total: 5 },
      { id: 'del2', order_id: 'o2', driver_id: 'd1', status: 'assigned', driver_fee_total: 5 },
      // livraison d'une AUTRE session (fermée) : ne doit jamais être comptée
      { id: 'delOld', order_id: 'oOld', driver_id: 'd1', status: 'delivered', amount_collected: 999, driver_fee_total: 50, delivered_at: '2026-11-04T10:00:00.000Z' },
    ],
    driver_sessions: [
      { id: 's0', driver_id: 'd1', session_status: 'closed', opening_cash: 0, started_at: '2026-11-04T00:00:00.000Z', closed_at: '2026-11-05T00:00:00.000Z' },
      { id: 's1', driver_id: 'd1', session_status: 'open', opening_cash: 100, started_at: SESSION_START, closed_at: null },
    ],
    driver_cash_movements: [
      { session_id: 's1', driver_id: 'd1', kind: 'opening', amount: 100 },
      { session_id: 's1', driver_id: 'd1', kind: 'topup', amount: 20 },
    ],
    driver_stock_movements: [
      { session_id: 's1', driver_id: 'd1', product_id: 'p1', kind: 'load', quantity: 5, created_at: '2026-11-06T00:01:00.000Z' },
    ],
    ...extra,
  })
}

const call = async (orderId, total = 40) => {
  const res = await route.POST(makeReq('http://localhost/api/mark-livree', { body: { orderId, total } }))
  return { status: res.status, body: await res.json() }
}
const delivered = () => getFakeTable('driver_stock_movements').filter((m) => m.kind === 'delivered')

test('route : livrer une commande avec un article VIP diminue le stock embarqué', async () => {
  seed()
  const r = await call('o1')
  assert.equal(r.status, 200)
  assert.equal(r.body.ok, true)
  assert.deepEqual(
    delivered().map((m) => [m.session_id, m.driver_id, m.product_id, m.quantity, m.order_id]),
    [['s1', 'd1', 'p1', 2, 'o1']]
  )
  const balance = vipStockBalance(getFakeTable('driver_stock_movements'))
  assert.equal(balance.find((b) => b.product_id === 'p1').onHand, 3)
  assert.equal(getFakeTable('orders').find((o) => o.id === 'o1').status, 'livrée')
})

test('route : deuxième appel sans doublon (idempotent)', async () => {
  seed()
  await call('o1')
  await call('o1')
  assert.equal(delivered().length, 1)
  assert.equal(vipStockBalance(getFakeTable('driver_stock_movements')).find((b) => b.product_id === 'p1').onHand, 3)
})

test('route : products.stock jamais modifié', async () => {
  seed()
  const before = structuredClone(getFakeTable('products'))
  await call('o1')
  await call('o1')
  assert.deepEqual(getFakeTable('products'), before)
})

test('route : commande sans article VIP = aucun mouvement', async () => {
  seed()
  const r = await call('o2')
  assert.equal(r.status, 200)
  assert.equal(delivered().length, 0)
  assert.equal(getFakeTable('order_deliveries').find((d) => d.id === 'del2').status, 'delivered')
})

test('route : recalcul limité à la session avec le fonds réel', async () => {
  seed()
  await call('o1', 40)
  const s1 = getFakeTable('driver_sessions').find((s) => s.id === 's1')
  // fonds réel 100 + 20 ; collecté 40 (la livraison de l'autre session, 999, n'est pas comptée) ; frais 5
  assert.equal(s1.collected_cash, 40)
  assert.equal(s1.net_to_remit, 155)
  const s0 = getFakeTable('driver_sessions').find((s) => s.id === 's0')
  assert.equal(s0.collected_cash, undefined)
})

test('route : échec du journal enregistré dans les journaux serveur, livraison non bloquée', async () => {
  // produit VIP inconnu : addStockMovement refuse, la livraison doit quand même aboutir
  seed({ order_items: [{ order_id: 'o1', product_id: 'pX', quantity: 1, is_vip: true }] })
  const logs = []
  console.error = (...a) => logs.push(a)
  try {
    const r = await call('o1')
    assert.equal(r.status, 200)
    assert.equal(r.body.ok, true)
  } finally {
    console.error = origError
  }
  assert.ok(logs.length > 0)
  assert.equal(delivered().length, 0)
  assert.equal(getFakeTable('orders').find((o) => o.id === 'o1').status, 'livrée')
  assert.equal(getFakeTable('driver_sessions').find((s) => s.id === 's1').collected_cash, 40)
})

test('route : refus sans administrateur, rien d écrit', async () => {
  seed()
  globalThis.__FAKE_AUTH__ = null
  const r = await call('o1')
  assert.equal(r.status, 401)
  assert.equal(delivered().length, 0)
  assert.equal(getFakeTable('orders').find((o) => o.id === 'o1').status, 'en_livraison')
})

// ---------------------------------------------------------------------------
// Preuves par le texte : products.stock jamais écrit, câblage de la page
// ---------------------------------------------------------------------------
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('aucun code du ticket n écrit dans la table products', () => {
  for (const f of ['app/api/mark-livree/route.ts', 'lib/mark-delivered.ts', 'lib/driver-stock-alert.ts', 'components/DriverVipAlert.tsx']) {
    const text = src(f)
    assert.doesNotMatch(text, /from\(\s*['"]products['"]\s*\)\s*\.\s*(update|upsert|delete|insert)/, f)
    assert.doesNotMatch(text, /\.rpc\(/, f)
  }
})

test('page des commandes : bandeau et avertissement câblés', () => {
  const page = src('app/admin/commandes/page.tsx')
  assert.match(page, /import DriverVipAlert from '@\/components\/DriverVipAlert'/)
  assert.match(page, /<DriverVipAlert alerts=\{vipAlerts\} \/>/)
  assert.match(page, /driverVipNote\(/)
  assert.match(page, /data-testid="vip-stock-warning"/)
  assert.match(page, /hasVipLines\(/)
  // l'affectation reste non bloquante : le bouton ne dépend pas du stock
  assert.match(page, /disabled=\{!selectedDriver \|\| saving\}/)
})

test('bandeau : composant vide sans alerte (retourne null)', () => {
  const comp = src('components/DriverVipAlert.tsx')
  assert.match(comp, /alerts\.length === 0\) return null/)
})

test('route : commande de test toujours supprimée, aucun mouvement ni calcul', async () => {
  seed({
    orders: [{ id: 'oT', status: 'en_livraison', customer_phone: '+352691434011' }],
    order_items: [{ order_id: 'oT', product_id: 'p1', quantity: 2, is_vip: true }],
    order_deliveries: [{ id: 'delT', order_id: 'oT', driver_id: 'd1', status: 'assigned', driver_fee_total: 5 }],
  })
  const before = structuredClone(getFakeTable('driver_sessions'))
  const r = await call('oT')
  assert.equal(r.status, 200)
  assert.equal(r.body.testOrderDeleted, true)
  assert.equal(getFakeTable('orders').length, 0)
  assert.equal(getFakeTable('order_items').length, 0)
  assert.equal(getFakeTable('order_deliveries').length, 0)
  assert.equal(delivered().length, 0)
  assert.deepEqual(getFakeTable('driver_sessions'), before)
})
