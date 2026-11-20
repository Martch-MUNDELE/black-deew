// BLAC-ADMIN-SIGNALEMENTS : ecran admin des signalements livreurs (logique pure + lecture du texte, sans reseau).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const lib = await import('../lib/delivery-reports-admin.ts')
const {
  canAccessReports, sortReports, filterReports, countOpenReports, parseReportFilter,
  isReportAction, decisionFor, buildDecisionUpdate, canApply, REPORT_ACTIONS, decisionLabel,
} = lib

const mk = (id, status, created_at) => ({ id, status, created_at })

test('fichiers livres : page, route, panneau, lib', () => {
  for (const p of [
    'app/admin/signalements/page.tsx',
    'app/api/admin/delivery-reports/[id]/route.ts',
    'components/admin/SignalementsPanel.tsx',
    'lib/delivery-reports-admin.ts',
  ]) assert.ok(existsSync(new URL('../' + p, import.meta.url)), p)
})

test('acces : admin et super admin autorises, livreur et autres refuses', () => {
  assert.equal(canAccessReports('admin'), true)
  for (const r of ['driver', 'none', '', null, undefined]) assert.equal(canAccessReports(r), false, String(r))
})

test('page : getAdminRole, refus du livreur (redirection) et de none', () => {
  const src = read('app/admin/signalements/page.tsx')
  assert.match(src, /getAdminRole\s*\(/)
  assert.match(src, /canAccessReports\s*\(/)
  assert.match(src, /DRIVER_HOME/)
  assert.match(src, /ACCESS_DENIED_REDIRECT/)
  assert.ok(src.indexOf('canAccessReports(') > -1 && src.indexOf('canAccessReports(') < src.indexOf('await loadRows()'), 'le controle de role precede la lecture des donnees')
  assert.doesNotMatch(src, /^'use client'|^"use client"/m)
})

test('route : requireAdmin avant toute lecture ou ecriture, 401/403 repris tels quels', () => {
  const src = read('app/api/admin/delivery-reports/[id]/route.ts')
  assert.match(src, /requireAdmin\(\)/)
  assert.match(src, /check\.status/)
  const first = src.indexOf('requireAdmin()')
  assert.ok(first > -1 && first < src.indexOf(".from('delivery_reports')"))
  assert.ok(src.lastIndexOf('requireAdmin()') > src.indexOf('export async function PATCH'))
})

test('liste : ouverts d abord, puis traites, du plus recent au plus ancien', () => {
  const sorted = sortReports([
    mk('c', 'closed', '2026-11-19T10:00:00Z'),
    mk('o1', 'open', '2026-11-18T10:00:00Z'),
    mk('h', 'handled', '2026-11-19T12:00:00Z'),
    mk('o2', 'open', '2026-11-19T09:00:00Z'),
  ])
  assert.deepEqual(sorted.map(r => r.id), ['o2', 'o1', 'h', 'c'])
})

test('filtre ouverts / tous', () => {
  const rows = [mk('a', 'open', '1'), mk('b', 'handled', '2'), mk('c', 'closed', '3')]
  assert.equal(filterReports(rows, 'open').length, 1)
  assert.equal(filterReports(rows, 'all').length, 3)
  assert.equal(parseReportFilter('all'), 'all')
  for (const v of [undefined, '', 'open', 'x', null]) assert.equal(parseReportFilter(v), 'open')
})

test('chaque action met a jour le bon statut et la bonne decision', () => {
  assert.deepEqual(decisionFor('acknowledge'), { status: 'handled', decision: 'acknowledged' })
  assert.deepEqual(decisionFor('close'), { status: 'closed', decision: 'closed' })
  const now = new Date('2026-11-19T12:00:00Z')
  const u = buildDecisionUpdate('acknowledge', 'admin@exemple.test', now)
  assert.deepEqual(u, { status: 'handled', handled_at: '2026-11-19T12:00:00.000Z', handled_by: 'admin@exemple.test', handled_decision: 'acknowledged' })
  const c = buildDecisionUpdate('close', 'admin@exemple.test', now)
  assert.equal(c.status, 'closed')
  assert.equal(c.handled_decision, 'closed')
})

test('route : applique buildDecisionUpdate sur delivery_reports avec garde de statut', () => {
  const src = read('app/api/admin/delivery-reports/[id]/route.ts')
  assert.match(src, /buildDecisionUpdate\(action, check\.email\)/)
  assert.match(src, /\.update\(update\)/)
  assert.match(src, /\.eq\('status', currentStatus\)/)
  assert.match(src, /status: 409/)
})

test('regles de transition : un signalement clos est final, prendre en compte seulement si ouvert', () => {
  assert.equal(canApply('acknowledge', 'open'), true)
  assert.equal(canApply('acknowledge', 'handled'), false)
  assert.equal(canApply('close', 'open'), true)
  assert.equal(canApply('close', 'handled'), true)
  assert.equal(canApply('close', 'closed'), false)
  assert.equal(canApply('acknowledge', 'closed'), false)
})

test('actions refusees : reassign et new_slot ne sont pas livrees', () => {
  assert.equal(isReportAction('reassign'), false)
  assert.equal(isReportAction('new_slot'), false)
  assert.equal(isReportAction('acknowledge'), true)
  assert.equal(isReportAction('close'), true)
  assert.deepEqual(REPORT_ACTIONS.map(a => a.label), ['Prendre en compte', 'Clore'])
  assert.match(read('app/api/admin/delivery-reports/[id]/route.ts'), /Action non disponible/)
})

test('aucune action ne touche au stock ni a l argent : seule la table delivery_reports est ecrite', () => {
  for (const p of ['app/api/admin/delivery-reports/[id]/route.ts', 'lib/delivery-reports-admin.ts']) {
    const src = read(p).replace(/^\s*\/\/.*$/gm, '')
    const tables = [...src.matchAll(/\.from\('([a-z_]+)'\)/g)].map(m => m[1])
    for (const t of tables) assert.equal(t, 'delivery_reports', p + ' : ' + t)
    assert.doesNotMatch(src, /stock|amount_|driver_cash|ledger|delivery_slots|order_deliveries|\.rpc\(|\.delete\(|\.insert\(/i, p)
  }
  const update = buildDecisionUpdate('close', 'a@b.test')
  assert.deepEqual(Object.keys(update).sort(), ['handled_at', 'handled_by', 'handled_decision', 'status'])
})

test('pastille : nombre de signalements ouverts', () => {
  assert.equal(countOpenReports([]), 0)
  assert.equal(countOpenReports([mk('a', 'open', '1'), mk('b', 'handled', '2'), mk('c', 'open', '3'), mk('d', 'closed', '4')]), 2)
})

test('navigation : lien Signalements apres Livreurs, pastille alimentee par open-count', () => {
  const nav = read('components/admin/AdminNavClient.tsx')
  assert.match(nav, /\/admin\/signalements/)
  assert.match(nav, /label: "Signalements"/)
  assert.match(nav, /badgeCount: openReportsCount/)
  assert.match(nav, /\/api\/admin\/delivery-reports\/open-count/)
  assert.ok(nav.includes('l.href === "/admin/livreurs"'))
  const route = read('app/api/admin/delivery-reports/[id]/route.ts')
  assert.match(route, /export async function GET/)
  assert.match(route, /id !== 'open-count'/)
  assert.match(route, /\.eq\('status', 'open'\)/)
})

test('panneau : textes en francais, boutons issus des actions livrees', () => {
  const src = read('components/admin/SignalementsPanel.tsx')
  assert.match(src, /REPORT_ACTIONS/)
  assert.match(src, /Aucun signalement à afficher/)
  assert.match(src, /Précisions/)
  assert.match(src, /Adresse/)
  assert.match(src, /Livreur/)
  assert.match(src, /Client/)
  assert.equal(decisionLabel('acknowledged'), 'Pris en compte')
  assert.equal(decisionLabel('closed'), 'Clos')
})

test('boutons Appeler du livreur : fichiers livreur non modifies par ce ticket', () => {
  // Controle de portee : l ecran admin n importe rien de l espace livreur.
  const src = read('app/admin/signalements/page.tsx') + read('components/admin/SignalementsPanel.tsx')
  assert.doesNotMatch(src, /driver-space|DriverDelivery|tel:/)
})
