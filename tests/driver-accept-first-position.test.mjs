// BLAC-P3-076 : premiere position du livreur envoyee des l'acceptation, avant l'ouverture de WhatsApp.
// Le code reel de sendFirstPosition est extrait du composant (types retires) et execute avec des doubles.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const { buildPositionPayload } = await import('../lib/tracking-sender.ts')

const SRC = read('components/driver/DriverAcceptDelivery.tsx')
const START = SRC.indexOf('export const FIRST_POSITION_TIMEOUT_MS')
const END = SRC.indexOf('export default function')
assert.ok(START !== -1 && END > START, 'bloc sendFirstPosition introuvable dans le composant')
const BLOCK = SRC.slice(START, END)
const CODE = stripTypeScriptTypes(BLOCK, { mode: 'strip' }).replace(/\bexport\s+/g, '')
const factory = new Function(
  'buildPositionPayload', 'navigator', 'fetch', 'setTimeout', 'clearTimeout',
  CODE + '\nreturn { sendFirstPosition, FIRST_POSITION_TIMEOUT_MS }'
)

const flush = () => new Promise((r) => setImmediate(r))

function setup({ geolocation, fetchImpl } = {}) {
  const calls = { fetch: [], timers: [], cleared: [] }
  const fakeFetch = fetchImpl
    ? (...a) => { calls.fetch.push(a); return fetchImpl(...a) }
    : (...a) => { calls.fetch.push(a); return Promise.resolve({ ok: true }) }
  const fakeSetTimeout = (cb, ms) => { calls.timers.push({ cb, ms }); return calls.timers.length }
  const fakeClearTimeout = (id) => { calls.cleared.push(id) }
  const nav = geolocation === undefined ? {} : { geolocation }
  const mod = factory(buildPositionPayload, nav, fakeFetch, fakeSetTimeout, fakeClearTimeout)
  return { mod, calls }
}

const COORDS = { latitude: -4.32, longitude: 15.31, accuracy: 18 }

test('delai maximal : constante a 4000 ms, passee a getCurrentPosition et au minuteur', async () => {
  let opts = null
  const { mod, calls } = setup({
    geolocation: { getCurrentPosition: (ok, ko, o) => { opts = o; ok({ coords: COORDS }) } },
  })
  assert.equal(mod.FIRST_POSITION_TIMEOUT_MS, 4000)
  await mod.sendFirstPosition('d1')
  assert.equal(opts.timeout, 4000)
  assert.equal(calls.timers.length, 1)
  assert.equal(calls.timers[0].ms, 4000)
  assert.equal(calls.cleared.length, 1)
})

test('geolocalisation OK : position envoyee a /api/driver/tracking avec le format de buildPositionPayload', async () => {
  const { mod, calls } = setup({
    geolocation: { getCurrentPosition: (ok) => ok({ coords: COORDS }) },
  })
  await mod.sendFirstPosition('d1')
  assert.equal(calls.fetch.length, 1)
  const [url, init] = calls.fetch[0]
  assert.equal(url, '/api/driver/tracking')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(init.body), buildPositionPayload('d1', COORDS))
  assert.deepEqual(JSON.parse(init.body), { delivery_id: 'd1', lat: -4.32, lng: 15.31, accuracy: 18 })
})

test("l'envoi est termine (await) avant la fin de la fonction, donc avant WhatsApp", async () => {
  const order = []
  const { mod } = setup({
    geolocation: { getCurrentPosition: (ok) => ok({ coords: COORDS }) },
    fetchImpl: () => new Promise((r) => setImmediate(() => { order.push('fetch-fini'); r({ ok: true }) })),
  })
  await mod.sendFirstPosition('d1')
  order.push('whatsapp')
  assert.deepEqual(order, ['fetch-fini', 'whatsapp'])
})

test("composant : l'appel a sendFirstPosition est entre setAccepted et window.open", () => {
  const iAccepted = SRC.indexOf('setAccepted({ whatsappUrl })')
  const iCall = SRC.indexOf('await sendFirstPosition(deliveryId)')
  const iOpen = SRC.indexOf('window.open(')
  const iNoUrl = SRC.indexOf('if (!whatsappUrl)')
  assert.ok(iNoUrl !== -1 && iAccepted > iNoUrl, 'setAccepted apres le test whatsappUrl')
  assert.ok(iCall > iAccepted, 'appel apres setAccepted')
  assert.ok(iOpen > iCall, 'window.open apres la premiere position')
  assert.equal(SRC.split('sendFirstPosition(deliveryId)').length - 1, 1, 'un seul appel')
  assert.ok(iCall > SRC.indexOf("fetch('/api/driver/accept-delivery'"), 'apres la requete acceptation')
})

test('refus de localisation : aucune erreur, aucun envoi, WhatsApp peut s ouvrir', async () => {
  const { mod, calls } = setup({
    geolocation: { getCurrentPosition: (ok, ko) => ko({ code: 1 }) },
  })
  await assert.doesNotReject(mod.sendFirstPosition('d1'))
  assert.equal(calls.fetch.length, 0)
})

test('getCurrentPosition qui leve : ignore', async () => {
  const { mod, calls } = setup({
    geolocation: { getCurrentPosition: () => { throw new Error('boom') } },
  })
  await assert.doesNotReject(mod.sendFirstPosition('d1'))
  assert.equal(calls.fetch.length, 0)
})

test('pas de geolocalisation disponible : ignore', async () => {
  const { mod, calls } = setup({})
  await assert.doesNotReject(mod.sendFirstPosition('d1'))
  assert.equal(calls.fetch.length, 0)
  assert.equal(calls.timers.length, 0)
})

test('delai depasse : la fonction rend la main au bout de 4000 ms meme sans reponse', async () => {
  const { mod, calls } = setup({ geolocation: { getCurrentPosition: () => {} } })
  let done = false
  const p = mod.sendFirstPosition('d1').then(() => { done = true })
  await flush()
  assert.equal(done, false)
  assert.equal(calls.timers[0].ms, 4000)
  calls.timers[0].cb()
  await p
  assert.equal(done, true)
  assert.equal(calls.fetch.length, 0)
  assert.equal(calls.cleared.length, 1)
})

test('envoi reseau qui ne repond jamais : attente plafonnee a 4000 ms', async () => {
  const { mod, calls } = setup({
    geolocation: { getCurrentPosition: (ok) => ok({ coords: COORDS }) },
    fetchImpl: () => new Promise(() => {}),
  })
  let done = false
  const p = mod.sendFirstPosition('d1').then(() => { done = true })
  await flush()
  assert.equal(calls.fetch.length, 1)
  assert.equal(done, false)
  calls.timers[0].cb()
  await p
  assert.equal(done, true)
})

test('erreur reseau (fetch rejete ou leve) : ignoree', async () => {
  const a = setup({
    geolocation: { getCurrentPosition: (ok) => ok({ coords: COORDS }) },
    fetchImpl: () => Promise.reject(new Error('reseau')),
  })
  await assert.doesNotReject(a.mod.sendFirstPosition('d1'))
  const b = setup({
    geolocation: { getCurrentPosition: (ok) => ok({ coords: COORDS }) },
    fetchImpl: () => { throw new Error('sync') },
  })
  await assert.doesNotReject(b.mod.sendFirstPosition('d1'))
})

test('coordonnees invalides : rien n est envoye', async () => {
  const { mod, calls } = setup({
    geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 91, longitude: 0 } }) },
  })
  await mod.sendFirstPosition('d1')
  assert.equal(calls.fetch.length, 0)
})

test('pas de duplication de la logique du payload : buildPositionPayload importe et reutilise', () => {
  assert.match(SRC, /import \{ buildPositionPayload \} from '@\/lib\/tracking-sender'/)
  assert.match(BLOCK, /buildPositionPayload\(deliveryId, position\.coords\)/)
  assert.ok(!/Number\.isFinite|> 90|< -90|> 180|< -180|\blat:|\blng:/.test(BLOCK), 'aucune construction de payload dupliquee')
  assert.ok(!/delivery_id\s*:/.test(BLOCK.replace(/JSON\.stringify\(payload\)/g, '')), 'delivery_id non reconstruit')
})

test('inchange : message et lien WhatsApp, ouverture noopener, requete acceptation', () => {
  assert.match(SRC, /window\.open\(whatsappUrl, '_blank', 'noopener,noreferrer'\)/)
  assert.match(SRC, /body: JSON\.stringify\(\{ delivery_id: deliveryId \}\)/)
  assert.match(SRC, /Prévenir le client sur WhatsApp/)
  assert.ok(!SRC.includes('buildEnRouteMessage'), 'le message WhatsApp reste construit cote API')
})
