// BLAC-P3-052 : un livreur sans session ouverte ('inactive') peut se connecter ; seul 'suspended' bloque
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { isDriverStatusAllowed, decideRoleRedirect } = await import('@/lib/admin-role')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('isDriverStatusAllowed : active et inactive autorises', () => {
  assert.equal(isDriverStatusAllowed('active'), true)
  assert.equal(isDriverStatusAllowed('inactive'), true)
})

test('isDriverStatusAllowed : suspended, null, undefined, vide, inconnu refuses', () => {
  for (const v of ['suspended', null, undefined, '', 'banned', 'ACTIVE', 0])
    assert.equal(isDriverStatusAllowed(v), false)
})

test('getAdminRole : plus de filtre status active sur delivery_drivers, utilise isDriverStatusAllowed', () => {
  const src = read('lib/admin-role-server.ts')
  const driverPart = src.slice(src.indexOf("from('delivery_drivers')"))
  assert.doesNotMatch(driverPart, /\.eq\(\s*'status'\s*,\s*'active'\s*\)/)
  assert.match(src, /isDriverStatusAllowed\s*\(/)
  assert.match(src, /select\('id, full_name, status'\)/)
  assert.match(src, /\.eq\('user_id', user\.id\)/)
  // le filtre active reste pour la table admins
  assert.match(src.slice(0, src.indexOf("from('delivery_drivers')")), /\.eq\('status', 'active'\)/)
})

test('decideRoleRedirect inchange', () => {
  assert.equal(decideRoleRedirect({ role: 'driver', path: '/admin/driver' }), null)
  assert.equal(decideRoleRedirect({ role: 'driver', path: '/admin/commandes' }), '/admin/driver')
  assert.equal(decideRoleRedirect({ role: 'none', path: '/admin/commandes' }), '/admin/login?error=acces')
})

test('page de connexion : message pour error=acces lu dans window.location.search', () => {
  const src = read('app/admin/login/page.tsx')
  assert.match(src, /get\('error'\)\s*===\s*'acces'/)
  assert.match(src, /Ce compte n'a pas acces a l'administration ni a l'espace livreur\. Contacte l'administrateur\./)
  assert.doesNotMatch(src, /useSearchParams/)
})

test('menu : liens /admin/driver et /admin/livreurs', () => {
  const src = read('components/admin/AdminNav.tsx') + read('components/admin/AdminNavClient.tsx')
  assert.match(src, /\/admin\/livreurs/)
  assert.match(src, /\/admin\/driver/)
  assert.match(src, /Espace livreur/)
})

test('configuration BLAC-P3-052 : coherente avec isDriverStatusAllowed (lecture du code)', () => {
  const adminRole = read('lib/admin-role.ts')
  const server = read('lib/admin-role-server.ts')
  assert.match(adminRole, /export function isDriverStatusAllowed/)
  assert.match(server, /isDriverStatusAllowed\s*\(/)
  for (const s of ['active', 'inactive']) assert.equal(isDriverStatusAllowed(s), true)
  for (const s of ['suspended']) assert.equal(isDriverStatusAllowed(s), false)
  assert.match(adminRole, /suspended/)
})
