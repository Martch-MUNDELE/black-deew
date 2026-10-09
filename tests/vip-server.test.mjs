import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resetFakeDb } from './helpers/fake-supabase.mjs'
const { normalizePhone, phonesMatch, verifyVipCredentials } = await import('@/lib/vip-server')
function seed() {
  resetFakeDb({
    settings: [
      { key: 'vip_access_enabled', value: 'true' },
      { key: 'vip_access_password', value: 'commun123' },
      { key: 'vip_allowed_phones', value: JSON.stringify(['+33612345678', '+243810000000']) },
    ],
    vip_individual_passwords: [{ phone: '+33612345678', password: 'perso456' }],
  })
}
test('(c) normalizePhone : formats +, 00, 0', () => {
  assert.equal(normalizePhone('+33 6 12 34 56 78'), '+33612345678')
  assert.equal(normalizePhone('0033612345678'), '+33612345678')
  assert.equal(normalizePhone('0612345678'), '+0612345678')
  assert.equal(normalizePhone('   '), '')
})
test('(c) phonesMatch : +, 00, 0 local et 9 derniers chiffres', () => {
  const allowed = ['+33612345678']
  assert.equal(phonesMatch('+33612345678', allowed), true)
  assert.equal(phonesMatch('0033612345678', allowed), true)
  assert.equal(phonesMatch('0612345678', allowed), true)
  assert.equal(phonesMatch('612345678', allowed), true)
  assert.equal(phonesMatch('+33 6 12 34 56 78', allowed), true)
  assert.equal(phonesMatch('0699999999', allowed), false)
  assert.equal(phonesMatch('1234567', allowed), false)
  assert.equal(phonesMatch('', allowed), false)
})
test('(c) mot de passe individuel prioritaire sur le commun', async () => {
  seed()
  const okPerso = await verifyVipCredentials('+33612345678', 'perso456')
  assert.equal(okPerso.ok, true)
  assert.equal(okPerso.needsPasswordChange, false)
  const refusCommun = await verifyVipCredentials('+33612345678', 'commun123')
  assert.equal(refusCommun.ok, false)
  assert.equal(refusCommun.status, 401)
})
test('(c) numero sans mot de passe individuel : le commun est accepte, changement requis', async () => {
  seed()
  const r = await verifyVipCredentials('+243810000000', 'commun123')
  assert.equal(r.ok, true)
  assert.equal(r.needsPasswordChange, true)
})
test('(c) refus identique pour numero inconnu et mauvais mot de passe', async () => {
  seed()
  const inconnu = await verifyVipCredentials('+33700000000', 'commun123')
  const mauvais = await verifyVipCredentials('+33612345678', 'faux')
  assert.equal(inconnu.ok, false)
  assert.deepEqual(inconnu, mauvais)
})
test('(c) champs vides : 400', async () => {
  seed()
  const r = await verifyVipCredentials('', '')
  assert.equal(r.ok, false)
  assert.equal(r.status, 400)
})
test('(c) acces desactive : 403', async () => {
  seed()
  resetFakeDb({
    settings: [
      { key: 'vip_access_enabled', value: 'false' },
      { key: 'vip_allowed_phones', value: '["+33612345678"]' },
    ],
  })
  const r = await verifyVipCredentials('+33612345678', 'x')
  assert.equal(r.status, 403)
})
