// BLAC-CARTE-LIVRAISON : carte de geolocalisation du detail de course (logique pure + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const { isValidCoordinate, toLatLng, computeBounds, computeView, OSM_TILE_URL, OSM_ATTRIBUTION_TEXT } = await import('@/lib/driver-route-map')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('coordonnees valides', () => {
  assert.equal(isValidCoordinate(-4.325, 15.322), true)
  assert.equal(isValidCoordinate(30.42, -9.6), true)
  assert.equal(isValidCoordinate(90, 180), true)
  assert.equal(isValidCoordinate(-90, -180), true)
})
test('coordonnees invalides', () => {
  for (const [a, b] of [[null, 1], [1, undefined], ['1', '2'], [NaN, 1], [1, Infinity], [91, 0], [-91, 0], [0, 181], [0, -181]]) {
    assert.equal(isValidCoordinate(a, b), false, `${a},${b}`)
  }
})
test('couple 0,0 refuse', () => {
  assert.equal(isValidCoordinate(0, 0), false)
  assert.equal(toLatLng(0, 0), null)
  assert.equal(isValidCoordinate(0, 5), true)
})
test('bornes', () => {
  assert.deepEqual(computeBounds([{ lat: 1, lng: 2 }, { lat: 3, lng: -4 }]), { south: 1, west: -4, north: 3, east: 2 })
  assert.equal(computeBounds([null, undefined]), null)
  assert.deepEqual(computeBounds([{ lat: 1, lng: 2 }, null]), { south: 1, west: 2, north: 1, east: 2 })
})
test('vue : destination seule, deux points, points confondus, invalide', () => {
  const dest = { lat: -4.3, lng: 15.3 }
  assert.equal(computeView(dest, null).kind, 'point')
  assert.equal(computeView(dest, { lat: -4.4, lng: 15.2 }).kind, 'bounds')
  assert.equal(computeView(dest, dest).kind, 'point')
  assert.equal(computeView({ lat: 0, lng: 0 }, dest), null)
  assert.equal(computeView(null, dest), null)
})
test('tuiles et attribution OpenStreetMap', () => {
  assert.match(OSM_TILE_URL, /^https:\/\/.*openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png$/)
  assert.match(OSM_ATTRIBUTION_TEXT, /OpenStreetMap/)
})

const { MAP_HEIGHT_PX } = await import('@/lib/driver-route-map')
const comp = () => read('components/driver/DriverRouteMap.tsx')

test('composant : client, 220 px, Leaflet charge une seule fois, tuiles OSM', () => {
  const src = comp()
  assert.match(src, /^'use client'/)
  assert.equal(MAP_HEIGHT_PX, 220)
  assert.match(src, /MAP_HEIGHT_PX/)
  assert.match(src, /let leafletLoadPromise/)
  assert.match(src, /unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js/)
  assert.match(src, /OSM_TILE_URL/)
  assert.match(src, /OSM_ATTRIBUTION_HTML/)
  assert.doesNotMatch(src, /from 'leaflet'|require\('leaflet'\)/)
})
test('composant : epingle destination, point livreur, recentrer 44 px, zoom, distance', () => {
  const src = comp()
  assert.match(src, /#FF6B20/)
  assert.match(src, /#7FD6A0/)
  assert.match(src, /Recentrer la carte/)
  assert.match(src, /width: 44/)
  assert.match(src, /height: 44/)
  assert.match(src, /zoomControl:\s*true/)
  assert.match(src, /distanceText/)
})
test('composant : un doigt fait defiler la page, deux doigts deplacent la carte', () => {
  const src = comp()
  assert.match(src, /dragging:\s*!L\.Browser\.mobile/)
  assert.match(src, /touchZoom:\s*true/)
  assert.match(src, /scrollWheelZoom:\s*false/)
})
test('repli vers l illustration : coordonnees invalides, echec ou delai de Leaflet, sans erreur visible', () => {
  const src = comp()
  assert.match(src, /import DriverRouteIllustration/)
  assert.match(src, /!dest \|\| status === 'failed'/)
  assert.match(src, /\.catch\(/)
  assert.match(src, /LOAD_TIMEOUT_MS/)
  assert.doesNotMatch(src, /console\.error/)
  assert.ok(existsSync(new URL('../components/driver/DriverRouteIllustration.tsx', import.meta.url)))
})
test('aucun envoi de position depuis la carte (lecture seule)', () => {
  const src = comp()
  assert.match(src, /watchPosition/)
  assert.doesNotMatch(src, /fetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket|\/api\//)
  assert.doesNotMatch(src, /method:\s*'(POST|PUT|PATCH)'/)
})
test('detail : utilise DriverRouteMap avec lat, lng et distanceText', () => {
  const src = read('components/driver/DriverDeliveryDetail.tsx')
  assert.match(src, /<DriverRouteMap lat=\{delivery\.lat\} lng=\{delivery\.lng\} distanceText=\{distance \|\| undefined\} \/>/)
  assert.doesNotMatch(src, /<DriverRouteIllustration/)
})
test('aucune nouvelle dependance npm Leaflet', () => {
  assert.doesNotMatch(read('package.json'), /"leaflet"/)
})
test('politique de securite : aucune en-tete CSP dans le depot (tuiles non bloquees)', () => {
  for (const f of ['next.config.ts', 'vercel.json', 'proxy.ts']) {
    assert.doesNotMatch(read(f), /content-security-policy/i, f)
  }
})
