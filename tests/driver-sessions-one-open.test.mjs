// BLAC-P3-042 : la migration de l'index unique « une session ouverte par livreur » est lue comme texte (aucune base, aucun réseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '..', 'supabase', 'migrations', '20261107_bd_driver_sessions_one_open.sql')

const raw = fs.readFileSync(file, 'utf8')
// SQL sans commentaires de ligne, en minuscules, espaces normalisés
const sql = raw
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

test('l en-tête indique que la migration est déjà appliquée à la main le 7 novembre 2026', () => {
  assert.match(raw, /déjà appliquée à la main le 7 novembre 2026/i)
})

test('crée un index unique', () => {
  assert.match(sql, /create unique index/)
})

test('idempotent : if not exists', () => {
  assert.match(sql, /create unique index if not exists driver_sessions_one_open_per_driver/)
})

test('sur la table public.driver_sessions, colonne driver_id', () => {
  assert.match(sql, /on public\.driver_sessions \(driver_id\)/)
})

test("clause partielle where session_status = 'open'", () => {
  assert.match(sql, /where session_status = 'open'/)
})

test('une seule instruction SQL', () => {
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean)
  assert.equal(statements.length, 1)
})

test('aucune instruction destructrice (drop, delete, truncate, update)', () => {
  for (const word of ['drop', 'delete', 'truncate', 'update']) {
    assert.ok(!new RegExp(`\\b${word}\\b`).test(sql), `instruction interdite : ${word}`)
  }
})
