import test from 'node:test'
import assert from 'node:assert/strict'
import { formatLogDetails } from '../lib/admin-log-details.ts'
test('details objet avec reason : retourne la raison', () => {
  assert.equal(formatLogDetails({ reason: 'Réactivation manuelle superadmin' }), 'Réactivation manuelle superadmin')
})
test('details objet sans reason : JSON.stringify', () => {
  assert.equal(formatLogDetails({ a: 1, b: 'x' }), '{"a":1,"b":"x"}')
})
test('details objet avec reason vide ou non texte : JSON.stringify', () => {
  assert.equal(formatLogDetails({ reason: '' }), '{"reason":""}')
  assert.equal(formatLogDetails({ reason: 42 }), '{"reason":42}')
})
test('details texte : retourne le texte tel quel', () => {
  assert.equal(formatLogDetails('Blocage manuel'), 'Blocage manuel')
})
test('details nul ou absent : chaine vide', () => {
  assert.equal(formatLogDetails(null), '')
  assert.equal(formatLogDetails(undefined), '')
})
test('le resultat est toujours une chaine, jamais un objet rendu par React', () => {
  for (const v of [{ reason: 'r' }, { x: 1 }, 'txt', null, undefined, 12, true, [1, 2]]) {
    assert.equal(typeof formatLogDetails(v), 'string')
  }
})
