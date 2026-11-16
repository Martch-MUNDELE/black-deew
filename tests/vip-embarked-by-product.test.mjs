// BLAC-P3-057 : stock embarque chez les livreurs, affiche en lecture seule sur admin > Produits.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const { embarkedByProduct } = await import('../lib/vip-embarked-by-product.ts')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pageSrc = readFileSync(join(root, 'app/admin/produits/page.tsx'), 'utf8')

test('deux livreurs avec le meme produit => somme', () => {
  const r = embarkedByProduct([
    { driver_id: 'd1', driver_name: 'A', balances: [{ product_id: 'p1', onHand: 3 }, { product_id: 'p2', onHand: 1 }] },
    { driver_id: 'd2', driver_name: 'B', balances: [{ product_id: 'p1', onHand: 4 }] },
  ])
  assert.equal(r.p1, 7)
  assert.equal(r.p2, 1)
})

test('solde negatif, nul ou invalide ignore', () => {
  const r = embarkedByProduct([
    { balances: [{ product_id: 'p1', onHand: -5 }, { product_id: 'p2', onHand: 0 }, { product_id: 'p3', onHand: Number.NaN }, { product_id: 'p4', onHand: 'x' }] },
    { balances: [{ product_id: 'p1', onHand: 2 }] },
  ])
  assert.equal(r.p1, 2)
  assert.ok(!('p2' in r) && !('p3' in r) && !('p4' in r))
})

test('produit absent => pas de cle', () => {
  const r = embarkedByProduct([{ balances: [{ product_id: 'p1', onHand: 2 }] }])
  assert.equal('p9' in r, false)
  assert.equal(r.p9, undefined)
})

test('entree null, undefined ou [] => {}', () => {
  assert.deepEqual(embarkedByProduct(null), {})
  assert.deepEqual(embarkedByProduct(undefined), {})
  assert.deepEqual(embarkedByProduct([]), {})
  assert.deepEqual(embarkedByProduct([null, { balances: null }]), {})
})

test('la page utilise loadOpenDriverStock + embarkedByProduct et affiche le libelle seulement si N > 0', () => {
  assert.match(pageSrc, /loadOpenDriverStock/)
  assert.match(pageSrc, /embarkedByProduct/)
  assert.match(pageSrc, /embarqués chez les livreurs/)
  assert.match(pageSrc, /> ?0/)
})

test('la page n appelle aucune ecriture sur le journal des livreurs', () => {
  assert.doesNotMatch(pageSrc, /driver_stock_movements/)
  assert.doesNotMatch(pageSrc, /from\(\s*['"]driver_[a-z_]+['"]\s*\)\s*\.(insert|update|upsert|delete)/)
  assert.doesNotMatch(pageSrc, /(recordMovement|appendMovement|insertMovement|saveLedger)/)
})
