// BLAC-P3-033 : accès aux journaux livreurs (faux Supabase en mémoire, sans réseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'

const data = await import('@/lib/driver-ledger-data')
const ledger = await import('@/lib/driver-ledger')

const baseTables = () => ({
  products: [
    { id: 'p1', name: 'Vip A', is_vip: true },
    { id: 'p2', name: 'Vip B', is_vip: true },
    { id: 'p3', name: 'Normal', is_vip: false },
  ],
  driver_sessions: [],
  driver_cash_movements: [],
  driver_stock_movements: [],
})

test('ajout de monnaie : fonds et complément sont écrits et relus', async () => {
  resetFakeDb(baseTables())
  const c = createClient()
  await data.addCashMovement(c, { session_id: 's1', driver_id: 'd1', kind: 'opening', amount: 100 })
  await data.addCashMovement(c, { session_id: 's1', driver_id: 'd1', kind: 'topup', amount: 40 })
  await data.addCashMovement(c, { session_id: 's2', driver_id: 'd1', kind: 'opening', amount: 5 })
  const rows = await data.listCashMovements(c, 's1')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((r) => r.kind).sort(), ['opening', 'topup'])
  assert.equal(rows.reduce((s, r) => s + r.amount, 0), 140)
})

test('ajout de monnaie : montant négatif, NaN ou complément nul refusés', async () => {
  resetFakeDb(baseTables())
  const c = createClient()
  await assert.rejects(() => data.addCashMovement(c, { session_id: 's1', driver_id: 'd1', kind: 'topup', amount: -5 }))
  await assert.rejects(() => data.addCashMovement(c, { session_id: 's1', driver_id: 'd1', kind: 'topup', amount: Number('x') }))
  await assert.rejects(() => data.addCashMovement(c, { session_id: 's1', driver_id: 'd1', kind: 'topup', amount: 0 }))
  assert.equal(getFakeTable('driver_cash_movements').length, 0)
})

test('réapprovisionnement : chargement puis complément cumulés dans le solde', async () => {
  resetFakeDb(baseTables())
  const c = createClient()
  await data.addStockMovement(c, { session_id: 's1', driver_id: 'd1', product_id: 'p1', kind: 'load', quantity: 5 })
  await data.addStockMovement(c, { session_id: 's1', driver_id: 'd1', product_id: 'p1', kind: 'topup', quantity: 3 })
  const rows = await data.listStockMovements(c, 's1')
  const balance = ledger.vipStockBalance(rows)
  assert.equal(balance.length, 1)
  assert.equal(balance[0].onHand, 8)
})

test('produit non VIP, inconnu ou quantité invalide refusés sans écriture', async () => {
  resetFakeDb(baseTables())
  const c = createClient()
  await assert.rejects(
    () => data.addStockMovement(c, { session_id: 's1', driver_id: 'd1', product_id: 'p3', kind: 'load', quantity: 2 }),
    /non VIP/
  )
  await assert.rejects(() => data.addStockMovement(c, { session_id: 's1', driver_id: 'd1', product_id: 'zz', kind: 'load', quantity: 2 }))
  await assert.rejects(() => data.addStockMovement(c, { session_id: 's1', driver_id: 'd1', product_id: 'p1', kind: 'load', quantity: 0 }))
  await assert.rejects(() => data.addStockMovement(c, { session_id: 's1', driver_id: 'd1', product_id: 'p1', kind: 'load', quantity: 1.5 }))
  assert.equal(getFakeTable('driver_stock_movements').length, 0)
})

test('clôture cohérente : mouvements rendu et gardé écrits, total rendu renvoyé', async () => {
  resetFakeDb(baseTables())
  const c = createClient()
  const res = await data.writeClosingMovements(c, {
    session_id: 's1',
    driver_id: 'd1',
    cashOnHand: 100,
    stockOnHand: { p1: 5, p2: 0 },
    decisions: { cash: { returned: 60, kept: 40 }, stock: { p1: { returned: 2, kept: 3 } } },
  })
  assert.equal(res.cashReturned, 60)
  assert.equal(res.cashKept, 40)
  const cash = getFakeTable('driver_cash_movements')
  assert.deepEqual(cash.map((r) => [r.kind, r.amount]), [['returned', 60], ['kept_for_next_day', 40]])
  const stock = getFakeTable('driver_stock_movements')
  assert.deepEqual(stock.map((r) => [r.kind, r.product_id, r.quantity]), [['returned', 'p1', 2], ['kept_for_next_day', 'p1', 3]])
})

test('clôture incohérente refusée et rien n\'est écrit', async () => {
  resetFakeDb(baseTables())
  const c = createClient()
  await assert.rejects(
    () => data.writeClosingMovements(c, {
      session_id: 's1', driver_id: 'd1', cashOnHand: 100, stockOnHand: { p1: 5 },
      decisions: { cash: { returned: 60, kept: 30 }, stock: { p1: { returned: 2, kept: 3 } } },
    }),
    /Monnaie/
  )
  await assert.rejects(
    () => data.writeClosingMovements(c, {
      session_id: 's1', driver_id: 'd1', cashOnHand: 100, stockOnHand: { p1: 5 },
      decisions: { cash: { returned: 60, kept: 40 }, stock: { p1: { returned: 2, kept: 2 } } },
    }),
    /quantité en main/
  )
  assert.equal(getFakeTable('driver_cash_movements').length, 0)
  assert.equal(getFakeTable('driver_stock_movements').length, 0)
})

test('report : dernière session clôturée du livreur, autres livreurs et sessions ouvertes ignorés', async () => {
  resetFakeDb({
    ...baseTables(),
    driver_sessions: [
      { id: 's-old', driver_id: 'd1', session_status: 'closed', started_at: '2026-11-04T08:00:00Z' },
      { id: 's-new', driver_id: 'd1', session_status: 'settled', started_at: '2026-11-05T08:00:00Z' },
      { id: 's-open', driver_id: 'd1', session_status: 'open', started_at: '2026-11-06T08:00:00Z' },
      { id: 's-other', driver_id: 'd2', session_status: 'closed', started_at: '2026-11-05T09:00:00Z' },
    ],
    driver_cash_movements: [
      { session_id: 's-old', driver_id: 'd1', kind: 'kept_for_next_day', amount: 10 },
      { session_id: 's-new', driver_id: 'd1', kind: 'kept_for_next_day', amount: 25 },
      { session_id: 's-new', driver_id: 'd1', kind: 'returned', amount: 70 },
      { session_id: 's-other', driver_id: 'd2', kind: 'kept_for_next_day', amount: 99 },
    ],
    driver_stock_movements: [
      { session_id: 's-new', driver_id: 'd1', product_id: 'p1', kind: 'kept_for_next_day', quantity: 3 },
      { session_id: 's-new', driver_id: 'd1', product_id: 'p2', kind: 'returned', quantity: 1 },
      { session_id: 's-old', driver_id: 'd1', product_id: 'p2', kind: 'kept_for_next_day', quantity: 7 },
    ],
  })
  const c = createClient()
  const carry = await data.readLastClosedCarryOver(c, 'd1')
  assert.equal(carry.openingCash, 25)
  assert.deepEqual(carry.stockLoads, [{ kind: 'load', product_id: 'p1', quantity: 3 }])
  const none = await data.readLastClosedCarryOver(c, 'd-inconnu')
  assert.deepEqual(none, { openingCash: 0, stockLoads: [] })
})

// ---- helpers de l'écran (BLAC-P3-033) ----
test('ouverture : session, fonds et chargements écrits ; produit non VIP refusé sans session', async () => {
  resetFakeDb(baseTables())
  const c = createClient()
  const { session_id } = await data.openSessionWithLedger(c, {
    driver_id: 'd1', openingCash: 50, loads: [{ product_id: 'p1', quantity: 4 }],
  })
  const sessions = getFakeTable('driver_sessions')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].id, session_id)
  assert.equal(sessions[0].session_status, 'open')
  assert.equal(sessions[0].opening_cash, 50)
  assert.equal(getFakeTable('driver_cash_movements')[0].kind, 'opening')
  assert.equal(getFakeTable('driver_stock_movements')[0].kind, 'load')
  await assert.rejects(
    () => data.openSessionWithLedger(c, { driver_id: 'd1', openingCash: 10, loads: [{ product_id: 'p3', quantity: 1 }] }),
    /non VIP/
  )
  assert.equal(getFakeTable('driver_sessions').length, 1)
  await assert.rejects(() => data.openSessionWithLedger(c, { driver_id: 'd1', openingCash: -1, loads: [] }))
})

test('préremplissage : report de la dernière session clôturée, zéro sinon', async () => {
  resetFakeDb({
    ...baseTables(),
    driver_sessions: [{ id: 'sx', driver_id: 'd1', session_status: 'closed', started_at: '2026-11-05T08:00:00Z' }],
    driver_cash_movements: [{ session_id: 'sx', driver_id: 'd1', kind: 'kept_for_next_day', amount: 30 }],
    driver_stock_movements: [{ session_id: 'sx', driver_id: 'd1', product_id: 'p1', kind: 'kept_for_next_day', quantity: 2 }],
  })
  const c = createClient()
  assert.deepEqual(await data.prepareOpening(c, 'd1'), { openingCash: 30, loads: { p1: '2' } })
  assert.deepEqual(await data.prepareOpening(c, 'd9'), { openingCash: 0, loads: {} })
})

test('trésorerie : net = fonds + compléments + collecté - frais des livraisons de la session', () => {
  const session = { driver_id: 'd1', started_at: '2026-10-20T08:00:00Z' }
  const dels = [
    { driver_id: 'd1', status: 'delivered', amount_collected: 50, driver_fee_total: 5, created_at: '2026-10-20T09:00:00Z' },
    { driver_id: 'd1', status: 'delivered', amount_collected: 20, driver_fee_total: 2, created_at: '2026-10-19T09:00:00Z' },
    { driver_id: 'd2', status: 'delivered', amount_collected: 99, driver_fee_total: 9, created_at: '2026-10-20T09:00:00Z' },
  ]
  const s = data.sessionCashSummary(session, dels, [
    { kind: 'opening', amount: 100 }, { kind: 'topup', amount: 20 },
  ])
  assert.equal(s.driverFees, 5)
  assert.equal(s.collected, 50)
  assert.equal(s.netToRemit, 165)
  const legacy = data.sessionCashSummary({ ...session, opening_cash: 80 }, [], [])
  assert.equal(legacy.netToRemit, 80)
})

test('alerte de stock : empty prioritaire, low, rien au-dessus du seuil', () => {
  assert.equal(data.stockAlertLevel(undefined), null)
  assert.equal(data.stockAlertLevel([{ kind: 'load', product_id: 'p1', quantity: 10 }]), null)
  assert.equal(data.stockAlertLevel([{ kind: 'load', product_id: 'p1', quantity: 3 }]), 'low')
  assert.equal(
    data.stockAlertLevel([
      { kind: 'load', product_id: 'p1', quantity: 3 }, { kind: 'delivered', product_id: 'p1', quantity: 3 },
      { kind: 'load', product_id: 'p2', quantity: 2 },
    ]),
    'empty'
  )
})

test('historique : texte rendu / gardé, null sans clôture', () => {
  const names = { p1: 'Vip A' }
  const nameOf = (id) => names[id] ?? id
  assert.equal(data.describeClosing(undefined, nameOf, 'USD'), null)
  assert.equal(data.describeClosing({ cash: [{ kind: 'opening', amount: 10 }], stock: [] }, nameOf, 'USD'), null)
  const text = data.describeClosing({
    cash: [{ kind: 'returned', amount: 60 }, { kind: 'kept_for_next_day', amount: 40 }],
    stock: [{ kind: 'returned', product_id: 'p1', quantity: 2 }, { kind: 'kept_for_next_day', product_id: 'p1', quantity: 3 }],
  }, nameOf, 'USD')
  assert.match(text, /Rendu 60 USD/)
  assert.match(text, /Gardé 40 USD/)
  assert.match(text, /Vip A : rendu 2 \/ gardé 3/)
})

test('contexte de clôture et fermeture : net, argent en main, stock restant, session close, livreur inactif', async () => {
  resetFakeDb({
    ...baseTables(),
    driver_sessions: [{ id: 's1', driver_id: 'd1', session_status: 'open', started_at: '2026-10-20T08:00:00Z' }],
    delivery_drivers: [{ id: 'd1', status: 'active' }],
    order_deliveries: [
      { driver_id: 'd1', status: 'delivered', amount_collected: 50, driver_fee_total: 5, created_at: '2026-10-20T09:00:00Z' },
    ],
    driver_cash_movements: [{ session_id: 's1', driver_id: 'd1', kind: 'opening', amount: 100 }],
    driver_stock_movements: [
      { session_id: 's1', driver_id: 'd1', product_id: 'p1', kind: 'load', quantity: 5 },
      { session_id: 's1', driver_id: 'd1', product_id: 'p1', kind: 'delivered', quantity: 2 },
    ],
  })
  const c = createClient()
  const ctx = await data.loadClosingContext(c, { id: 's1', driver_id: 'd1', started_at: '2026-10-20T08:00:00Z', opening_cash: 100 })
  assert.equal(ctx.cashOnHand, 100)
  assert.equal(ctx.netToRemit, 145)
  assert.equal(ctx.collected, 50)
  assert.deepEqual(ctx.stock, [{ product_id: 'p1', name: 'Vip A', onHand: 3 }])
  await data.finalizeSessionClose(c, { session_id: 's1', driver_id: 'd1', collected_cash: 50, net_to_remit: 145 })
  const s = getFakeTable('driver_sessions')[0]
  assert.equal(s.session_status, 'closed')
  assert.equal(s.net_to_remit, 145)
  assert.ok(s.closed_at)
  assert.equal(getFakeTable('delivery_drivers')[0].status, 'inactive')
})

test('journaux : chargement groupé par session', async () => {
  resetFakeDb({
    ...baseTables(),
    driver_cash_movements: [
      { session_id: 'a', kind: 'opening', amount: 1 }, { session_id: 'b', kind: 'opening', amount: 2 },
    ],
    driver_stock_movements: [{ session_id: 'a', product_id: 'p1', kind: 'load', quantity: 1 }],
  })
  const l = await data.loadLedgers(createClient(), ['a', 'b'])
  assert.equal(l.a.cash.length, 1)
  assert.equal(l.b.cash[0].amount, 2)
  assert.equal(l.a.stock.length, 1)
  assert.equal(l.b.stock.length, 0)
  assert.deepEqual(await data.loadLedgers(createClient(), []), {})
})

// ---- câblage de l'écran (lecture du texte de page.tsx) ----
import { readFileSync } from 'node:fs'
const pageSrc = readFileSync(new URL('../app/admin/livreurs/page.tsx', import.meta.url), 'utf8')

test('câblage : page.tsx utilise le panneau et la fenêtre de clôture', () => {
  assert.match(pageSrc, /import DriverLedgerPanel from '@\/components\/DriverLedgerPanel'/)
  assert.match(pageSrc, /import DriverCloseDialog/)
  assert.match(pageSrc, /<DriverLedgerPanel[\s>]/)
  assert.match(pageSrc, /<DriverCloseDialog[\s>]/)
})

test('câblage : « Argent remis » absent d\'une session ouverte, seulement sur les sessions clôturées', () => {
  assert.doesNotMatch(pageSrc, /handleSettle\(openSess/)
  assert.doesNotMatch(pageSrc, /settleLoading === openSess/)
  assert.doesNotMatch(pageSrc, /Tresorerie session/)
  assert.match(pageSrc, /cs\.session_status === 'closed' && !cs\.settled_at/)
})

test('câblage : la liste des courses passe par deliveriesOfSession', () => {
  assert.match(pageSrc, /import \{ deliveriesOfSession/)
  assert.match(pageSrc, /deliveriesOfSession\(driverDeliveries\[driver\.id\]/)
  assert.doesNotMatch(pageSrc, /const deliveries = driverDeliveries\[driver\.id\] \|\| \[\]/)
})

test('câblage : frais livreur et net à remettre ne sont plus calculés à l\'envers dans la page', () => {
  assert.doesNotMatch(pageSrc, /kpi\.totalToRemit\)/)
  assert.doesNotMatch(pageSrc, /sumDriverFee/)
  assert.match(pageSrc, /sessionCashSummary\(/)
  assert.match(pageSrc, /totalToRemit: sessCash\.netToRemit/)
  assert.match(pageSrc, /win: sessCash\.driverFees/)
})

test('câblage : ouverture avec produits VIP et report, pastille Stock VIP bas, historique rendu/gardé', () => {
  assert.match(pageSrc, /Produits VIP à embarquer/)
  assert.match(pageSrc, /prepareOpening\(/)
  assert.match(pageSrc, /openSessionWithLedger\(/)
  assert.match(pageSrc, /stockAlertLevel\(/)
  assert.match(pageSrc, /Stock VIP bas/)
  assert.match(pageSrc, /describeClosing\(/)
})

test('câblage : le champ Fonds ouverture est conservé dans la fenêtre d\'ouverture, avant les produits VIP', () => {
  const fonds = pageSrc.indexOf('Fonds ouverture')
  const vip = pageSrc.indexOf('Produits VIP à embarquer')
  assert.ok(fonds > 0, 'Fonds ouverture absent')
  assert.ok(vip > fonds, 'les produits VIP doivent suivre le champ fonds')
  assert.doesNotMatch(pageSrc, /^\s*\$1\s*$/m)
})

test('câblage : le champ de saisie du fonds est complet et aucun résidu $1 n\'est affiché', () => {
  assert.match(pageSrc, /<label style=\{LBL\}>Fonds ouverture<\/label><input type="number" min="0" value=\{openingCash\} onChange=\{e => setOpeningCash\(e\.target\.value\)\}/)
  assert.doesNotMatch(pageSrc, /<\/p>\$1/)
  assert.doesNotMatch(pageSrc, /\$1/)
  assert.doesNotMatch(pageSrc, />Fonds ouverture<\/span>/)
})
