// BLAC-P3-058 : le livreur accepte la course avant de la livrer (logique pure + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const { nextStatusOnAccept } = await import('../lib/accept-delivery.ts')

test('nextStatusOnAccept : assigned => picked_up', () => {
  assert.deepEqual(nextStatusOnAccept('assigned'), { ok: true, status: 'picked_up' })
})

test('nextStatusOnAccept : picked_up => already (idempotent)', () => {
  assert.deepEqual(nextStatusOnAccept('picked_up'), { ok: true, already: true })
})

test('nextStatusOnAccept : delivered et cancelled => refus avec raison', () => {
  for (const s of ['delivered', 'cancelled']) {
    const r = nextStatusOnAccept(s)
    assert.equal(r.ok, false)
    assert.equal(typeof r.reason, 'string')
    assert.ok(r.reason.length > 0)
  }
})

test('nextStatusOnAccept : casse et espaces ignores', () => {
  assert.equal(nextStatusOnAccept('  DELIVERED ').ok, false)
  assert.equal(nextStatusOnAccept('Cancelled').ok, false)
  assert.deepEqual(nextStatusOnAccept(' PICKED_UP '), { ok: true, already: true })
  assert.deepEqual(nextStatusOnAccept(' Assigned '), { ok: true, status: 'picked_up' })
  assert.deepEqual(nextStatusOnAccept(null), { ok: true, status: 'picked_up' })
})

test('route : controles 401, 403, 400 et 404, dans le bon ordre, driver_id impose par la session', () => {
  const src = read('app/api/driver/accept-delivery/route.ts')
  assert.match(src, /getAdminRole\(\)/)
  assert.match(src, /status: 401/)
  assert.match(src, /status: 403/)
  assert.match(src, /info\.role !== 'driver'/)
  assert.match(src, /status: 400/)
  assert.match(src, /UUID_RE\.test\(deliveryId\)/)
  assert.match(src, /Livraison introuvable' \}, \{ status: 404/)
  assert.match(src, /const driverId = info\.driver\.id/)
  assert.match(src, /\.eq\('driver_id', driverId\)/)
  assert.ok(!/payload\??\.driver_id|body\??\.driver_id/.test(src))
  const from = src.indexOf(".from('order_deliveries')")
  assert.ok(src.indexOf('status: 401') < src.indexOf('status: 403'))
  assert.ok(src.indexOf('status: 403') < src.indexOf('status: 400'))
  assert.ok(src.indexOf('status: 400') < from)
  assert.ok(from < src.indexOf('status: 404'))
})

test('route : transition via nextStatusOnAccept, idempotente, picked_up_at, no-store, 409 si refus', () => {
  const src = read('app/api/driver/accept-delivery/route.ts')
  assert.match(src, /nextStatusOnAccept\(delivery\.status\)/)
  assert.match(src, /ok: true, already: true/)
  assert.match(src, /status: 409/)
  assert.match(src, /picked_up_at: new Date\(\)\.toISOString\(\)/)
  assert.match(src, /'Cache-Control': 'no-store'/)
  assert.ok(src.indexOf('already: true') < src.indexOf('.update('))
  assert.ok(!/\.delete\(/.test(src))
})

test('composant : appelle la route, rafraichit, chargement et erreur, sans boite navigateur', () => {
  const src = read('components/driver/DriverAcceptDelivery.tsx')
  assert.match(src, /^'use client'/)
  assert.match(src, /Accepter la course/)
  assert.match(src, /\/api\/driver\/accept-delivery/)
  assert.match(src, /router\.refresh\(\)/)
  assert.match(src, /disabled=\{sending\}/)
  assert.match(src, /role="alert"/)
  assert.ok(!/\bconfirm\(|\balert\(/.test(src))
})

test("detail : Livrée n'apparait qu'apres acceptation, badge Acceptée, bouton Accepter avant", () => {
  const src = read('components/driver/DriverDeliveryDetail.tsx')
  assert.match(src, /const accepted = delivery\.status\.trim\(\)\.toLowerCase\(\) === 'picked_up'/)
  assert.match(src, /\{notYetAccepted \? \(/)
  assert.match(src, /<DriverAcceptDelivery deliveryId=\{delivery\.id\} \/>/)
  assert.equal((src.match(/<DriverMarkDelivered/g) || []).length, 1)
  assert.ok(src.indexOf('{accepted ? (') < src.indexOf('<DriverMarkDelivered'))
  assert.ok(src.indexOf('<DriverAcceptDelivery deliveryId') < src.indexOf('<DriverMarkDelivered'))
  assert.match(src, /'Acceptée'/)
  assert.match(src, /Appeler/)
  assert.match(src, /<DriverNavigationLinks/)
})
