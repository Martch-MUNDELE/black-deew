// BLAC-P3-046 : espace livreur, detection du role et redirection (sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { resolveAdminRole, isDriverAllowedPath, decideRoleRedirect } = await import('@/lib/admin-role')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const DENIED = '/admin/login?error=acces'

test('resolveAdminRole : admin prioritaire, puis driver, sinon none', () => {
  assert.equal(resolveAdminRole({ isAdmin: true, isDriver: true }), 'admin')
  assert.equal(resolveAdminRole({ isAdmin: true, isDriver: false }), 'admin')
  assert.equal(resolveAdminRole({ isAdmin: false, isDriver: true }), 'driver')
  assert.equal(resolveAdminRole({ isAdmin: false, isDriver: false }), 'none')
})

test('isDriverAllowedPath : /admin/driver et sous-chemins seulement', () => {
  assert.equal(isDriverAllowedPath('/admin/driver'), true)
  assert.equal(isDriverAllowedPath('/admin/driver/x'), true)
  assert.equal(isDriverAllowedPath('/admin/driver?a=1'), true)
  assert.equal(isDriverAllowedPath('/admin/driverx'), false)
  assert.equal(isDriverAllowedPath('/admin'), false)
  assert.equal(isDriverAllowedPath('/admin/commandes'), false)
})

test('livreur hors espace livreur => /admin/driver', () => {
  assert.equal(decideRoleRedirect({ role: 'driver', path: '/admin/commandes' }), '/admin/driver')
  assert.equal(decideRoleRedirect({ role: 'driver', path: '/admin' }), '/admin/driver')
})

test('livreur sur /admin/driver et /admin/driver/x => pas de redirection', () => {
  assert.equal(decideRoleRedirect({ role: 'driver', path: '/admin/driver' }), null)
  assert.equal(decideRoleRedirect({ role: 'driver', path: '/admin/driver/x' }), null)
})

test('admin partout (y compris apercu /admin/driver) => pas de redirection', () => {
  for (const path of ['/admin', '/admin/commandes', '/admin/driver', '/admin/driver/x'])
    assert.equal(decideRoleRedirect({ role: 'admin', path }), null)
})

test('none => /admin/login?error=acces, y compris sur /admin/driver', () => {
  for (const path of ['/admin', '/admin/commandes', '/admin/driver', '/admin/driver/x'])
    assert.equal(decideRoleRedirect({ role: 'none', path }), DENIED)
})

test('/admin/login jamais redirige, pour aucun role', () => {
  for (const role of ['admin', 'driver', 'none'])
    for (const path of ['/admin/login', '/admin/login/', '/admin/login?error=acces'])
      assert.equal(decideRoleRedirect({ role, path }), null)
})

test('layout : lit x-admin-path, appelle getAdminRole, decideRoleRedirect et redirect', () => {
  const src = read('app/admin/layout.tsx')
  assert.match(src, /x-admin-path/)
  assert.match(src, /getAdminRole\s*\(/)
  assert.match(src, /decideRoleRedirect\s*\(/)
  assert.match(src, /from 'next\/navigation'/)
  assert.match(src, /redirect\s*\(/)
  assert.doesNotMatch(src, /SERVICE_ROLE/)
})

test('proxy : pose l en-tete x-admin-path sans changer toLogin', () => {
  const src = read('proxy.ts')
  assert.match(src, /x-admin-path/)
  assert.match(src, /function toLogin/)
  assert.match(src, /'\/admin\/login'/)
})

test('admin-role-server : cle service_role cote serveur uniquement', () => {
  const src = read('lib/admin-role-server.ts')
  assert.match(src, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(src, /NEXT_PUBLIC_[A-Z_]*SERVICE/)
  assert.doesNotMatch(src, /^\s*['"]use client['"]/m)
  assert.match(src, /delivery_drivers/)
  assert.match(src, /status/)
  for (const p of ['app/admin/layout.tsx', 'app/admin/driver/page.tsx', 'lib/admin-role.ts']) {
    assert.doesNotMatch(read(p), /SUPABASE_SERVICE_ROLE_KEY/)
  }
})

test('page livreur : titre, message sans profil et lien retour', () => {
  const src = read('app/admin/driver/page.tsx')
  assert.match(src, /Espace livreur/)
  assert.match(src, /Aucun profil livreur li/)
  assert.match(src, /href="\/admin"/)
  assert.doesNotMatch(src, /^\s*['"]use client['"]/m)
})

test('layout : rendu admin inchange (AdminShell, AdminNav, PushNotificationManager) et branche livreur sans menu', () => {
  const src = read('app/admin/layout.tsx')
  assert.match(src, /<AdminShell nav=\{<AdminNav \/>\} push=\{<PushNotificationManager \/>\}>/)
  const driverBranch = src.slice(src.indexOf("info.role === 'driver'"), src.indexOf('return (\n    <AdminShell'))
  assert.ok(driverBranch.length > 0)
  assert.doesNotMatch(driverBranch, /AdminNav|PushNotificationManager|AdminShell/)
})

test('admin-role-server : role null sur erreur de lecture, jamais admin par defaut', () => {
  const src = read('lib/admin-role-server.ts')
  assert.match(src, /console\.warn\(/)
  assert.match(src, /return null/)
  assert.doesNotMatch(src, /role:\s*'admin'/)
  assert.match(src, /\.eq\('status', 'active'\)/)
  assert.match(src, /\.eq\('user_id', user\.id\)/)
})
