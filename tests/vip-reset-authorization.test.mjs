import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'
import { setFakeSession } from './helpers/fake-supabase-server.mjs'
import { makeReq } from './helpers/req.mjs'
const consume = await import('@/app/api/vip/reset/consume/route')
const resetLink = await import('@/app/api/admin/vip-reset-link/route')
const FUTURE = new Date(Date.now() + 3600_000).toISOString()
const PAST = new Date(Date.now() - 3600_000).toISOString()
function seed({ allowed, tokenPhone = '+33767079691', expires = FUTURE, usedAt = null }) {
  resetFakeDb({
    admins: [{ email: 'admin@test.local', role: 'admin', status: 'active' }],
    settings: [{ key: 'vip_allowed_phones', value: JSON.stringify(allowed) }],
    vip_individual_passwords: [],
    vip_password_reset_tokens: [{ id: 't1', phone: tokenPhone, token: 'tok-1', expires_at: expires, used_at: usedAt }],
    vip_password_reset_requests: [{ id: 'r1', phone: tokenPhone, status: 'pending' }],
  })
}
const doConsume = () => consume.POST(makeReq('http://x/api/vip/reset/consume', { body: { token: 'tok-1', newPassword: 'Nouveau-1234' } }))
test('consume : numero autorise -> mot de passe enregistre', async () => {
  seed({ allowed: ['+33767079691'] })
  const res = await doConsume()
  assert.equal(res.status, 200)
  assert.equal(getFakeTable('vip_individual_passwords').length, 1)
})
test('consume : numero NON autorise -> refus 403, aucun mot de passe, jeton non consomme', async () => {
  seed({ allowed: ['+33612345678'] })
  const res = await doConsume()
  assert.equal(res.status, 403)
  assert.equal(getFakeTable('vip_individual_passwords').length, 0)
  assert.equal(getFakeTable('vip_password_reset_tokens')[0].used_at, null)
})
test('consume : liste autorisee vide -> refus, aucun mot de passe', async () => {
  seed({ allowed: [] })
  const res = await doConsume()
  assert.equal(res.status, 403)
  assert.equal(getFakeTable('vip_individual_passwords').length, 0)
})
for (const [label, allowed] of [['0033', '0033767079691'], ['local avec zero', '0767079691'], ['+33', '+33767079691']]) {
  test(`consume : format ${label} reconnu`, async () => {
    seed({ allowed: [allowed] })
    const res = await doConsume()
    assert.equal(res.status, 200)
  })
}
test('consume : jeton expire -> 410, aucun mot de passe', async () => {
  seed({ allowed: ['+33767079691'], expires: PAST })
  const res = await doConsume()
  assert.equal(res.status, 410)
  assert.equal(getFakeTable('vip_individual_passwords').length, 0)
})
test('consume : jeton deja utilise -> 410, aucun mot de passe', async () => {
  seed({ allowed: ['+33767079691'], usedAt: PAST })
  const res = await doConsume()
  assert.equal(res.status, 410)
  assert.equal(getFakeTable('vip_individual_passwords').length, 0)
})
test('vip-reset-link : numero NON autorise -> 403 explicite, aucun jeton cree, demande inchangee', async () => {
  seed({ allowed: ['+33612345678'] })
  getFakeTable('vip_password_reset_tokens').length = 0
  setFakeSession({ email: 'admin@test.local' })
  const res = await resetLink.POST(makeReq('http://x/api/admin/vip-reset-link', { body: { requestId: 'r1' } }))
  assert.equal(res.status, 403)
  const json = await res.json()
  assert.match(json.error, /non autoris/i)
  assert.equal(getFakeTable('vip_password_reset_tokens').length, 0)
  assert.equal(getFakeTable('vip_password_reset_requests')[0].status, 'pending')
})
test('vip-reset-link : numero autorise -> jeton genere', async () => {
  seed({ allowed: ['0767079691'] })
  getFakeTable('vip_password_reset_tokens').length = 0
  setFakeSession({ email: 'admin@test.local' })
  const res = await resetLink.POST(makeReq('http://x/api/admin/vip-reset-link', { body: { requestId: 'r1' } }))
  assert.equal(res.status, 200)
  assert.equal(getFakeTable('vip_password_reset_tokens').length, 1)
})
