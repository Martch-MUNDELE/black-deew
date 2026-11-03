// BLAC-P2-024 : creation / annulation d'offres personnelles (admin Marketing), base simulee en memoire.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

await import('./helpers/env.mjs')
const { resetFakeDb, getFakeTable, createClient } = await import('./helpers/fake-supabase.mjs')
const { runClientOffersAction, normalizeOfferPhone, OFFERS_UNAVAILABLE_MESSAGE } = await import('../lib/client-offers.ts')

const ADMIN = { ok: true, email: 'admin@example.test', role: 'owner' }
const seed = (offers = []) =>
  resetFakeDb({
    promotion_rules: [
      { id: 'promo-1', name: 'Moins 10 pour cent', status: 'active' },
      { id: 'promo-off', name: 'Ancienne promo', status: 'inactive' },
    ],
    client_offers: offers,
  })
const run = (method, extra = {}) => runClientOffersAction({ check: ADMIN, db: createClient(), method, ...extra })
const valid = { phone: '+243 81 000 0001', promotion_id: 'promo-1', campaign_label: 'Merci VIP' }

// Client dont la table client_offers est absente (erreur), le reste fonctionne.
function dbWithoutOffersTable() {
  const base = createClient()
  const err = { data: null, error: { code: '42P01' } }
  const failing = {
    select() { return this }, order() { return this }, eq() { return this },
    insert() { return this }, update() { return this }, single() { return this },
    maybeSingle() { return Promise.resolve(err) },
    then(res, rej) { return Promise.resolve(err).then(res, rej) },
  }
  return { from: (t) => (t === 'client_offers' ? failing : base.from(t)) }
}

test('refus sans admin : 401 et 403, rien d ecrit', async () => {
  seed()
  for (const [status, error] of [[401, 'Authentification requise'], [403, 'Acces reserve aux administrateurs']]) {
    for (const method of ['GET', 'POST', 'PATCH']) {
      const r = await runClientOffersAction({ check: { ok: false, status, error }, db: createClient(), method, body: valid })
      assert.equal(r.status, status)
      assert.equal(r.body.error, error)
    }
  }
  assert.equal(getFakeTable('client_offers').length, 0)
})

test('la route appelle requireAdmin pour GET, POST et PATCH', () => {
  const src = readFileSync(new URL('../app/api/admin/client-offers/route.ts', import.meta.url), 'utf8')
  assert.match(src, /import \{ requireAdmin \} from '@\/lib\/admin-auth'/)
  for (const m of ['GET', 'POST', 'PATCH']) assert.match(src, new RegExp('export async function ' + m + '\\('))
  assert.match(src, /const check = await requireAdmin\(\)/)
  assert.doesNotMatch(src, /console\.(log|info|error)/)
})

test('creation valide : offre active, motif manual, enregistree', async () => {
  seed()
  const r = await run('POST', { body: valid })
  assert.equal(r.status, 201)
  const rows = getFakeTable('client_offers')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].promotion_id, 'promo-1')
  assert.equal(rows[0].status, 'active')
  assert.equal(rows[0].reason, 'manual')
  assert.equal(rows[0].campaign_label, 'Merci VIP')
  assert.equal(rows[0].starts_at, null)
  assert.equal(rows[0].ends_at, null)
})

test('telephone normalise comme vip-approve', async () => {
  assert.equal(normalizeOfferPhone('00243 81 000 0001'), '+243810000001')
  assert.equal(normalizeOfferPhone(' +243 (81) 000-0001 '), '+243810000001')
  assert.equal(normalizeOfferPhone(''), '')
  seed()
  await run('POST', { body: { ...valid, phone: '00243 81 000 0001' } })
  assert.equal(getFakeTable('client_offers')[0].phone, '+243810000001')
})

test('telephone invalide refuse', async () => {
  seed()
  const r = await run('POST', { body: { ...valid, phone: '12' } })
  assert.equal(r.status, 400)
  assert.equal(getFakeTable('client_offers').length, 0)
})

test('promotion inconnue ou inactive refusee', async () => {
  seed()
  const unknown = await run('POST', { body: { ...valid, promotion_id: 'nope' } })
  assert.equal(unknown.status, 400)
  const inactive = await run('POST', { body: { ...valid, promotion_id: 'promo-off' } })
  assert.equal(inactive.status, 400)
  const missing = await run('POST', { body: { phone: valid.phone } })
  assert.equal(missing.status, 400)
  assert.equal(getFakeTable('client_offers').length, 0)
})

test('dates incoherentes refusees, dates valides acceptees', async () => {
  seed()
  const before = await run('POST', { body: { ...valid, starts_at: '2026-12-10T10:00:00.000Z', ends_at: '2026-12-01T10:00:00.000Z' } })
  assert.equal(before.status, 400)
  const equal = await run('POST', { body: { ...valid, starts_at: '2026-12-10T10:00:00.000Z', ends_at: '2026-12-10T10:00:00.000Z' } })
  assert.equal(equal.status, 400)
  const garbage = await run('POST', { body: { ...valid, starts_at: 'pas une date' } })
  assert.equal(garbage.status, 400)
  assert.equal(getFakeTable('client_offers').length, 0)
  const ok = await run('POST', { body: { ...valid, starts_at: '2026-12-01T10:00:00.000Z', ends_at: '2026-12-10T10:00:00.000Z' } })
  assert.equal(ok.status, 201)
  assert.equal(getFakeTable('client_offers')[0].ends_at, '2026-12-10T10:00:00.000Z')
})

test('liste : plus recentes d abord, et promotions actives avec rules=1', async () => {
  seed([
    { id: 'o-old', phone: '+243810000001', promotion_id: 'promo-1', status: 'active', created_at: '2026-11-01T10:00:00.000Z' },
    { id: 'o-new', phone: '+243810000002', promotion_id: 'promo-1', status: 'active', created_at: '2026-11-02T10:00:00.000Z' },
  ])
  const r = await run('GET', { rules: true })
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.offers.map((o) => o.id), ['o-new', 'o-old'])
  assert.deepEqual(r.body.rules, [{ id: 'promo-1', name: 'Moins 10 pour cent' }])
  const plain = await run('GET')
  assert.equal('rules' in plain.body, false)
})

test('annulation : active vers cancelled ; deja annulee 409 ; inconnue 404', async () => {
  seed([{ id: 'o1', phone: '+243810000001', promotion_id: 'promo-1', status: 'active', created_at: '2026-11-01T10:00:00.000Z' }])
  const r = await run('PATCH', { body: { id: 'o1' } })
  assert.equal(r.status, 200)
  assert.equal(getFakeTable('client_offers')[0].status, 'cancelled')
  assert.equal((await run('PATCH', { body: { id: 'o1' } })).status, 409)
  assert.equal((await run('PATCH', { body: { id: 'zzz' } })).status, 404)
  assert.equal((await run('PATCH', { body: {} })).status, 400)
})

test('table absente : 200 avec unavailable true et message francais, jamais 500', async () => {
  seed()
  const db = dbWithoutOffersTable()
  const calls = [
    runClientOffersAction({ check: ADMIN, db, method: 'GET', rules: true }),
    runClientOffersAction({ check: ADMIN, db, method: 'POST', body: valid }),
    runClientOffersAction({ check: ADMIN, db, method: 'PATCH', body: { id: 'o1' } }),
    runClientOffersAction({ check: ADMIN, db: { from: () => { throw new Error('boom') } }, method: 'GET' }),
  ]
  for (const r of await Promise.all(calls)) {
    assert.equal(r.status, 200)
    assert.equal(r.body.unavailable, true)
    assert.equal(r.body.message, OFFERS_UNAVAILABLE_MESSAGE)
    assert.match(String(r.body.message), /offres personnelles/)
  }
})
