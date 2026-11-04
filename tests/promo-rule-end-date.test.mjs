// BLAC-P3-026 : ends_at des promotions dans les listes de campagne et de scénarios.
// Base simulée en mémoire, aucune vraie base, aucune écriture.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

await import('./helpers/env.mjs')
const { runCampaignsAction } = await import('../lib/campaigns.ts')
const { runClientOffersAction } = await import('../lib/client-offers.ts')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const admin = { ok: true }

// Base simulée : promotion_rules selon les colonnes demandées, autres tables vides.
function fakeDb({ failWithEnds = false, rows }) {
  const selects = []
  return {
    selects,
    from(table) {
      if (table !== 'promotion_rules') {
        const empty = { data: [], error: null }
        const chain = new Proxy({}, {
          get: (_t, prop) => {
            if (prop === 'then') return (res, rej) => Promise.resolve(empty).then(res, rej)
            return () => chain
          },
        })
        return chain
      }
      return {
        select(cols) {
          selects.push(cols)
          const hasEnd = String(cols).includes('ends_at')
          return {
            eq: () => Promise.resolve(
              hasEnd && failWithEnds
                ? { data: null, error: { message: 'column ends_at does not exist' } }
                : { data: rows.map((r) => (hasEnd ? r : { id: r.id, name: r.name, status: r.status })), error: null },
            ),
          }
        },
      }
    },
  }
}

const ROWS = [
  { id: 'r1', name: 'Promo avec fin', status: 'active', ends_at: '2026-12-31T00:00:00.000Z' },
  { id: 'r2', name: 'Promo sans fin', status: 'active', ends_at: null },
]

async function campaignRules(db) {
  const r = await runCampaignsAction({ check: admin, db, method: 'GET' })
  return r.body.rules
}
async function offerRules(db) {
  const r = await runClientOffersAction({ check: admin, db, method: 'GET', rules: true })
  return r.body.rules
}

for (const [label, get] of [['campaigns', campaignRules], ['client-offers', offerRules]]) {
  test(`${label} : ends_at est renvoyé, null si vide, id et name inchangés`, async () => {
    const db = fakeDb({ rows: ROWS })
    const rules = await get(db)
    assert.ok(Array.isArray(rules))
    assert.match(db.selects[0], /ends_at/)
    assert.deepEqual(rules, [
      { id: 'r1', name: 'Promo avec fin', ends_at: '2026-12-31T00:00:00.000Z' },
      { id: 'r2', name: 'Promo sans fin', ends_at: null },
    ])
  })

  test(`${label} : une erreur avec ends_at retombe sur l'ancienne lecture`, async () => {
    const db = fakeDb({ rows: ROWS, failWithEnds: true })
    const rules = await get(db)
    assert.equal(db.selects.length, 2)
    assert.doesNotMatch(db.selects[1], /ends_at/)
    assert.deepEqual(rules, [
      { id: 'r1', name: 'Promo avec fin' },
      { id: 'r2', name: 'Promo sans fin' },
    ])
  })
}

test('la colonne ends_at existe dans promotion_rules (migration du dépôt)', () => {
  const sql = read('supabase/migrations/20261031_bd_promotion_rules.sql')
  assert.match(sql, /create table[^;]*promotion_rules/i)
  assert.match(sql, /ends_at\s+timestamptz/)
})

test('ScenariosPanel contient l\'avertissement promo-no-end-warning-scenarios', () => {
  const panel = read('components/admin/ScenariosPanel.tsx')
  assert.match(panel, /data-testid="promo-no-end-warning-scenarios"/)
  assert.match(panel, /ends_at\?: string \| null/)
  assert.match(panel, /noEndWarning\(value\)/)
  assert.match(panel, /n'a pas de date de fin/)
})
