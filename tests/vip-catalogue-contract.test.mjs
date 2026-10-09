// Test de contrat sur le code source (pas de jsdom dans le projet) : verifie les garde-fous du chargement du catalogue VIP.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const page = read('app/(public)/vip/page.tsx')
const card = read('components/PopularVipCard.tsx')
const gate = read('components/VipAccessGate.tsx')
test('plus de fetch qui transforme une reponse non OK en liste vide', () => {
  for (const src of [page, card]) {
    assert.ok(!/r\.ok \? .*: \[\]/.test(src))
    assert.match(src, /res\.status === 401 \|\| res\.status === 403/)
    assert.match(src, /status: 'unauthorized'/)
    assert.match(src, /status: 'error'/)
  }
})
test('la page ne charge le catalogue qu apres acces et relance sur reloadKey / grantedOk', () => {
  assert.match(page, /if \(!grantedOk\) return/)
  assert.match(page, /\[items, supabase, grantedOk, reloadKey\]/)
  assert.match(page, /onGranted=\{\(\) => setGrantedOk\(true\)\}/)
})
test('erreur de chargement distincte de la liste vide, avec bouton Reessayer', () => {
  assert.match(page, /loadError &&/)
  assert.match(page, /Réessayer/)
  assert.match(page, /!loading && !loadError && products\.length === 0/)
  assert.match(page, /Aucun produit disponible/)
})
test('session expiree : la page revoque l acces et la porte revient au portail', () => {
  assert.match(page, /setRevokeToken\(\(t\) => t \+ 1\)/)
  assert.match(gate, /revokeToken/)
  assert.match(gate, /setGranted\(false\)/)
})
test('la porte notifie onGranted quand granted devient vrai', () => {
  assert.match(gate, /onGranted\?: \(\) => void/)
  assert.match(gate, /if \(granted\) onGrantedRef\.current\?\.\(\)/)
})
