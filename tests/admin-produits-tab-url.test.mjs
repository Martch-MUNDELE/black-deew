import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../app/admin/produits/page.tsx', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../components/admin/AdminNav.tsx', import.meta.url), 'utf8')

test('le menu envoie un onglet que la page lit', () => {
  for (const t of ['actifs', 'inactifs', 'vip']) assert.ok(nav.includes('/admin/produits?tab=' + t))
  assert.match(page, /useSearchParams/)
  assert.match(page, /searchParams\.get\('tab'\)/)
})

test('les pastilles mettent aussi l adresse à jour', () => {
  assert.match(page, /router\.replace\('\/admin\/produits\?tab=' \+ t\)/)
})
