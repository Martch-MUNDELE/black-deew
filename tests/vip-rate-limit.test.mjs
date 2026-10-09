import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeReq, uniqueIp } from './helpers/req.mjs'
const { vipRateLimit } = await import('@/lib/vip-rate-limit')
test('(b) le plafond declenche un 429 avec Retry-After', async () => {
  const ip = uniqueIp()
  assert.equal(await vipRateLimit(makeReq('http://x/api', { ip }), 'rl-a', { max: 2 }), null)
  assert.equal(await vipRateLimit(makeReq('http://x/api', { ip }), 'rl-a', { max: 2 }), null)
  const res = await vipRateLimit(makeReq('http://x/api', { ip }), 'rl-a', { max: 2 })
  assert.ok(res)
  assert.equal(res.status, 429)
  const retry = Number(res.headers.get('Retry-After'))
  assert.ok(retry > 0 && retry <= 900, `Retry-After=${retry}`)
  const json = await res.json()
  assert.equal(json.granted, false)
})
test('(b) la fenetre se reinitialise apres expiration', async (t) => {
  const ip = uniqueIp()
  let now = 2_000_000_000_000
  t.mock.method(Date, 'now', () => now)
  await vipRateLimit(makeReq('http://x/api', { ip }), 'rl-b', { max: 1 })
  const blocked = await vipRateLimit(makeReq('http://x/api', { ip }), 'rl-b', { max: 1 })
  assert.equal(blocked?.status, 429)
  now += 15 * 60 * 1000 + 1000
  assert.equal(await vipRateLimit(makeReq('http://x/api', { ip }), 'rl-b', { max: 1 }), null)
})
test('(b) compteurs separes par adresse IP', async () => {
  assert.equal(await vipRateLimit(makeReq('http://x/api', { ip: uniqueIp() }), 'rl-c', { max: 1 }), null)
  assert.equal(await vipRateLimit(makeReq('http://x/api', { ip: uniqueIp() }), 'rl-c', { max: 1 }), null)
})
test('(b) limitation aussi par numero meme avec IP differentes', async () => {
  const body = { phone: '+33611111111' }
  await vipRateLimit(makeReq('http://x/api', { ip: uniqueIp(), body }), 'rl-d', { max: 1 })
  const res = await vipRateLimit(makeReq('http://x/api', { ip: uniqueIp(), body }), 'rl-d', { max: 1 })
  assert.equal(res?.status, 429)
})
