// BLAC-ITINERAIRE-ADRESSE : l'adresse ecrite prime sur les coordonnees ; carte a livrer avec Voir et accepter la course.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { buildNavigationLinks } = await import('@/lib/driver-navigation')
const { buildMapsUrl } = await import('@/lib/driver-space')

const ADDRESS = '4 route de matadi ngaliema Kinshasa'
const ENCODED = encodeURIComponent(ADDRESS)

test('buildNavigationLinks : adresse presente => liens par adresse meme avec coordonnees', () => {
  const links = buildNavigationLinks({ address: ADDRESS, lat: -4.3306055, lng: 15.2512703 })
  assert.ok(links)
  assert.ok(links.google.includes(`destination=${ENCODED}`))
  assert.ok(links.waze.includes(`q=${ENCODED}`))
  assert.ok(links.apple.includes(`daddr=${ENCODED}`))
  assert.ok(links.android.includes(`q=${ENCODED}`))
  assert.ok(!links.google.includes('-4.3306055'))
})

test('buildNavigationLinks : adresse vide + coordonnees => liens par coordonnees', () => {
  const links = buildNavigationLinks({ address: '  ', lat: -4.3306055, lng: 15.2512703 })
  assert.ok(links)
  assert.ok(links.google.includes('-4.3306055,15.2512703'))
})

test('buildNavigationLinks : adresse et coordonnees vides => null', () => {
  assert.equal(buildNavigationLinks({ address: '', lat: null, lng: null }), null)
})

test('buildMapsUrl : meme regle (adresse prioritaire, coordonnees en secours, sinon null)', () => {
  const byAddress = buildMapsUrl({ address: ADDRESS, lat: -4.3306055, lng: 15.2512703 })
  assert.ok(byAddress.includes(`destination=${ENCODED}`))
  assert.ok(!byAddress.includes('-4.3306055'))
  assert.ok(buildMapsUrl({ address: '', lat: -4.3306055, lng: 15.2512703 }).includes('-4.3306055,15.2512703'))
  assert.equal(buildMapsUrl({ address: '', lat: null, lng: null }), null)
})

test('carte a livrer (TodoCard) : bouton Voir et accepter la course vers le detail + bouton Appeler conserve', () => {
  const src = readFileSync(new URL('../components/driver/DriverHome.tsx', import.meta.url), 'utf8')
  const start = src.indexOf('function TodoCard')
  assert.ok(start >= 0)
  const card = src.slice(start, src.indexOf('\n}\n', start))
  assert.match(card, /Voir et accepter la course/)
  assert.match(card, /\/admin\/driver\/livraison\/\$\{d\.id\}/)
  assert.match(card, /Appeler/)
  assert.match(card, /buildTelUrl\(d\.customerPhone\)/)
  assert.doesNotMatch(card, /DriverAcceptDelivery/)
})
