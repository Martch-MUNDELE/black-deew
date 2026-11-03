// BLAC-P2-025 : campagnes Marketing (admin), base simulee en memoire. Aucun envoi, aucune vraie base.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

await import('./helpers/env.mjs')
const { resetFakeDb, getFakeTable, createClient } = await import('./helpers/fake-supabase.mjs')
const {
  runCampaignsAction, buildCampaignMessage, validateCampaignInput, STOP_LINE, CAMPAIGNS_UNAVAILABLE_MESSAGE,
} = await import('../lib/campaigns.ts')

const ADMIN = { ok: true, email: 'admin@example.test', role: 'owner' }
const seed = (campaigns = []) =>
  resetFakeDb({
    promotion_rules: [
      { id: 'promo-1', name: 'Moins 10 pour cent', status: 'active' },
    ],
    campaigns,
  })
const run = (method, extra = {}) => runCampaignsAction({ check: ADMIN, db: createClient(), method, ...extra })
const valid = {
  name: 'Merci VIP', promotion_id: 'promo-1', message: 'Profite de -10 % ce week-end.',
  audience_mode: 'all_consenting',
}

function dbWithoutCampaignsTable() {
  const base = createClient()
  const err = { data: null, error: { code: '42P01' } }
  const failing = {
    select() { return this }, order() { return this }, eq() { return this },
    insert() { return this }, update() { return this }, single() { return this },
    maybeSingle() { return Promise.resolve(err) },
    then(res, rej) { return Promise.resolve(err).then(res, rej) },
  }
  return { from: (t) => (t === 'campaigns' ? failing : base.from(t)) }
}

test('STOP ajoute une seule fois, jamais en double', () => {
  const once = buildCampaignMessage('Bonjour')
  assert.ok(once.endsWith(STOP_LINE))
  assert.equal(once.split(STOP_LINE).length - 1, 1)
  assert.equal(buildCampaignMessage(once), once)
  assert.equal(buildCampaignMessage('A\n' + STOP_LINE + '\nB').split(STOP_LINE).length - 1, 1)
  assert.ok(buildCampaignMessage('A\n' + STOP_LINE + '\nB').endsWith(STOP_LINE))
  assert.equal(buildCampaignMessage(''), STOP_LINE)
})

test('refus sans admin : 401 et 403, rien d ecrit', async () => {
  seed()
  for (const [status, error] of [[401, 'Authentification requise'], [403, 'Acces reserve aux administrateurs']]) {
    for (const method of ['GET', 'POST', 'PATCH']) {
      const r = await runCampaignsAction({ check: { ok: false, status, error }, db: createClient(), method, body: valid })
      assert.equal(r.status, status)
      assert.equal(r.body.error, error)
    }
  }
  assert.equal(getFakeTable('campaigns').length, 0)
})

test('la route appelle requireAdmin pour GET, POST et PATCH, sans journal', () => {
  const src = readFileSync(new URL('../app/api/admin/campaigns/route.ts', import.meta.url), 'utf8')
  assert.match(src, /import \{ requireAdmin \} from '@\/lib\/admin-auth'/)
  for (const m of ['GET', 'POST', 'PATCH']) assert.match(src, new RegExp('export async function ' + m + '\\('))
  assert.match(src, /const check = await requireAdmin\(\)/)
  assert.doesNotMatch(src, /console\.(log|info|error|warn)/)
})

test('creation valide : brouillon enregistre, puis liste', async () => {
  seed()
  const r = await run('POST', { body: valid })
  assert.equal(r.status, 201)
  const rows = getFakeTable('campaigns')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].status, 'draft')
  assert.equal(rows[0].audience_mode, 'all_consenting')
  assert.equal(rows[0].promotion_id, 'promo-1')
  const list = await run('GET')
  assert.equal(list.status, 200)
  assert.equal(list.body.campaigns.length, 1)
  assert.equal(list.body.rules.length, 1)
})

test('validation : nom et message obligatoires', () => {
  assert.equal(validateCampaignInput({ ...valid, name: '  ' }).ok, false)
  assert.equal(validateCampaignInput({ ...valid, message: '' }).ok, false)
  assert.equal(validateCampaignInput({ ...valid, message: STOP_LINE }).ok, false)
  assert.equal(validateCampaignInput(valid).ok, true)
})

test('promotion inconnue refusee', async () => {
  seed()
  const r = await run('POST', { body: { ...valid, promotion_id: 'zzz' } })
  assert.equal(r.status, 400)
  assert.equal(getFakeTable('campaigns').length, 0)
})

test('dates incoherentes refusees', async () => {
  seed()
  const r = await run('POST', { body: { ...valid, starts_at: '2026-12-10T10:00:00Z', ends_at: '2026-12-01T10:00:00Z' } })
  assert.equal(r.status, 400)
  const bad = await run('POST', { body: { ...valid, starts_at: 'pas une date' } })
  assert.equal(bad.status, 400)
  assert.equal(getFakeTable('campaigns').length, 0)
})

test('audience invalide refusee', async () => {
  seed()
  for (const audience_mode of ['tous', '', undefined]) {
    const r = await run('POST', { body: { ...valid, audience_mode } })
    assert.equal(r.status, 400)
  }
  assert.equal(getFakeTable('campaigns').length, 0)
})

test('annulation et marquage prete', async () => {
  seed([
    { id: 'c1', name: 'A', promotion_id: 'promo-1', message: 'm', status: 'draft', audience_mode: 'best_clients', created_at: '2026-11-01T00:00:00Z' },
    { id: 'c2', name: 'B', promotion_id: 'promo-1', message: 'm', status: 'cancelled', audience_mode: 'best_clients', created_at: '2026-11-02T00:00:00Z' },
  ])
  const ready = await run('PATCH', { body: { id: 'c1', status: 'ready' } })
  assert.equal(ready.status, 200)
  assert.equal(getFakeTable('campaigns').find((c) => c.id === 'c1').status, 'ready')
  assert.equal((await run('PATCH', { body: { id: 'c1', status: 'ready' } })).status, 409)
  const cancel = await run('PATCH', { body: { id: 'c1', status: 'cancelled' } })
  assert.equal(cancel.status, 200)
  assert.equal(getFakeTable('campaigns').find((c) => c.id === 'c1').status, 'cancelled')
  assert.equal((await run('PATCH', { body: { id: 'c2', status: 'cancelled' } })).status, 409)
  assert.equal((await run('PATCH', { body: { id: 'zzz', status: 'cancelled' } })).status, 404)
  assert.equal((await run('PATCH', { body: { status: 'cancelled' } })).status, 400)
  assert.equal((await run('PATCH', { body: { id: 'c1', status: 'draft' } })).status, 400)
})

test('table absente : 200 avec unavailable true, jamais 500', async () => {
  seed()
  const db = dbWithoutCampaignsTable()
  const calls = [
    runCampaignsAction({ check: ADMIN, db, method: 'GET' }),
    runCampaignsAction({ check: ADMIN, db, method: 'POST', body: valid }),
    runCampaignsAction({ check: ADMIN, db, method: 'PATCH', body: { id: 'c1', status: 'cancelled' } }),
    runCampaignsAction({ check: ADMIN, db: { from: () => { throw new Error('boom') } }, method: 'GET' }),
  ]
  for (const r of await Promise.all(calls)) {
    assert.equal(r.status, 200)
    assert.equal(r.body.unavailable, true)
    assert.equal(r.body.message, CAMPAIGNS_UNAVAILABLE_MESSAGE)
  }
})

test('migration : NON APPLIQUEE, RLS activee, aucune politique, aucun acces public', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261103_bd_campaigns.sql', import.meta.url), 'utf8')
  assert.match(sql.split('\n').slice(0, 4).join('\n'), /NON APPLIQUÉE : ne pas exécuter sans validation humaine/)
  const idx = sql.indexOf('-- RETOUR ARRIÈRE')
  assert.ok(idx > 0, 'retour arriere present')
  const body = sql.slice(0, idx)
  const n = body.toLowerCase().replace(/\s+/g, ' ')
  assert.ok(n.includes('create table if not exists public.campaigns'))
  assert.ok(n.includes('alter table public.campaigns enable row level security'))
  assert.ok(!n.includes('create policy'))
  assert.ok(!/\bgrant\b/.test(n))
  assert.ok(!/\bto (anon|public|authenticated)\b/.test(n))
  assert.ok(n.includes('references public.promotion_rules(id)'))
  assert.ok(n.includes("status text not null default 'draft'"))
  assert.ok(n.includes("'draft', 'ready', 'cancelled'"))
  assert.ok(n.includes("'all_consenting', 'best_clients', 'inactive_clients'"))
  assert.ok(sql.slice(idx).includes('drop table if exists public.campaigns'))
})
