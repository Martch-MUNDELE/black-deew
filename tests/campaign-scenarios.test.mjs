// BLAC-P3-013 : scenarios de campagne (meilleurs clients, inactifs) et file d'envoi, base simulee en memoire.
// Aucun envoi, aucune vraie base, aucune migration.
import test from 'node:test'
import assert from 'node:assert/strict'

await import('./helpers/env.mjs')
const { resetFakeDb, createClient } = await import('./helpers/fake-supabase.mjs')
const S = await import('../lib/campaign-scenarios.ts')
const { runCampaignSendsAction, SCENARIO_UNAVAILABLE_MESSAGE } = await import('../lib/campaign-sends.ts')
const { normalizePhone } = await import('../lib/vip-server.ts')

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 3, 12, 0, 0)
const at = (d, base = NOW) => new Date(base - d * DAY).toISOString()
const order = (phone, total, daysAgo, status = 'delivered') => ({
  customer_phone: phone, customer_name: 'Client', total, status, created_at: at(daysAgo),
})
const phones = (list) => list.map((c) => c.phone)

test('constantes de seuils exportees', () => {
  assert.equal(S.BEST_CLIENTS_WINDOW_DAYS, 180)
  assert.equal(S.BEST_CLIENTS_LIMIT, 20)
  assert.equal(S.INACTIVE_MIN_ORDERS, 2)
  assert.equal(S.INACTIVE_MIN_DAYS, 60)
  assert.equal(S.INACTIVE_MAX_DAYS, 365)
})

test('meilleurs clients : classement par chiffre d affaires', () => {
  const orders = [order('+243810000001', 100, 10), order('+243810000002', 300, 10), order('+243810000003', 200, 10)]
  assert.deepEqual(phones(S.selectBestClients(orders, NOW)), ['+243810000002', '+243810000003', '+243810000001'])
})

test('meilleurs clients : egalite, le plus recent d abord', () => {
  const orders = [order('+243810000001', 100, 30), order('+243810000002', 100, 5), order('+243810000003', 100, 60)]
  assert.deepEqual(phones(S.selectBestClients(orders, NOW)), ['+243810000002', '+243810000001', '+243810000003'])
})

test('meilleurs clients : commandes annulees exclues du chiffre et du classement', () => {
  const orders = [
    order('+243810000001', 50, 10),
    order('+243810000002', 9999, 10, 'cancelled'),
    order('+243810000001', 8000, 12, 'cancelled'),
  ]
  const res = S.selectBestClients(orders, NOW)
  assert.deepEqual(phones(res), ['+243810000001'])
  assert.equal(res[0].revenue, 50)
})

test('meilleurs clients : fenetre de 180 jours', () => {
  const orders = [order('+243810000001', 100, 179), order('+243810000002', 900, 181)]
  assert.deepEqual(phones(S.selectBestClients(orders, NOW)), ['+243810000001'])
})

test('meilleurs clients : limite de 20 et regroupement des formats de numero', () => {
  const many = Array.from({ length: 25 }, (_, i) => order(`+2438100001${String(i).padStart(2, '0')}`, 100 + i, 10))
  const res = S.selectBestClients(many, NOW)
  assert.equal(res.length, 20)
  assert.ok(!phones(res).includes('+243810000100'))
  const merged = S.selectBestClients([order('+243810000001', 40, 10), order('243810000001', 60, 20)], NOW)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].revenue, 100)
  assert.equal(merged[0].orders, 2)
})

test('inactifs : seuil de 2 commandes non annulees', () => {
  const orders = [
    order('+243810000001', 10, 100), // 1 commande seulement
    order('+243810000002', 10, 100), order('+243810000002', 10, 150), // 2 commandes
    order('+243810000003', 10, 100), order('+243810000003', 10, 150, 'cancelled'), // 1 seule valable
  ]
  assert.deepEqual(phones(S.selectInactiveClients(orders, NOW)), ['+243810000002'])
})

test('inactifs : derniere commande strictement apres 60 jours', () => {
  const two = (p, d) => [order(p, 10, d), order(p, 10, d + 30)]
  const orders = [...two('+243810000001', 59), ...two('+243810000002', 60), ...two('+243810000003', 61)]
  assert.deepEqual(phones(S.selectInactiveClients(orders, NOW)), ['+243810000003'])
})

test('inactifs : derniere commande au plus 365 jours', () => {
  const two = (p, d) => [order(p, 10, d), order(p, 10, d + 30)]
  const orders = [...two('+243810000001', 365), ...two('+243810000002', 366)]
  assert.deepEqual(phones(S.selectInactiveClients(orders, NOW)), ['+243810000001'])
})

// ---- File d'envoi par scenario ----
const ADMIN = { ok: true, email: 'admin@example.test', role: 'owner' }
const P1 = '+243810000001' // eligible
const P2 = '+243810000002' // refuse
const P3 = '+243810000003' // opt-out
const P4 = '+243810000004' // contacte il y a 5 jours (plafond 30 jours)
const P5 = '+212600000005' // eligible via mot de passe individuel
const P6 = '+243810000006' // autorise, sans commande valable
const P9 = '+243819999999' // hors liste VIP
const ago = (d) => at(d, Date.now())
const ord = (phone, total, d, status = 'delivered') => ({ customer_phone: phone, total, status, created_at: ago(d) })

const seed = (audience, withOrders = true) =>
  resetFakeDb({
    campaigns: [{ id: 'c1', name: 'Merci VIP', message: 'Bonjour.', status: 'ready', ...(audience ? { audience_mode: audience } : {}) }],
    settings: [{ key: 'vip_allowed_phones', value: JSON.stringify([P1, P2, P3, P4, P6]) }],
    vip_individual_passwords: [{ phone: P5, password: 'x' }],
    marketing_refusals: [{ phone: P2, created_at: ago(90), source: 'whatsapp_stop' }],
    vip_access_requests: [{ phone: P3, marketing_opt_in: false }],
    campaign_sends: [
      { campaign_id: 'c0', phone: P4, status: 'sent', sent_at: ago(5) },
      { campaign_id: 'c0', phone: P1, status: 'sent', sent_at: ago(40) },
    ],
    ...(withOrders
      ? {
          orders: [
            ord(P9, 1000, 10), ord(P2, 500, 10), ord(P3, 400, 10), ord(P4, 300, 10), ord(P1, 200, 10),
            ord('212600000005', 100, 10), ord(P6, 5000, 10, 'cancelled'),
            // inactifs : 2 commandes, derniere il y a 100 jours
            ...[P1, P2, P3, P4, P9].flatMap((p) => [ord(p, 10, 100), ord(p, 10, 130)]),
            ord(P5, 10, 100), // une seule commande pour P5 : jamais inactif
          ],
        }
      : {}),
  })

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

const queue = (db = createClient()) => runCampaignSendsAction({ check: ADMIN, db, method: 'GET', campaignId: 'c1' })
const qphones = (res) => res.body.queue.map((i) => i.phone).sort()

test('file best_clients : refus, opt-out, plafond 30 jours et hors VIP exclus', async () => {
  seed('best_clients')
  const res = await queue()
  assert.equal(res.status, 200)
  // P1 : dernier envoi il y a 40 jours, ne bloque pas ; P5 via mot de passe individuel
  assert.deepEqual(qphones(res), [P1, P5].sort())
  assert.equal(res.body.audience, 'best_clients')
  assert.equal(res.body.total, 2)
  for (const excluded of [P2, P3, P4, P6, P9]) assert.ok(!qphones(res).includes(excluded))
})

test('file inactive_clients : refus, opt-out et plafond 30 jours exclus', async () => {
  seed('inactive_clients')
  const pair = (p) => [ord(p, 10, 100), ord(p, 10, 130)]
  globalThis.__FAKE_DB__.tables.orders = [...pair(P1), ...pair(P2), ...pair(P3), ...pair(P4), ...pair(P9), ord(P5, 10, 100), ord(P6, 10, 5), ord(P6, 10, 100)]
  const res = await queue()
  assert.deepEqual(qphones(res), [P1])
  assert.equal(res.body.audience, 'inactive_clients')
  for (const excluded of [P2, P3, P4, P5, P9]) assert.ok(!qphones(res).includes(excluded))
})

test('all_consenting inchange, champ absent = all_consenting', async () => {
  for (const mode of ['all_consenting', undefined]) {
    seed(mode)
    const res = await queue()
    assert.deepEqual(qphones(res), [P1, P5, P6].sort())
    assert.equal(res.body.audience, 'all_consenting')
  }
})

test('all_consenting n a pas besoin de la table orders', async () => {
  seed('all_consenting', false)
  const res = await queue(dbWithoutTable('orders'))
  assert.equal(res.status, 200)
  assert.ok(!res.body.unavailable)
  assert.deepEqual(qphones(res), [P1, P5, P6].sort())
})

test('table orders absente : unavailable explicite, file vide, pas de repli sur tous les clients', async () => {
  for (const mode of ['best_clients', 'inactive_clients']) {
    seed(mode, false)
    const res = await queue(dbWithoutTable('orders'))
    assert.equal(res.status, 200)
    assert.equal(res.body.unavailable, true)
    assert.equal(res.body.message, SCENARIO_UNAVAILABLE_MESSAGE)
    assert.deepEqual(res.body.queue, [])
    assert.equal(res.body.total, 0)
  }
})

test('marquer envoye : refuse un numero hors scenario et ne plante pas si orders absente', async () => {
  seed('best_clients')
  const out = await runCampaignSendsAction({
    check: ADMIN, db: createClient(), method: 'PATCH', body: { campaign_id: 'c1', phone: P6, action: 'sent' },
  })
  assert.equal(out.status, 409)
  seed('best_clients', false)
  const unavailable = await runCampaignSendsAction({
    check: ADMIN, db: dbWithoutTable('orders'), method: 'PATCH', body: { campaign_id: 'c1', phone: P1, action: 'sent' },
  })
  assert.equal(unavailable.status, 200)
  assert.equal(unavailable.body.unavailable, true)
})

test('numeros du scenario normalises', () => {
  const res = S.selectBestClients([order('243810000001', 10, 5)], NOW)
  assert.equal(res[0].phone, normalizePhone('243810000001'))
})
