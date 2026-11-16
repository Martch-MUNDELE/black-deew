// BLAC-SUIVI-LIVRAISON-PAGE : fonctions pures de la page de suivi + lecture du code de la page.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { osmEmbedUrl, googleMapsUrl, trackingStatusText } = await import('@/lib/tracking-view')

const PAGE = readFileSync(new URL('../app/suivi/[token]/page.tsx', import.meta.url), 'utf8')

test('osmEmbedUrl : marker et bbox coherent autour du point', () => {
  const url = osmEmbedUrl(-4.325, 15.322)
  assert.ok(url.startsWith('https://www.openstreetmap.org/export/embed.html?'))
  assert.ok(url.includes('marker=-4.325,15.322'))
  const bbox = new URL(url).searchParams.get('bbox').split(',').map(Number)
  assert.equal(bbox.length, 4)
  const [left, bottom, right, top] = bbox
  assert.ok(left < 15.322 && 15.322 < right)
  assert.ok(bottom < -4.325 && -4.325 < top)
  assert.ok(Math.abs(right - left - 0.01) < 1e-6)
  assert.ok(Math.abs(top - bottom - 0.01) < 1e-6)
})

test('googleMapsUrl : URL exacte', () => {
  assert.equal(googleMapsUrl(-4.325, 15.322), 'https://maps.google.com/?q=-4.325,15.322')
})

test('trackingStatusText : livraison terminee', () => {
  assert.equal(trackingStatusText({ active: false, lat: 1, lng: 2, fresh: true }), 'Livraison terminée')
})

test('trackingStatusText : position en attente', () => {
  assert.equal(trackingStatusText({ active: true, lat: null, lng: null, fresh: false }), 'Position en attente du livreur')
})

test('trackingStatusText : livreur en route', () => {
  assert.equal(trackingStatusText({ active: true, lat: 1, lng: 2, fresh: true }), 'Le livreur est en route')
})

test('trackingStatusText : derniere position il y a X min (arrondi)', () => {
  const now = Date.parse('2026-11-08T12:00:00Z')
  const updated = new Date(now - 4.4 * 60000).toISOString()
  assert.equal(
    trackingStatusText({ active: true, lat: 1, lng: 2, fresh: false, updated_at: updated }, now),
    'Dernière position il y a 4 min'
  )
  const updated2 = new Date(now - 4.6 * 60000).toISOString()
  assert.equal(
    trackingStatusText({ active: true, lat: 1, lng: 2, fresh: false, updated_at: updated2 }, now),
    'Dernière position il y a 5 min'
  )
})

test('page : appel /api/tracking/, intervalle 10 s, message token invalide', () => {
  assert.ok(PAGE.includes("'use client'"))
  assert.ok(PAGE.includes('/api/tracking/'))
  assert.match(PAGE, /10_?000/)
  assert.ok(PAGE.includes('setInterval'))
  assert.ok(PAGE.includes("Ce lien de suivi n'est plus valide"))
  assert.ok(PAGE.includes('Ouvrir dans Google Maps'))
})

test('page : aucune dependance externe ni script externe', () => {
  const imports = [...PAGE.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
  const allowed = new Set(['react', 'next/navigation', '@/lib/tracking-view'])
  for (const i of imports) assert.ok(allowed.has(i), `import non autorise : ${i}`)
  assert.ok(!/<script/i.test(PAGE))
  assert.ok(!/require\(/.test(PAGE))
})
