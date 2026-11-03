// BLAC-P3-014 : resultats d'une campagne. Base simulee en memoire uniquement.
import test from 'node:test'
import assert from 'node:assert/strict'

await import('./helpers/env.mjs')
const { resetFakeDb, createClient } = await import('./helpers/fake-supabase.mjs')
const { computeCampaignResults, runCampaignResultsAction, RESULTS_WINDOW_DAYS, RESULTS_WINDOW_MS } =
  await import('../lib/campaign-results.ts')

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-11-03T12:00:00.000Z')
const at = (daysFromNow) => new Date(NOW + daysFromNow * DAY).toISOString()
const P1 = '+243810000001'
const P2 = '+243810000002'
const P3 = '+243810000003'
const P4 = '+243810000004'

const seed = (over = {}) =>
  resetFakeDb({
    campaign_sends: [
      { campaign_id: 'c1', phone: P1, status: 'sent', sent_at: at(-10) },
      { campaign_id: 'c1', phone: P2, status: 'sent', sent_at: at(-9) },
      { campaign_id: 'c1', phone: P3, status: 'refused' },
      { campaign_id: 'c2', phone: P4, status: 'sent', sent_at: at(-10) },
    ],
    marketing_refusals: [
      { phone: P3, created_at: at(-8), source: 'whatsapp_stop' },
      { phone: P4, created_at: at(-30), source: 'whatsapp_stop' },
    ],
    orders: [],
    ...over,
  })

const compute = (db = createClient()) => computeCampaignResults(db, 'c1', NOW)

function dbWithoutTable(name) {
  const base = createClient()
  const err = { data: null, error: { code: '42P01' } }
  const failing = {
    select() { return this }, eq() { return this },
    maybeSingle() { return Promise.resolve(err) },
    then(res, rej) { return Promise.resolve(err).then(res, rej) },
  }
  return { from: (t) => (t === name ? failing : base.from(t)) }
}

test('la fenetre est de 7 jours', () => {
  assert.equal(RESULTS_WINDOW_DAYS, 7)
  assert.equal(RESULTS_WINDOW_MS, 7 * DAY)
})

test('envois comptes : seulement le statut sent de cette campagne', async () => {
  seed()
  const r = await compute()
  assert.equal(r.unavailable, false)
  assert.equal(r.sent, 2)
})

test('refus comptes depuis le premier envoi, anciens refus exclus', async () => {
  seed()
  const r = await compute()
  assert.equal(r.refused, 1)
})

test('commande dans les 7 jours comptee avec son chiffre d affaires', async () => {
  seed({ orders: [{ customer_phone: P1, total: 40, status: 'delivered', created_at: at(-8) }] })
  const r = await compute()
  assert.equal(r.orders, 1)
  assert.equal(r.revenue, 40)
})

test('commande avant l envoi exclue', async () => {
  seed({ orders: [{ customer_phone: P1, total: 40, status: 'delivered', created_at: at(-11) }] })
  const r = await compute()
  assert.equal(r.orders, 0)
  assert.equal(r.revenue, 0)
})

test('commande apres 7 jours exclue', async () => {
  seed({ orders: [{ customer_phone: P1, total: 40, status: 'delivered', created_at: at(-10 + 7.5) }] })
  const r = await compute()
  assert.equal(r.orders, 0)
})

test('commande annulee exclue', async () => {
  seed({ orders: [{ customer_phone: P1, total: 40, status: 'cancelled', created_at: at(-8) }] })
  const r = await compute()
  assert.equal(r.orders, 0)
  assert.equal(r.revenue, 0)
})

test('client compte une seule fois pour le taux, toutes ses commandes pour le chiffre d affaires', async () => {
  seed({
    orders: [
      { customer_phone: P1, total: 40, status: 'delivered', created_at: at(-8) },
      { customer_phone: P1, total: 25, status: 'delivered', created_at: at(-7) },
    ],
  })
  const r = await compute()
  assert.equal(r.orders, 2)
  assert.equal(r.revenue, 65)
  assert.equal(r.conversionRate, 50)
})

test('taux arrondi a 1 decimale', async () => {
  seed({
    campaign_sends: [
      { campaign_id: 'c1', phone: P1, status: 'sent', sent_at: at(-10) },
      { campaign_id: 'c1', phone: P2, status: 'sent', sent_at: at(-10) },
      { campaign_id: 'c1', phone: P3, status: 'sent', sent_at: at(-10) },
    ],
    orders: [{ customer_phone: P1, total: 10, status: 'delivered', created_at: at(-9) }],
  })
  assert.equal((await compute()).conversionRate, 33.3)
})

test('taux a 0 sans envoi', async () => {
  seed({ campaign_sends: [], orders: [{ customer_phone: P1, total: 40, status: 'delivered', created_at: at(-8) }] })
  const r = await compute()
  assert.equal(r.sent, 0)
  assert.equal(r.refused, 0)
  assert.equal(r.orders, 0)
  assert.equal(r.conversionRate, 0)
})

test('table absente : unavailable avec message, sans exception', async () => {
  seed()
  for (const t of ['campaign_sends', 'marketing_refusals', 'orders']) {
    const r = await compute(dbWithoutTable(t))
    assert.equal(r.unavailable, true)
    assert.ok(typeof r.message === 'string' && r.message.length > 10)
  }
})

test('route : un non-admin est refuse', async () => {
  seed()
  const denied = { ok: false, status: 403, error: 'Acces reserve aux administrateurs' }
  const res = await runCampaignResultsAction({ check: denied, db: createClient(), campaignId: 'c1', nowMs: NOW })
  assert.equal(res.status, 403)
})

test('route : admin recoit 200 avec les chiffres, 200 unavailable si table absente, 400 sans id', async () => {
  seed()
  const admin = { ok: true, email: 'admin@example.test', role: 'owner' }
  const ok = await runCampaignResultsAction({ check: admin, db: createClient(), campaignId: 'c1', nowMs: NOW })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.sent, 2)
  const un = await runCampaignResultsAction({ check: admin, db: dbWithoutTable('orders'), campaignId: 'c1', nowMs: NOW })
  assert.equal(un.status, 200)
  assert.equal(un.body.unavailable, true)
  const bad = await runCampaignResultsAction({ check: admin, db: createClient(), nowMs: NOW })
  assert.equal(bad.status, 400)
})
