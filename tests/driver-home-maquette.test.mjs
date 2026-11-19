// BLAC-ACCUEIL-LIVREUR-MAQUETTE : accueil livreur selon les maquettes (logique pure + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { onlineBadge, stockBarRatio, activeDelivery, deliveryStepIndex } = await import('@/lib/driver-space')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('onlineBadge : session ouverte => En ligne / green', () => {
  assert.deepEqual(onlineBadge({ id: 's1', startedAt: '2026-11-19T08:00:00Z', openingCash: 0 }), { label: 'En ligne', tone: 'green' })
})

test('onlineBadge : sans session => Hors session / muted', () => {
  assert.deepEqual(onlineBadge(null), { label: 'Hors session', tone: 'muted' })
})

test('stockBarRatio : 0 pour 0 en stock', () => {
  assert.equal(stockBarRatio(0, 1000), 0)
})

test('stockBarRatio : minimum 0.06 pour 1 sur 1000', () => {
  assert.equal(stockBarRatio(1, 1000), 0.06)
})

test('stockBarRatio : 1 au maximum', () => {
  assert.equal(stockBarRatio(1000, 1000), 1)
})

test('stockBarRatio : maxOnHand 0 donne 0', () => {
  assert.equal(stockBarRatio(5, 0), 0)
})

test('activeDelivery : renvoie la premiere livraison picked_up', () => {
  const list = [{ id: 'a', status: 'assigned' }, { id: 'b', status: 'picked_up' }, { id: 'c', status: 'picked_up' }]
  assert.equal(activeDelivery(list).id, 'b')
})

test('activeDelivery : null sans livraison picked_up', () => {
  assert.equal(activeDelivery([{ id: 'a', status: 'assigned' }, { id: 'd', status: 'delivered' }]), null)
  assert.equal(activeDelivery([]), null)
})

test('deliveryStepIndex : picked_up 1, delivered 2, assigned 0', () => {
  assert.equal(deliveryStepIndex('picked_up'), 1)
  assert.equal(deliveryStepIndex('delivered'), 2)
  assert.equal(deliveryStepIndex('assigned'), 0)
})

test('lib/driver-space-server.ts : statuts assigned, pending, picked_up, delivered', () => {
  const src = read('lib/driver-space-server.ts')
  for (const s of ['assigned', 'pending', 'picked_up', 'delivered']) assert.ok(src.includes(`'${s}'`), s)
})

test('lib/site-logo-server.ts : lit site_logo', () => {
  assert.ok(read('lib/site-logo-server.ts').includes('site_logo'))
})

test('DriverHome.tsx : fonctions et textes attendus, aucun emoji', () => {
  const src = read('components/driver/DriverHome.tsx')
  for (const t of ['onlineBadge', 'stockBarRatio', 'activeDelivery', 'Se déconnecter', 'Aucune course en attente', 'DriverNavigationLinks']) {
    assert.ok(src.includes(t) || src.includes(t.replace('é', '\\u00e9')), t)
  }
  assert.equal(/\p{Extended_Pictographic}/u.test(src), false)
})

test('la page appelle getSiteLogoUrl', () => {
  assert.ok(read('app/admin/driver/page.tsx').includes('getSiteLogoUrl'))
})
