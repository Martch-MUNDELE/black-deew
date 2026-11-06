// BLAC-P3-035 : simulation d'une journée complète de livreur (faux client en mémoire, sans réseau, sans vraie base).
// Journée 1 -> rendu d'argent -> journée 2 avec report. Écrit aussi reports/BLAC-LIVREURS-JOURNEE-TEST_REPORT.md.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ledger = await import('@/lib/driver-ledger')
const data = await import('@/lib/driver-ledger-data')
const alertLib = await import('@/lib/driver-stock-alert')

// ---------------------------------------------------------------------------
// Faux client en mémoire : select / insert / update / delete, eq / in / gte / order / maybeSingle.
// ---------------------------------------------------------------------------
function createMemoryClient(initial) {
  const tables = structuredClone(initial)
  let seq = 0
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++seq * 1000).toISOString()
  class Query {
    constructor(table) {
      this.table = table
      this.op = 'select'
      this.cols = '*'
      this.filters = []
      this.sortKey = null
      this.payload = null
    }
    select(cols = '*') { this.cols = cols; return this }
    insert(rows) { this.op = 'insert'; this.payload = rows; return this }
    update(patch) { this.op = 'update'; this.payload = patch; return this }
    delete() { this.op = 'delete'; return this }
    eq(col, val) { this.filters.push((r) => r[col] === val); return this }
    in(col, vals) { this.filters.push((r) => vals.includes(r[col])); return this }
    gte(col, val) { this.filters.push((r) => r[col] != null && String(r[col]) >= String(val)); return this }
    order(col) { this.sortKey = col; return this }
    match(r) { return this.filters.every((f) => f(r)) }
    run() {
      if (!tables[this.table]) tables[this.table] = []
      const rows = tables[this.table]
      if (this.op === 'insert') {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload]
        for (const r of list) rows.push({ id: globalThis.crypto.randomUUID(), created_at: stamp(), ...structuredClone(r) })
        return { data: null, error: null }
      }
      if (this.op === 'update') {
        for (const r of rows) if (this.match(r)) Object.assign(r, this.payload)
        return { data: null, error: null }
      }
      if (this.op === 'delete') {
        tables[this.table] = rows.filter((r) => !this.match(r))
        return { data: null, error: null }
      }
      const out = rows.filter((r) => this.match(r)).map((r) => structuredClone(r))
      if (this.cols.includes('delivery_drivers(')) {
        for (const r of out) {
          const d = (tables.delivery_drivers ?? []).find((x) => x.id === r.driver_id)
          r.delivery_drivers = d ? structuredClone(d) : null
        }
      }
      if (this.sortKey) out.sort((a, b) => String(a[this.sortKey] ?? '').localeCompare(String(b[this.sortKey] ?? '')))
      return { data: out, error: null }
    }
    maybeSingle() {
      const r = this.run()
      return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error })
    }
    single() { return this.maybeSingle() }
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej) }
  }
  return { from: (t) => new Query(t), tables }
}

// ---------------------------------------------------------------------------
// Données de départ
// ---------------------------------------------------------------------------
const D = 'd1'
const NAMES = { p1: 'Cuvée Or', p2: 'Réserve Noire' }
const client = createMemoryClient({
  products: [
    { id: 'p1', name: 'Cuvée Or', is_vip: true },
    { id: 'p2', name: 'Réserve Noire', is_vip: true },
    { id: 'p3', name: 'Eau minérale', is_vip: false },
  ],
  delivery_drivers: [
    { id: 'd1', full_name: 'Karim', status: 'active' },
    { id: 'd2', full_name: 'Samir', status: 'active' },
  ],
  driver_sessions: [],
  driver_cash_movements: [],
  driver_stock_movements: [],
  order_deliveries: [],
})
const at = (day, hm) => `2026-03-0${day}T${hm}:00.000Z`
const snap = () => JSON.stringify(client.tables)
const money = (n) => `${Number(n).toFixed(2)} USD`
const st = { s1: null, s2: null, final1: null, final2: null, carry: null }
const steps = []
const passed = new Set()

async function alertsNow() {
  const s = await alertLib.loadOpenDriverStock(client)
  return alertLib.driverVipAlerts(s.drivers, s.names)
}
const alertKeys = (a) => a.map((x) => `${x.product_id}:${x.level}:${x.onHand}`).sort()

async function measure(sessionId) {
  const row = client.tables.driver_sessions.find((s) => s.id === sessionId)
  const ctx = await data.loadClosingContext(client, row)
  const balances = ledger.vipStockBalance(await data.listStockMovements(client, sessionId))
  const stock = Object.fromEntries(balances.map((b) => [b.product_id, b]))
  const alerts = await alertsNow()
  return { row, ctx, s: ctx.summary, balances, stock, alerts }
}

async function deliver(sessionId, { order_id, collected, fee, when, lines = [], driver = D, status = 'delivered' }) {
  await client.from('order_deliveries').insert({
    order_id,
    driver_id: driver,
    status,
    amount_collected: collected,
    driver_fee_total: fee,
    delivered_at: status === 'delivered' ? when : null,
    created_at: when,
  })
  if (status !== 'delivered') return
  for (const [product_id, quantity] of lines) {
    await data.addStockMovement(client, { session_id: sessionId, driver_id: driver, product_id, kind: 'delivered', quantity, order_id })
  }
}

function record(title, m, notes = []) {
  const s = m.s
  const md = [`## ${title}`, '']
  for (const n of notes) md.push(n, '')
  md.push('| Indicateur | Valeur |', '|---|---|')
  const rows = [
    ["Monnaie d'ouverture", s.opening],
    ['Compléments de monnaie', s.topup],
    ['Monnaie donnée au total', s.given],
    ['Argent encaissé (livraisons livrées)', s.collected],
    ['Frais livreur', s.driverFees],
    ['Net à remettre', s.netToRemit],
    ['Argent sur le livreur (monnaie en main)', s.cashOnHand],
    ['Monnaie rendue', s.returned],
    ['Monnaie gardée', s.kept],
  ]
  for (const [k, v] of rows) md.push(`| ${k} | ${money(v)} |`)
  md.push('', '| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |', '|---|---|---|---|---|---|')
  for (const b of m.balances) {
    md.push(`| ${NAMES[b.product_id] ?? b.product_id} | ${b.loaded} | ${b.delivered} | ${b.returned} | ${b.kept} | ${b.onHand} |`)
  }
  md.push('', `Alertes de stock : ${m.alerts.length ? m.alerts.map((a) => alertLib.alertMessage(a)).join(' ; ') : 'aucune'}`, '')
  steps.push(md.join('\n'))
}

const goodCash = { returned: 100, kept: 50 }
const goodStock = () => ({ p1: { returned: 1, kept: 1 }, p2: { returned: 1, kept: 3 } })

// ---------------------------------------------------------------------------
// Journée 1
// ---------------------------------------------------------------------------
test('J1 · ouverture : fonds de monnaie, chargement VIP, produit non VIP refusé', async () => {
  assert.equal(ledger.DEFAULT_VIP_LOW_STOCK, 3)
  assert.deepEqual(await data.prepareOpening(client, D), { openingCash: 0, loads: {} })

  const before = snap()
  await assert.rejects(
    () => data.openSessionWithLedger(client, {
      driver_id: D,
      openingCash: 100,
      loads: [{ product_id: 'p1', quantity: 6 }, { product_id: 'p3', quantity: 2 }],
      now: new Date(at(2, '08:00')),
    }),
    /non VIP/
  )
  assert.equal(snap(), before, 'ouverture refusée : aucune écriture')

  const { session_id } = await data.openSessionWithLedger(client, {
    driver_id: D,
    openingCash: 100,
    loads: [{ product_id: 'p1', quantity: 6 }, { product_id: 'p2', quantity: 4 }],
    now: new Date(at(2, '08:00')),
  })
  st.s1 = session_id
  const stockBefore = client.tables.driver_stock_movements.length
  await assert.rejects(
    () => data.addStockMovement(client, { session_id, driver_id: D, product_id: 'p3', kind: 'load', quantity: 2 }),
    /non VIP/
  )
  assert.equal(client.tables.driver_stock_movements.length, stockBefore)

  const m = await measure(session_id)
  assert.equal(m.s.opening, 100)
  assert.equal(m.s.given, 100)
  assert.equal(m.s.netToRemit, 100)
  assert.equal(m.s.cashOnHand, 100)
  assert.equal(m.stock.p1.onHand, 6)
  assert.equal(m.stock.p2.onHand, 4)
  assert.equal(m.stock.p3, undefined)
  assert.deepEqual(alertKeys(m.alerts), [])
  record('Étape 1 — Journée 1 : ouverture (fonds 100, 6 × Cuvée Or, 4 × Réserve Noire)', m, [
    'Le chargement de « Eau minérale » (produit non VIP) est refusé (message « Produit non VIP refusé ») et n\'écrit rien, à l\'ouverture comme en cours de session.',
  ])
  passed.add('ouverture')
})

test('J1 · livraison 1 : encaissé 45, frais 5, 2 × Cuvée Or ; seules les livraisons livrées du livreur comptent', async () => {
  await deliver(st.s1, { order_id: 'o1', collected: 45, fee: 5, when: at(2, '09:30'), lines: [['p1', 2]] })
  await deliver(st.s1, { order_id: 'o_att', collected: 99, fee: 9, when: at(2, '09:45'), status: 'assigned' })
  await deliver(st.s1, { order_id: 'o_autre', collected: 500, fee: 50, when: at(2, '09:40'), driver: 'd2' })
  const m = await measure(st.s1)
  assert.equal(m.s.collected, 45)
  assert.equal(m.s.driverFees, 5)
  assert.equal(m.s.netToRemit, 140)
  assert.equal(m.stock.p1.onHand, 4)
  assert.equal(m.stock.p1.delivered, 2)
  assert.deepEqual(alertKeys(m.alerts), [])
  record('Étape 2 — Journée 1 : livraison n°1 (o1)', m, [
    'Livraison o1 : encaissé 45, frais 5, 2 × Cuvée Or. Ignorées par le calcul : une course « assigned » de 99 et une livraison d\'un autre livreur de 500.',
  ])
  passed.add('livraison 1')
})

test('J1 · livraison 2 : l\'alerte de stock bas apparaît au seuil (3)', async () => {
  await deliver(st.s1, { order_id: 'o2', collected: 30, fee: 5, when: at(2, '11:00'), lines: [['p1', 1]] })
  const m = await measure(st.s1)
  assert.equal(m.s.collected, 75)
  assert.equal(m.s.driverFees, 10)
  assert.equal(m.s.netToRemit, 165)
  assert.equal(m.stock.p1.onHand, 3)
  assert.deepEqual(alertKeys(m.alerts), ['p1:low:3'])
  assert.equal(alertLib.alertMessage(m.alerts[0]), 'Livreur Karim : stock bas de Cuvée Or : 3 restant')
  record('Étape 3 — Journée 1 : livraison n°2 (o2), Cuvée Or au seuil', m, ['Cuvée Or tombe à 3 = seuil : alerte « stock bas ». À 4 il n\'y en avait pas.'])
  passed.add('livraison 2')
})

test('J1 · livraison 3 : le stock vide est signalé', async () => {
  await deliver(st.s1, { order_id: 'o3', collected: 60, fee: 10, when: at(2, '12:30'), lines: [['p2', 4]] })
  const m = await measure(st.s1)
  assert.equal(m.s.collected, 135)
  assert.equal(m.s.driverFees, 20)
  assert.equal(m.s.netToRemit, 215)
  assert.equal(m.stock.p2.onHand, 0)
  assert.equal(m.stock.p2.insufficient, false)
  assert.deepEqual(alertKeys(m.alerts), ['p1:low:3', 'p2:empty:0'])
  const messages = m.alerts.map((a) => alertLib.alertMessage(a))
  assert.ok(messages.includes('Livreur Karim : plus de produit Réserve Noire'))
  assert.equal(m.alerts[0].level, 'empty', 'le vide passe avant le bas')
  record('Étape 4 — Journée 1 : livraison n°3 (o3), Réserve Noire épuisée', m)
  passed.add('livraison 3')
})

test('J1 · compléments en cours de journée : +50 de monnaie, +5 × Réserve Noire', async () => {
  await data.addCashMovement(client, { session_id: st.s1, driver_id: D, kind: 'topup', amount: 50 })
  await data.addStockMovement(client, { session_id: st.s1, driver_id: D, product_id: 'p2', kind: 'topup', quantity: 5 })
  const m = await measure(st.s1)
  assert.equal(m.s.topup, 50)
  assert.equal(m.s.given, 150)
  assert.equal(m.s.cashOnHand, 150)
  assert.equal(m.s.netToRemit, 265)
  assert.equal(m.stock.p2.onHand, 5)
  assert.deepEqual(alertKeys(m.alerts), ['p1:low:3'])
  record('Étape 5 — Journée 1 : compléments de monnaie (+50) et de stock (+5 Réserve Noire)', m, ['Réserve Noire remonte à 5 : l\'alerte « vide » disparaît.'])
  passed.add('compléments')
})

test('J1 · livraison 4 : totaux de la journée avant clôture', async () => {
  await deliver(st.s1, { order_id: 'o4', collected: 25, fee: 5, when: at(2, '15:00'), lines: [['p1', 1], ['p2', 1]] })
  const m = await measure(st.s1)
  assert.equal(m.s.collected, 160)
  assert.equal(m.s.driverFees, 25)
  assert.equal(m.s.netToRemit, 285) // 150 + 160 - 25
  assert.equal(m.s.cashOnHand, 150)
  assert.equal(m.stock.p1.onHand, 2)
  assert.equal(m.stock.p2.onHand, 4)
  assert.deepEqual(alertKeys(m.alerts), ['p1:low:2'])
  const ids = ledger.deliveriesOfSession(client.tables.order_deliveries, { driver_id: D, started_at: m.row.started_at, closed_at: null }).map((d) => d.order_id).sort()
  assert.deepEqual(ids, ['o1', 'o2', 'o3', 'o4'])
  assert.deepEqual(m.ctx.stock.map((x) => [x.product_id, x.name, x.onHand]), [['p1', 'Cuvée Or', 2], ['p2', 'Réserve Noire', 4]])
  record('Étape 6 — Journée 1 : livraison n°4 (o4), contexte de clôture', m, [
    'Calcul à la main : net à remettre = 150 (fonds + compléments) + 160 (encaissé) − 25 (frais) = 285.',
  ])
  passed.add('livraison 4')
})

// ---------------------------------------------------------------------------
// Fin de journée 1
// ---------------------------------------------------------------------------
test('Fin J1 · cas avec écart : toute clôture incohérente est refusée et n\'écrit rien', async () => {
  const m = await measure(st.s1)
  const stockOnHand = Object.fromEntries(m.balances.map((b) => [b.product_id, b.onHand]))
  assert.deepEqual(stockOnHand, { p1: 2, p2: 4 })
  assert.equal(m.ctx.cashOnHand, 150)
  const cases = [
    ['Monnaie rendue 100 + gardée 40 ≠ 150 en main', { cash: { returned: 100, kept: 40 }, stock: goodStock() }, /Monnaie/],
    ['Cuvée Or rendu 1 + gardé 0 ≠ 2 en main', { cash: goodCash, stock: { ...goodStock(), p1: { returned: 1, kept: 0 } } }, /Produit p1/],
    ['Réserve Noire rendu 5 + gardé 0 ≠ 4 en main', { cash: goodCash, stock: { ...goodStock(), p2: { returned: 5, kept: 0 } } }, /Produit p2/],
    ['Aucune décision pour Réserve Noire (4 en main)', { cash: goodCash, stock: { p1: { returned: 1, kept: 1 } } }, /Produit p2 : aucune décision/],
    ['Décision pour un produit inconnu', { cash: goodCash, stock: { ...goodStock(), p9: { returned: 1, kept: 0 } } }, /produit inconnu/],
  ]
  const lines = ['| Cas refusé | Message du système |', '|---|---|']
  for (const [label, decisions, re] of cases) {
    const before = snap()
    let message = ''
    await assert.rejects(
      () => data.writeClosingMovements(client, { session_id: st.s1, driver_id: D, cashOnHand: m.ctx.cashOnHand, stockOnHand, decisions }),
      (e) => {
        message = e.message
        return e instanceof ledger.LedgerError && re.test(e.message)
      }
    )
    assert.equal(snap(), before, `cas « ${label} » : rien ne doit être écrit`)
    lines.push(`| ${label} | ${message} |`)
  }
  steps.push(['## Étape 7 — Fin de journée 1 : clôtures avec écart (toutes refusées, rien d\'écrit)', '', ...lines, ''].join('\n'))
  passed.add('écart')
})

test('Fin J1 · cas correct : on rend 100 de monnaie et on garde 50 ; stock p1 1/1, p2 1/3', async () => {
  const m = await measure(st.s1)
  const stockOnHand = Object.fromEntries(m.balances.map((b) => [b.product_id, b.onHand]))
  const written = await data.writeClosingMovements(client, {
    session_id: st.s1,
    driver_id: D,
    cashOnHand: m.ctx.cashOnHand,
    stockOnHand,
    decisions: { cash: goodCash, stock: goodStock() },
  })
  assert.equal(written.cashReturned, 100)
  assert.equal(written.cashKept, 50)
  assert.equal(written.cashMovements.length, 2)
  assert.equal(written.stockMovements.length, 4)

  await data.finalizeSessionClose(client, {
    session_id: st.s1,
    driver_id: D,
    collected_cash: m.ctx.collected,
    net_to_remit: m.ctx.netToRemit,
    now: new Date(at(2, '18:00')),
  })
  const row = client.tables.driver_sessions.find((s) => s.id === st.s1)
  assert.equal(row.session_status, 'closed')
  assert.equal(row.closed_at, at(2, '18:00'))
  assert.equal(row.collected_cash, 160)
  assert.equal(row.net_to_remit, 285)
  assert.equal(client.tables.delivery_drivers.find((d) => d.id === D).status, 'inactive')

  const after = await measure(st.s1)
  assert.equal(after.s.collected, 160)
  assert.equal(after.s.driverFees, 25)
  assert.equal(after.s.netToRemit, 285)
  assert.equal(after.s.returned, 100)
  assert.equal(after.s.kept, 50)
  assert.equal(after.s.cashOnHand, 0)
  assert.equal(after.stock.p1.delivered, 4)
  assert.equal(after.stock.p2.loaded, 9)
  assert.equal(after.stock.p2.delivered, 5)
  assert.deepEqual([after.stock.p1.returned, after.stock.p1.kept, after.stock.p1.onHand], [1, 1, 0])
  assert.deepEqual([after.stock.p2.returned, after.stock.p2.kept, after.stock.p2.onHand], [1, 3, 0])
  assert.deepEqual(alertKeys(after.alerts), [], 'plus aucune session ouverte : plus d\'alerte')

  const ledgers = await data.loadLedgers(client, [st.s1])
  const text = data.describeClosing(ledgers[st.s1], (id) => NAMES[id] ?? id, 'USD')
  assert.equal(text, 'Rendu 100 USD · Gardé 50 USD · Cuvée Or : rendu 1 / gardé 1 · Réserve Noire : rendu 1 / gardé 3')

  st.final1 = after
  record('Étape 8 — Fin de journée 1 : clôture correcte (rendu 100 + gardé 50 = 150 en main)', after, [
    'Stock rendu / gardé : Cuvée Or 1 / 1 (= 2 en main), Réserve Noire 1 / 3 (= 4 en main). Session fermée, collecté 160, net remis 285, livreur passé en inactif.',
    `Historique affiché : ${text}`,
  ])
  passed.add('clôture')
})

// ---------------------------------------------------------------------------
// Journée 2
// ---------------------------------------------------------------------------
test('J2 · le report est exactement ce qui a été gardé et la session s\'ouvre avec', async () => {
  const prep = await data.prepareOpening(client, D)
  assert.deepEqual(prep, { openingCash: 50, loads: { p1: '1', p2: '3' } })
  st.carry = prep
  const { session_id } = await data.openSessionWithLedger(client, {
    driver_id: D,
    openingCash: prep.openingCash,
    loads: Object.entries(prep.loads).map(([product_id, q]) => ({ product_id, quantity: Number(q) })),
    now: new Date(at(3, '08:00')),
  })
  st.s2 = session_id
  const cashRows = await data.listCashMovements(client, session_id)
  assert.deepEqual(cashRows.map((r) => [r.kind, r.amount]), [['opening', 50]])
  const m = await measure(session_id)
  assert.equal(m.s.opening, 50)
  assert.equal(m.s.cashOnHand, 50)
  assert.equal(m.s.netToRemit, 50)
  assert.equal(m.s.collected, 0)
  assert.equal(m.stock.p1.onHand, 1)
  assert.equal(m.stock.p2.onHand, 3)
  assert.deepEqual(alertKeys(m.alerts), ['p1:low:1', 'p2:low:3'])
  record('Étape 9 — Journée 2 : ouverture avec le report (50 de monnaie, 1 × Cuvée Or, 3 × Réserve Noire)', m, [
    'Report lu par prepareOpening : monnaie 50, Cuvée Or 1, Réserve Noire 3 = exactement ce qui avait été gardé le soir de la journée 1.',
  ])
  passed.add('report')
})

test('J2 · nouvelle livraison, et les livraisons de la journée 1 ne sont pas recomptées', async () => {
  await deliver(st.s2, { order_id: 'o5', collected: 20, fee: 5, when: at(3, '10:00'), lines: [['p2', 1]] })
  const m = await measure(st.s2)
  assert.equal(m.s.collected, 20, 'pas 180 : les 160 de la journée 1 ne comptent pas')
  assert.equal(m.s.driverFees, 5)
  assert.equal(m.s.netToRemit, 65) // 50 + 20 - 5
  assert.equal(m.s.cashOnHand, 50)
  assert.equal(m.stock.p1.onHand, 1)
  assert.equal(m.stock.p2.onHand, 2)
  assert.deepEqual(alertKeys(m.alerts), ['p1:low:1', 'p2:low:2'])

  const ids2 = ledger.deliveriesOfSession(client.tables.order_deliveries, { driver_id: D, started_at: m.row.started_at, closed_at: null }).map((d) => d.order_id)
  assert.deepEqual(ids2, ['o5'])
  const day1 = await measure(st.s1)
  assert.equal(day1.s.collected, 160, 'la journée 1 garde ses 160 malgré la livraison du lendemain')
  assert.equal(day1.s.netToRemit, 285)

  st.final2 = m
  record('Étape 10 — Journée 2 : livraison o5 (encaissé 20, frais 5, 1 × Réserve Noire)', m, [
    'Calcul à la main : net à remettre = 50 (report) + 20 (encaissé) − 5 (frais) = 65. La journée 1 reste à 160 encaissés / 285 net.',
  ])
  passed.add('journée 2')
})

// ---------------------------------------------------------------------------
// Rapport lisible
// ---------------------------------------------------------------------------
test('Rapport lisible écrit dans reports/BLAC-LIVREURS-JOURNEE-TEST_REPORT.md', async () => {
  const f1 = st.final1
  const f2 = st.final2
  assert.ok(f1 && f2, 'les étapes précédentes doivent avoir tourné')
  const ok = passed.size === 10
  const head = [
    '# BLAC-LIVREURS-JOURNEE — Simulation d\'une journée de livreur',
    '',
    'Rapport généré automatiquement par `tests/driver-day-simulation.test.mjs` (faux client de base de données en mémoire, aucun réseau, aucune vraie base).',
    'Livreur simulé : Karim. Produits VIP : Cuvée Or, Réserve Noire (+ Eau minérale, non VIP, pour le refus). Seuil de stock bas : 3.',
    'Limite : les mouvements de stock « livré » sont écrits par le test avec `addStockMovement` (comme le ferait la livraison), sans passer par la route `mark-livree`.',
    `Statut final : ${ok ? 'PASS' : 'FAIL'}`,
    '',
    `Résultat des contrôles du scénario : ${ok ? 'tous les contrôles précédents ont réussi.' : 'ATTENTION, au moins un contrôle a échoué : voir la sortie du test.'}`,
    '',
  ]
  const recap = [
    '## Récapitulatif à comparer avec l\'écran',
    '',
    '| Mesure | Journée 1 | Journée 2 |',
    '|---|---|---|',
    `| Monnaie d'ouverture | ${money(f1.s.opening)} | ${money(f2.s.opening)} |`,
    `| Compléments de monnaie | ${money(f1.s.topup)} | ${money(f2.s.topup)} |`,
    `| Argent encaissé | ${money(f1.s.collected)} | ${money(f2.s.collected)} |`,
    `| Frais livreur | ${money(f1.s.driverFees)} | ${money(f2.s.driverFees)} |`,
    `| Net à remettre | ${money(f1.s.netToRemit)} | ${money(f2.s.netToRemit)} |`,
    `| Monnaie rendue / gardée | ${money(f1.s.returned)} / ${money(f1.s.kept)} | pas encore clôturée |`,
    `| Report vers le lendemain | monnaie ${money(st.carry.openingCash)} ; Cuvée Or ${st.carry.loads.p1} ; Réserve Noire ${st.carry.loads.p2} | — |`,
    '',
    `Formule : net à remettre = monnaie donnée + encaissé − frais. Journée 1 : ${f1.s.given} + ${f1.s.collected} − ${f1.s.driverFees} = ${f1.s.netToRemit}. Journée 2 : ${f2.s.given} + ${f2.s.collected} − ${f2.s.driverFees} = ${f2.s.netToRemit}.`,
    '',
    '## Défauts constatés dans le code des livreurs',
    '',
    ok ? 'Aucun défaut révélé par ce scénario (aucune correction du code applicatif faite).' : 'Voir la sortie du test : au moins un contrôle a échoué.',
    '',
  ]
  const md = [...head, ...steps, ...recap].join('\n')
  const file = path.join(process.cwd(), 'reports', 'BLAC-LIVREURS-JOURNEE-TEST_REPORT.md')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, md, 'utf8')
  const back = fs.readFileSync(file, 'utf8')
  assert.ok(back.includes('285.00 USD'))
  assert.ok(back.includes('Étape 10'))
})
