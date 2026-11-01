// BLAC-P2-014 : tests phase 2 du module Promotions (lancer avec node --test)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { selectPublicPromotions } = await import('../lib/promotion-rules.ts')
const { checkPromoCodeUsage, findPromoCodeRule } = await import('../lib/promotions.ts')
const { hasAdminPermission } = await import('../lib/admin/permissions.ts')
const { getRolePermissions } = await import('../lib/admin/roles.ts')

const NOW = new Date('2026-10-31T12:00:00Z').getTime()
const base = (o = {}) => ({
  id: 'r1', name: 'Promo', status: 'active', scope: 'all', trigger_type: 'cart_amount',
  benefit_type: 'percent_discount', discount_percent: 10, minimum_order_amount: 100,
  customer_message: 'Message client', admin_note: 'NOTE SECRETE', promotion_mode: 'automatic',
  code: null, usage_limit_total: 5, usage_count: 2, benefits: [], ...o,
})

test('route publique : aucun champ sensible exposé', () => {
  const out = selectPublicPromotions([base(), base({ id: 'r2', promotion_mode: 'promo_code', code: 'SECRET10' })], NOW)
  assert.equal(out.length, 1)
  const json = JSON.stringify(out)
  for (const forbidden of ['admin_note', 'NOTE SECRETE', 'SECRET10', 'code', 'usage_limit', 'usage_count']) {
    assert.ok(!json.includes(forbidden), `champ interdit présent : ${forbidden}`)
  }
  assert.deepEqual(Object.keys(out[0]).sort(), ['benefit_type', 'customer_message', 'discount_percent', 'id', 'minimum_order_amount', 'minimum_quantity', 'name', 'scope'])
})

test('règle expirée, future ou brouillon absente de la route publique', () => {
  const out = selectPublicPromotions([
    base({ id: 'exp', ends_at: '2026-10-01T00:00:00Z' }),
    base({ id: 'fut', starts_at: '2026-12-01T00:00:00Z' }),
    base({ id: 'dra', status: 'draft' }),
    base({ id: 'ok', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-12-01T00:00:00Z' }),
  ], NOW)
  assert.deepEqual(out.map((r) => r.id), ['ok'])
})

test('limite d\'usage atteinte : code refusé avec message clair', () => {
  const rule = base({ id: 'c1', promotion_mode: 'promo_code', code: 'BIENVENUE', usage_limit_total: 3, usage_count: 3 })
  const found = findPromoCodeRule([rule], ' bienvenue ')
  assert.equal(found.id, 'c1')
  const res = checkPromoCodeUsage(found)
  assert.equal(res.ok, false)
  assert.match(res.error, /épuisé/)
})

test('limite d\'usage non atteinte ou absente : code accepté', () => {
  assert.equal(checkPromoCodeUsage(base({ usage_limit_total: 3, usage_count: 2 })).ok, true)
  assert.equal(checkPromoCodeUsage(base({ usage_limit_total: null, usage_count: 999 })).ok, true)
  assert.equal(checkPromoCodeUsage(null).ok, true)
})

test('lien admin Promotions : présent dans le groupe CONFIGURATION, icône pourcentage, filtré par permission', () => {
  const src = readFileSync(new URL('../components/admin/AdminNav.tsx', import.meta.url), 'utf8')
  assert.match(src, /href: "\/admin\/promotions", label: "Promotions", icon: "percent", permission: "promotions"/)
  assert.ok(src.indexOf('label: "CONFIGURATION"') < src.indexOf('/admin/promotions'))
  assert.ok(src.indexOf('/admin/promotions') < src.indexOf('label: "FACTURATION"'))
  assert.match(src, /hasAdminPermission\(permissions, key, "view"\)/)
  assert.equal(hasAdminPermission(getRolePermissions('owner'), 'promotions', 'view'), true)
  assert.equal(hasAdminPermission({ promotions: [] }, 'promotions', 'view'), false)
  assert.equal(hasAdminPermission(null, 'promotions', 'view'), false)
})

const { previewPublicPromotions } = await import('../lib/promotions.ts')

test('aperçu client : prix final indicatif et seuil non atteint', () => {
  const promos = [{ id: 'a', name: 'A', customer_message: null, benefit_type: 'percent_discount', discount_percent: 10, minimum_order_amount: 100, minimum_quantity: null }]
  const ok = previewPublicPromotions(promos, 200, 2)[0]
  assert.equal(ok.eligible, true)
  assert.equal(ok.discount, 20)
  assert.equal(ok.finalPrice, 180)
  const ko = previewPublicPromotions(promos, 60, 1)[0]
  assert.equal(ko.eligible, false)
  assert.equal(ko.discount, 0)
  assert.equal(ko.missingAmount, 40)
})
