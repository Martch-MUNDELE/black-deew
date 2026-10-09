import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb } from './helpers/fake-supabase.mjs'
import { makeReq } from './helpers/req.mjs'
const commandes = await import('@/app/api/commandes/route')
const { createVipSessionValue, VIP_COOKIE_NAME } = await import('@/lib/vip-session')
function seed() {
  resetFakeDb({
    settings: [
      { key: 'status', value: 'open' },
      { key: 'vip_access_enabled', value: 'true' },
      { key: 'vip_allowed_phones', value: JSON.stringify(['+33612345678']) },
    ],
    products: [{ id: 'p-vip', name: 'Article VIP', price: 100, discount: 0, variants: null, is_vip: true, active: true }],
  })
}
const body = {
  name: 'Client Test',
  phone: '+33612345678',
  address: '1 rue du Test',
  slot_id: 's1',
  // Le client pretend que l article n est pas VIP : le serveur doit l ignorer.
  items: [{ product_id: 'p-vip', product_name: 'x', quantity: 1, unit_price: 1, isVip: false }],
}
test('(g) article VIP sans cookie : refuse (401)', async () => {
  seed()
  const res = await commandes.POST(makeReq('http://x/api/commandes', { body }))
  assert.equal(res.status, 401)
})
test('(g) article VIP avec cookie invalide : refuse (401)', async () => {
  seed()
  const res = await commandes.POST(makeReq('http://x/api/commandes', { body, cookie: `${VIP_COOKIE_NAME}=abc.def` }))
  assert.equal(res.status, 401)
})
test('(g) article VIP avec cookie expire : refuse (401)', async () => {
  seed()
  const old = createVipSessionValue('+33612345678', Date.now() - 40 * 24 * 3600 * 1000)
  const res = await commandes.POST(makeReq('http://x/api/commandes', { body, cookie: `${VIP_COOKIE_NAME}=${old}` }))
  assert.equal(res.status, 401)
})
test('(g) article VIP avec cookie valide mais numero non autorise : refuse (403)', async () => {
  seed()
  const v = createVipSessionValue('+33700000000')
  const res = await commandes.POST(makeReq('http://x/api/commandes', { body, cookie: `${VIP_COOKIE_NAME}=${v}` }))
  assert.equal(res.status, 403)
})
