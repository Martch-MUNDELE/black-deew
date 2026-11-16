import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync('app/admin/livreurs/page.tsx', 'utf8')
const start = src.indexOf('async function handleOpenSession')
const end = src.indexOf('async function startOpening')
const fn = src.slice(start, end)

test('handleOpenSession est localisee', () => {
  assert.ok(start > 0 && end > start)
})

test("handleOpenSession appelle fetch('/api/admin/open-driver-session' en POST", () => {
  assert.ok(fn.includes("fetch('/api/admin/open-driver-session'"))
  assert.match(fn, /method:\s*'POST'/)
  assert.match(fn, /'Content-Type':\s*'application\/json'/)
  assert.match(fn, /credentials:\s*'same-origin'/)
})

test('handleOpenSession ne contient plus openSessionWithLedger(', () => {
  assert.ok(!fn.includes('openSessionWithLedger('))
  assert.ok(!src.includes('openSessionWithLedger'))
})

test('le champ error de la reponse est repris dans le message', () => {
  assert.match(fn, /data\.error/)
  assert.match(fn, /openError\s*=/)
  assert.ok(fn.includes('Ouverture impossible'))
  assert.match(fn, /setSessionError\(openError\)/)
})

test('parseOpeningCash et parseOpeningLoads sont toujours utilises', () => {
  assert.match(fn, /parseOpeningCash\(openingCash\)/)
  assert.match(fn, /parseOpeningLoads\(openLoads\)/)
  assert.match(fn, /Montant invalide/)
})

test('updateDriverStatus(sessionDriver.id, "active") appele apres ouverture reussie', () => {
  const iErr = fn.indexOf('if (openError)')
  const iUpd = fn.indexOf('updateDriverStatus(sessionDriver.id, "active")')
  assert.ok(iErr > 0 && iUpd > iErr)
  assert.ok(fn.includes('openingRef.current'))
  assert.ok(fn.includes('setSessionLoading'))
  assert.ok(fn.includes('void load()'))
})
