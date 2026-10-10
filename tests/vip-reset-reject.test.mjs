import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'
import { setFakeSession } from './helpers/fake-supabase-server.mjs'
import { makeReq } from './helpers/req.mjs'
const reject = await import('@/app/api/admin/vip-reset-reject/route')
function seed() {
  resetFakeDb({
    admins: [{ email: 'admin@test.local', role: 'admin', status: 'active' }],
    vip_password_reset_requests: [
      { id: 'r1', phone: '+33767079691', status: 'pending' },
      { id: 'r2', phone: '+33767079691', status: 'sent' },
    ],
  })
}
const call = (id) => reject.POST(makeReq('http://x/api/admin/vip-reset-reject', { body: { requestId: id } }))
test('vip-reset-reject : succes pending -> rejected', async () => {
  seed(); setFakeSession({ email: 'admin@test.local' })
  const res = await call('r1')
  assert.equal(res.status, 200)
  assert.equal(getFakeTable('vip_password_reset_requests').find((r) => r.id === 'r1').status, 'rejected')
})
test('vip-reset-reject : introuvable -> 404', async () => {
  seed(); setFakeSession({ email: 'admin@test.local' })
  assert.equal((await call('absent')).status, 404)
})
test('vip-reset-reject : deja traitee -> 409, statut inchange', async () => {
  seed(); setFakeSession({ email: 'admin@test.local' })
  assert.equal((await call('r2')).status, 409)
  assert.equal(getFakeTable('vip_password_reset_requests').find((r) => r.id === 'r2').status, 'sent')
})
test('vip-reset-reject : sans session -> 401, rien modifie', async () => {
  seed(); setFakeSession(null)
  assert.equal((await call('r1')).status, 401)
  assert.equal(getFakeTable('vip_password_reset_requests').find((r) => r.id === 'r1').status, 'pending')
})
test('vip-reset-reject : non admin -> 403, rien modifie', async () => {
  seed(); setFakeSession({ email: 'client@test.local' })
  assert.equal((await call('r1')).status, 403)
  assert.equal(getFakeTable('vip_password_reset_requests').find((r) => r.id === 'r1').status, 'pending')
})
test('vip-reset-reject : requestId manquant -> 400', async () => {
  seed(); setFakeSession({ email: 'admin@test.local' })
  assert.equal((await call('')).status, 400)
})
