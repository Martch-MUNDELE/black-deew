import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const permissions = read('../lib/admin/permissions.ts')
const roles = read('../lib/admin/roles.ts')
const nav = read('../components/admin/AdminNav.tsx')
const page = read('../app/admin/marketing/page.tsx')

test('la section marketing existe dans permissions.ts, après promotions', () => {
  assert.match(permissions, /key: 'marketing', label: 'Marketing', path: '\/admin\/marketing', group: 'Configuration'/)
  assert.ok(permissions.indexOf("key: 'marketing'") > permissions.indexOf("key: 'promotions'"))
})

test('chacune des cinq tables de roles.ts contient marketing au même niveau que promotions', () => {
  const blocks = roles.match(/createAdminPermissionMap\(\{[\s\S]*?\n\}\)/g) ?? []
  assert.equal(blocks.length, 5)
  const expected = ['FULL', 'WRITE', 'READ', 'READ', 'READ']
  blocks.forEach((b, i) => {
    assert.match(b, /\n  marketing: /)
    assert.ok(b.includes('  promotions: ' + expected[i] + ','))
    assert.ok(b.includes('  marketing: ' + expected[i] + ','))
  })
})

test('AdminNav.tsx contient /admin/marketing avec permission marketing, après /admin/promotions', () => {
  const line = nav.split('\n').find((l) => l.includes('"/admin/marketing"'))
  assert.ok(line, 'ligne marketing absente')
  assert.match(line, /permission: "marketing"/)
  assert.match(line, /label: "Marketing"/)
  assert.ok(nav.indexOf('/admin/marketing') > nav.indexOf('/admin/promotions'))
})

test('la page marketing contient l état vide et la phrase d introduction', () => {
  assert.ok(page.includes("Aucune campagne pour l'instant"))
  assert.ok(page.includes('Envoie des offres aux clients VIP par WhatsApp, avec leur accord.'))
  assert.ok(page.includes('Marketing'))
})
