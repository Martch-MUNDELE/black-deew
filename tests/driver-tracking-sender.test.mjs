// BLAC-P3-065 : envoi de position du livreur (fonctions pures + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const { TRACKING_INTERVAL_MS, shouldSendPosition, buildPositionPayload } = await import('../lib/tracking-sender.ts')

test('TRACKING_INTERVAL_MS vaut 15000', () => {
  assert.equal(TRACKING_INTERVAL_MS, 15000)
})

test('shouldSendPosition : vrai sans envoi precedent, faux a 5 s, vrai a 15 s', () => {
  assert.equal(shouldSendPosition(null, 100000), true)
  assert.equal(shouldSendPosition(undefined, 100000), true)
  assert.equal(shouldSendPosition(100000, 105000), false)
  assert.equal(shouldSendPosition(100000, 115000), true)
  assert.equal(shouldSendPosition(100000, 105000, 5000), true)
})

test('buildPositionPayload : valide, accuracy optionnelle', () => {
  assert.deepEqual(
    buildPositionPayload('d1', { latitude: 33.57, longitude: -7.58, accuracy: 12 }),
    { delivery_id: 'd1', lat: 33.57, lng: -7.58, accuracy: 12 }
  )
  assert.deepEqual(
    buildPositionPayload('d1', { latitude: 33.57, longitude: -7.58 }),
    { delivery_id: 'd1', lat: 33.57, lng: -7.58 }
  )
})

test('buildPositionPayload : null pour NaN, lat 91, lng 181', () => {
  assert.equal(buildPositionPayload('d1', { latitude: NaN, longitude: -7.58 }), null)
  assert.equal(buildPositionPayload('d1', { latitude: 91, longitude: -7.58 }), null)
  assert.equal(buildPositionPayload('d1', { latitude: 33.57, longitude: 181 }), null)
  assert.equal(buildPositionPayload('d1', null), null)
})

test('composant DriverTrackingSender : watchPosition, clearWatch, route, message localisation', () => {
  const src = read('components/driver/DriverTrackingSender.tsx')
  assert.match(src, /^'use client'/)
  assert.match(src, /watchPosition/)
  assert.match(src, /clearWatch/)
  assert.match(src, /enableHighAccuracy: true/)
  assert.match(src, /\/api\/driver\/tracking/)
  assert.match(src, /shouldSendPosition/)
  assert.match(src, /Active la localisation/)
  assert.match(src, /Position partagée/)
})

test('DriverMarkDelivered : monte DriverTrackingSender et le bouton WhatsApp', () => {
  const src = read('components/driver/DriverMarkDelivered.tsx')
  assert.match(src, /DriverTrackingSender/)
  assert.match(src, /Partager ma position en direct dans WhatsApp/)
  assert.match(src, /Oui, livrée/)
})

test('route mark-delivered : desactive le suivi et conserve 401, 403, 400, 404, 409', () => {
  const src = read('app/api/driver/mark-delivered/route.ts')
  assert.match(src, /delivery_tracking/)
  assert.match(src, /active/)
  assert.match(src, /ended_at/)
  for (const code of [401, 403, 400, 404, 409]) {
    assert.match(src, new RegExp(`status: ${code}`))
  }
  assert.ok(src.indexOf('delivery_tracking') > src.indexOf('markOrderDelivered(supabase'))
})
