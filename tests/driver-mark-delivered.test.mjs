// BLAC-P3-051 : le livreur marque lui-meme une livraison comme livree (lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('lib/mark-delivered.ts : aucune suppression de commande, messages d\'erreur conserves', () => {
  const src = read('lib/mark-delivered.ts')
  assert.match(src, /export async function markOrderDelivered/)
  assert.ok(!/\.delete\(/.test(src))
  assert.match(src, /`orders: \$\{orderErr\.message\}`/)
  assert.match(src, /`order_deliveries: \$\{delErr\.message\}`/)
  assert.match(src, /`driver_sessions: \$\{sessErr\.message\}`/)
})

test('route admin : garde requireAdmin et la branche isTestPhone, appelle markOrderDelivered', () => {
  const src = read('app/api/mark-livree/route.ts')
  assert.match(src, /requireAdmin\(\)/)
  assert.match(src, /isTestPhone\(/)
  assert.match(src, /testOrderDeleted: true/)
  assert.match(src, /markOrderDelivered\(supabase, orderId, total\)/)
  assert.ok(src.indexOf('requireAdmin()') < src.indexOf('markOrderDelivered('))
})

test('route livreur : 401 sans session, 403 si non livreur, session via getAdminRole', () => {
  const src = read('app/api/driver/mark-delivered/route.ts')
  assert.match(src, /getAdminRole\(\)/)
  assert.match(src, /status: 401/)
  assert.match(src, /status: 403/)
  assert.match(src, /info\.role !== 'driver'/)
  assert.ok(src.indexOf('status: 401') < src.indexOf('status: 403'))
  assert.ok(src.indexOf('status: 403') < src.indexOf('.from(\'order_deliveries\')'))
})

test('route livreur : UUID valide avant toute requete, driver_id impose par la session', () => {
  const src = read('app/api/driver/mark-delivered/route.ts')
  assert.match(src, /UUID_RE\.test\(deliveryId\)/)
  assert.ok(src.indexOf('UUID_RE.test(deliveryId)') < src.indexOf('.from(\'order_deliveries\')'))
  assert.match(src, /\.eq\('driver_id', driverId\)/)
  assert.match(src, /const driverId = info\.driver\.id/)
  assert.ok(!/payload\??\.driver_id|body\??\.driver_id/.test(src))
  assert.match(src, /Livraison introuvable' \}, \{ status: 404/)
})

test('route livreur : le montant n\'est jamais lu dans la requete, orders.total relu cote serveur', () => {
  const src = read('app/api/driver/mark-delivered/route.ts')
  assert.ok(!/payload\??\.(total|amount)|body\??\.(total|amount)|amount_collected/.test(src))
  assert.match(src, /\.from\('orders'\)/)
  assert.match(src, /\.select\('total'\)/)
  assert.match(src, /markOrderDelivered\(supabase, delivery\.order_id, orderTotal\)/)
})

test('route livreur : deja livree => already:true sans ecriture, annulee => 409, appelle markOrderDelivered', () => {
  const src = read('app/api/driver/mark-delivered/route.ts')
  assert.match(src, /state === 'delivered'/)
  assert.match(src, /ok: true, already: true/)
  assert.match(src, /state === 'cancelled'/)
  assert.match(src, /status: 409/)
  assert.ok(src.indexOf('already: true') < src.indexOf('markOrderDelivered('))
  assert.ok(src.indexOf('status: 409') < src.indexOf('markOrderDelivered('))
  assert.ok(!/\.delete\(|isTestPhone/.test(src))
})

test('composant : confirmation en page, ni confirm( ni alert(', () => {
  const src = read('components/driver/DriverMarkDelivered.tsx')
  assert.match(src, /^'use client'/)
  assert.match(src, /Marquer comme livrée/)
  assert.match(src, /Confirmer la livraison \?/)
  assert.match(src, /Montant encaissé : \{formatMoney\(amount\)\}/)
  assert.match(src, /Annuler/)
  assert.match(src, /Oui, livrée/)
  assert.match(src, /disabled=\{sending\}/)
  assert.match(src, /router\.refresh\(\)/)
  assert.match(src, /minHeight: 52/)
  assert.ok(!/\bconfirm\(|\balert\(/.test(src))
  assert.ok(!/amount/.test(src.slice(src.indexOf('JSON.stringify'), src.indexOf('JSON.stringify') + 60)))
})

test('DriverDeliveryDetail : bouton seulement si non livree, Appeler et Itineraire conserves', () => {
  const src = read('components/driver/DriverDeliveryDetail.tsx')
  assert.match(src, /\{!delivered \? <DriverMarkDelivered deliveryId=\{delivery\.id\} amount=\{delivery\.amountToCollect\} \/> : null\}/)
  assert.equal((src.match(/<DriverMarkDelivered/g) || []).length, 1)
  assert.ok(src.indexOf('<DriverMarkDelivered') < src.indexOf('label="Appeler"'))
  assert.match(src, /label="Appeler"/)
  assert.match(src, /label="Itinéraire"/)
  assert.match(src, /env\(safe-area-inset-bottom\)/)
})

test("lib/mark-delivered.ts : ordre des ecritures et messages d'erreur identiques a la route admin d'origine", () => {
  const src = read('lib/mark-delivered.ts')
  assert.match(src, /`orders: \$\{orderErr\.message\}`/)
  assert.match(src, /`order_deliveries: \$\{delErr\.message\}`/)
  assert.match(src, /`driver_sessions: \$\{sessErr\.message\}`/)
  const order = [
    ".update({ status: 'livrée' })",
    'order_status_history',
    'recalculatePeriodCore(',
    "status: 'delivered'",
    "'driver_sessions'",
    'addStockMovement(',
    'collected_cash: cash.collected',
  ].map((needle) => src.indexOf(needle))
  assert.ok(order.every((i) => i >= 0), 'chaque etape est presente')
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'etapes dans le meme ordre')
})
