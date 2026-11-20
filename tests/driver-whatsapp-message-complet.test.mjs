// BLAC-P3-077 : message WhatsApp complet (livreur, articles, lien de suivi), bouton et verrou d'ecran
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const { buildEnRouteMessage, shareTrackingViaWhatsApp } = await import('../lib/delivery-whatsapp.ts')

const base = { customerName: 'Awa', driverName: 'Jean', driverPhone: '0812345678', trackingUrl: 'https://x.test/suivi/abc' }

test('message avec articles : ligne Votre commande, lien de suivi present, reste inchange', () => {
  const items = [{ name: 'Burger', quantity: 2 }, { name: 'Frites', quantity: 1 }]
  const m = buildEnRouteMessage({ ...base, items })
  assert.match(m, /^Votre commande : 2 x Burger, 1 x Frites$/m)
  assert.match(m, /Votre livreur : Jean - Tel : 0812345678/)
  assert.match(m, /Suivez votre livreur en direct : https:\/\/x\.test\/suivi\/abc/)
  assert.deepEqual(m.split('\n').filter((l) => !l.startsWith('Votre commande :')), buildEnRouteMessage(base).split('\n'))
})

test('message avec liste vide ou sans articles : identique au comportement par defaut', () => {
  const ref = buildEnRouteMessage(base)
  assert.equal(buildEnRouteMessage({ ...base, items: [] }), ref)
  assert.equal(buildEnRouteMessage({ ...base, items: null }), ref)
  assert.equal(buildEnRouteMessage({ ...base, items: undefined }), ref)
  assert.ok(!ref.includes('Votre commande :'))
})

test('message avec plus de 8 articles : 8 listes puis "et N autres"', () => {
  const items = Array.from({ length: 11 }, (_, i) => ({ name: `P${i + 1}`, quantity: i + 1 }))
  const line = buildEnRouteMessage({ ...base, items }).split('\n').find((l) => l.startsWith('Votre commande :'))
  assert.ok(line.includes('8 x P8'))
  assert.ok(!line.includes('P9'))
  assert.ok(line.endsWith(', et 3 autres'))
  const nine = buildEnRouteMessage({ ...base, items: items.slice(0, 9) }).split('\n').find((l) => l.startsWith('Votre commande :'))
  assert.ok(nine.endsWith(', et 1 autre'))
  const eight = buildEnRouteMessage({ ...base, items: items.slice(0, 8) }).split('\n').find((l) => l.startsWith('Votre commande :'))
  assert.ok(!eight.includes(' et '))
})

test('articles invalides : nom vide ignore, quantite invalide => 1', () => {
  const m = buildEnRouteMessage({ ...base, items: [{ name: '  ', quantity: 3 }, { name: 'Jus', quantity: 'x' }] })
  assert.match(m, /^Votre commande : 1 x Jus$/m)
})

test('bouton : appelle la route avec delivery_id et ouvre whatsappUrl renvoye', async () => {
  const calls = []
  const opened = []
  const r = await shareTrackingViaWhatsApp({
    deliveryId: 'd-1',
    fetchImpl: async (url, init) => {
      calls.push([url, init])
      return { ok: true, json: async () => ({ ok: true, already: true, whatsappUrl: 'https://wa.me/243812345678?text=x' }) }
    },
    open: (u) => opened.push(u),
  })
  assert.deepEqual(r, { ok: true })
  assert.equal(calls[0][0], '/api/driver/accept-delivery')
  assert.equal(calls[0][1].method, 'POST')
  assert.deepEqual(JSON.parse(calls[0][1].body), { delivery_id: 'd-1' })
  assert.deepEqual(opened, ['https://wa.me/243812345678?text=x'])
})

test('bouton : echec (reseau, statut, url absente) => message d erreur, rien d ouvert', async () => {
  const opened = []
  const open = (u) => opened.push(u)
  const a = await shareTrackingViaWhatsApp({ deliveryId: 'd', fetchImpl: async () => { throw new Error('net') }, open })
  const b = await shareTrackingViaWhatsApp({ deliveryId: 'd', fetchImpl: async () => ({ ok: false, json: async () => ({}) }), open })
  const c = await shareTrackingViaWhatsApp({ deliveryId: 'd', fetchImpl: async () => ({ ok: true, json: async () => ({ whatsappUrl: null }) }), open })
  const d = await shareTrackingViaWhatsApp({ deliveryId: 'd', fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('json') } }), open })
  for (const r of [a, b, c, d]) {
    assert.equal(r.ok, false)
    assert.ok(typeof r.error === 'string' && r.error.length > 0)
  }
  assert.deepEqual(opened, [])
})

test('composant DriverMarkDelivered : nouveau libelle, helper, erreur, astuce conservee', () => {
  const src = read('components/driver/DriverMarkDelivered.tsx')
  assert.match(src, /Prévenir le client et partager mon suivi/)
  assert.match(src, /shareTrackingViaWhatsApp/)
  assert.match(src, /role="alert"/)
  assert.match(src, /Astuce/)
  assert.match(src, /Choisis Position/)
  assert.ok(!/Partager ma position en direct dans WhatsApp/.test(src))
})

test('route accept-delivery : lit order_items dans les deux chemins, echec ignore', () => {
  const src = read('app/api/driver/accept-delivery/route.ts')
  assert.match(src, /from\('order_items'\)/)
  assert.match(src, /select\('product_name, quantity'\)/)
  assert.match(src, /items,/)
  assert.equal((src.match(/buildWhatsappInfo\(deliveryId/g) || []).length, 2)
  const fn = src.slice(src.indexOf('async function fetchOrderItems'))
  assert.match(fn.slice(0, fn.indexOf('\n}\n')), /catch/)
})

test('DriverTrackingSender : wakeLock, retour de visibilite, position immediate, texte, indisponibilite ignoree', () => {
  const src = read('components/driver/DriverTrackingSender.tsx')
  assert.match(src, /wakeLock/)
  assert.match(src, /request\('screen'\)/)
  assert.match(src, /addEventListener\('visibilitychange'/)
  assert.match(src, /removeEventListener\('visibilitychange'/)
  assert.match(src, /visibilityState !== 'visible'/)
  assert.match(src, /void requestWakeLock\(\)/)
  assert.match(src, /getCurrentPosition/)
  assert.match(src, /sendCoords\(position\.coords, true\)/)
  assert.match(src, /Garde cet écran ouvert pour que le client te suive/)
  const rw = src.slice(src.indexOf('async function requestWakeLock'), src.indexOf('void requestWakeLock()'))
  assert.match(rw, /try \{/)
  assert.match(rw, /catch \{/)
  assert.match(rw, /typeof nav\.wakeLock\.request !== 'function'\) return/)
})

test('URL WhatsApp : le texte decode contient livreur, articles et lien de suivi', async () => {
  const { buildEnRouteWhatsAppUrl } = await import('../lib/delivery-whatsapp.ts')
  const items = [{ name: 'Burger', quantity: 2 }, { name: 'Frites', quantity: 1 }]
  const message = buildEnRouteMessage({ ...base, items })
  const url = buildEnRouteWhatsAppUrl({ customerPhone: '0812345678', message })
  assert.ok(url && url.startsWith('https://wa.me/243812345678'))
  const text = new URL(url).searchParams.get('text')
  assert.equal(text, message)
  assert.match(text, /Votre livreur : Jean/)
  assert.match(text, /Votre commande : 2 x Burger, 1 x Frites/)
  assert.match(text, /Suivez votre livreur en direct : https:\/\/x\.test\/suivi\/abc/)
})
