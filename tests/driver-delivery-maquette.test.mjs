// BLAC-P3-068 : ecran de detail livraison selon la maquette (logique pure + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { headerBadge, steps, stockNote } = await import('@/lib/driver-delivery-view')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('headerBadge : assigned', () => {
  assert.deepEqual(headerBadge('assigned'), { label: 'À accepter', tone: 'gold' })
})
test('headerBadge : pending', () => {
  assert.deepEqual(headerBadge('pending'), { label: 'À accepter', tone: 'gold' })
})
test('headerBadge : picked_up', () => {
  assert.deepEqual(headerBadge('picked_up'), { label: 'En route', tone: 'green' })
})
test('headerBadge : delivered', () => {
  assert.deepEqual(headerBadge('delivered'), { label: 'Livrée', tone: 'green' })
})
test('headerBadge : cancelled', () => {
  assert.deepEqual(headerBadge('cancelled'), { label: 'Annulée', tone: 'alert' })
})

test('steps : assigned et pending donnent un tableau vide', () => {
  assert.deepEqual(steps('assigned'), [])
  assert.deepEqual(steps('pending'), [])
})
test('steps : picked_up', () => {
  assert.deepEqual(steps('picked_up'), [
    { label: 'Acceptée', state: 'done' },
    { label: 'En route', state: 'current' },
    { label: 'Livrée', state: 'upcoming' },
  ])
})
test('steps : delivered', () => {
  assert.deepEqual(steps('delivered'), [
    { label: 'Acceptée', state: 'done' },
    { label: 'En route', state: 'done' },
    { label: 'Livrée', state: 'done' },
  ])
})

test('stockNote : stock suffisant', () => {
  assert.deepEqual(stockNote([{ name: 'Mèche A', quantity: 2 }], [{ name: 'Mèche A', onHand: 5 }]), [
    { name: 'Mèche A', onHand: 5, enough: true },
  ])
})
test('stockNote : stock insuffisant', () => {
  assert.deepEqual(stockNote([{ name: 'Mèche A', quantity: 3 }], [{ name: 'Mèche A', onHand: 1 }]), [
    { name: 'Mèche A', onHand: 1, enough: false },
  ])
})
test('stockNote : article absent des soldes ignore', () => {
  assert.deepEqual(
    stockNote(
      [{ name: 'X', quantity: 1 }, { name: 'Y', quantity: 1 }],
      [{ name: 'Y', onHand: 1 }],
    ),
    [{ name: 'Y', onHand: 1, enough: true }],
  )
})

test('stock serveur : vipStockBalance, filtre livreur, [] en cas d erreur', () => {
  const src = read('lib/driver-delivery-stock-server.ts')
  assert.match(src, /vipStockBalance/)
  assert.match(src, /driver_id|driverId/)
  assert.match(src, /catch/)
  assert.match(src, /return \[\]/)
})

test('illustration : svg, aria-hidden, aucun http', () => {
  const src = read('components/driver/DriverRouteIllustration.tsx')
  assert.match(src, /<svg/)
  assert.match(src, /aria-hidden/)
  assert.doesNotMatch(src, /http/)
})

test('detail : composants et phrase de la maquette, aucun emoji', () => {
  const src = read('components/driver/DriverDeliveryDetail.tsx')
  for (const word of ['headerBadge', 'steps', 'stockNote', 'DriverRouteIllustration', 'DriverAcceptDelivery', 'DriverNavigationLinks', 'DriverMarkDelivered']) {
    assert.ok(src.includes(word), `manque ${word}`)
  }
  assert.ok(src.includes('En acceptant, la commande passe en livraison'))
  assert.doesNotMatch(src, /\p{Extended_Pictographic}/u)
})

test('page : appelle getDriverStockBalances', () => {
  assert.match(read('app/admin/driver/livraison/[id]/page.tsx'), /getDriverStockBalances/)
})
