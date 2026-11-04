// BLAC-P3-025 : écran 3 du Marketing (Scénarios automatiques). Base simulée en mémoire, numéros fictifs.
// Aucune vraie base, aucune donnée client réelle, aucune migration.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

await import('./helpers/env.mjs')
const S = await import('../lib/campaign-scenarios.ts')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const route = read('app/api/admin/campaign-scenarios/route.ts')
const lib = read('lib/campaign-scenarios.ts')
const panel = read('components/admin/ScenariosPanel.tsx')
const page = read('app/admin/marketing/page.tsx')
const screenLib = lib.slice(lib.indexOf('BLAC-P3-025'))

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 3, 12, 0, 0)
const at = (d) => new Date(NOW - d * DAY).toISOString()
const order = (phone, total, daysAgo) => ({ customer_phone: phone, customer_name: 'Client', total, status: 'delivered', created_at: at(daysAgo) })

function fakeDb(tables) {
  const calls = []
  return {
    calls,
    from(table) {
      calls.push(table)
      return {
        select: () => Promise.resolve(tables[table] ? { data: tables[table], error: null } : { data: null, error: { message: 'absent' } }),
        insert: () => { throw new Error('écriture interdite') },
        update: () => { throw new Error('écriture interdite') },
        delete: () => { throw new Error('écriture interdite') },
        upsert: () => { throw new Error('écriture interdite') },
      }
    },
  }
}
const admin = { ok: true, email: 'a@test.local', role: 'admin' }

test('la route est en lecture seule : GET seul, requireAdmin, aucun insert ni update', () => {
  assert.ok(route.includes('export async function GET'))
  assert.ok(!/export async function (POST|PATCH|PUT|DELETE)/.test(route))
  assert.ok(route.includes('requireAdmin'))
  for (const w of ['.insert(', '.update(', '.delete(', '.upsert(']) {
    assert.ok(!route.includes(w), `route : ${w}`)
    assert.ok(!screenLib.includes(w), `lib écran 3 : ${w}`)
  }
})

test('la réponse contient le classement (3 max) et le compteur avec aperçu de trois noms', async () => {
  const orders = [
    order('+243810000001', 500, 10), order('+243810000002', 400, 10), order('+243810000003', 300, 10), order('+243810000004', 200, 10),
    order('+243810000005', 20, 100), order('+243810000005', 20, 120),
    order('+243810000006', 20, 100), order('+243810000006', 20, 120),
    order('+243810000007', 20, 100), order('+243810000007', 20, 120),
    order('+243810000008', 20, 100), order('+243810000008', 20, 120),
  ]
  const vip = ['1', '2', '5', '6', '7', '8'].map((n) => ({ phone: `+24381000000${n}`, pseudo: `Pseudo${n}`, status: 'approved', marketing_opt_in: true }))
  const db = fakeDb({ orders, vip_access_requests: vip })
  const res = await S.runCampaignScenariosAction({ check: admin, db, method: 'GET', nowMs: NOW })
  assert.equal(res.status, 200)
  assert.equal(res.body.best.length, 3)
  assert.deepEqual(res.body.best.map((c) => c.phone), ['+243810000001', '+243810000002', '+243810000003'])
  assert.equal(res.body.best[0].pseudo, 'Pseudo1')
  assert.equal(res.body.best[0].orders, 1)
  assert.equal(res.body.best[0].revenue, 500)
  assert.equal(res.body.inactive.count, 4)
  assert.equal(res.body.inactive.preview.length, 3)
})

test('seuls les VIP qui ont accepté les offres sont comptés pour la relance', async () => {
  const orders = [order('+243810000005', 20, 100), order('+243810000005', 20, 120), order('+243810000006', 20, 100), order('+243810000006', 20, 120)]
  const vip = [
    { phone: '+243810000005', pseudo: 'Ok', status: 'approved', marketing_opt_in: true },
    { phone: '+243810000006', pseudo: 'Refus', status: 'approved', marketing_opt_in: false },
  ]
  const res = await S.runCampaignScenariosAction({ check: admin, db: fakeDb({ orders, vip_access_requests: vip }), method: 'GET', nowMs: NOW })
  assert.equal(res.body.inactive.count, 1)
})

test('données indisponibles : 200 + unavailable + message, sans écriture', async () => {
  const db = fakeDb({})
  const res = await S.runCampaignScenariosAction({ check: admin, db, method: 'GET', nowMs: NOW })
  assert.equal(res.status, 200)
  assert.equal(res.body.unavailable, true)
  assert.equal(res.body.message, S.SCENARIOS_SCREEN_UNAVAILABLE_MESSAGE)
})

test('accès refusé et méthode non GET : aucune lecture', async () => {
  const db = fakeDb({ orders: [] })
  const denied = await S.runCampaignScenariosAction({ check: { ok: false, status: 401, error: 'Non autorisé' }, db, method: 'GET' })
  assert.equal(denied.status, 401)
  const post = await S.runCampaignScenariosAction({ check: admin, db, method: 'POST' })
  assert.equal(post.status, 405)
  assert.equal(db.calls.length, 0)
})

test('le panneau contient les deux cartes et la mention sur les VIP ayant accepté les offres', () => {
  assert.ok(panel.includes('data-testid="scenario-best-client"'))
  assert.ok(panel.includes('data-testid="scenario-inactive-vip"'))
  assert.ok(panel.includes('Meilleur client du mois'))
  assert.ok(panel.includes('Relance des VIP inactifs'))
  assert.ok(panel.includes('Seuls les VIP qui ont accepté les offres sont relancés.'))
  assert.ok(panel.includes('applyCampaignVariables'))
  assert.equal((panel.match(/type="datetime-local"/g) ?? []).length, 2)
  assert.equal((panel.match(/data-testid="scenario-(best|inactive)-validate"/g) ?? []).length, 2)
  assert.equal((panel.match(/\{bestBusy \? 'Création…' : "Valider et préparer l'envoi"\}|\{inBusy \? 'Création…' : "Valider et préparer l'envoi"\}/g) ?? []).length, 2)
  assert.ok(panel.includes('Ouvrir WhatsApp'))
  assert.ok(panel.includes('flexWrap'))
})

test('l onglet Scénarios automatiques est entre Offres clients et Résultats, avec hash', () => {
  assert.ok(page.includes("label: 'Scénarios automatiques'"))
  assert.ok(page.includes('<ScenariosPanel />'))
  const o = page.indexOf("id: 'offres'"), s = page.indexOf("id: 'scenarios'"), r = page.indexOf("id: 'resultats'")
  assert.ok(o > 0 && s > o && r > s)
})

test('les boutons Valider n écrivent que par client-offers et campaigns', () => {
  const posts = [...panel.matchAll(/fetch\('([^']+)',\s*\{\s*method: '(\w+)'/g)].map((m) => `${m[2]} ${m[1]}`)
  assert.deepEqual(posts.sort(), ['POST /api/admin/campaigns', 'POST /api/admin/client-offers'])
  const urls = [...panel.matchAll(/fetch\('([^']+)'/g)].map((m) => m[1])
  for (const u of urls) assert.ok(['/api/admin/campaign-scenarios', '/api/admin/client-offers?rules=1', '/api/admin/client-offers', '/api/admin/campaigns'].includes(u), u)
  assert.ok(panel.includes("audience_mode: 'inactive_clients'"))
  assert.ok(!panel.includes('supabase'))
  // chaque écriture est dans une fonction déclenchée par un clic sur Valider
  assert.ok(panel.includes('onClick={validateBest}') && panel.includes('onClick={validateInactive}'))
  assert.ok(!/useEffect\([^)]*validate/.test(panel))
})
