// BLAC-P2-026 : file d'envoi WhatsApp d'une campagne, base simulee en memoire. Aucun envoi, aucune vraie base.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

await import('./helpers/env.mjs')
const { resetFakeDb, getFakeTable, createClient } = await import('./helpers/fake-supabase.mjs')
const { runCampaignSendsAction, buildWhatsappLink, CAMPAIGN_SENDS_UNAVAILABLE_MESSAGE } = await import('../lib/campaign-sends.ts')
const { STOP_LINE } = await import('../lib/campaigns.ts')

const ADMIN = { ok: true, email: 'admin@example.test', role: 'owner' }
const P1 = '+243810000001' // eligible (ancien envoi > 30 jours)
const P2 = '+243810000002' // refuse (marketing_refusals)
const P3 = '+243810000003' // opt-out sur demande VIP
const P4 = '+243810000004' // deja contacte il y a 5 jours (autre campagne)
const P5 = '+212600000005' // eligible via mot de passe individuel
const P9 = '+243819999999' // hors liste VIP
const DAY = 24 * 60 * 60 * 1000
const ago = (d) => new Date(Date.now() - d * DAY).toISOString()

const seed = (campaignStatus = 'ready') =>
  resetFakeDb({
    campaigns: [{ id: 'c1', name: 'Merci VIP', message: 'Profite de -10 % ce week-end.', status: campaignStatus },
      { id: 'c0', name: 'Ancienne', message: 'Ancien', status: 'ready' }],
    settings: [{ key: 'vip_allowed_phones', value: JSON.stringify([P1, P2, P3, P4]) }],
    vip_individual_passwords: [{ phone: P5, password: 'x' }],
    marketing_refusals: [{ phone: P2, created_at: ago(90), source: 'whatsapp_stop' }],
    vip_access_requests: [{ phone: P3, marketing_opt_in: false }, { phone: P9, marketing_opt_in: true }],
    campaign_sends: [
      { campaign_id: 'c0', phone: P4, status: 'sent', sent_at: ago(5) },
      { campaign_id: 'c0', phone: P1, status: 'sent', sent_at: ago(40) },
    ],
  })

const run = (method, extra = {}, db = createClient()) => runCampaignSendsAction({ check: ADMIN, db, method, ...extra })
const phonesOf = (res) => res.body.queue.map((i) => i.phone)

function dbWithoutTable(name) {
  const base = createClient()
  const err = { data: null, error: { code: '42P01' } }
  const failing = {
    select() { return this }, eq() { return this }, insert() { return this }, update() { return this },
    maybeSingle() { return Promise.resolve(err) },
    then(res, rej) { return Promise.resolve(err).then(res, rej) },
  }
  return { from: (t) => (t === name ? failing : base.from(t)) }
}

test('file : refuse, opt-out, deja contacte ce mois et hors liste VIP sont exclus', async () => {
  seed()
  const res = await run('GET', { campaignId: 'c1' })
  assert.equal(res.status, 200)
  assert.deepEqual(phonesOf(res).sort(), [P1, P5].sort())
  assert.equal(res.body.total, 2)
  assert.equal(res.body.sent, 0)
})

test('refuse exclu', async () => {
  seed()
  assert.ok(!phonesOf(await run('GET', { campaignId: 'c1' })).includes(P2))
})

test('deja contacte ce mois exclu, mais un envoi de plus de 30 jours ne bloque pas', async () => {
  seed()
  const p = phonesOf(await run('GET', { campaignId: 'c1' }))
  assert.ok(!p.includes(P4))
  assert.ok(p.includes(P1))
})

test('numero hors liste VIP exclu', async () => {
  seed()
  assert.ok(!phonesOf(await run('GET', { campaignId: 'c1' })).includes(P9))
})

test('lien WhatsApp : chiffres, STOP une seule fois, message encode', () => {
  const url = buildWhatsappLink(P1, 'Bonjour & bienvenue\nProfite de -10 %')
  assert.ok(url.startsWith('https://wa.me/243810000001?text='))
  const raw = url.split('?text=')[1]
  assert.ok(!/[ \n&%](?![0-9A-F]{2})/.test(raw.replace(/%[0-9A-F]{2}/g, '')))
  assert.ok(!raw.includes(' ') && !raw.includes('\n'))
  const decoded = decodeURIComponent(raw)
  assert.equal(decoded.split(STOP_LINE).length - 1, 1)
  assert.ok(decoded.endsWith(STOP_LINE))
  const already = decodeURIComponent(buildWhatsappLink(P1, 'Salut\n\n' + STOP_LINE).split('?text=')[1])
  assert.equal(already.split(STOP_LINE).length - 1, 1)
  assert.equal(buildWhatsappLink('abc', 'x'), null)
})

test('la file renvoie un lien WhatsApp avec STOP pour chaque client a contacter', async () => {
  seed()
  const res = await run('GET', { campaignId: 'c1' })
  for (const i of res.body.queue) {
    assert.ok(i.whatsapp_url.startsWith('https://wa.me/'))
    assert.equal(decodeURIComponent(i.whatsapp_url.split('?text=')[1]).split(STOP_LINE).length - 1, 1)
  }
})

test('marquer envoye : ligne sent, compteur et sortie de la file a contacter', async () => {
  seed()
  const res = await run('PATCH', { body: { campaign_id: 'c1', phone: P1, action: 'sent' } })
  assert.equal(res.status, 200)
  const row = getFakeTable('campaign_sends').find((r) => r.campaign_id === 'c1' && r.phone === P1)
  assert.equal(row.status, 'sent')
  assert.ok(row.sent_at)
  const q = await run('GET', { campaignId: 'c1' })
  assert.equal(q.body.sent, 1)
  assert.equal(q.body.queue.find((i) => i.phone === P1).status, 'sent')
  assert.equal(q.body.queue.find((i) => i.phone === P1).whatsapp_url, null)
})

test('marquer envoye refuse un numero qui n est pas dans la file', async () => {
  seed()
  const res = await run('PATCH', { body: { campaign_id: 'c1', phone: P2, action: 'sent' } })
  assert.equal(res.status, 409)
  assert.ok(!getFakeTable('campaign_sends').some((r) => r.campaign_id === 'c1'))
})

test('STOP : numero inscrit dans marketing_refusals et envoi passe en refused', async () => {
  seed()
  const res = await run('PATCH', { body: { campaign_id: 'c1', phone: P5, action: 'stop' } })
  assert.equal(res.status, 200)
  assert.ok(getFakeTable('marketing_refusals').some((r) => r.phone === P5))
  assert.equal(getFakeTable('campaign_sends').find((r) => r.campaign_id === 'c1' && r.phone === P5).status, 'refused')
  assert.ok(!phonesOf(await run('GET', { campaignId: 'c1' })).includes(P5))
})

test('refus sans admin : aucune lecture ni ecriture', async () => {
  seed()
  const denied = { ok: false, status: 403, error: 'Acces reserve aux administrateurs' }
  const g = await runCampaignSendsAction({ check: denied, db: createClient(), method: 'GET', campaignId: 'c1' })
  const p = await runCampaignSendsAction({ check: denied, db: createClient(), method: 'PATCH', body: { campaign_id: 'c1', phone: P1, action: 'sent' } })
  assert.equal(g.status, 403)
  assert.equal(p.status, 403)
  assert.equal(getFakeTable('campaign_sends').filter((r) => r.campaign_id === 'c1').length, 0)
})

test('campagne non prete : 409', async () => {
  seed('draft')
  assert.equal((await run('GET', { campaignId: 'c1' })).status, 409)
})

test('tables absentes : 200 + unavailable true, pas d erreur 500', async () => {
  for (const t of ['campaign_sends', 'marketing_refusals']) {
    seed()
    const res = await run('GET', { campaignId: 'c1' }, dbWithoutTable(t))
    assert.equal(res.status, 200)
    assert.equal(res.body.unavailable, true)
    assert.equal(res.body.message, CAMPAIGN_SENDS_UNAVAILABLE_MESSAGE)
    const patch = await run('PATCH', { body: { campaign_id: 'c1', phone: P1, action: 'stop' } }, dbWithoutTable(t))
    assert.equal(patch.status, 200)
    assert.equal(patch.body.unavailable, true)
  }
})

test('migration : non appliquee, securite par ligne sur les deux tables, sans politique, retour arriere', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261103_bd_campaign_sends.sql', import.meta.url), 'utf8')
  assert.ok(/NON APPLIQUÉE/.test(sql))
  assert.ok(/create table if not exists public\.campaign_sends/.test(sql))
  assert.ok(/create table if not exists public\.marketing_refusals/.test(sql))
  assert.ok(/alter table public\.campaign_sends enable row level security/.test(sql))
  assert.ok(/alter table public\.marketing_refusals enable row level security/.test(sql))
  assert.ok(!/create policy/i.test(sql))
  assert.ok(/unique \(campaign_id, phone\)/.test(sql))
  assert.ok(/'to_send', 'sent', 'refused'/.test(sql))
  assert.ok(/phone text primary key/.test(sql))
  assert.ok(/-- drop table if exists public\.campaign_sends/.test(sql))
  assert.ok(/-- drop table if exists public\.marketing_refusals/.test(sql))
})
