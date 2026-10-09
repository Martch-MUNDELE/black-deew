import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'
import { makeReq } from './helpers/req.mjs'
const login = await import('@/app/api/vip/login/route')
const session = await import('@/app/api/vip/session/route')
const logout = await import('@/app/api/vip/logout/route')
const consume = await import('@/app/api/vip/reset/consume/route')
const { createVipSessionValue, VIP_COOKIE_NAME } = await import('@/lib/vip-session')
const FUTURE = () => new Date(Date.now() + 3600_000).toISOString()
const PAST = () => new Date(Date.now() - 3600_000).toISOString()
function seed() {
  resetFakeDb({
    settings: [
      { key: 'vip_access_enabled', value: 'true' },
      { key: 'vip_access_password', value: 'commun123' },
      { key: 'vip_allowed_phones', value: JSON.stringify(['+33612345678', '+243810000000']) },
    ],
    vip_individual_passwords: [{ phone: '+33612345678', password: 'perso456' }],
    vip_password_reset_tokens: [
      { id: 1, token: 'tok-valid', phone: '+33612345678', expires_at: FUTURE(), used_at: null },
      { id: 2, token: 'tok-expired', phone: '+33612345678', expires_at: PAST(), used_at: null },
      { id: 3, token: 'tok-used', phone: '+33612345678', expires_at: FUTURE(), used_at: PAST() },
      { id: 4, token: 'tok-race', phone: '+33612345678', expires_at: FUTURE(), used_at: null },
    ],
  })
}
test('(d) login OK : cookie pose, aucun mot de passe dans la reponse', async () => {
  seed()
  const res = await login.POST(makeReq('http://x/api/vip/login', { body: { phone: '+33612345678', password: 'perso456' } }))
  assert.equal(res.status, 200)
  const text = await res.text()
  assert.ok(!text.includes('perso456') && !text.includes('commun123'))
  assert.ok(!Object.keys(JSON.parse(text)).some((k) => k.toLowerCase() === 'password'))
  const setCookie = res.headers.get('set-cookie') || ''
  assert.match(setCookie, new RegExp(`${VIP_COOKIE_NAME}=`))
  assert.match(setCookie, /HttpOnly/i)
})
test('(d) login avec mot de passe commun : pas de cookie, needsPasswordChange, pas de fuite', async () => {
  seed()
  const res = await login.POST(makeReq('http://x/api/vip/login', { body: { phone: '+243810000000', password: 'commun123' } }))
  assert.equal(res.status, 200)
  const text = await res.text()
  assert.equal(JSON.parse(text).needsPasswordChange, true)
  assert.ok(!text.includes('commun123'))
  assert.equal(res.headers.get('set-cookie'), null)
})
test('(d) login refuse : 401, pas de cookie, pas de mot de passe', async () => {
  seed()
  const res = await login.POST(makeReq('http://x/api/vip/login', { body: { phone: '+33612345678', password: 'faux-mdp' } }))
  assert.equal(res.status, 401)
  const text = await res.text()
  assert.ok(!text.includes('faux-mdp') && !text.includes('perso456'))
  assert.equal(res.headers.get('set-cookie'), null)
})
test('(e) session : cookie absent => granted false', async () => {
  seed()
  const res = await session.GET(makeReq('http://x/api/vip/session', { method: 'GET' }))
  assert.deepEqual(await res.json(), { granted: false })
})
test('(e) session : cookie invalide => granted false et cookie efface', async () => {
  seed()
  const res = await session.GET(makeReq('http://x/api/vip/session', { method: 'GET', cookie: `${VIP_COOKIE_NAME}=abc.def` }))
  assert.equal((await res.json()).granted, false)
  assert.match(res.headers.get('set-cookie') || '', /Max-Age=0/i)
})
test('(e) session : cookie valide et numero autorise => granted true', async () => {
  seed()
  const v = createVipSessionValue('+33612345678')
  const res = await session.GET(makeReq('http://x/api/vip/session', { method: 'GET', cookie: `${VIP_COOKIE_NAME}=${v}` }))
  const json = await res.json()
  assert.equal(json.granted, true)
  assert.equal(json.phone, '+33612345678')
})
test('(e) session : cookie valide mais numero non autorise => granted false', async () => {
  seed()
  const v = createVipSessionValue('+33700000000')
  const res = await session.GET(makeReq('http://x/api/vip/session', { method: 'GET', cookie: `${VIP_COOKIE_NAME}=${v}` }))
  assert.equal((await res.json()).granted, false)
})
test('logout : cookie efface', async () => {
  const res = await logout.POST()
  assert.equal((await res.json()).ok, true)
  assert.match(res.headers.get('set-cookie') || '', /Max-Age=0/i)
})
test('(f) consume : jeton expire refuse', async () => {
  seed()
  const res = await consume.POST(makeReq('http://x/api/vip/reset/consume', { body: { token: 'tok-expired', newPassword: 'nouveau789' } }))
  assert.equal(res.status, 410)
  assert.equal(res.headers.get('set-cookie'), null)
  assert.equal(getFakeTable('vip_individual_passwords')[0].password, 'perso456')
})
test('(f) consume : jeton deja utilise refuse', async () => {
  seed()
  const res = await consume.POST(makeReq('http://x/api/vip/reset/consume', { body: { token: 'tok-used', newPassword: 'nouveau789' } }))
  assert.equal(res.status, 410)
  assert.equal(getFakeTable('vip_individual_passwords')[0].password, 'perso456')
})
test('(f) consume : jeton inconnu => 404', async () => {
  seed()
  const res = await consume.POST(makeReq('http://x/api/vip/reset/consume', { body: { token: 'tok-nope', newPassword: 'nouveau789' } }))
  assert.equal(res.status, 404)
})
test('(f) consume : usage unique (2e appel refuse, mot de passe mis a jour une seule fois)', async () => {
  seed()
  const first = await consume.POST(makeReq('http://x/api/vip/reset/consume', { body: { token: 'tok-valid', newPassword: 'nouveau789' } }))
  assert.equal(first.status, 200)
  assert.match(first.headers.get('set-cookie') || '', new RegExp(`${VIP_COOKIE_NAME}=`))
  assert.equal(getFakeTable('vip_individual_passwords')[0].password, 'nouveau789')
  const second = await consume.POST(makeReq('http://x/api/vip/reset/consume', { body: { token: 'tok-valid', newPassword: 'autre-mdp-1' } }))
  assert.equal(second.status, 410)
  assert.equal(getFakeTable('vip_individual_passwords')[0].password, 'nouveau789')
})
test('(f) consume : deux appels simultanes, un seul reussit', async () => {
  seed()
  const calls = [1, 2].map((n) => consume.POST(makeReq('http://x/api/vip/reset/consume', { body: { token: 'tok-race', newPassword: `mdp-course-${n}` } })))
  const statuses = (await Promise.all(calls)).map((r) => r.status).sort()
  assert.deepEqual(statuses, [200, 410])
})
test('(f) consume : mot de passe trop court => 400', async () => {
  seed()
  const res = await consume.POST(makeReq('http://x/api/vip/reset/consume', { body: { token: 'tok-valid', newPassword: 'ab' } }))
  assert.equal(res.status, 400)
})
