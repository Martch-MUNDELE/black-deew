// BLAC-P3-024 : écran 2 du Marketing, file d'envoi. Base simulée en mémoire, aucun envoi, aucune vraie base.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

await import('./helpers/env.mjs')
const { resetFakeDb, createClient } = await import('./helpers/fake-supabase.mjs')
const { runCampaignSendsAction } = await import('../lib/campaign-sends.ts')

const ADMIN = { ok: true, email: 'admin@example.test', role: 'owner' }
const P1 = '+243810000001'
const P5 = '+212600000005'

const seed = () =>
  resetFakeDb({
    campaigns: [{ id: 'c1', name: 'Merci VIP', message: 'Salut {pseudo}, profite de -10 %.', status: 'ready' }],
    settings: [{ key: 'vip_allowed_phones', value: JSON.stringify([P1]) }],
    vip_individual_passwords: [{ phone: P5, password: 'x' }],
    marketing_refusals: [],
    vip_access_requests: [{ phone: P1, pseudo: 'Alex', status: 'approved', marketing_opt_in: true }],
    campaign_sends: [],
  })

const get = () => runCampaignSendsAction({ check: ADMIN, db: createClient(), method: 'GET', campaignId: 'c1' })

test('élément de file : pseudo et message présents', async () => {
  seed()
  const res = await get()
  assert.equal(res.status, 200)
  const item = res.body.queue.find((i) => i.phone === P1)
  assert.equal(item.pseudo, 'Alex')
  assert.equal(typeof item.message, 'string')
  assert.ok(item.message.includes('Alex'))
  assert.ok(item.message.includes('-10 %'))
  assert.equal(item.status, 'to_send')
  assert.ok(item.whatsapp_url && item.whatsapp_url.startsWith('https://wa.me/'))
})

test('pseudo absent : null, message présent', async () => {
  seed()
  const item = (await get()).body.queue.find((i) => i.phone === P5)
  assert.equal(item.pseudo, null)
  assert.equal(typeof item.message, 'string')
  assert.ok(item.message.length > 0)
})

test('le message affiché correspond au texte du lien WhatsApp', async () => {
  seed()
  const item = (await get()).body.queue.find((i) => i.phone === P1)
  const encoded = new URL(item.whatsapp_url).searchParams.get('text')
  assert.equal(encoded, item.message)
})

const src = readFileSync(new URL('../components/admin/CampaignSendQueue.tsx', import.meta.url), 'utf8')

test('composant : progression accessible', () => {
  assert.ok(src.includes('role="progressbar"'))
  assert.ok(src.includes('aria-valuenow'))
  assert.ok(src.includes('messages envoyés'))
})

test('composant : trois filtres avec compteurs', () => {
  assert.ok(src.includes("'Tous'"))
  assert.ok(src.includes("'À envoyer'"))
  assert.ok(src.includes("'Envoyés'"))
  assert.ok(src.includes('queue-filter-'))
  assert.ok(src.includes('f.count'))
})

test('composant : panneau Prochain message et boutons', () => {
  assert.ok(src.includes('queue-next-panel'))
  assert.ok(src.includes('Prochain :'))
  assert.ok(src.includes('Ouvrir WhatsApp'))
  assert.ok(src.includes('Marquer comme envoyé'))
  assert.ok(src.includes('Passer ce client'))
  assert.ok(src.includes('A répondu STOP'))
  assert.ok(src.includes('Prochain'))
})

test('composant : data-testid d\'origine conservés et actions sent/stop', () => {
  for (const id of ['campaign-send-queue', 'queue-counter', 'queue-scenario']) assert.ok(src.includes(`"${id}"`), id)
  assert.ok(src.includes("'sent'") && src.includes("'stop'"))
})

test('composant : Passer ce client ne touche pas la base', () => {
  const skipBody = src.slice(src.indexOf('function skip'), src.indexOf('// Ordre'))
  assert.ok(!skipBody.includes('fetch('))
})

test('composant : statuts non faits absents', () => {
  assert.ok(!src.includes('lien ouvert'))
  assert.ok(!src.includes('a commandé'))
})
