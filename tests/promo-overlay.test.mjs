// BLAC-P3-010 : tests de la logique pure de l'overlay promotionnel
import test from 'node:test'
import assert from 'node:assert/strict'

const { selectPromotionForSurface, getOverlaySurface, parseDismissedIds, addDismissedId, formatPromotionBadge } =
  await import('../lib/promo-overlay.ts')

const NOW = new Date('2026-11-01T12:00:00Z').getTime()
const p = (o = {}) => ({
  id: 'p1', name: 'Promo', customer_message: 'Message', benefit_type: 'percent_discount',
  discount_percent: 10, scope: 'all', ...o,
})
const pick = (list, surface, dismissed = []) => selectPromotionForSurface(list, surface, dismissed, NOW)

test('(a) promotion classic : visible sur classic, absente sur vip', () => {
  const list = [p({ id: 'c', scope: 'classic' })]
  assert.equal(pick(list, 'classic')?.id, 'c')
  assert.equal(pick(list, 'vip'), null)
})

test('(b) promotion vip : visible sur vip, absente sur classic', () => {
  const list = [p({ id: 'v', scope: 'vip' })]
  assert.equal(pick(list, 'vip')?.id, 'v')
  assert.equal(pick(list, 'classic'), null)
})

test('(c) portee all et mixed visibles sur les deux surfaces', () => {
  for (const scope of ['all', 'mixed']) {
    const list = [p({ id: scope, scope })]
    assert.equal(pick(list, 'classic')?.id, scope)
    assert.equal(pick(list, 'vip')?.id, scope)
  }
})

test('(d) priorite puis avantage', () => {
  // sans champ priority : l ordre de la route publique (deja trie par priorite) fait foi
  assert.equal(pick([p({ id: 'a', discount_percent: 5 }), p({ id: 'b', discount_percent: 50 })], 'classic')?.id, 'a')
  // avec priorite explicite : le plus petit nombre gagne
  assert.equal(pick([p({ id: 'a', priority: 100, discount_percent: 50 }), p({ id: 'b', priority: 10, discount_percent: 5 })], 'classic')?.id, 'b')
  // meme priorite : le plus avantageux gagne
  assert.equal(pick([p({ id: 'a', priority: 10, discount_percent: 5 }), p({ id: 'b', priority: 10, discount_percent: 30 })], 'classic')?.id, 'b')
  // un seul resultat
  assert.ok(!Array.isArray(pick([p(), p({ id: 'x' })], 'classic')))
})

test('(e) promotion fermee ignoree, nouvelle promotion affichee', () => {
  const list = [p({ id: 'old' })]
  assert.equal(pick(list, 'classic', ['old']), null)
  const list2 = [p({ id: 'old' }), p({ id: 'new', discount_percent: 5 })]
  assert.equal(pick(list2, 'classic', ['old'])?.id, 'new')
  assert.deepEqual(parseDismissedIds('["a","b",3]'), ['a', 'b'])
  assert.deepEqual(addDismissedId(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(addDismissedId(['a'], 'a'), ['a'])
})

test('(f) liste vide ou donnees invalides : aucune promotion, aucune erreur', () => {
  for (const bad of [[], null, undefined, 'x', 42, {}, [null, 1, 'a', {}, { id: 5 }, { id: 'z' }, [[]]]]) {
    assert.equal(pick(bad, 'classic'), null)
    assert.equal(pick(bad, 'vip'), null)
  }
  assert.equal(selectPromotionForSurface([p()], 'classic', null, NOW)?.id, 'p1')
  assert.deepEqual(parseDismissedIds('{pas du json'), [])
  assert.deepEqual(parseDismissedIds(null), [])
  assert.equal(pick([p({ scope: 'inconnu' })], 'classic'), null)
})

test('(g) promotion expiree, future, inactive ou a code jamais choisie', () => {
  assert.equal(pick([p({ ends_at: '2026-10-31T00:00:00Z' })], 'classic'), null)
  assert.equal(pick([p({ starts_at: '2026-12-01T00:00:00Z' })], 'classic'), null)
  assert.equal(pick([p({ status: 'inactive' })], 'classic'), null)
  assert.equal(pick([p({ status: 'draft' })], 'classic'), null)
  assert.equal(pick([p({ ends_at: 'date invalide' })], 'classic'), null)
  assert.equal(pick([p({ promotion_mode: 'promo_code' })], 'classic'), null)
  assert.equal(pick([p({ code: 'ABC' })], 'classic'), null)
  assert.equal(pick([p({ id: 'ok', status: 'active', ends_at: '2026-11-30T00:00:00Z' })], 'classic')?.id, 'ok')
})

test('surface selon le chemin : accueil et vip seulement', () => {
  assert.equal(getOverlaySurface('/'), 'classic')
  assert.equal(getOverlaySurface('/vip'), 'vip')
  assert.equal(getOverlaySurface('/vip/'), 'vip')
  for (const path of ['/panier', '/confirmation/123', '/admin', '/admin/promotions', '/vip/reset', null, undefined, '']) {
    assert.equal(getOverlaySurface(path), null)
  }
})

test('badge : pourcentage, montant, livraison, cadeau', () => {
  assert.equal(formatPromotionBadge(p({ discount_percent: 15 })).text, '-15%')
  assert.equal(formatPromotionBadge(p({ benefit_type: 'fixed_discount', fixed_discount_amount: 5 })).text, '-5')
  assert.equal(formatPromotionBadge(p({ benefit_type: 'free_delivery' })).text, 'LIVRAISON OFFERTE')
  assert.equal(formatPromotionBadge(p({ benefit_type: 'gift_product' })).text, 'CADEAU OFFERT')
})
