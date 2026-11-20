// BLAC-SIGNALER-PROBLEME : validation, route (lecture du texte, sans reseau), composant et cablage.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const { REPORT_KINDS, REPORT_NOTE_MAX, isValidReportKind, validateReportNote, reportKindLabel } = await import('../lib/delivery-reports.ts')

const KINDS = ['address_not_found','customer_unreachable','customer_refused','amount_mismatch','product_damaged','breakdown_delay','insufficient_stock','cannot_continue','other']

test('lib/delivery-reports.ts : les 9 types sont declares', () => {
  const src = read('lib/delivery-reports.ts')
  for (const k of KINDS) assert.ok(src.includes("'" + k + "'"), k)
  assert.equal(REPORT_KINDS.length, 9)
})

test('isValidReportKind : accepte les 9 types', () => {
  for (const k of KINDS) assert.equal(isValidReportKind(k), true, k)
})

test('isValidReportKind : refuse un kind inconnu ou un type non texte', () => {
  for (const bad of ['', 'inconnu', 'OTHER', ' other', null, undefined, 42, {}, []]) {
    assert.equal(isValidReportKind(bad), false, String(bad))
  }
})

test('reportKindLabel : libelles francais, repli sur la valeur brute', () => {
  assert.equal(reportKindLabel('insufficient_stock'), 'Stock insuffisant')
  assert.equal(reportKindLabel('xyz'), 'xyz')
})

test('validateReportNote : facultative, limite 500 caracteres', () => {
  assert.deepEqual(validateReportNote(undefined), { ok: true, note: null })
  assert.deepEqual(validateReportNote(null), { ok: true, note: null })
  assert.deepEqual(validateReportNote('   '), { ok: true, note: null })
  assert.deepEqual(validateReportNote('  porte fermee '), { ok: true, note: 'porte fermee' })
  assert.equal(validateReportNote('a'.repeat(REPORT_NOTE_MAX)).ok, true)
  assert.equal(validateReportNote('a'.repeat(REPORT_NOTE_MAX + 1)).ok, false)
  assert.equal(validateReportNote(123).ok, false)
})

test('migration : table, RLS activee, aucune policy', () => {
  const sql = read('supabase/migrations/20261119_bd_delivery_reports.sql')
  assert.match(sql, /create table if not exists public\.delivery_reports/)
  assert.match(sql, /enable row level security/)
  assert.doesNotMatch(sql, /create policy/i)
  assert.ok(existsSync(new URL('../supabase/migrations/20261119_bd_delivery_reports.sql', import.meta.url)))
})

test('route : 401, 403 (non livreur), 400 (livraison / kind / note), dans le bon ordre', () => {
  const src = read('app/api/driver/report-problem/route.ts')
  assert.match(src, /getAdminRole\(\)/)
  assert.match(src, /info\.role !== 'driver'/)
  assert.match(src, /isValidReportKind\(/)
  assert.match(src, /validateReportNote\(/)
  assert.ok(src.indexOf('status: 401') < src.indexOf('status: 403'))
  assert.ok(src.indexOf('status: 403') < src.indexOf('status: 400'))
  assert.match(src, /info\.driver\.id/)
})

test('route : 403 si la course est celle d un autre livreur (filtre driver_id de la session)', () => {
  const src = read('app/api/driver/report-problem/route.ts')
  assert.match(src, /\.from\('order_deliveries'\)/)
  assert.match(src, /\.eq\('driver_id', driverId\)/)
  assert.match(src, /if \(!delivery\)[\s\S]{0,200}status: 403/)
  assert.doesNotMatch(src, /payload\??\.driver_id/)
})

test('route : 409 si un signalement ouvert existe deja (et doublon d index unique)', () => {
  const src = read('app/api/driver/report-problem/route.ts')
  assert.match(src, /\.eq\('status', 'open'\)/)
  assert.match(src, /status: 409/)
  assert.match(src, /23505/)
})

test('route : 503 propre si la table est absente, aucune exception ne sort', () => {
  const src = read('app/api/driver/report-problem/route.ts')
  assert.match(src, /42P01/)
  assert.match(src, /PGRST205/)
  assert.match(src, /status: 503/)
  assert.match(src, /export async function POST[\s\S]*try \{[\s\S]*\} catch \{/)
})

test('route : ne modifie JAMAIS le statut de la livraison ni le stock', () => {
  // Commentaires ignores : seul le code compte
  const src = read('app/api/driver/report-problem/route.ts').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  assert.doesNotMatch(src, /\.update\(/)
  assert.doesNotMatch(src, /\.delete\(/)
  assert.doesNotMatch(src, /\.upsert\(/)
  assert.doesNotMatch(src, /from\('orders'\)/)
  assert.doesNotMatch(src, /stock/i)
  assert.doesNotMatch(src, /nextStatusOn/)
  const inserts = src.match(/\.insert\(/g) ?? []
  assert.equal(inserts.length, 1)
  assert.match(src, /\.from\('delivery_reports'\)\s*\.insert\(/)
})

test('composant : libelles, confirmation, cibles tactiles >= 44 px, types de la lib', () => {
  const src = read('components/driver/DriverReportProblem.tsx')
  assert.match(src, /Signaler un problème/)
  assert.match(src, /Signalement envoyé/)
  assert.match(src, /REPORT_KINDS/)
  assert.match(src, /Précisions \(facultatif\)/)
  assert.match(src, /\/api\/driver\/report-problem/)
  const heights = [...src.matchAll(/minHeight: (\d+)/g)].map((m) => Number(m[1]))
  assert.ok(heights.length > 0)
  for (const h of heights) assert.ok(h >= 44, 'minHeight ' + h)
})

test('detail : bouton sous Accepter (non acceptee) et sous Marquer comme livree (acceptee), Appeler conserve', () => {
  const src = read('components/driver/DriverDeliveryDetail.tsx')
  assert.match(src, /import DriverReportProblem from '@\/components\/driver\/DriverReportProblem'/)
  assert.equal((src.match(/<DriverReportProblem /g) ?? []).length, 2)
  const accept = src.indexOf('<DriverAcceptDelivery ')
  const markDelivered = src.indexOf('<DriverMarkDelivered ')
  const reports = [...src.matchAll(/<DriverReportProblem /g)].map((m) => m.index)
  assert.ok(accept < reports[0] && reports[0] < markDelivered)
  assert.ok(markDelivered < reports[1])
  // BLAC-DETAIL-ERGONOMIE : Appeler quitte le bas de page et passe sur la carte client (CallLink)
  assert.match(src, /<CallLink href=\{telHref\} phone=\{delivery\.customerPhone\} \/>/)
  assert.doesNotMatch(src, /CallButton/)
})
