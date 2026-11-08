// BLAC-P3-053 : « Ouvrir une session » — un champ vide vaut 0, l'admin ne saisit jamais 0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { parseOpeningCash, parseOpeningLoads } = await import('@/lib/session-form')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('parseOpeningCash : chaine vide => 0', () => {
  assert.equal(parseOpeningCash(''), 0)
})

test('parseOpeningCash : espaces => 0', () => {
  assert.equal(parseOpeningCash('   '), 0)
  assert.equal(parseOpeningCash(' \t '), 0)
})

test('parseOpeningCash : nombres valides', () => {
  assert.equal(parseOpeningCash('20'), 20)
  assert.equal(parseOpeningCash('0'), 0)
  assert.equal(parseOpeningCash(' 20 '), 20)
  assert.equal(parseOpeningCash('12.5'), 12.5)
})

test('parseOpeningCash : virgule decimale acceptee', () => {
  assert.equal(parseOpeningCash('12,5'), 12.5)
})

test('parseOpeningCash : negatif ou non numerique => null', () => {
  for (const v of ['-3', '-0.5', 'abc', '12abc', '1,2,3', '1e5', 'NaN', 'Infinity', '--1'])
    assert.equal(parseOpeningCash(v), null, v)
})

test('parseOpeningLoads : vides, 0 et invalides ignores', () => {
  const out = parseOpeningLoads({ a: '', b: '0', c: 'abc', d: '-2', e: '1.5', f: '   ' })
  assert.deepEqual(out, [])
})

test('parseOpeningLoads : quantites valides conservees', () => {
  const out = parseOpeningLoads({ a: '3', b: '', c: '0', d: ' 12 ', e: 'x' })
  assert.deepEqual(out, [
    { product_id: 'a', quantity: 3 },
    { product_id: 'd', quantity: 12 },
  ])
})

test('parseOpeningLoads : objet vide => liste vide', () => {
  assert.deepEqual(parseOpeningLoads({}), [])
})

test('handleOpenSession utilise les helpers et Montant invalide seulement si null', () => {
  const src = read('app/admin/livreurs/page.tsx')
  assert.match(src, /from '@\/lib\/session-form'/)
  const fn = src.slice(src.indexOf('async function handleOpenSession'), src.indexOf('async function startOpening'))
  assert.match(fn, /parseOpeningCash\(openingCash\)/)
  assert.match(fn, /cash === null/)
  assert.match(fn, /parseOpeningLoads\(openLoads\)/)
  assert.doesNotMatch(fn, /parseFloat\(openingCash\)/)
})
