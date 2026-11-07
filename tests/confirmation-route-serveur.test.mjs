// BLAC-P3-045 : la page publique de confirmation lit la commande via la route serveur /api/commandes/[id]/confirmation
// Test de lecture de texte, sans reseau. Lancer : node --test tests/confirmation-route-serveur.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const routePath = join(here, '../app/api/commandes/[id]/confirmation/route.ts')
const pagePath = join(here, '../app/(public)/confirmation/[id]/page.tsx')

const routeExists = existsSync(routePath)
const route = routeExists ? readFileSync(routePath, 'utf8') : ''
const page = readFileSync(pagePath, 'utf8')

test('la route GET de confirmation existe (runtime nodejs, force-dynamic)', () => {
  assert.ok(routeExists, 'route.ts absente')
  assert.match(route, /export async function GET/)
  assert.ok(route.includes("export const runtime = 'nodejs'"))
  assert.ok(route.includes("export const dynamic = 'force-dynamic'"))
})

test('la route utilise SUPABASE_SERVICE_ROLE_KEY cote serveur', () => {
  assert.ok(route.includes('process.env.SUPABASE_SERVICE_ROLE_KEY'))
  assert.ok(route.includes("from '@supabase/supabase-js'"))
})

test('la route valide l\'UUID et renvoie 400 sinon', () => {
  assert.match(route, /UUID_RE/)
  assert.match(route, /\[0-9a-f\]\{8\}/)
  assert.match(route, /, 400\)/)
})

test('la route renvoie 404 si la commande est introuvable', () => {
  assert.match(route, /Commande introuvable/)
  assert.match(route, /, 404\)/)
})

test('la route renvoie Cache-Control: no-store', () => {
  assert.ok(route.includes("'Cache-Control': 'no-store'"))
})

test('la route ne selectionne ni phone ni email', () => {
  assert.ok(!/phone/i.test(route), 'phone present')
  assert.ok(!/e-?mail/i.test(route), 'email present')
  assert.ok(!route.includes("select('*')"), 'select(*) interdit')
})

test('les champs selectionnes sont exactement ceux du ticket', () => {
  assert.ok(route.includes("'id, customer_name, customer_address, customer_note, lat, lng, slot_id, total, delivery_fee, delivery_mode'"))
  assert.ok(route.includes("'id, quantity, product_name, unit_price'"))
  assert.ok(route.includes("'date, time_start, time_end'"))
})

test('la page n\'importe plus lib/supabase/client', () => {
  assert.ok(!page.includes('lib/supabase/client'))
  assert.ok(!page.includes('createClient'))
})

test('la page ne lit plus orders ni order_items directement', () => {
  assert.ok(!page.includes("from('orders')"))
  assert.ok(!page.includes("from('order_items')"))
  assert.ok(!page.includes("from('delivery_slots')"))
})

test('la page appelle /api/commandes/ avec /confirmation', () => {
  assert.ok(page.includes('/api/commandes/'))
  assert.ok(page.includes("'/confirmation'"))
})

test('la page garde les etats loading et commande introuvable', () => {
  assert.ok(page.includes('Chargement...'))
  assert.ok(page.includes('Commande introuvable'))
})

test('la page lit order, items et slot dans la reponse et sort du chargement meme en cas d\'erreur', () => {
  assert.ok(page.includes('data.order'))
  assert.ok(page.includes('data.items'))
  assert.ok(page.includes('data.slot'))
  assert.match(page, /catch\s*\{/)
  assert.match(page, /if \(!cancelled\) setLoading\(false\)/)
})
