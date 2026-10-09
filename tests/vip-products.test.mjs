import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb } from './helpers/fake-supabase.mjs'
import { makeReq } from './helpers/req.mjs'
const products = await import('@/app/api/vip/products/route')
const { createVipSessionValue, VIP_COOKIE_NAME } = await import('@/lib/vip-session')
const URL_ = 'http://x/api/vip/products'
const ALLOWED = '+33612345678'
function seed({ enabled = 'true' } = {}) {
  resetFakeDb({
    settings: [
      { key: 'vip_access_enabled', value: enabled },
      { key: 'vip_allowed_phones', value: JSON.stringify([ALLOWED]) },
    ],
    products: [
      { id: 'v2', name: 'Zeta VIP', is_vip: true, active: true, price: 20 },
      { id: 'v1', name: 'Alpha VIP', is_vip: true, active: true, price: 10 },
      { id: 'v3', name: 'Inactif VIP', is_vip: true, active: false, price: 30 },
      { id: 'c1', name: 'Classique Burger', is_vip: false, active: true, price: 5 },
    ],
  })
}
const get = (cookie) => products.GET(makeReq(URL_, { method: 'GET', cookie }))
test('session VIP valide : 200, produits VIP actifs tries, aucun produit non VIP', async () => {
  seed()
  const res = await get(`${VIP_COOKIE_NAME}=${createVipSessionValue(ALLOWED)}`)
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.deepEqual(json.products.map((p) => p.id), ['v1', 'v2'])
  assert.ok(json.products.every((p) => p.is_vip === true && p.active === true))
  assert.equal(res.headers.get('cache-control'), 'no-store')
})
test('session absente : 401 et aucun produit', async () => {
  seed()
  const res = await get(undefined)
  assert.equal(res.status, 401)
  const text = await res.text()
  assert.ok(!text.includes('products'))
  for (const name of ['Alpha VIP', 'Zeta VIP', 'Inactif VIP', 'Classique Burger']) assert.ok(!text.includes(name))
})
test('session forgee (signature alteree) : 401', async () => {
  seed()
  const [payload] = createVipSessionValue(ALLOWED).split('.')
  const res = await get(`${VIP_COOKIE_NAME}=${payload}.signatureforgee`)
  assert.equal(res.status, 401)
})
test('session forgee (charge utile modifiee, signature d origine) : 401', async () => {
  seed()
  const [, sig] = createVipSessionValue(ALLOWED).split('.')
  const forged = Buffer.from(JSON.stringify({ p: '+33699999999', e: Date.now() + 1e9 })).toString('base64url')
  const res = await get(`${VIP_COOKIE_NAME}=${forged}.${sig}`)
  assert.equal(res.status, 401)
})
test('session expiree : 401', async () => {
  seed()
  const old = createVipSessionValue(ALLOWED, Date.now() - 31 * 24 * 3600 * 1000)
  const res = await get(`${VIP_COOKIE_NAME}=${old}`)
  assert.equal(res.status, 401)
})
test('session signee mais numero non autorise : 401, pas de fuite', async () => {
  seed()
  const res = await get(`${VIP_COOKIE_NAME}=${createVipSessionValue('+33700000000')}`)
  assert.equal(res.status, 401)
  const text = await res.text()
  assert.ok(!text.includes('Alpha VIP') && !text.includes('Zeta VIP'))
})
test('acces VIP desactive : 401 meme avec session valide', async () => {
  seed({ enabled: 'false' })
  const res = await get(`${VIP_COOKIE_NAME}=${createVipSessionValue(ALLOWED)}`)
  assert.equal(res.status, 401)
})
test('non-fuite : aucune reponse refusee ne contient un produit VIP', async () => {
  seed()
  const cookies = [undefined, `${VIP_COOKIE_NAME}=abc.def`, `${VIP_COOKIE_NAME}=`, `${VIP_COOKIE_NAME}=${createVipSessionValue('+33700000000')}`]
  for (const c of cookies) {
    const res = await get(c)
    assert.equal(res.status, 401)
    const text = await res.text()
    for (const name of ['Alpha VIP', 'Zeta VIP', 'Inactif VIP']) assert.ok(!text.includes(name))
  }
})
