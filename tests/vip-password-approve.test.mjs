import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'
import { setFakeSession } from './helpers/fake-supabase-server.mjs'
import { makeReq } from './helpers/req.mjs'
const { verifyPassword } = await import('@/lib/vip-password')
const approve = await import('@/app/api/admin/vip-approve/route')
function seed(requestedPassword = 'Demande-Mdp-77') {
  resetFakeDb({
    admins: [{ email: 'admin@test.local', role: 'admin', status: 'active' }],
    settings: [{ key: 'vip_allowed_phones', value: JSON.stringify([]) }],
    vip_individual_passwords: [],
    vip_access_requests: [{ id: 'req-1', phone: '+33612345678', pseudo: 'Test', status: 'pending', requested_password: requestedPassword }],
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
test('vip-approve : stocke une valeur scrypt$, ne renvoie plus le mot de passe, aucun log en clair', async () => {
  seed()
  setFakeSession({ email: 'admin@test.local' })
  const cap = captureLogs()
  let res
  try {
    res = await approve.POST(makeReq('http://x/api/admin/vip-approve', { body: { requestId: 'req-1' } }))
  } finally { cap.restore() }
  assert.equal(res.status, 200)
  const text = await res.text()
  const json = JSON.parse(text)
  assert.equal(json.ok, true)
  assert.ok(!('password' in json))
  assert.ok(!text.includes('Demande-Mdp-77'))
  const row = getFakeTable('vip_individual_passwords').find((r) => r.phone === '+33612345678')
  assert.ok(row && row.password.startsWith('scrypt$'))
  assert.notEqual(row.password, 'Demande-Mdp-77')
  assert.equal(verifyPassword(row.password, 'Demande-Mdp-77'), true)
  assert.ok(!cap.lines.some((l) => l.includes('Demande-Mdp-77')))
})
test('vip-approve : sans mot de passe demande, aucune ligne de mot de passe creee', async () => {
  seed(null)
  setFakeSession({ email: 'admin@test.local' })
  const res = await approve.POST(makeReq('http://x/api/admin/vip-approve', { body: { requestId: 'req-1' } }))
  assert.equal(res.status, 200)
  assert.equal(getFakeTable('vip_individual_passwords').length, 0)
})
