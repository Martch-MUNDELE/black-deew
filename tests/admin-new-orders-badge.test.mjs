// BLAC-PASTILLE-COMMANDES : pastille des nouvelles commandes (barre laterale bureau, menu mobile, temps reel).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../components/admin/AdminNavClient.tsx', import.meta.url), 'utf8')
const { applyOrderEvent, newOrderCountOf } = await import('../lib/admin-new-orders.ts')

function between(a, b) {
  const i = src.indexOf(a)
  const j = src.indexOf(b)
  assert.ok(i >= 0 && j > i, 'repere introuvable : ' + a + ' / ' + b)
  return src.slice(i, j)
}
const desktop = between('SIDEBAR DESKTOP', 'HEADER MOBILE')
const drawer = between('Dropdown mobile', 'BOTTOM BAR MOBILE')
const bottom = src.slice(src.indexOf('BOTTOM BAR MOBILE'))

test('barre laterale bureau : pastille sur le lien Commandes, a droite du libelle, avant le chevron, seulement si compteur > 0', () => {
  const re = /link\.href === "\/admin\/commandes" && newOrderCount > 0 && \(\s*<span className="bd-sidebar-badge">\{newOrderCount\}<\/span>\s*\)\}\s*<ChevronDown/
  assert.match(desktop, re)
  assert.ok(desktop.indexOf('{link.label}</span>') < desktop.search(re))
})

test('barre laterale bureau : pastille sur le sous-lien Nouvelles (/admin/commandes?tab=nouvelle) si compteur > 0', () => {
  assert.match(desktop, /sub\.url === "\/admin\/commandes\?tab=nouvelle" && newOrderCount > 0 && \(\s*<span className="bd-sidebar-badge">\{newOrderCount\}<\/span>/)
})

test('la pastille est absente a zero : toute occurrence est gardee par newOrderCount > 0', () => {
  const uses = [...src.matchAll(/\{newOrderCount\}/g)]
  assert.equal(uses.length, 4)
  for (const m of uses) {
    const before = src.slice(Math.max(0, m.index - 520), m.index)
    assert.match(before, /newOrderCount > 0 &&/)
  }
})

test('menu deroulant mobile : pastille sur le lien Commandes, avant le chevron', () => {
  assert.match(drawer, /link\.href === "\/admin\/commandes" && newOrderCount > 0 && \(\s*<span className="bd-sidebar-badge"[^>]*>\{newOrderCount\}<\/span>\s*\)\}\s*<ChevronDown/)
})

test('barre du bas mobile : rendu conserve (pastille jaune inline sur Commandes, pastille VIP inchangee)', () => {
  assert.ok(bottom.includes('{link.href === "/admin/commandes" && newOrderCount > 0 && ('))
  assert.ok(bottom.includes('style={{ position: "absolute", top: -6, right: -8, background: "#F5C842", color: "#000", borderRadius: 9, minWidth: 16, height: 16, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{newOrderCount}</span>'))
  assert.ok(bottom.includes('{isVip && pendingVipCount > 0 && ('))
  assert.ok(!bottom.includes('bd-sidebar-badge'))
})

test('ecoute temps reel : tous les evenements de la table orders passent par la logique pure', () => {
  assert.match(src, /event: "\*", schema: "public", table: "orders"/)
  assert.match(src, /applyOrderEvent\(prevOrderIds\.current/)
  assert.match(src, /setNewOrderCount\(next\.size\)/)
})

test('logique pure : INSERT ajoute', () => {
  const s = applyOrderEvent(new Set(), { eventType: 'INSERT', new: { id: 'a', status: 'nouvelle' } })
  assert.deepEqual([...s], ['a'])
  assert.equal(newOrderCountOf(s), 1)
})

test('logique pure : INSERT en double sans effet', () => {
  const s0 = new Set(['a'])
  const s = applyOrderEvent(s0, { eventType: 'INSERT', new: { id: 'a', status: 'nouvelle' } })
  assert.equal(newOrderCountOf(s), 1)
})

test('logique pure : UPDATE hors nouvelle retire', () => {
  const s = applyOrderEvent(new Set(['a', 'b']), { eventType: 'UPDATE', new: { id: 'a', status: 'confirmee' }, old: { id: 'a' } })
  assert.deepEqual([...s], ['b'])
})

test('logique pure : UPDATE vers nouvelle ajoute (restauration), sans doublon', () => {
  let s = applyOrderEvent(new Set(), { eventType: 'UPDATE', new: { id: 'a', status: 'nouvelle' } })
  assert.equal(newOrderCountOf(s), 1)
  s = applyOrderEvent(s, { eventType: 'UPDATE', new: { id: 'a', status: 'nouvelle' } })
  assert.equal(newOrderCountOf(s), 1)
})

test('logique pure : DELETE retire', () => {
  const s = applyOrderEvent(new Set(['a', 'b']), { eventType: 'DELETE', old: { id: 'b' } })
  assert.deepEqual([...s], ['a'])
})

test('logique pure : jamais negatif et ensemble d origine non mute', () => {
  const s0 = new Set()
  let s = applyOrderEvent(s0, { eventType: 'DELETE', old: { id: 'x' } })
  s = applyOrderEvent(s, { eventType: 'UPDATE', new: { id: 'x', status: 'livree' } })
  s = applyOrderEvent(s, { eventType: 'DELETE', old: {} })
  assert.equal(newOrderCountOf(s), 0)
  const s1 = new Set(['a'])
  applyOrderEvent(s1, { eventType: 'DELETE', old: { id: 'a' } })
  assert.equal(s1.size, 1)
})
