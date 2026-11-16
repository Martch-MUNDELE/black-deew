import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lib = await import('@/lib/delivery-tracking')
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

test('generateTrackingToken : 32 caracteres url-safe, deux tokens differents', () => {
  const a = lib.generateTrackingToken()
  const b = lib.generateTrackingToken()
  assert.equal(a.length, 32)
  assert.match(a, /^[A-Za-z0-9_-]{32}$/)
  assert.notEqual(a, b)
  assert.equal(lib.isValidTrackingToken(a), true)
})

test('isValidTrackingToken refuse vide, trop court, caracteres interdits', () => {
  assert.equal(lib.isValidTrackingToken(''), false)
  assert.equal(lib.isValidTrackingToken('abc'), false)
  assert.equal(lib.isValidTrackingToken('a'.repeat(31)), false)
  assert.equal(lib.isValidTrackingToken('a'.repeat(31) + '/'), false)
  assert.equal(lib.isValidTrackingToken('a'.repeat(31) + ' '), false)
  assert.equal(lib.isValidTrackingToken(null), false)
})

test('parsePositionBody : accepte une position valide', () => {
  const r = lib.parsePositionBody({ lat: 33.57, lng: -7.58 })
  assert.equal(r.ok, true)
  assert.equal(r.lat, 33.57)
  assert.equal(r.lng, -7.58)
  const r2 = lib.parsePositionBody({ lat: 33.57, lng: -7.58, accuracy: 12 })
  assert.equal(r2.ok, true)
  assert.equal(r2.accuracy_m, 12)
})

test('parsePositionBody : refuse lat 91, lng 181, texte, null, precision negative', () => {
  assert.equal(lib.parsePositionBody({ lat: 91, lng: 0 }).ok, false)
  assert.equal(lib.parsePositionBody({ lat: 0, lng: 181 }).ok, false)
  assert.equal(lib.parsePositionBody('abc').ok, false)
  assert.equal(lib.parsePositionBody(null).ok, false)
  assert.equal(lib.parsePositionBody({ lat: 'x', lng: 0 }).ok, false)
  assert.equal(lib.parsePositionBody({ lat: 0, lng: 0, accuracy: -1 }).ok, false)
})

test('isPositionFresh : vrai a 30 s, faux a 5 min', () => {
  const now = Date.parse('2026-11-09T10:00:00Z')
  assert.equal(lib.isPositionFresh(new Date(now - 30000).toISOString(), now), true)
  assert.equal(lib.isPositionFresh(new Date(now - 300000).toISOString(), now), false)
  assert.equal(lib.isPositionFresh(null, now), false)
})

test('buildTrackingUrl', () => {
  assert.equal(lib.buildTrackingUrl('https://x.test', 'abc'), 'https://x.test/suivi/abc')
})

test('publicTrackingView : aucune cle delivery_id, driver_id, token', () => {
  const now = Date.parse('2026-11-09T10:00:00Z')
  const view = lib.publicTrackingView(
    {
      delivery_id: 'd', driver_id: 'dr', token: 't', active: true,
      lat: 33.57, lng: -7.58, position_updated_at: new Date(now - 10000).toISOString(),
    },
    now
  )
  assert.deepEqual(Object.keys(view).sort(), ['active', 'fresh', 'lat', 'lng', 'updated_at'])
  for (const k of ['delivery_id', 'driver_id', 'token']) assert.equal(k in view, false)
  assert.equal(view.fresh, true)
})

test('migration : table, RLS, index unique partiel, aucune regle d acces', () => {
  const sql = read('supabase/migrations/20261109_bd_delivery_tracking.sql')
  assert.match(sql, /create table if not exists public\.delivery_tracking/i)
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /create unique index if not exists[\s\S]*\(delivery_id\)[\s\S]*where active/i)
  assert.doesNotMatch(sql, /create\s+policy/i)
})

test('route livreur : controles 401, 403, 400, 404 et 409', () => {
  const src = read('app/api/driver/tracking/route.ts')
  for (const code of ['401', '403', '400', '404', '409']) {
    assert.match(src, new RegExp('status: ' + code))
  }
  assert.match(src, /no-store/)
})

test('route publique : 404 et no-store', () => {
  const src = read('app/api/tracking/[token]/route.ts')
  assert.match(src, /status: 404/)
  assert.match(src, /no-store/)
})
