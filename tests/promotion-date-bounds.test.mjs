// BLAC-P2-016 : bornes de dates des promotions, memes regles pour le panier et la commande.
import test from 'node:test'
import assert from 'node:assert/strict'

const mod = await import('../lib/promotion-rules.ts')
const { isRuleActiveAt, selectPublicPromotions } = mod

const START = '2026-11-10T00:00:00.000Z'
const END = '2026-11-15T23:59:59.000Z'
const t = (iso) => new Date(iso).getTime()

function rule(extra = {}) {
  return {
    id: 'r1', name: 'Promo', status: 'active', promotion_mode: 'automatic', code: null,
    benefit_type: 'percent_discount', discount_percent: 10, scope: 'order',
    customer_message: null, minimum_order_amount: null, minimum_quantity: null,
    starts_at: null, ends_at: null, benefits: [], ...extra,
  }
}

test('isRuleActiveAt est exportee', () => {
  assert.equal(typeof isRuleActiveAt, 'function')
})

test('regle sans dates : active', () => {
  assert.equal(isRuleActiveAt(rule(), t('2026-01-01T00:00:00.000Z')), true)
})

test('avant le debut : inactive', () => {
  assert.equal(isRuleActiveAt(rule({ starts_at: START, ends_at: END }), t(START) - 1), false)
})

test('instant exact du debut : active', () => {
  assert.equal(isRuleActiveAt(rule({ starts_at: START, ends_at: END }), t(START)), true)
})

test('23:59:59 le jour de fin : active', () => {
  assert.equal(isRuleActiveAt(rule({ starts_at: START, ends_at: END }), t(END)), true)
})

test('une seconde apres la fin : inactive', () => {
  assert.equal(isRuleActiveAt(rule({ starts_at: START, ends_at: END }), t(END) + 1000), false)
})

test('debut seul', () => {
  const r = rule({ starts_at: START })
  assert.equal(isRuleActiveAt(r, t(START) - 1), false)
  assert.equal(isRuleActiveAt(r, t(START)), true)
  assert.equal(isRuleActiveAt(r, t('2030-01-01T00:00:00.000Z')), true)
})

test('fin seule', () => {
  const r = rule({ ends_at: END })
  assert.equal(isRuleActiveAt(r, t('2020-01-01T00:00:00.000Z')), true)
  assert.equal(isRuleActiveAt(r, t(END)), true)
  assert.equal(isRuleActiveAt(r, t(END) + 1000), false)
})

test('date invalide : meme verdict partout (pas de limite)', () => {
  const r = rule({ starts_at: 'pas-une-date' })
  const now = t(START)
  assert.equal(isRuleActiveAt(r, now), true)
  assert.equal(selectPublicPromotions([r], now).length, 1)
})

test('apercu public et regle de reference : meme resultat a chaque borne', () => {
  const cases = [rule(), rule({ starts_at: START, ends_at: END }), rule({ starts_at: START }), rule({ ends_at: END })]
  const instants = [t(START) - 1, t(START), t(END), t(END) + 1, t(END) + 1000]
  for (const r of cases) {
    for (const now of instants) {
      assert.equal(selectPublicPromotions([r], now).length === 1, isRuleActiveAt(r, now),
        `divergence a ${new Date(now).toISOString()} pour ${JSON.stringify({ s: r.starts_at, e: r.ends_at })}`)
    }
  }
})
