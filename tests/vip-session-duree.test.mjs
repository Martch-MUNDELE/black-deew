import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { resetFakeDb } from './helpers/fake-supabase.mjs'
import { makeReq } from './helpers/req.mjs'
const login = await import('@/app/api/vip/login/route')
const logout = await import('@/app/api/vip/logout/route')
const { createVipSessionValue, verifyVipSessionValue, VIP_SESSION_MAX_AGE_S, VIP_COOKIE_NAME } = await import('@/lib/vip-session')
const PHONE = '+33612345678'
const H = 3600 * 1000
const T0 = 1_700_000_000_000
// Fabrique une ancienne valeur signee (sans horodatage d'emission "i"), valable 30 jours.
function legacyValue(phone, issuedAt) {
  const payload = Buffer.from(JSON.stringify({ p: phone, e: issuedAt + 30 * 24 * H })).toString('base64url')
  const sig = createHmac('sha256', process.env.VIP_SESSION_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}
function seed() {
  resetFakeDb({
    settings: [
      { key: 'vip_access_enabled', value: 'true' },
      { key: 'vip_access_password', value: 'commun123' },
      { key: 'vip_allowed_phones', value: JSON.stringify([PHONE]) },
    ],
    vip_individual_passwords: [{ phone: PHONE, password: 'perso456' }],
    vip_password_reset_tokens: [],
  })
}
test('duree : la constante unique vaut 12 h', () => {
  assert.equal(VIP_SESSION_MAX_AGE_S, 12 * 60 * 60)
})
test('duree : valeur signee valide acceptee juste apres emission', () => {
  assert.equal(verifyVipSessionValue(createVipSessionValue(PHONE, T0), T0 + 1000), PHONE)
})
test('duree : valeur dans la fenetre (11 h) acceptee', () => {
  assert.equal(verifyVipSessionValue(createVipSessionValue(PHONE, T0), T0 + 11 * H), PHONE)
})
test('duree : valeur expiree (13 h) refusee', () => {
  assert.equal(verifyVipSessionValue(createVipSessionValue(PHONE, T0), T0 + 13 * H), null)
})
test('duree : refus a 12 h pile', () => {
  assert.equal(verifyVipSessionValue(createVipSessionValue(PHONE, T0), T0 + 12 * H), null)
})
test('duree : ancienne valeur (30 jours, sans horodatage) emise il y a 11 h acceptee', () => {
  assert.equal(verifyVipSessionValue(legacyValue(PHONE, T0), T0 + 11 * H), PHONE)
})
test('duree : ancienne valeur (30 jours, sans horodatage) emise il y a 13 h refusee', () => {
  assert.equal(verifyVipSessionValue(legacyValue(PHONE, T0), T0 + 13 * H), null)
})
test('duree : ancienne valeur emise il y a 10 jours refusee', () => {
  assert.equal(verifyVipSessionValue(legacyValue(PHONE, T0), T0 + 10 * 24 * H), null)
})
test('duree : horodatage d emission falsifie refuse (signature)', () => {
  const v = createVipSessionValue(PHONE, T0)
  const [payload, sig] = v.split('.')
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  data.i = T0 + 20 * H
  data.e = T0 + 40 * H
  const forged = Buffer.from(JSON.stringify(data)).toString('base64url')
  assert.equal(verifyVipSessionValue(`${forged}.${sig}`, T0 + 13 * H), null)
})
test('cookie login : aucun Max-Age ni Expires (cookie de session du navigateur)', async () => {
  seed()
  const res = await login.POST(makeReq('http://x/api/vip/login', { body: { phone: PHONE, password: 'perso456' } }))
  assert.equal(res.status, 200)
  const setCookie = res.headers.get('set-cookie') || ''
  assert.match(setCookie, new RegExp(`${VIP_COOKIE_NAME}=`))
  assert.match(setCookie, /HttpOnly/i)
  assert.doesNotMatch(setCookie, /Max-Age/i)
  assert.doesNotMatch(setCookie, /Expires/i)
})
test('cookie logout : suppression conservee avec Max-Age=0', async () => {
  const res = await logout.POST()
  assert.match(res.headers.get('set-cookie') || '', /Max-Age=0/i)
})
