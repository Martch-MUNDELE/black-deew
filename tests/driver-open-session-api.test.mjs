// BLAC-P3-059 : ouverture de session livreur cote serveur (validation du corps + garde-fous de la route)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { parseOpenSessionBody } = await import('@/lib/driver-open-session-api')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const DRIVER = '11111111-1111-4111-8111-111111111111'
const PROD_A = '22222222-2222-4222-8222-222222222222'
const PROD_B = '33333333-3333-4333-8333-333333333333'

test('corps valide => ok avec valeurs normalisees', () => {
  const r = parseOpenSessionBody({
    driver_id: DRIVER,
    openingCash: 50,
    loads: [{ product_id: PROD_A, quantity: 3 }, { product_id: PROD_B, quantity: '2' }],
  })
  assert.equal(r.ok, true)
  assert.equal(r.value.driver_id, DRIVER)
  assert.equal(r.value.openingCash, 50)
  assert.deepEqual(r.value.loads, [
    { product_id: PROD_A, quantity: 3 },
    { product_id: PROD_B, quantity: 2 },
  ])
})

test('driver_id non uuid => erreur', () => {
  for (const id of ['abc', '', null, undefined, 42]) {
    const r = parseOpenSessionBody({ driver_id: id, openingCash: 0, loads: [] })
    assert.equal(r.ok, false)
    assert.equal(typeof r.error, 'string')
  }
})

test('corps non objet => erreur', () => {
  for (const b of [null, undefined, 'x', 12, []]) assert.equal(parseOpenSessionBody(b).ok, false)
})

test('openingCash vide ou absent => 0', () => {
  for (const cash of ['', '  ', null, undefined]) {
    const r = parseOpenSessionBody({ driver_id: DRIVER, openingCash: cash, loads: [] })
    assert.equal(r.ok, true)
    assert.equal(r.value.openingCash, 0)
  }
  const sans = parseOpenSessionBody({ driver_id: DRIVER })
  assert.equal(sans.ok, true)
  assert.equal(sans.value.openingCash, 0)
  assert.deepEqual(sans.value.loads, [])
})

test('openingCash negatif ou non numerique => erreur', () => {
  for (const cash of [-1, '-5', 'abc', NaN, Infinity]) {
    assert.equal(parseOpenSessionBody({ driver_id: DRIVER, openingCash: cash, loads: [] }).ok, false)
  }
})

test('quantite 0 ou vide ignoree', () => {
  const r = parseOpenSessionBody({
    driver_id: DRIVER,
    openingCash: 0,
    loads: [
      { product_id: PROD_A, quantity: 0 },
      { product_id: PROD_B, quantity: '' },
      { product_id: PROD_B, quantity: null },
      { product_id: PROD_A, quantity: 4 },
    ],
  })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.loads, [{ product_id: PROD_A, quantity: 4 }])
})

test('quantite decimale ou negative => erreur', () => {
  for (const q of [1.5, '2.5', -1]) {
    const r = parseOpenSessionBody({ driver_id: DRIVER, openingCash: 0, loads: [{ product_id: PROD_A, quantity: q }] })
    assert.equal(r.ok, false)
  }
})

test('product_id non uuid avec quantite > 0 => erreur', () => {
  const r = parseOpenSessionBody({ driver_id: DRIVER, openingCash: 0, loads: [{ product_id: 'nope', quantity: 2 }] })
  assert.equal(r.ok, false)
})

test('route : 401 sans session, 403 pour un non admin, no-store', () => {
  const src = read('app/api/admin/open-driver-session/route.ts')
  assert.match(src, /export async function POST/)
  assert.match(src, /await getAdminRole\(\)/)
  assert.match(src, /if \(!info\)[\s\S]*?status: 401/)
  assert.match(src, /info\.role !== 'admin'[\s\S]*?status: 403/)
  assert.ok(src.indexOf('status: 401') < src.indexOf('status: 403'))
  assert.ok(src.indexOf('status: 403') < src.indexOf('openSessionWithLedger('))
  assert.match(src, /Cache-Control': 'no-store'/)
  assert.match(src, /status: 400/)
  assert.match(src, /SESSION_DEJA_OUVERTE_MESSAGE \? 409 : 500/)
  assert.match(src, /SUPABASE_SERVICE_ROLE_KEY/)
})
