// BLAC-P3-036 : produits VIP embarquables (driver_carryable), faux Supabase en mémoire, sans réseau ni vraie base
import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'

const data = await import('@/lib/driver-ledger-data')
const ledger = await import('@/lib/driver-ledger')

const tables = (over = {}) => ({
  products: [
    { id: 'p1', name: 'Cuvée Or', is_vip: true, driver_carryable: true },
    { id: 'p2', name: 'Réserve Noire', is_vip: true, driver_carryable: null },
    { id: 'p9', name: 'Service de préparation produit', is_vip: true, driver_carryable: false },
    { id: 'p3', name: 'Normal', is_vip: false, driver_carryable: true },
  ],
  driver_sessions: [],
  order_deliveries: [],
  driver_cash_movements: [],
  driver_stock_movements: [],
  ...over,
})

const stockRow = (product_id, quantity, kind = 'load') => ({
  session_id: 's1',
  driver_id: 'd1',
  product_id,
  kind,
  quantity,
})

test('listVipProducts : un produit is_vip avec driver_carryable false n apparaît pas', async () => {
  resetFakeDb(tables())
  const list = await data.listVipProducts(createClient())
  assert.deepEqual(list.map((p) => p.id).sort(), ['p1', 'p2'])
  assert.ok(!list.some((p) => p.id === 'p9'))
})

test('listVipProducts : colonne absente, repli sur le comportement actuel (tous les is_vip)', async () => {
  resetFakeDb(
    tables({
      products: [
        { id: 'p1', name: 'Cuvée Or', is_vip: true },
        { id: 'p9', name: 'Service de préparation produit', is_vip: true },
        { id: 'p3', name: 'Normal', is_vip: false },
      ],
    })
  )
  const list = await data.listVipProducts(createClient())
  assert.deepEqual(list.map((p) => p.id).sort(), ['p1', 'p9'])
})

test('assertVipProduct : refuse driver_carryable false, accepte true, null et absent', () => {
  assert.throws(() => ledger.assertVipProduct({ id: 'p9', name: 'Service', is_vip: true, driver_carryable: false }), /non embarquable/)
  assert.throws(() => ledger.assertVipProduct({ id: 'p3', is_vip: false, driver_carryable: true }), /non VIP/)
  assert.doesNotThrow(() => ledger.assertVipProduct({ id: 'p1', is_vip: true, driver_carryable: true }))
  assert.doesNotThrow(() => ledger.assertVipProduct({ id: 'p1', is_vip: true, driver_carryable: null }))
  assert.doesNotThrow(() => ledger.assertVipProduct({ id: 'p1', is_vip: true }))
})

test('chargement refusé : requireVipProduct et addStockMovement refusent le produit non embarquable sans écriture', async () => {
  resetFakeDb(tables())
  const c = createClient()
  await assert.rejects(() => data.requireVipProduct(c, 'p9'), /non embarquable/)
  await assert.rejects(
    () => data.addStockMovement(c, { session_id: 's1', driver_id: 'd1', product_id: 'p9', kind: 'load', quantity: 1 }),
    /non embarquable/
  )
  assert.equal(getFakeTable('driver_stock_movements').length, 0)
  await data.addStockMovement(c, { session_id: 's1', driver_id: 'd1', product_id: 'p1', kind: 'load', quantity: 2 })
  assert.equal(getFakeTable('driver_stock_movements').length, 1)
})

test('ouverture de session : un chargement du produit non embarquable est refusé avant toute écriture', async () => {
  resetFakeDb(tables())
  const c = createClient()
  await assert.rejects(
    () =>
      data.openSessionWithLedger(c, {
        driver_id: 'd1',
        openingCash: 50,
        loads: [
          { product_id: 'p1', quantity: 1 },
          { product_id: 'p9', quantity: 1 },
        ],
      }),
    /non embarquable/
  )
  assert.equal(getFakeTable('driver_sessions').length, 0)
  assert.equal(getFakeTable('driver_cash_movements').length, 0)
  assert.equal(getFakeTable('driver_stock_movements').length, 0)
})

test('clôture : le produit non embarquable est ignoré dans le contexte de clôture', async () => {
  resetFakeDb(tables({ driver_stock_movements: [stockRow('p1', 4), stockRow('p9', 7)] }))
  const ctx = await data.loadClosingContext(createClient(), {
    id: 's1',
    driver_id: 'd1',
    started_at: '2026-11-06T08:00:00Z',
    opening_cash: 0,
  })
  assert.deepEqual(ctx.stock.map((s) => [s.product_id, s.onHand]), [['p1', 4]])
})

test('alertes : loadLedgers écarte les mouvements du produit non embarquable, stockAlertLevel les ignore sur demande', async () => {
  resetFakeDb(tables({ driver_stock_movements: [stockRow('p1', 10), stockRow('p9', 1)] }))
  const ledgers = await data.loadLedgers(createClient(), ['s1'])
  assert.deepEqual(ledgers.s1.stock.map((m) => m.product_id), ['p1'])
  assert.equal(data.stockAlertLevel(ledgers.s1.stock), null)

  const raw = [stockRow('p9', 1)]
  assert.equal(data.stockAlertLevel(raw), 'low')
  assert.equal(data.stockAlertLevel(raw, ['p9']), null)
  assert.equal(data.stockAlertLevel(raw, new Set(['p9'])), null)
})

test('loadLedgers : colonne absente, les mouvements sont conservés', async () => {
  resetFakeDb(
    tables({
      products: [{ id: 'p9', name: 'Service', is_vip: true }],
      driver_stock_movements: [stockRow('p9', 1)],
    })
  )
  const ledgers = await data.loadLedgers(createClient(), ['s1'])
  assert.equal(ledgers.s1.stock.length, 1)
})
