import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const RAPPORT = '/Users/martch/PROJECTS_APPLI/black-deew/reports/BLAC-LIVREURS-EMBARQUABLE_REPORT.md'
const ID = '36362ca1-77f6-404e-8b79-f87e3a0c98e1'
const texte = readFileSync(RAPPORT, 'utf8')
const blocs = [...texte.matchAll(/```sql\n([\s\S]*?)\n```/g)].map((m) => m[1])

test('le rapport contient la requête select de l\'étape 2 dans un bloc sql fermé', () => {
  const attendu = `select id, name, is_vip, driver_carryable from public.products where id = '${ID}';`
  assert.ok(blocs.some((b) => b.trim() === attendu))
})

test('le rapport contient driver_carryable = false dans un bloc sql fermé', () => {
  const attendu = `update public.products set driver_carryable = false where id = '${ID}';`
  assert.ok(blocs.some((b) => b.includes('driver_carryable = false') && b.trim() === attendu))
})

test('les blocs de code sont tous fermés (nombre pair de balises)', () => {
  const n = (texte.match(/^```/gm) || []).length
  assert.equal(n % 2, 0)
})

test('étape 2 avant étape 3, chacune suivie de son bloc', () => {
  const i2 = texte.indexOf('2. Contrôler la ligne visée')
  const iSel = texte.indexOf('select id, name, is_vip')
  const i3 = texte.indexOf('3. Passer le service')
  const iUpd = texte.indexOf('driver_carryable = false')
  assert.ok(i2 > -1 && i2 < iSel && iSel < i3 && i3 < iUpd)
})
