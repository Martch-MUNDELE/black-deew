// BLAC-P3-037 : une seule session ouverte par livreur (faux Supabase en mémoire, sans réseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createClient, resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'

const data = await import('@/lib/driver-ledger-data')

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

const baseTables = (sessions = []) => ({
  products: [{ id: 'p1', name: 'Vip A', is_vip: true }],
  driver_sessions: sessions,
  driver_cash_movements: [],
  driver_stock_movements: [],
})

test('deux sessions ouvertes du même livreur : un seul choix, avec la plus récente', () => {
  const manu = { id: 'd1', full_name: 'Manu x', phone: '1' }
  const autre = { id: 'd2', full_name: 'Autre', phone: '2' }
  const rows = [
    { driver_id: 'd1', started_at: '2026-11-01T10:00:00.000Z', delivery_drivers: manu },
    { driver_id: 'd2', started_at: '2026-11-02T08:00:00.000Z', delivery_drivers: [autre] },
    { driver_id: 'd1', started_at: '2026-11-01T10:00:01.100Z', delivery_drivers: { ...manu, phone: 'recent' } },
  ]
  const out = data.dedupeOpenSessionDrivers(rows)
  assert.equal(out.length, 2)
  assert.deepEqual(out.map((d) => d.id).sort(), ['d1', 'd2'])
  assert.equal(out.find((d) => d.id === 'd1').phone, 'recent')
  assert.equal(new Set(out.map((d) => d.id)).size, out.length)
})

test('liste d\'affectation : livreur absent ou null ignoré, liste vide acceptée', () => {
  assert.deepEqual(data.dedupeOpenSessionDrivers([]), [])
  assert.deepEqual(data.dedupeOpenSessionDrivers([{ started_at: null, delivery_drivers: null }]), [])
})

test('ouverture refusée si une session est déjà ouverte, rien n\'est écrit', async () => {
  resetFakeDb(baseTables([{ id: 's-old', driver_id: 'd1', session_status: 'open', started_at: '2026-11-01T10:00:00.000Z' }]))
  const c = createClient()
  await assert.rejects(
    () => data.openSessionWithLedger(c, { driver_id: 'd1', openingCash: 50, loads: [{ product_id: 'p1', quantity: 2 }] }),
    /déjà une session ouverte/
  )
  assert.equal(getFakeTable('driver_sessions').length, 1)
  assert.equal(getFakeTable('driver_cash_movements').length, 0)
  assert.equal(getFakeTable('driver_stock_movements').length, 0)
})

test('une session fermée n\'empêche pas l\'ouverture ; un livreur sans session s\'ouvre normalement', async () => {
  resetFakeDb(baseTables([{ id: 's-closed', driver_id: 'd1', session_status: 'closed', started_at: '2026-10-30T10:00:00.000Z' }]))
  const c = createClient()
  const { session_id } = await data.openSessionWithLedger(c, { driver_id: 'd1', openingCash: 20, loads: [{ product_id: 'p1', quantity: 1 }] })
  assert.ok(session_id)
  const open = getFakeTable('driver_sessions').filter((s) => s.driver_id === 'd1' && s.session_status === 'open')
  assert.equal(open.length, 1)
  assert.equal(getFakeTable('driver_cash_movements').length, 1)
  assert.equal(getFakeTable('driver_stock_movements').length, 1)
})

test('second clic rapide (appels simultanés) : une seule session ouverte', async () => {
  resetFakeDb(baseTables())
  const c = createClient()
  const params = { driver_id: 'd3', openingCash: 10, loads: [] }
  const results = await Promise.allSettled([
    data.openSessionWithLedger(c, params),
    data.openSessionWithLedger(c, params),
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  const rejected = results.filter((r) => r.status === 'rejected')
  assert.equal(rejected.length, 1)
  assert.match(String(rejected[0].reason.message), /déjà une session ouverte/)
  assert.equal(getFakeTable('driver_sessions').filter((s) => s.driver_id === 'd3').length, 1)
  assert.equal(getFakeTable('driver_cash_movements').length, 1)
})

test('second appel après la fin du premier : refusé aussi, le verrou est bien libéré en cas d\'échec', async () => {
  resetFakeDb(baseTables())
  const c = createClient()
  await assert.rejects(() => data.openSessionWithLedger(c, { driver_id: 'd4', openingCash: 5, loads: [{ product_id: 'zz', quantity: 1 }] }))
  assert.equal(getFakeTable('driver_sessions').length, 0)
  await data.openSessionWithLedger(c, { driver_id: 'd4', openingCash: 5, loads: [] })
  await assert.rejects(() => data.openSessionWithLedger(c, { driver_id: 'd4', openingCash: 5, loads: [] }), /déjà une session ouverte/)
  assert.equal(getFakeTable('driver_sessions').filter((s) => s.driver_id === 'd4').length, 1)
})

test('écran Livreurs : le bouton Ouvrir est inactif pendant l\'ouverture et ignore un second clic', () => {
  const src = read('../app/admin/livreurs/page.tsx')
  assert.match(src, /const openingRef = useRef\(false\)/)
  assert.match(src, /if \(!sessionDriver \|\| openingRef\.current\) return/)
  assert.match(src, /openingRef\.current = true/)
  assert.match(src, /openingRef\.current = false/)
  assert.match(src, /onClick=\{handleOpenSession\} disabled=\{sessionLoading\}/)
})

test('page des commandes : la liste d\'affectation passe par la déduplication', () => {
  const src = read('../app/admin/commandes/page.tsx')
  assert.match(src, /dedupeOpenSessionDrivers<DriverRow>\(rows\)/)
  assert.match(src, /driver_id, started_at, delivery_drivers\(/)
  assert.match(src, /import \{ dedupeOpenSessionDrivers \} from '@\/lib\/driver-ledger-data'/)
})
