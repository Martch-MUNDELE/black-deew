import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { decideAdminAccess, isAdminProtectedPath, isAdminLoginPath, hasSupabaseSessionCookie } =
  await import('@/lib/supabase/proxy')
test('chemins exclus : login, public, vip, api, statiques => non proteges', () => {
  for (const p of ['/admin/login', '/admin/login/', '/', '/vip', '/panier', '/api/admin/vip-approve', '/_next/static/x.js', '/favicon.ico', '/administrateur']) {
    assert.equal(isAdminProtectedPath(p), false, p)
  }
})
test('chemins admin proteges', () => {
  for (const p of ['/admin', '/admin/', '/admin/commandes', '/admin/superadmin/facturation/contrats']) {
    assert.equal(isAdminProtectedPath(p), true, p)
  }
})
test('isAdminLoginPath', () => {
  assert.equal(isAdminLoginPath('/admin/login'), true)
  assert.equal(isAdminLoginPath('/admin/loginx'), false)
  assert.equal(isAdminLoginPath('/admin/commandes'), false)
})
test('cookie de session : detection', () => {
  assert.equal(hasSupabaseSessionCookie(['sb-abc-auth-token']), true)
  assert.equal(hasSupabaseSessionCookie(['sb-abc-auth-token.0', 'sb-abc-auth-token.1']), true)
  assert.equal(hasSupabaseSessionCookie(['vip_session', 'other']), false)
  assert.equal(hasSupabaseSessionCookie([]), false)
})
test('sans cookie de session : /admin/* => redirect-login', () => {
  assert.equal(decideAdminAccess({ path: '/admin/commandes', hasSessionCookie: false }), 'redirect-login')
  assert.equal(decideAdminAccess({ path: '/admin', hasSessionCookie: false }), 'redirect-login')
})
test('avec cookie de session : verification requise puis decision', () => {
  assert.equal(decideAdminAccess({ path: '/admin/commandes', hasSessionCookie: true }), 'check-session')
  assert.equal(decideAdminAccess({ path: '/admin/commandes', hasSessionCookie: true, hasUser: true }), 'allow')
  assert.equal(decideAdminAccess({ path: '/admin/commandes', hasSessionCookie: true, hasUser: false }), 'redirect-login')
})
test('chemins exclus : toujours allow, avec ou sans cookie', () => {
  for (const p of ['/admin/login', '/', '/vip', '/panier', '/api/x']) {
    assert.equal(decideAdminAccess({ path: p, hasSessionCookie: false }), 'allow', p)
    assert.equal(decideAdminAccess({ path: p, hasSessionCookie: true, hasUser: false }), 'allow', p)
  }
})
