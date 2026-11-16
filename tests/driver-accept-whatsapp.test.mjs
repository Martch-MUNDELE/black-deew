// BLAC-P3-066 : message WhatsApp "en route" a l'acceptation (logique pure + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const { buildEnRouteMessage, buildEnRouteWhatsAppUrl } = await import('../lib/delivery-whatsapp.ts')

const base = { customerName: 'Awa', driverName: 'Jean', driverPhone: '0812345678' }

test('buildEnRouteMessage : nom du client, nom et telephone du livreur, lien de suivi', () => {
  const m = buildEnRouteMessage({ ...base, trackingUrl: 'https://x.test/suivi/abc' })
  assert.match(m, /Bonjour Awa, votre commande Black Deew est en route ! Notre livreur arrive bientot chez vous\./)
  assert.match(m, /Votre livreur : Jean - Tel : 0812345678/)
  assert.match(m, /Suivez votre livreur en direct : https:\/\/x\.test\/suivi\/abc/)
})

test('buildEnRouteMessage : pas de ligne de suivi sans lien', () => {
  const m = buildEnRouteMessage(base)
  assert.ok(!m.includes('Suivez votre livreur'))
  assert.ok(!buildEnRouteMessage({ ...base, trackingUrl: '' }).includes('Suivez votre livreur'))
  assert.ok(!buildEnRouteMessage({ ...base, trackingUrl: null }).includes('Suivez votre livreur'))
})

test('buildEnRouteMessage : livreur ou client inconnus', () => {
  const m = buildEnRouteMessage({})
  assert.match(m, /^Bonjour, votre commande Black Deew est en route !/)
  assert.ok(!m.includes('Votre livreur'))
})

test('buildEnRouteWhatsAppUrl : numero local en 0 => wa.me/243', () => {
  const u = buildEnRouteWhatsAppUrl({ customerPhone: '0812345678', message: 'salut' })
  assert.ok(u && u.startsWith('https://wa.me/243812345678'))
})

test('buildEnRouteWhatsAppUrl : numero deja prefixe conserve', () => {
  const u = buildEnRouteWhatsAppUrl({ customerPhone: '+243 81 234 5678', message: 'salut' })
  assert.ok(u && u.startsWith('https://wa.me/243812345678'))
})

test('buildEnRouteWhatsAppUrl : null si numero vide ou sans chiffres', () => {
  assert.equal(buildEnRouteWhatsAppUrl({ customerPhone: '', message: 'x' }), null)
  assert.equal(buildEnRouteWhatsAppUrl({ customerPhone: '   ', message: 'x' }), null)
  assert.equal(buildEnRouteWhatsAppUrl({ customerPhone: 'abc', message: 'x' }), null)
  assert.equal(buildEnRouteWhatsAppUrl({ customerPhone: null, message: 'x' }), null)
})

test("le texte encode dans l'URL se decode vers le message", () => {
  const message = buildEnRouteMessage({ ...base, trackingUrl: 'https://x.test/suivi/abc' })
  const u = buildEnRouteWhatsAppUrl({ customerPhone: '0812345678', message })
  const text = new URL(u).searchParams.get('text')
  assert.equal(text, message)
})

test('route : en_livraison, historique, suivi, trackingUrl, whatsappUrl, controles conserves', () => {
  const src = read('app/api/driver/accept-delivery/route.ts')
  for (const s of ['en_livraison', 'order_status_history', 'delivery_tracking', 'trackingUrl', 'whatsappUrl']) {
    assert.ok(src.includes(s), s)
  }
  for (const c of ['status: 401', 'status: 403', 'status: 400', 'status: 404', 'status: 409']) {
    assert.ok(src.includes(c), c)
  }
  assert.match(src, /select\('id, status, order_id'\)/)
})

test('composant : lien WhatsApp, bouton Continuer, noopener', () => {
  const src = read('components/driver/DriverAcceptDelivery.tsx')
  assert.match(src, /Prévenir le client sur WhatsApp/)
  assert.match(src, /Continuer/)
  assert.match(src, /noopener/)
  assert.match(src, /target="_blank"/)
  assert.match(src, /<a\b/)
  assert.ok(!/\bconfirm\(|\balert\(/.test(src))
})
