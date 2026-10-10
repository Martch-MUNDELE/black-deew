import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'
import { makeReq, uniqueIp } from './helpers/req.mjs'
const route = await import('@/app/api/vip/reset-request/route')
function seed(allowed, requests = []) {
  resetFakeDb({
    settings: [{ key: 'vip_allowed_phones', value: JSON.stringify(allowed) }],
    vip_password_reset_requests: requests,
  })
}
const call = (phone, ip = uniqueIp()) => route.POST(makeReq('http://x/api/vip/reset-request', { ip, body: { phone } }))
test('reset-request : numero autorise -> demande creee', async () => {
  seed(['+33767079691'])
  const res = await call('+33767079691')
  assert.equal(res.status, 201)
  const rows = getFakeTable('vip_password_reset_requests')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].status, 'pending')
})
test('reset-request : numero non autorise -> 403, aucune ligne creee', async () => {
  seed(['+33612345678'])
  const res = await call('+33767079691')
  assert.equal(res.status, 403)
  const json = await res.json()
  assert.match(json.error, /demande d.acc/i)
  assert.equal(getFakeTable('vip_password_reset_requests').length, 0)
})
test('reset-request : liste VIP vide -> 403, aucune ligne creee', async () => {
  seed([])
  assert.equal((await call('+33767079691')).status, 403)
  assert.equal(getFakeTable('vip_password_reset_requests').length, 0)
})
test('reset-request : format 0033 accepte', async () => {
  seed(['+33767079691'])
  assert.equal((await call('0033767079691')).status, 201)
  assert.equal(getFakeTable('vip_password_reset_requests').length, 1)
})
test('reset-request : format local 0767079691 accepte', async () => {
  seed(['+33767079691'])
  assert.equal((await call('0767079691')).status, 201)
  assert.equal(getFakeTable('vip_password_reset_requests').length, 1)
})
test('reset-request : demande deja en attente -> 409', async () => {
  seed(['+33767079691'], [{ id: 'x1', phone: '+33767079691', status: 'pending' }])
  assert.equal((await call('+33767079691')).status, 409)
  assert.equal(getFakeTable('vip_password_reset_requests').length, 1)
})
test('reset-request : numero invalide -> 400', async () => {
  seed(['+33767079691'])
  assert.equal((await call('123')).status, 400)
})
test('reset-request : limite de tentatives -> 429', async () => {
  seed([])
  const ip = uniqueIp()
  let last
  for (let i = 0; i < 11; i++) last = await call('+33699999999', ip)
  assert.equal(last.status, 429)
  assert.ok(Number(last.headers.get('Retry-After')) > 0)
  assert.equal(getFakeTable('vip_password_reset_requests').length, 0)
})
