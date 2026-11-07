// BLAC-P3-048 : accueil de l'espace livreur (logique pure + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { splitDeliveries, formatSlot, buildMapsUrl, buildTelUrl, initialOf } = await import('@/lib/driver-space')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('splitDeliveries : a faire / deja livrees / annulees ecartees', () => {
  const items = [
    { id: 'a', status: 'assigned' },
    { id: 'b', status: 'pending' },
    { id: 'c', status: 'delivered' },
    { id: 'd', status: 'cancelled' },
    { id: 'e', status: 'canceled' },
    { id: 'f', status: 'DELIVERED' },
    { id: 'g', status: null },
  ]
  const { todo, done } = splitDeliveries(items)
  assert.deepEqual(todo.map((i) => i.id), ['a', 'b', 'g'])
  assert.deepEqual(done.map((i) => i.id), ['c', 'f'])
})

test('formatSlot : HH:MM – HH:MM, repli sur la date', () => {
  assert.equal(formatSlot('2026-11-07', '09:00:00', '11:30:00'), '09:00 \u2013 11:30')
  assert.equal(formatSlot('2026-11-07', '9:00', '11:30'), '09:00 \u2013 11:30')
  assert.equal(formatSlot('2026-11-07', '09:00', null), '09:00')
  assert.equal(formatSlot('2026-11-07', null, null), '07/11')
  assert.equal(formatSlot(null, null, null), '')
})

test('buildMapsUrl : adresse seule, lat/lng prioritaires, rien => null', () => {
  assert.equal(
    buildMapsUrl({ address: '12 avenue de la Paix, Gombe' }),
    'https://www.google.com/maps/dir/?api=1&destination=12%20avenue%20de%20la%20Paix%2C%20Gombe'
  )
  assert.equal(
    buildMapsUrl({ address: 'x', lat: -4.3276, lng: 15.3136 }),
    'https://www.google.com/maps/dir/?api=1&destination=-4.3276,15.3136'
  )
  assert.equal(buildMapsUrl({ address: '  ', lat: null, lng: null }), null)
})

test('buildTelUrl : nettoie espaces, tirets, parentheses et garde le plus initial', () => {
  assert.equal(buildTelUrl('+243 81 234-56 78'), 'tel:+243812345678')
  assert.equal(buildTelUrl('081 234 5678'), 'tel:0812345678')
  assert.equal(buildTelUrl('(081) 234-5678'), 'tel:0812345678')
  assert.equal(buildTelUrl('   '), null)
  assert.equal(buildTelUrl(null), null)
})

test('initialOf : majuscule de la premiere lettre, L par defaut', () => {
  assert.equal(initialOf('  kevin Mbuyi'), 'K')
  assert.equal(initialOf('\u00e9lie'), '\u00c9')
  assert.equal(initialOf(''), 'L')
  assert.equal(initialOf(null), 'L')
})

test('route : getAdminRole, refus sans profil livreur, aucun identifiant venant de la requete, no-store', () => {
  const src = read('app/api/driver/home/route.ts')
  assert.match(src, /getAdminRole\(\)/)
  assert.match(src, /info\.role !== 'driver' \|\| !info\.driver\?\.id/)
  assert.match(src, /status: 401/)
  assert.match(src, /status: 403/)
  assert.match(src, /getDriverHome\(info\.driver\.id/)
  assert.match(src, /export async function GET\(\s*\)/)
  assert.doesNotMatch(src, /searchParams|req\.|request\.|\.json\(\)\s*\)\s*as/)
  assert.match(src, /'Cache-Control': 'no-store'/)
})

test('getDriverHome : cle service_role, limite au livreur, aucun email client ni statut de paiement', () => {
  const src = read('lib/driver-space-server.ts')
  assert.match(src, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(src, /\.eq\('driver_id', driverId\)/)
  assert.doesNotMatch(src, /email/i)
  assert.doesNotMatch(src, /payment|paid/i)
})

test('DriverHome : intervalle de 20 secondes, boutons Appeler et Itineraire, ligne de connexion perdue', () => {
  const src = read('components/driver/DriverHome.tsx')
  assert.match(src, /REFRESH_INTERVAL_MS = 20000/)
  assert.match(src, /setInterval/)
  assert.match(src, /visibilitychange/)
  assert.match(src, /\/api\/driver\/home/)
  assert.match(src, /Appeler/)
  assert.match(src, /Itin\u00e9raire|Itineraire/)
  assert.match(src, /Connexion perdue, nouvel essai\.\.\./)
  assert.doesNotMatch(src, /supabase/i)
})

test('page : getAdminRole + getDriverHome cote serveur, aucune lecture de table avec le client navigateur', () => {
  const src = read('app/admin/driver/page.tsx')
  assert.match(src, /getAdminRole\(\)/)
  assert.match(src, /getDriverHome\(driver\.id/)
  assert.match(src, /Aucun profil livreur li\u00e9 \u00e0 ce compte/)
  assert.match(src, /AdminLogoutButton/)
  assert.doesNotMatch(src, /supabase\/client|createBrowserClient|\.from\(/)
  assert.doesNotMatch(src, /^'use client'/m)
})
