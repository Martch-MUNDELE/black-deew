import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { createVipSessionValue, verifyVipSessionValue, VIP_SESSION_MAX_AGE_S } = await import('@/lib/vip-session')
const { safeEqual } = await import('@/lib/vip-server')
const PHONE = '+33612345678'
test('(a) signature valide acceptee', () => {
  const v = createVipSessionValue(PHONE)
  assert.equal(verifyVipSessionValue(v), PHONE)
})
test('(a) signature alteree refusee', () => {
  const v = createVipSessionValue(PHONE)
  const [payload, sig] = v.split('.')
  const flipped = sig.slice(0, -1) + (sig.at(-1) === 'A' ? 'B' : 'A')
  assert.equal(verifyVipSessionValue(`${payload}.${flipped}`), null)
})
test('(a) payload altere avec signature d origine refuse', () => {
  const v = createVipSessionValue(PHONE)
  const sig = v.split('.')[1]
  const other = createVipSessionValue('+243810000000').split('.')[0]
  assert.equal(verifyVipSessionValue(`${other}.${sig}`), null)
})
test('(a) formats invalides refuses', () => {
  for (const bad of [undefined, null, '', 'abc', 'a.b.c', '.', 'x.y']) assert.equal(verifyVipSessionValue(bad), null)
})
test('(a) cookie expire refuse', () => {
  const past = Date.now() - (VIP_SESSION_MAX_AGE_S * 1000 + 1000)
  assert.equal(verifyVipSessionValue(createVipSessionValue(PHONE, past)), null)
})
test('(a) cookie valide puis expire selon la date de verification', () => {
  const t0 = 1_700_000_000_000
  const v = createVipSessionValue(PHONE, t0)
  assert.equal(verifyVipSessionValue(v, t0 + 1000), PHONE)
  assert.equal(verifyVipSessionValue(v, t0 + VIP_SESSION_MAX_AGE_S * 1000), null)
})
test('(a) signature de longueur differente refusee sans exception', () => {
  const payload = createVipSessionValue(PHONE).split('.')[0]
  assert.equal(verifyVipSessionValue(`${payload}.court`), null)
})
test('(a) sans secret : creation impossible, verification refusee', () => {
  const v = createVipSessionValue(PHONE)
  const saved = { a: process.env.VIP_SESSION_SECRET, b: process.env.SUPABASE_SERVICE_ROLE_KEY }
  delete process.env.VIP_SESSION_SECRET
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    assert.throws(() => createVipSessionValue(PHONE))
    assert.equal(verifyVipSessionValue(v), null)
  } finally {
    process.env.VIP_SESSION_SECRET = saved.a
    process.env.SUPABASE_SERVICE_ROLE_KEY = saved.b
  }
})
test('(a) comparaison en temps constant : safeEqual correct + timingSafeEqual present dans le code', () => {
  assert.equal(safeEqual('abc', 'abc'), true)
  assert.equal(safeEqual('abc', 'abd'), false)
  assert.equal(safeEqual('abc', 'abcd'), false)
  assert.match(readFileSync(new URL('../lib/vip-session.ts', import.meta.url), 'utf8'), /timingSafeEqual\(a, b\)/)
  assert.match(readFileSync(new URL('../lib/vip-server.ts', import.meta.url), 'utf8'), /timingSafeEqual/)
})
