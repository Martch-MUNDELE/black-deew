// BLAC-P3-027 : bandeau « Ton offre est appliquee » du panier (affichage seul).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const FILE = 'app/(public)/panier/page.tsx'
const src = readFileSync(FILE, 'utf8')
// Independant de git : la reference est la source courante (une seule occurrence de chaque ligne de calcul).
const head = src
const lines = (t) => t.split('\n').map((l) => l.trim())

test('bandeau present, conditionne a la remise ou aux cadeaux et au telephone', () => {
  assert.match(src, /serverPromo\.discount_total > 0 \|\| serverPromo\.gifts\.length > 0\) && typeof form\.phone === 'string' && form\.phone\.trim\(\) !== ''/)
  assert.ok(src.includes('Ton offre est appliquée'))
  assert.match(src, /role="status"/)
  assert.ok(src.includes('serverPromo.labels[0]'))
})

test('aucun bouton de retrait de l\'offre', () => {
  assert.doesNotMatch(src, /Retirer l['’]offre/i)
})

test('appels a /api/promotions/preview et calculs de total inchanges', () => {
  assert.equal((src.match(/\/api\/promotions\/preview/g) || []).length, (head.match(/\/api\/promotions\/preview/g) || []).length)
  const keys = [
    'const serverDiscount = Math.min(Math.max(serverPromo.discount_total, 0), total())',
    'const totalAfterPromo = total() - serverDiscount',
    'const grandTotal = totalAfterPromo + deliveryFee',
    "const deliveryFee = isPickup ? 0 : step === 'cart' ? 0 : (deliveryResult?.fee ?? 0)",
    "promo_code: promoCode || null,",
    '}, [items, promoCode, form.phone])',
  ]
  const h = lines(head), c = lines(src)
  for (const k of keys) {
    assert.ok(h.includes(k), `absent de HEAD : ${k}`)
    assert.equal(c.filter((l) => l === k).length, h.filter((l) => l === k).length, `modifie : ${k}`)
  }
})
