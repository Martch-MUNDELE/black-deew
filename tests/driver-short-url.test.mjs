import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { loginHeading } = await import('@/lib/driver-short-url')

const nextConfig = readFileSync('next.config.ts', 'utf8')
const loginPage = readFileSync('app/admin/login/page.tsx', 'utf8')

test('loginHeading : /admin/driver => Espace livreur', () => {
  assert.equal(loginHeading('/admin/driver'), 'Espace livreur')
})
test('loginHeading : sous-chemin livreur => Espace livreur', () => {
  assert.equal(loginHeading('/admin/driver/livraison/abc'), 'Espace livreur')
})
test('loginHeading : insensible a la casse et accepte un parametre apres', () => {
  assert.equal(loginHeading('/ADMIN/Driver'), 'Espace livreur')
  assert.equal(loginHeading('/admin/driver?x=1'), 'Espace livreur')
})
test('loginHeading : /admin/commandes => Administration', () => {
  assert.equal(loginHeading('/admin/commandes'), 'Administration')
})
test('loginHeading : null, undefined et vide => Administration', () => {
  assert.equal(loginHeading(null), 'Administration')
  assert.equal(loginHeading(undefined), 'Administration')
  assert.equal(loginHeading(''), 'Administration')
})

function hasRedirect(source, destination) {
  const re = new RegExp(
    "source:\\s*'" + source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    "'\\s*,\\s*destination:\\s*'" + destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    "'\\s*,\\s*permanent:\\s*false"
  )
  return re.test(nextConfig)
}

test('next.config.ts : fonction async redirects()', () => {
  assert.match(nextConfig, /async\s+redirects\s*\(\s*\)/)
})
test('next.config.ts : quatre redirections temporaires exactes', () => {
  assert.ok(hasRedirect('/driver', '/admin/driver'), '/driver')
  assert.ok(hasRedirect('/driver/:path*', '/admin/driver/:path*'), '/driver/:path*')
  assert.ok(hasRedirect('/admin/drivers', '/admin/driver'), '/admin/drivers')
  assert.ok(hasRedirect('/livreur', '/admin/driver'), '/livreur')
  assert.equal((nextConfig.match(/permanent:\s*false/g) || []).length, 4)
  assert.doesNotMatch(nextConfig, /permanent:\s*true/)
})
test('page de connexion : utilise loginHeading', () => {
  assert.match(loginPage, /from '@\/lib\/driver-short-url'/)
  assert.match(loginPage, /loginHeading\(/)
  assert.doesNotMatch(loginPage, />Administration<\/div>/)
})
