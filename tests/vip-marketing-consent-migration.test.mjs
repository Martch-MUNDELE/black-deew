import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const sqlPath = path.join(here, '..', 'supabase', 'migrations', '20261103_bd_vip_marketing_consent.sql')
const sql = readFileSync(sqlPath, 'utf8')
// Code SQL sans les lignes de commentaire (le retour arrière y est en commentaire)
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

test("l'en-tête NON APPLIQUÉE est présent en tête de fichier", () => {
  const head = sql.split('\n').slice(0, 5).join('\n')
  assert.match(head, /NON APPLIQUÉE : ne pas exécuter sans validation humaine/)
})

test('les trois colonnes sont ajoutées sur public.vip_access_requests', () => {
  assert.match(code, /alter table public\.vip_access_requests/i)
  for (const col of ['marketing_opt_in', 'marketing_opt_in_at', 'marketing_opt_in_source']) {
    assert.match(code, new RegExp(`add column if not exists ${col}\\b`, 'i'), col)
  }
})

test('les types sont boolean, timestamptz et text', () => {
  assert.match(code, /add column if not exists marketing_opt_in boolean/i)
  assert.match(code, /add column if not exists marketing_opt_in_at timestamptz/i)
  assert.match(code, /add column if not exists marketing_opt_in_source text/i)
})

test('aucune valeur par défaut ni not null sur marketing_opt_in', () => {
  const m = code.match(/add column if not exists marketing_opt_in boolean[^;]*;/i)
  assert.ok(m, 'déclaration de marketing_opt_in introuvable')
  assert.doesNotMatch(m[0], /default/i)
  assert.doesNotMatch(m[0], /not null/i)
  assert.doesNotMatch(code, /set default/i)
})

test('la contrainte limite la source à demande, encart, admin', () => {
  assert.match(code, /check\s*\(\s*marketing_opt_in_source in \('demande', 'encart', 'admin'\)\s*\)/i)
})

test('aucune instruction destructrice ou de droits hors commentaire', () => {
  for (const kw of ['drop', 'delete', 'truncate', 'grant', 'revoke', 'update', 'insert']) {
    assert.doesNotMatch(code, new RegExp(`\\b${kw}\\b`, 'i'), kw)
  }
})

test('le retour arrière est présent en commentaire seulement', () => {
  assert.match(sql, /^-- RETOUR ARRIÈRE \(non exécuté\)/m)
  assert.match(sql, /^-- {3}drop column if exists marketing_opt_in_source/m)
  assert.match(sql, /^-- {3}drop column if exists marketing_opt_in_at/m)
  assert.match(sql, /^-- {3}drop column if exists marketing_opt_in;$/m)
})

test('aucune mention de policy', () => {
  assert.doesNotMatch(sql, /polic(y|ies)/i)
})
