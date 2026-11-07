// BLAC-P3-032 : journal de monnaie et de stock VIP embarqué (calculs purs, sans réseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const {
  DEFAULT_VIP_LOW_STOCK,
  deliveriesOfSession,
  computeSessionCash,
  vipStockBalance,
  buildClosingMovements,
  carryOverFromSession,
  lowStockAlerts,
  assertVipProduct,
} = await import('@/lib/driver-ledger')

const session = {
  driver_id: 'd1',
  started_at: '2026-11-06T08:00:00Z',
  closed_at: '2026-11-06T18:00:00Z',
  session_status: 'closed',
}

const delivery = (over = {}) => ({
  driver_id: 'd1',
  status: 'delivered',
  amount_collected: 124,
  driver_fee_total: 6,
  delivered_at: '2026-11-06T10:00:00Z',
  created_at: '2026-11-06T09:30:00Z',
  ...over,
})

test('constante DEFAULT_VIP_LOW_STOCK = 3', () => {
  assert.equal(DEFAULT_VIP_LOW_STOCK, 3)
})

test('solde de monnaie avec complément en cours de journée', () => {
  const cash = computeSessionCash({
    movements: [
      { kind: 'opening', amount: 400 },
      { kind: 'topup', amount: 100 },
    ],
    deliveries: [],
    session,
  })
  assert.equal(cash.opening, 400)
  assert.equal(cash.topup, 100)
  assert.equal(cash.given, 500)
  assert.equal(cash.cashOnHand, 500)
})

test('argent sur le livreur après rendu et part gardée', () => {
  const cash = computeSessionCash({
    movements: [
      { kind: 'opening', amount: 400 },
      { kind: 'topup', amount: 100 },
      { kind: 'returned', amount: 300 },
      { kind: 'kept_for_next_day', amount: 200 },
    ],
    deliveries: [],
    session,
  })
  assert.equal(cash.returned, 300)
  assert.equal(cash.kept, 200)
  assert.equal(cash.cashOnHand, 0)
})

test('équivalence du net avec l ancienne formule : 400 + 124 - 6 = 518', () => {
  const cash = computeSessionCash({
    movements: [{ kind: 'opening', amount: 400 }],
    deliveries: [delivery()],
    session,
  })
  assert.equal(cash.collected, 124)
  assert.equal(cash.driverFees, 6)
  assert.equal(cash.netToRemit, 518)
  assert.equal(cash.netToRemit, 400 + 124 - 6)
})

test('montants numériques reçus en texte (numeric de Postgres)', () => {
  const cash = computeSessionCash({
    movements: [{ kind: 'opening', amount: '400' }],
    deliveries: [delivery({ amount_collected: '124', driver_fee_total: '6' })],
    session,
  })
  assert.equal(cash.netToRemit, 518)
})

test('montant négatif refusé dans le journal de monnaie', () => {
  assert.throws(
    () => computeSessionCash({ movements: [{ kind: 'topup', amount: -5 }], deliveries: [], session }),
    /négatif/
  )
})

test('deliveriesOfSession exclut un autre livreur, une autre session du même livreur et les statuts non livrés', () => {
  const mine = delivery()
  const otherDriver = delivery({ driver_id: 'd2' })
  const previousDay = delivery({ delivered_at: '2026-11-05T10:00:00Z', created_at: '2026-11-05T09:00:00Z' })
  const afterClose = delivery({ delivered_at: '2026-11-06T19:00:00Z' })
  const failed = delivery({ status: 'failed' })
  const kept = deliveriesOfSession([mine, otherDriver, previousDay, afterClose, failed], session)
  assert.deepEqual(kept, [mine])
})

test('deliveriesOfSession : repli sur created_at quand delivered_at est vide', () => {
  const noDeliveredAt = delivery({ delivered_at: null, created_at: '2026-11-06T11:00:00Z' })
  assert.deepEqual(deliveriesOfSession([noDeliveredAt], session), [noDeliveredAt])
})

test('deliveriesOfSession : session ouverte = fenêtre jusqu a maintenant', () => {
  const open = { driver_id: 'd1', started_at: '2026-11-06T08:00:00Z', closed_at: null, session_status: 'open' }
  const inside = delivery({ delivered_at: '2026-11-06T12:00:00Z' })
  const future = delivery({ delivered_at: '2026-11-06T16:00:00Z' })
  const now = new Date('2026-11-06T13:00:00Z')
  assert.deepEqual(deliveriesOfSession([inside, future], open, now), [inside])
})

test('solde de stock avec réapprovisionnement', () => {
  const [b] = vipStockBalance([
    { kind: 'load', product_id: 'p1', quantity: 10 },
    { kind: 'topup', product_id: 'p1', quantity: 5 },
  ])
  assert.equal(b.loaded, 15)
  assert.equal(b.onHand, 15)
  assert.equal(b.insufficient, false)
})

test('une livraison décrémente le stock en main', () => {
  const [b] = vipStockBalance([
    { kind: 'load', product_id: 'p1', quantity: 10 },
    { kind: 'topup', product_id: 'p1', quantity: 5 },
    { kind: 'delivered', product_id: 'p1', quantity: 4, order_id: 'o1' },
  ])
  assert.equal(b.delivered, 4)
  assert.equal(b.onHand, 11)
  assert.equal(b.insufficient, false)
})

test('formule de la quantité en main avec ajustements, rendu et gardé', () => {
  const [b] = vipStockBalance([
    { kind: 'load', product_id: 'p1', quantity: 10 },
    { kind: 'adjust_plus', product_id: 'p1', quantity: 2 },
    { kind: 'delivered', product_id: 'p1', quantity: 3 },
    { kind: 'returned', product_id: 'p1', quantity: 4 },
    { kind: 'kept_for_next_day', product_id: 'p1', quantity: 2 },
    { kind: 'adjust_minus', product_id: 'p1', quantity: 1 },
  ])
  assert.equal(b.onHand, 10 + 2 - 3 - 4 - 2 - 1)
  assert.equal(b.onHand, 2)
})

test('livraison supérieure au stock : insufficient', () => {
  const [b] = vipStockBalance([
    { kind: 'load', product_id: 'p1', quantity: 2 },
    { kind: 'delivered', product_id: 'p1', quantity: 3 },
  ])
  assert.equal(b.onHand, -1)
  assert.equal(b.insufficient, true)
})

test('livraison avant le chargement (chronologie) : insufficient', () => {
  const [b] = vipStockBalance([
    { kind: 'load', product_id: 'p1', quantity: 5, created_at: '2026-11-06T10:00:00Z' },
    { kind: 'delivered', product_id: 'p1', quantity: 3, created_at: '2026-11-06T09:00:00Z' },
  ])
  assert.equal(b.insufficient, true)
})

test('quantité invalide refusée', () => {
  assert.throws(() => vipStockBalance([{ kind: 'load', product_id: 'p1', quantity: 0 }]), /invalide/)
  assert.throws(() => vipStockBalance([{ kind: 'load', product_id: 'p1', quantity: 1.5 }]), /invalide/)
})

test('clôture avec rendu et gardé corrects', () => {
  const result = buildClosingMovements({
    cashOnHand: 500,
    stockOnHand: { p1: 6, p2: 0 },
    decisions: {
      cash: { returned: 300, kept: 200 },
      stock: { p1: { returned: 4, kept: 2 } },
    },
  })
  assert.deepEqual(result.cashMovements, [
    { kind: 'returned', amount: 300 },
    { kind: 'kept_for_next_day', amount: 200 },
  ])
  assert.deepEqual(result.stockMovements, [
    { kind: 'returned', product_id: 'p1', quantity: 4 },
    { kind: 'kept_for_next_day', product_id: 'p1', quantity: 2 },
  ])
})

test('clôture incohérente refusée : stock', () => {
  assert.throws(
    () =>
      buildClosingMovements({
        cashOnHand: 0,
        stockOnHand: { p1: 6 },
        decisions: { cash: { returned: 0, kept: 0 }, stock: { p1: { returned: 4, kept: 1 } } },
      }),
    /doit être égal/
  )
})

test('clôture incohérente refusée : monnaie', () => {
  assert.throws(
    () =>
      buildClosingMovements({
        cashOnHand: 500,
        stockOnHand: {},
        decisions: { cash: { returned: 300, kept: 100 }, stock: {} },
      }),
    /doit être égal/
  )
})

test('clôture refusée : quantité négative, décision manquante, produit inconnu', () => {
  assert.throws(
    () =>
      buildClosingMovements({
        cashOnHand: 0,
        stockOnHand: { p1: 6 },
        decisions: { cash: { returned: 0, kept: 0 }, stock: { p1: { returned: -1, kept: 7 } } },
      }),
    /entiers positifs ou nuls/
  )
  assert.throws(
    () =>
      buildClosingMovements({
        cashOnHand: 0,
        stockOnHand: { p1: 6 },
        decisions: { cash: { returned: 0, kept: 0 }, stock: {} },
      }),
    /aucune décision/
  )
  assert.throws(
    () =>
      buildClosingMovements({
        cashOnHand: 0,
        stockOnHand: {},
        decisions: { cash: { returned: 0, kept: 0 }, stock: { p9: { returned: 0, kept: 0 } } },
      }),
    /inconnu/
  )
})

test('report au lendemain : monnaie gardée et lignes load par produit gardé', () => {
  const carry = carryOverFromSession({
    cash: [
      { kind: 'returned', amount: 300 },
      { kind: 'kept_for_next_day', amount: 200 },
    ],
    stock: [
      { kind: 'returned', product_id: 'p1', quantity: 4 },
      { kind: 'kept_for_next_day', product_id: 'p1', quantity: 2 },
      { kind: 'kept_for_next_day', product_id: 'p2', quantity: 1 },
    ],
  })
  assert.equal(carry.openingCash, 200)
  assert.deepEqual(carry.stockLoads, [
    { kind: 'load', product_id: 'p1', quantity: 2 },
    { kind: 'load', product_id: 'p2', quantity: 1 },
  ])
})

test('alertes : empty à zéro, low sous le seuil, rien au-dessus', () => {
  const alerts = lowStockAlerts([
    { product_id: 'p1', onHand: 0 },
    { product_id: 'p2', onHand: 3 },
    { product_id: 'p3', onHand: 4 },
  ])
  assert.deepEqual(
    alerts.map((a) => [a.product_id, a.level]),
    [
      ['p1', 'empty'],
      ['p2', 'low'],
    ]
  )
  assert.equal(alerts.find((a) => a.product_id === 'p3'), undefined)
})

test('alertes : seuil personnalisé', () => {
  const alerts = lowStockAlerts([{ product_id: 'p3', onHand: 4 }], 5)
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].level, 'low')
  assert.equal(alerts[0].threshold, 5)
})

test('produit non VIP refusé', () => {
  assert.throws(() => assertVipProduct({ id: 'p1', name: 'Soda', is_vip: false }), /non VIP/)
  assert.throws(() => assertVipProduct({ id: 'p1', name: 'Soda' }), /non VIP/)
  assert.throws(() => assertVipProduct(null), /non VIP/)
  const vip = { id: 'p2', name: 'Cuvée', is_vip: true }
  assert.equal(assertVipProduct(vip), vip)
})

test('migration : texte conforme (non appliquée, deux tables, retour arrière en commentaire)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261106_bd_driver_ledger.sql', import.meta.url), 'utf8')
  assert.match(sql, /NON APPLIQUÉE : ne pas exécuter sans validation humaine/)
  assert.match(sql, /create table if not exists public\.driver_cash_movements/)
  assert.match(sql, /create table if not exists public\.driver_stock_movements/)
  assert.match(sql, /on delete cascade/)
  assert.match(sql, /order_id uuid references public\.orders\(id\) on delete set null/)
  assert.match(sql, /check \(quantity > 0\)/)
  assert.match(sql, /check \(amount >= 0\)/)
  assert.match(sql, /RETOUR ARRIÈRE/)
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  assert.doesNotMatch(code, /\binsert\s+into\b/i)
  assert.doesNotMatch(code, /\balter\s+table\b/i)
  assert.doesNotMatch(code, /\bdrop\s+/i)
})
