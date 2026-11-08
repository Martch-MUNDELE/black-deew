// BLAC-P3-050 : notifications push livreur (logique pure + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { buildAssignmentPush } = await import('@/lib/driver-push')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('buildAssignmentPush : titre, creneau dans le corps, url livreur', () => {
  const m = buildAssignmentPush({ date: '2026-11-07', time_start: '18:00:00', time_end: '19:00:00' })
  assert.equal(m.title, 'Nouvelle livraison')
  assert.equal(m.body, 'Samedi 7 novembre, 18:00-19:00')
  assert.equal(m.url, '/admin/driver')
})

test('buildAssignmentPush : aucune donnee client, creneau absent => message neutre', () => {
  const m = buildAssignmentPush({ date: '2026-11-07', time_start: '9:00', time_end: null, customer_name: 'Jean Client', phone: '0812345678', address: '12 avenue' })
  const text = JSON.stringify(m)
  assert.ok(!/Jean|Client|0812345678|avenue/.test(text))
  assert.deepEqual(Object.keys(m).sort(), ['body', 'tag', 'title', 'url'])
  const empty = buildAssignmentPush(null)
  assert.equal(empty.title, 'Nouvelle livraison')
  assert.ok(empty.body.length > 0)
})

test('subscribe : lit getAdminRole, driver_id jamais pris du corps, met a jour un endpoint existant', () => {
  const src = read('app/api/push/subscribe/route.ts')
  assert.match(src, /getAdminRole/)
  assert.match(src, /info\.driver\.id/)
  assert.ok(!/subscription\.driver_id|subscription\?\.driver_id|body\.driver_id/.test(src))
  assert.match(src, /\.update\(\{ driver_id: driverId \}\)/)
})

test('send : n\'envoie qu\'aux abonnes sans livreur', () => {
  assert.match(read('app/api/push/send/route.ts'), /\.is\('driver_id', null\)/)
})

test('notify-assignment : 401 / 403, relit orders.driver_id cote serveur', () => {
  const src = read('app/api/driver/notify-assignment/route.ts')
  assert.match(src, /status: 401/)
  assert.match(src, /status: 403/)
  assert.match(src, /info\.role === 'driver'/)
  assert.match(src, /\.from\('orders'\)/)
  assert.match(src, /\.select\('driver_id, slot_id'\)/)
  assert.ok(!/body\??\.driver_id/.test(src))
  assert.ok(!/status: 500/.test(src))
})

test('handleConfirm : appelle /api/driver/notify-assignment sans await', () => {
  const src = read('app/admin/commandes/page.tsx')
  assert.match(src, /fetch\('\/api\/driver\/notify-assignment'/)
  assert.ok(!/await\s+fetch\('\/api\/driver\/notify-assignment'/.test(src))
  const i = src.indexOf('const handleConfirm')
  assert.ok(i >= 0 && src.indexOf('/api/driver/notify-assignment') > i)
})

test('PushNotificationManager : texte livreur sur /admin/driver', () => {
  const src = read('components/pwa/PushNotificationManager.tsx')
  assert.match(src, /usePathname/)
  assert.match(src, /Recevoir une alerte quand une livraison/)
  assert.match(src, /Recevoir les alertes nouvelles commandes/)
})

test('migration : ADD COLUMN IF NOT EXISTS driver_id + index', () => {
  const sql = read('supabase/migrations/20261108_bd_push_driver_id.sql')
  assert.match(sql, /ADD COLUMN IF NOT EXISTS driver_id/i)
  assert.match(sql, /references public\.delivery_drivers\(id\) on delete cascade/i)
  assert.match(sql, /create index if not exists/i)
})
