// BLAC-P3-012 : declencheurs de promotion coherents avec le perimetre
import test from 'node:test'
import assert from 'node:assert/strict'

const {
  PROMOTION_TRIGGERS_BY_SCOPE,
  getAllowedTriggers,
  isTriggerAllowedForScope,
  getDefaultTriggerForScope,
} = await import('@/lib/promotion-triggers')
const { validatePromotionRule } = await import('@/lib/promotion-rules')

const ALL = ['cart_amount', 'cart_quantity', 'classic_purchase', 'vip_purchase', 'mixed_purchase', 'product', 'category']
const EXPECTED = {
  all: ALL,
  classic: ['cart_amount', 'cart_quantity', 'classic_purchase', 'product', 'category'],
  vip: ['cart_amount', 'cart_quantity', 'vip_purchase', 'product', 'category'],
  mixed: ['cart_amount', 'cart_quantity', 'mixed_purchase', 'product', 'category'],
}

test('(a) liste exacte des declencheurs permis par perimetre', () => {
  assert.deepEqual(Object.keys(PROMOTION_TRIGGERS_BY_SCOPE).sort(), Object.keys(EXPECTED).sort())
  for (const [scope, list] of Object.entries(EXPECTED)) {
    assert.deepEqual([...getAllowedTriggers(scope)].sort(), [...list].sort(), `perimetre ${scope}`)
  }
})

test('(a) perimetre inconnu : aucun declencheur', () => {
  assert.deepEqual([...getAllowedTriggers('inconnu')], [])
  assert.equal(isTriggerAllowedForScope('inconnu', 'cart_amount'), false)
})

test('(b) combinaisons incoherentes refusees', () => {
  const refused = [
    ['vip', 'classic_purchase'], ['vip', 'mixed_purchase'],
    ['classic', 'vip_purchase'], ['classic', 'mixed_purchase'],
    ['mixed', 'classic_purchase'], ['mixed', 'vip_purchase'],
  ]
  for (const [scope, trigger] of refused) {
    assert.equal(isTriggerAllowedForScope(scope, trigger), false, `${scope} + ${trigger}`)
  }
  assert.equal(isTriggerAllowedForScope('vip', 'vip_purchase'), true)
  assert.equal(isTriggerAllowedForScope('classic', 'classic_purchase'), true)
  assert.equal(isTriggerAllowedForScope('mixed', 'mixed_purchase'), true)
  for (const t of ALL) assert.equal(isTriggerAllowedForScope('all', t), true)
})

test('(c) declencheur par defaut = montant quand l ancien n est plus permis', () => {
  assert.equal(getDefaultTriggerForScope('vip', 'classic_purchase'), 'cart_amount')
  assert.equal(getDefaultTriggerForScope('classic', 'mixed_purchase'), 'cart_amount')
  assert.equal(getDefaultTriggerForScope('mixed', 'vip_purchase'), 'cart_amount')
  assert.equal(getDefaultTriggerForScope('vip'), 'cart_amount')
  assert.equal(getDefaultTriggerForScope('vip', 'product'), 'product')
})

test('(d) validation serveur : regle incoherente refusee en francais', () => {
  const res = validatePromotionRule({ scope: 'vip', trigger_type: 'classic_purchase', benefit_type: 'free_delivery' })
  assert.equal(res.ok, false)
  assert.ok(res.errors.some((e) => /declencheur/i.test(e) && /perimetre/i.test(e)), res.errors.join(' | '))
})

test('(d) validation serveur : regle valide acceptee', () => {
  for (const [scope, list] of Object.entries(EXPECTED)) {
    for (const trigger of list) {
      const res = validatePromotionRule({ scope, trigger_type: trigger, benefit_type: 'free_delivery' })
      assert.equal(res.ok, true, `${scope} + ${trigger} : ${res.errors.join(' | ')}`)
    }
  }
})

test('(d) validation serveur : regle sans perimetre ni declencheur inchangee', () => {
  assert.equal(validatePromotionRule({ benefit_type: 'free_delivery' }).ok, true)
})
