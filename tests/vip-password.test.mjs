import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'
import { makeReq } from './helpers/req.mjs'
const { hashPassword, verifyPassword, isHashed } = await import('@/lib/vip-password')
const { verifyVipCredentials } = await import('@/lib/vip-server')
const login = await import('@/app/api/vip/login/route')
const changePassword = await import('@/app/api/vip/change-password/route')
const consume = await import('@/app/api/vip/reset/consume/route')
const FUTURE = () => new Date(Date.now() + 3600_000).toISOString()
function seed(storedPassword = 'perso456') {
  resetFakeDb({
    settings: [
      { key: 'vip_access_enabled', value: 'true' },
      { key: 'vip_access_password', value: 'commun123' },
      { key: 'vip_allowed_phones', value: JSON.stringify(['+33612345678', '+243810000000']) },
    ],
    vip_individual_passwords: [{ phone: '+33612345678', password: storedPassword }],
    vip_password_reset_tokens: [
      { id: 1, token: 'tok-valid', phone: '+33612345678', expires_at: FUTURE(), used_at: null },
    ],
  })
}
function captureLogs() {
  const lines = []
  const originals = {}
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
    originals[k] = console[k]
    console[k] = (...args) => { lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) }
  }
  return { lines, restore() { for (const k of Object.keys(originals)) console[k] = originals[k] } }
}
test('hashPassword : format scrypt$N$r$p$sel$hash', () => {
  const h = hashPassword('secret-1')
  const parts = h.split('$')
  assert.equal(parts.length, 6)
  assert.deepEqual(parts.slice(0, 4), ['scrypt', '16384', '8', '1'])
  assert.equal(Buffer.from(parts[4], 'base64').length, 16)
  assert.equal(Buffer.from(parts[5], 'base64').length, 32)
  assert.equal(isHashed(h), true)
  assert.equal(isHashed('secret-1'), false)
})
test('hashPassword : le hash differe a chaque appel (sel) et n est jamais egal au clair', () => {
  const a = hashPassword('secret-1')
  const b = hashPassword('secret-1')
  assert.notEqual(a, b)
  assert.notEqual(a, 'secret-1')
  assert.ok(!a.includes('secret-1'))
})
test('verifyPassword : accepte le bon, refuse le mauvais', () => {
  const h = hashPassword('secret-1')
  assert.equal(verifyPassword(h, 'secret-1'), true)
  assert.equal(verifyPassword(h, 'secret-2'), false)
  assert.equal(verifyPassword(h, ''), false)
})
test('verifyPassword : valeur hachee mal formee => false', () => {
  assert.equal(verifyPassword('scrypt$bad', 'x'), false)
  assert.equal(verifyPassword('scrypt$16384$8$1$$', 'x'), false)
})
test('verifyPassword : ancien mot de passe en clair reste accepte (transitoire)', () => {
  assert.equal(verifyPassword('ancien-clair', 'ancien-clair'), true)
  assert.equal(verifyPassword('ancien-clair', 'autre'), false)
  assert.equal(verifyPassword(null, 'x'), false)
})
test('connexion individuelle : valeur hachee OK, mauvais mot de passe refuse', async () => {
  seed(hashPassword('perso456'))
  const ok = await verifyVipCredentials('+33612345678', 'perso456')
  assert.equal(ok.ok, true)
  assert.equal(ok.needsPasswordChange, false)
  const ko = await verifyVipCredentials('+33612345678', 'faux-mdp')
  assert.equal(ko.ok, false)
  assert.equal(ko.status, 401)
})
test('connexion individuelle : valeur en clair encore acceptee', async () => {
  seed('perso456')
  assert.equal((await verifyVipCredentials('+33612345678', 'perso456')).ok, true)
})
test('login route : valeur hachee en base, connexion OK puis refus', async () => {
  seed(hashPassword('perso456'))
  const good = await login.POST(makeReq('http://x/api/vip/login', { body: { phone: '+33612345678', password: 'perso456' } }))
  assert.equal(good.status, 200)
  const bad = await login.POST(makeReq('http://x/api/vip/login', { body: { phone: '+33612345678', password: 'faux-mdp' } }))
  assert.equal(bad.status, 401)
})
test('change-password : stocke une valeur scrypt$ et la connexion fonctionne ensuite', async () => {
  seed('perso456')
  const cap = captureLogs()
  let res
  try {
    res = await changePassword.POST(makeReq('http://x/api/vip/change-password', {
      body: { phone: '+33612345678', currentPassword: 'perso456', newPassword: 'NouveauMdp-9' },
    }))
  } finally { cap.restore() }
  assert.equal(res.status, 200)
  const stored = getFakeTable('vip_individual_passwords')[0].password
  assert.ok(stored.startsWith('scrypt$'))
  assert.notEqual(stored, 'NouveauMdp-9')
  assert.ok(!(await res.text()).includes('NouveauMdp-9'))
  assert.ok(!cap.lines.some((l) => l.includes('NouveauMdp-9') || l.includes('perso456')))
  assert.equal((await verifyVipCredentials('+33612345678', 'NouveauMdp-9')).ok, true)
  assert.equal((await verifyVipCredentials('+33612345678', 'perso456')).ok, false)
})
test('change-password depuis le mot de passe commun : cree une valeur scrypt$', async () => {
  seed('perso456')
  const res = await changePassword.POST(makeReq('http://x/api/vip/change-password', {
    body: { phone: '+243810000000', currentPassword: 'commun123', newPassword: 'MonMdp-VIP-1' },
  }))
  assert.equal(res.status, 200)
  const row = getFakeTable('vip_individual_passwords').find((r) => r.phone === '+243810000000')
  assert.ok(row && row.password.startsWith('scrypt$'))
})
test('reset/consume : stocke une valeur scrypt$, aucun mot de passe dans les logs ni la reponse', async () => {
  seed('perso456')
  const cap = captureLogs()
  let res
  try {
    res = await consume.POST(makeReq('http://x/api/vip/reset/consume', { body: { token: 'tok-valid', newPassword: 'Reset-Mdp-42' } }))
  } finally { cap.restore() }
  assert.equal(res.status, 200)
  const stored = getFakeTable('vip_individual_passwords')[0].password
  assert.ok(stored.startsWith('scrypt$'))
  assert.notEqual(stored, 'Reset-Mdp-42')
  assert.ok(!(await res.text()).includes('Reset-Mdp-42'))
  assert.ok(!cap.lines.some((l) => l.includes('Reset-Mdp-42')))
  assert.equal(verifyPassword(stored, 'Reset-Mdp-42'), true)
})
