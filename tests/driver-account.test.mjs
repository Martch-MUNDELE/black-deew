// BLAC-P3-047 : compte de connexion livreur (logique pure + controles par lecture du texte).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeDriverEmail, validateDriverAccountInput } from '@/lib/driver-account'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const PASSWORD_9 = 'a'.repeat(9)
const PASSWORD_10 = 'a'.repeat(10)

test('email vide refuse', () => {
  const r = validateDriverAccountInput({ email: '   ', password: PASSWORD_10 })
  assert.equal(r.ok, false)
  assert.match(r.error, /email/i)
})

test('email invalide refuse', () => {
  assert.equal(validateDriverAccountInput({ email: 'pas-un-email', password: PASSWORD_10 }).ok, false)
  assert.equal(validateDriverAccountInput({ email: 'a@b', password: PASSWORD_10 }).ok, false)
})

test('mot de passe de 9 caracteres refuse', () => {
  const r = validateDriverAccountInput({ email: 'livreur@example.com', password: PASSWORD_9 })
  assert.equal(r.ok, false)
  assert.match(r.error, /10/)
})

test('mot de passe de 10 caracteres accepte', () => {
  assert.equal(validateDriverAccountInput({ email: 'livreur@example.com', password: PASSWORD_10 }).ok, true)
})

test('email normalise en minuscules et sans espaces', () => {
  assert.equal(normalizeDriverEmail('  Livreur@Example.COM '), 'livreur@example.com')
  const r = validateDriverAccountInput({ email: '  Livreur@Example.COM ', password: PASSWORD_10 })
  assert.deepEqual(r, { ok: true, email: 'livreur@example.com' })
})

test('la validation ne renvoie jamais le mot de passe', () => {
  const r = validateDriverAccountInput({ email: 'livreur@example.com', password: PASSWORD_10 })
  assert.equal(JSON.stringify(r).includes(PASSWORD_10), false)
})

test('route : requireAdmin appele avant tout', () => {
  const src = read('app/api/admin/driver-account/route.ts')
  const iAdmin = src.indexOf('requireAdmin()')
  assert.ok(iAdmin > 0)
  for (const marker of ['req.json()', 'request.json()', '.from(', 'auth.admin.']) {
    const i = src.indexOf(marker)
    if (i !== -1) assert.ok(iAdmin < i, `requireAdmin doit preceder ${marker}`)
  }
})

test('route : createUser, deleteUser et updateUserById', () => {
  const src = read('app/api/admin/driver-account/route.ts')
  assert.match(src, /auth\.admin\.createUser/)
  assert.match(src, /auth\.admin\.deleteUser/)
  assert.match(src, /auth\.admin\.updateUserById/)
})

test('route : aucun console qui transmet le mot de passe', () => {
  const src = read('app/api/admin/driver-account/route.ts')
  const lines = src.split('\n').filter((l) => /console\.(log|error|warn|info|debug)/.test(l))
  for (const l of lines) assert.equal(/password/i.test(l), false, `console avec password : ${l}`)
})

test('page : importe DriverAccountDialog', () => {
  assert.match(read('app/admin/livreurs/page.tsx'), /import\s+DriverAccountDialog\s+from\s+'@\/components\/DriverAccountDialog'/)
})

test('dialogue : champ mot de passe en type password', () => {
  assert.match(read('components/DriverAccountDialog.tsx'), /type=\{[^}]*'password'[^}]*\}|type="password"/)
})
