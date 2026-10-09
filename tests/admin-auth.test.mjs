import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'
import { setFakeSession } from './helpers/fake-supabase-server.mjs'
import { makeReq } from './helpers/req.mjs'
const { requireAdmin } = await import('@/lib/admin-auth')
const approve = await import('@/app/api/admin/vip-approve/route')
function seed() {
  resetFakeDb({
    admins: [
      { email: 'admin@test.local', role: 'admin', status: 'active' },
      { email: 'bloque@test.local', role: 'admin', status: 'blocked' },
    ],
    settings: [{ key: 'vip_allowed_phones', value: JSON.stringify([]) }],
    vip_access_requests: [{ id: 'req-1', phone: '+33612345678', pseudo: 'Test', status: 'pending', requested_password: 'abc12345' }],
  })
}
test('requireAdmin : sans session => 401', async () => {
  seed(); setFakeSession(null)
  const r = await requireAdmin()
  assert.equal(r.ok, false); assert.equal(r.status, 401)
})
test('requireAdmin : utilisateur non admin => 403', async () => {
  seed(); setFakeSession({ email: 'client@test.local' })
  const r = await requireAdmin()
  assert.equal(r.ok, false); assert.equal(r.status, 403)
})
test('requireAdmin : admin bloque => 403', async () => {
  seed(); setFakeSession({ email: 'bloque@test.local' })
  const r = await requireAdmin()
  assert.equal(r.ok, false); assert.equal(r.status, 403)
})
test('requireAdmin : admin actif => ok', async () => {
  seed(); setFakeSession({ email: 'admin@test.local' })
  const r = await requireAdmin()
  assert.equal(r.ok, true); assert.equal(r.email, 'admin@test.local')
})
test('vip-approve : sans session => 401, rien modifie', async () => {
  seed(); setFakeSession(null)
  const res = await approve.POST(makeReq('http://x/api/admin/vip-approve', { body: { requestId: 'req-1' } }))
  assert.equal(res.status, 401)
  assert.equal(getFakeTable('vip_access_requests')[0].status, 'pending')
})
test('vip-approve : non admin => 403, rien modifie', async () => {
  seed(); setFakeSession({ email: 'client@test.local' })
  const res = await approve.POST(makeReq('http://x/api/admin/vip-approve', { body: { requestId: 'req-1' } }))
  assert.equal(res.status, 403)
  assert.equal(getFakeTable('vip_access_requests')[0].status, 'pending')
})
test('vip-approve : admin => 200 et demande approuvee', async () => {
  seed(); setFakeSession({ email: 'admin@test.local' })
  const res = await approve.POST(makeReq('http://x/api/admin/vip-approve', { body: { requestId: 'req-1' } }))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).ok, true)
  assert.equal(getFakeTable('vip_access_requests')[0].status, 'approved')
})
