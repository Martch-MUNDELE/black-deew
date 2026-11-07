// BLAC-P3-049 : detail d'une livraison livreur (logique pure + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { shortOrderRef, formatDistanceKm, formatLongDate } = await import('@/lib/driver-space')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('shortOrderRef : 8 premiers caracteres en majuscules', () => {
  assert.equal(shortOrderRef('3f9a1c2e-7b44-4d10-9a55-0c1d2e3f4a5b'), '3F9A1C2E')
  assert.equal(shortOrderRef('abc'), 'ABC')
  assert.equal(shortOrderRef(null), '')
  assert.equal(shortOrderRef(undefined), '')
})

test('formatDistanceKm : valeur, zero, inconnue', () => {
  assert.equal(formatDistanceKm(6), '6,0 km')
  assert.equal(formatDistanceKm(6.04), '6,0 km')
  assert.equal(formatDistanceKm(12.56), '12,6 km')
  assert.equal(formatDistanceKm(0), '0,0 km')
  assert.equal(formatDistanceKm(null), '')
  assert.equal(formatDistanceKm(undefined), '')
  assert.equal(formatDistanceKm(Number.NaN), '')
})

test('formatLongDate : jour de la semaine, jour et mois, vide si invalide', () => {
  assert.equal(formatLongDate('2026-11-07'), 'Samedi 7 novembre')
  assert.equal(formatLongDate(null), '')
  assert.equal(formatLongDate('nimporte quoi'), '')
})

test('getDriverDelivery : cle service_role, driver_id impose, aucun email client ni donnee de paiement', () => {
  const full = read('lib/driver-space-server.ts')
  const start = full.indexOf('export async function getDriverDelivery')
  assert.ok(start > 0)
  const src = full.slice(start)
  assert.match(src, /serviceClient\(\)/)
  assert.match(src, /\.eq\('driver_id', driverId\)/)
  assert.match(src, /\.eq\('id', deliveryId\)/)
  assert.match(src, /return null/)
  assert.doesNotMatch(src, /email/i)
  assert.doesNotMatch(src, /payment|paid|paiement/i)
  assert.doesNotMatch(full, /email/i)
})

test('page detail : getAdminRole, refus sans profil livreur, UUID valide avant la requete, introuvable', () => {
  const src = read('app/admin/driver/livraison/[id]/page.tsx')
  assert.match(src, /getAdminRole\(\)/)
  assert.match(src, /info\?\.role === 'driver'/)
  assert.match(src, /redirect\('\/admin\/driver'\)/)
  assert.match(src, /UUID_RE/)
  assert.ok(src.indexOf('UUID_RE.test(id)') < src.indexOf('getDriverDelivery(driver.id'))
  assert.match(src, /getDriverDelivery\(driver\.id, id\)/)
  assert.doesNotMatch(src, /supabase\/client|createBrowserClient|\.from\(/)
  assert.doesNotMatch(src, /^'use client'/m)
})

test('composant detail : Appeler, Itineraire, note du client, introuvable, safe-area, retour', () => {
  const src = read('components/driver/DriverDeliveryDetail.tsx')
  assert.match(src, /Appeler/)
  assert.match(src, /Itin\u00e9raire|Itineraire/)
  assert.match(src, /Note du client/)
  assert.match(src, /Livraison introuvable/)
  assert.match(src, /safe-area-inset-bottom/)
  assert.match(src, /Mes livraisons/)
  assert.match(src, /position: 'fixed'/)
  assert.match(src, /A encaisser|\u00c0 encaisser/)
  assert.doesNotMatch(src, /supabase/i)
})

test('DriverHome : liens reels vers le detail, boutons Appeler et Itineraire conserves', () => {
  const src = read('components/driver/DriverHome.tsx')
  assert.match(src, /\/admin\/driver\/livraison\//)
  assert.match(src, /<a\s[^>]*href=\{`\/admin\/driver\/livraison\/\$\{d\.id\}`\}/)
  assert.match(src, /Appeler/)
  assert.match(src, /Itin\u00e9raire|Itineraire/)
})
