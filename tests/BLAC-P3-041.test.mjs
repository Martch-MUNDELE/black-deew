// BLAC-P3-041 : le rapport BLAC-LIVREURS-SESSION-DOUBLE_REPORT.md contient les requêtes de vérification en lecture seule
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FENCE = '`'.repeat(3)
const reportPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'BLAC-LIVREURS-SESSION-DOUBLE_REPORT.md')
const text = readFileSync(reportPath, 'utf8')
const lines = text.split(/\r?\n/)

// Seuls les blocs sql ouverts ET fermés sont retenus
function closedSqlBlocks() {
  const blocks = []
  let current = null
  for (const line of lines) {
    const t = line.trim()
    if (current === null) {
      if (t === FENCE + 'sql') current = []
    } else if (t === FENCE) {
      blocks.push(current.join('\n'))
      current = null
    } else {
      current.push(line)
    }
  }
  return blocks
}

const blocks = closedSqlBlocks()

test('le nombre de balises de bloc de code est pair', () => {
  const fences = lines.filter((l) => l.trim().startsWith(FENCE))
  assert.ok(fences.length > 0)
  assert.equal(fences.length % 2, 0)
})

test('deux blocs sql fermés, chacun contenant une requête select', () => {
  assert.equal(blocks.length, 2)
  for (const b of blocks) assert.match(b, /^\s*select\b/i)
})

test('les requêtes portent sur driver_sessions avec session_status = \'open\'', () => {
  for (const b of blocks) {
    assert.match(b, /driver_sessions/)
    assert.match(b, /session_status = 'open'/)
  }
})

test('les blocs sql sont en lecture seule (aucune écriture)', () => {
  for (const b of blocks) assert.doesNotMatch(b, /\b(insert|update|delete|drop|alter|truncate)\b/i)
})

test('la phrase lecture seule / décision manuelle de Martial est présente', () => {
  assert.match(text, /lecture seule/)
  assert.match(text, /à la main par Martial/)
})
