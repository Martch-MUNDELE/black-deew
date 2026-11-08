// BLAC-P3-055 : parcours complet du livreur (faux client en mémoire, sans réseau, sans vraie base).
// Admin actif -> livreur Martch activé -> session (fonds 20, 20 VIP) -> espace livreur -> course assignée
// -> livrée via markOrderDelivered -> course terminée dans le fil admin (livreur libéré).
// Écrit reports/BLAC-PARCOURS-LIVREUR-COMPLET_REPORT.md (une ligne par étape, anomalies non masquées).
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const adminRole = await import('@/lib/admin-role')
const data = await import('@/lib/driver-ledger-data')
const ledger = await import('@/lib/driver-ledger')
const markLib = await import('@/lib/mark-delivered')
const feedLib = await import('@/lib/driver-delivery-feed')

// Faux client en mémoire (copie de driver-day-simulation, complété : update().select() renvoie les lignes, lte).
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
      this.returning = false
    }
    select(cols = '*') { this.cols = cols; this.returning = true; return this }
    insert(rows) { this.op = 'insert'; this.payload = rows; return this }
    update(patch) { this.op = 'update'; this.payload = patch; return this }
    delete() { this.op = 'delete'; return this }
    eq(col, val) { this.filters.push((r) => r[col] === val); return this }
    in(col, vals) { this.filters.push((r) => vals.includes(r[col])); return this }
    gte(col, val) { this.filters.push((r) => r[col] != null && String(r[col]) >= String(val)); return this }
    lte(col, val) { this.filters.push((r) => r[col] != null && String(r[col]) <= String(val)); return this }
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
        const hit = []
        for (const r of rows) if (this.match(r)) { Object.assign(r, this.payload); hit.push(structuredClone(r)) }
        return { data: this.returning ? hit : null, error: null }
      }
      if (this.op === 'delete') {
        tables[this.table] = rows.filter((r) => !this.match(r))
        return { data: null, error: null }
      }
      const out = rows.filter((r) => this.match(r)).map((r) => structuredClone(r))
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

const client = createMemoryClient({
  admins: [{ user_id: 'u-admin', status: 'active' }],
  delivery_drivers: [{ id: 'dm', full_name: 'Martch', status: 'inactive', user_id: 'u-martch' }],
  products: [{ id: 'vip1', name: 'Cuvée Or', is_vip: true, stock: 50 }],
  orders: [{
    id: 'ord1', status: 'confirmée', total: 35,
    customer_name: 'Client Test', delivery_address: '12 avenue du Test, Kinshasa',
  }],
  order_items: [{ id: 'it1', order_id: 'ord1', product_id: 'vip1', product_name: 'Cuvée Or', quantity: 3, unit_price: 35 / 3, is_vip: true }],
  driver_sessions: [],
  driver_cash_movements: [],
  driver_stock_movements: [],
  order_deliveries: [],
})

const D = 'dm'
const results = []
const st = { sessionId: null }

async function step(label, fn) {
  try {
    const detail = await fn()
    results.push({ label, ok: true, detail: detail || '' })
  } catch (e) {
    results.push({ label, ok: false, detail: String(e?.message ?? e).split('\n').slice(0, 6).join(' | ') })
    throw e
  }
}
const row = (table, id) => client.tables[table].find((r) => r.id === id)

test('1 · admin actif ; livreur Martch inactif puis activé', async () => {
  await step('1. Admin actif ; livreur Martch inactif puis activé', async () => {
    const isAdmin = client.tables.admins.some((a) => a.user_id === 'u-admin' && a.status === 'active')
    assert.equal(adminRole.resolveAdminRole({ isAdmin, isDriver: false }), 'admin')
    assert.equal(adminRole.decideRoleRedirect({ role: 'admin', path: '/admin/orders' }), null)

    assert.equal(row('delivery_drivers', D).status, 'inactive')
    assert.equal(adminRole.isDriverStatusAllowed('inactive'), true, "'inactive' ne doit pas bloquer la connexion")
    assert.equal(adminRole.isDriverStatusAllowed('suspended'), false)

    await client.from('delivery_drivers').update({ status: 'active' }).eq('id', D)
    assert.equal(row('delivery_drivers', D).status, 'active')
    return "admin reconnu ; Martch 'inactive' -> 'active'"
  })
})

test('2 · ouverture de session : fonds 20, 20 unités VIP, journal cohérent', async () => {
  await step('2. Ouverture de session (fonds 20, 20 × produit VIP)', async () => {
    const { session_id } = await data.openSessionWithLedger(client, {
      driver_id: D,
      openingCash: 20,
      loads: [{ product_id: 'vip1', quantity: 20 }],
      now: new Date(Date.now() - 3600 * 1000),
    })
    st.sessionId = session_id
    const sess = row('driver_sessions', session_id)
    assert.equal(sess.session_status, 'open')
    assert.equal(sess.opening_cash, 20)

    const cash = await data.listCashMovements(client, session_id)
    assert.equal(cash.length, 1)
    assert.equal(cash[0].kind, 'opening')
    assert.equal(Number(cash[0].amount), 20)

    const stock = await data.listStockMovements(client, session_id)
    assert.equal(stock.length, 1)
    assert.equal(stock[0].kind, 'load')
    assert.equal(stock[0].product_id, 'vip1')
    assert.equal(Number(stock[0].quantity), 20)

    assert.equal(row('products', 'vip1').stock, 50, 'le stock du produit ne doit pas être modifié')
    const bal = ledger.vipStockBalance(stock).find((b) => b.product_id === 'vip1')
    assert.equal(bal.onHand, 20)
    return "mouvement d'ouverture 20 ; chargement 20 ; products.stock inchangé (50) ; en main 20"
  })
})

test('3 · le livreur actif est redirigé vers son espace, pas refoulé', async () => {
  await step('3. Livreur actif redirigé vers /admin/driver', async () => {
    const drv = row('delivery_drivers', D)
    const role = adminRole.resolveAdminRole({ isAdmin: false, isDriver: adminRole.isDriverStatusAllowed(drv.status) })
    assert.equal(role, 'driver')
    assert.equal(adminRole.decideRoleRedirect({ role, path: '/admin/orders' }), adminRole.DRIVER_HOME)
    assert.equal(adminRole.DRIVER_HOME, '/admin/driver')
    assert.equal(adminRole.decideRoleRedirect({ role, path: '/admin/driver' }), null)
    assert.equal(adminRole.decideRoleRedirect({ role, path: '/admin/driver/ord1' }), null)
    assert.notEqual(adminRole.decideRoleRedirect({ role, path: '/admin/orders' }), adminRole.ACCESS_DENIED_REDIRECT)
    return "rôle 'driver' ; /admin/orders -> /admin/driver ; /admin/driver sans redirection ; jamais ?error=acces"
  })
})

test('4 · course assignée, visible dans les données du livreur', async () => {
  await step('4. Course assignée et visible (adresse, montant, lignes)', async () => {
    await client.from('order_deliveries').insert({ order_id: 'ord1', driver_id: D, status: 'assigned', created_at: new Date().toISOString() })
    const mine = (await client.from('order_deliveries').select('*').eq('driver_id', D).eq('status', 'assigned')).data
    assert.equal(mine.length, 1)
    assert.equal(mine[0].order_id, 'ord1')
    const order = row('orders', mine[0].order_id)
    assert.equal(order.delivery_address, '12 avenue du Test, Kinshasa')
    assert.equal(Number(order.total), 35)
    const lines = (await client.from('order_items').select('*').eq('order_id', 'ord1')).data
    assert.equal(lines.length, 1)
    assert.equal(lines[0].product_id, 'vip1')
    assert.equal(Number(lines[0].quantity), 3)
    return 'course assignée au livreur avec adresse, total 35 et 1 ligne (3 × produit VIP). Lecture via le faux client : getDriverHome utilise le vrai client serveur (non couvert)'
  })
})

test('5-6 · le livreur livre ; commande livrée, encaissement, stock décrémenté', async () => {
  await step('5. Le livreur marque la course livrée (markOrderDelivered)', async () => {
    const res = await markLib.markOrderDelivered(client, 'ord1', 35)
    assert.equal(res.ok, true, JSON.stringify(res))
    assert.equal(res.driverSessionUpdated, true)
    return "markOrderDelivered ok:true, driverSessionUpdated:true"
  })
  await step('6. Commande livrée, livraison delivered + montant, stock VIP embarqué décrémenté', async () => {
    assert.equal(row('orders', 'ord1').status, 'livrée')
    const del = client.tables.order_deliveries.find((d) => d.order_id === 'ord1')
    assert.equal(del.status, 'delivered')
    assert.equal(Number(del.amount_collected), 35)
    assert.ok(del.delivered_at)

    const stock = await data.listStockMovements(client, st.sessionId)
    const delivered = stock.filter((m) => m.kind === 'delivered')
    assert.equal(delivered.length, 1)
    assert.equal(Number(delivered[0].quantity), 3)
    assert.equal(delivered[0].order_id, 'ord1')
    const bal = ledger.vipStockBalance(stock).find((b) => b.product_id === 'vip1')
    assert.equal(bal.onHand, 17)
    assert.equal(row('products', 'vip1').stock, 50, 'products.stock ne doit jamais être touché')
    const sess = row('driver_sessions', st.sessionId)
    assert.equal(Number(sess.collected_cash), 35)
    assert.equal(Number(sess.net_to_remit), 55)
    return "commande 'livrée' ; livraison 'delivered', encaissé 35 ; stock embarqué 20 -> 17 ; products.stock 50 ; session collecté 35, net 55"
  })
})

test('7 · le fil admin montre la course terminée avec le nom du livreur', async () => {
  await step('7. buildDeliveryFeed : course terminée (livreur libéré)', async () => {
    const rows = (await client.from('order_deliveries').select('*')).data
    const drivers = (await client.from('delivery_drivers').select('*')).data
    const feed = feedLib.buildDeliveryFeed(rows, drivers, new Date())
    assert.equal(feed.length, 1)
    assert.equal(feed[0].order_id, 'ord1')
    assert.equal(feed[0].driver_name, 'Martch')
    assert.equal(feed[0].amount_collected, 35)
    return "fil admin : 1 course terminée, livreur 'Martch', 35 encaissés"
  })
})

after(() => {
  const ok = results.length > 0 && results.every((r) => r.ok)
  const md = [
    '# BLAC-PARCOURS-LIVREUR-COMPLET — Rapport du parcours livreur',
    '',
    `Statut final : ${ok && results.length === 7 ? 'PASS' : 'FAIL'}`,
    '',
    'Scénario joué avec un faux client en mémoire (aucun réseau, aucune vraie base, aucun code de production modifié).',
    '',
    '| Étape | Résultat | Détail |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.label} | ${r.ok ? 'OK' : 'ÉCHEC'} | ${String(r.detail).replace(/\|/g, '/')} |`),
    '',
    'Limites : pas de navigateur ni de vraie base ; l\'étape « accepte » n\'a pas de fonction dédiée dans les repères du ticket (non couverte) ; la notification d\'assignation (lib/driver-push.ts) est couverte par tests/driver-push.test.mjs.',
    '',
  ].join('\n')
  fs.mkdirSync(path.resolve('reports'), { recursive: true })
  fs.writeFileSync(path.resolve('reports/BLAC-PARCOURS-LIVREUR-COMPLET_REPORT.md'), md)
})
