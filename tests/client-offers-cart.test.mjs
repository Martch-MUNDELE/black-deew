// BLAC-P2-023 : offres personnelles du client (panier et commande), base simulee en memoire.
import test from 'node:test'
import assert from 'node:assert/strict'

await import('./helpers/env.mjs')
const fake = await import('./helpers/fake-supabase.mjs')
const { resetFakeDb, getFakeTable, createClient } = fake
const mod = await import('../lib/client-offers.ts')
const { loadActiveOffersForPhone, loadClientOfferRules, applyClientOffersToRules, loadOfferLinkedRuleIds, markClientOffersUsed } = mod

const NOW = new Date('2026-11-10T12:00:00.000Z').getTime()
const P1 = '+243810000001'
const P2 = '+243820000002'
const rule = (id) => ({ id, name: id, status: 'active', benefit_type: 'percent_discount', discount_percent: 10, scope: 'order', benefits: [] })
const RULES = [rule('general'), rule('perso')]
const offer = (extra = {}) => ({ id: 'o1', phone: P1, promotion_id: 'perso', status: 'active', starts_at: null, ends_at: null, ...extra })
const ids = (list) => list.map((r) => r.id)

const errorClient = { from: () => ({ select: () => Promise.resolve({ data: null, error: { code: '42P01' } }) }) }
const throwingClient = { from: () => { throw new Error('boom') } }

test('table absente (erreur) : aucune offre, sans exception', async () => {
  assert.deepEqual(await loadActiveOffersForPhone(errorClient, P1, NOW), [])
  assert.deepEqual(await loadActiveOffersForPhone(throwingClient, P1, NOW), [])
  const r = await applyClientOffersToRules(errorClient, RULES, P1, NOW)
  assert.deepEqual(ids(r.rules), ['general', 'perso'])
  assert.equal((await loadOfferLinkedRuleIds(throwingClient)).size, 0)
})

test('telephone sans offre : aucune regle personnelle', async () => {
  resetFakeDb({ client_offers: [] })
  const sb = createClient()
  assert.deepEqual(await loadClientOfferRules(sb, P1, RULES, NOW), [])
})

test('telephone avec offre active : regle personnelle appliquee', async () => {
  resetFakeDb({ client_offers: [offer()] })
  const sb = createClient()
  assert.deepEqual(ids(await loadClientOfferRules(sb, P1, RULES, NOW)), ['perso'])
  const r = await applyClientOffersToRules(sb, RULES, P1, NOW)
  assert.deepEqual(ids(r.rules).sort(), ['general', 'perso'])
  assert.deepEqual(r.offers.map((o) => o.id), ['o1'])
})

test('offre expiree ou pas commencee : non appliquee', async () => {
  resetFakeDb({ client_offers: [offer({ ends_at: '2026-11-09T00:00:00.000Z' })] })
  assert.deepEqual(await loadActiveOffersForPhone(createClient(), P1, NOW), [])
  resetFakeDb({ client_offers: [offer({ starts_at: '2026-11-11T00:00:00.000Z' })] })
  assert.deepEqual(await loadActiveOffersForPhone(createClient(), P1, NOW), [])
})

test("offre d'un autre telephone : non appliquee", async () => {
  resetFakeDb({ client_offers: [offer({ phone: P2 })] })
  assert.deepEqual(await loadClientOfferRules(createClient(), P1, RULES, NOW), [])
})

test('regle liee a une offre : invisible pour les autres et sans telephone', async () => {
  resetFakeDb({ client_offers: [offer()] })
  const sb = createClient()
  assert.deepEqual(ids((await applyClientOffersToRules(sb, RULES, P2, NOW)).rules), ['general'])
  assert.deepEqual(ids((await applyClientOffersToRules(sb, RULES, '', NOW)).rules), ['general'])
  assert.deepEqual(ids((await applyClientOffersToRules(sb, RULES, null, NOW)).rules), ['general'])
})

test('marquage utilisee : status, used_at, used_order_id, une seule fois', async () => {
  resetFakeDb({ client_offers: [offer()] })
  const sb = createClient()
  assert.equal(await markClientOffersUsed(sb, ['o1'], 'order-1', NOW), 1)
  const row = getFakeTable('client_offers')[0]
  assert.equal(row.status, 'used')
  assert.equal(row.used_order_id, 'order-1')
  assert.equal(row.used_at, new Date(NOW).toISOString())
  await markClientOffersUsed(sb, ['o1'], 'order-2', NOW + 1000)
  assert.equal(getFakeTable('client_offers')[0].used_order_id, 'order-1')
  assert.deepEqual(await loadActiveOffersForPhone(sb, P1, NOW), [])
})

test('echec du marquage : aucune exception', async () => {
  const failing = { from: () => ({ update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: { code: 'X' } }) }) }) }) }
  assert.equal(await markClientOffersUsed(failing, ['o1'], 'order-1', NOW), 0)
  assert.equal(await markClientOffersUsed(throwingClient, ['o1'], 'order-1', NOW), 0)
})
