// BLAC-P3-043 : lignes de lecture de la fenêtre « Clôturer la session » (contrôle sur le texte des fichiers, sans réseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const read = (rel) => readFileSync(join(here, rel), 'utf8')

const dialog = read('../components/DriverCloseDialog.tsx')
const page = read('../app/admin/livreurs/page.tsx')
const ledger = read('../lib/driver-ledger.ts')

test('la fenêtre déclare la prop collected (nombre) et la reçoit', () => {
  assert.match(dialog, /collected:\s*number/)
  assert.match(dialog, /cashOnHand,\s*\n\s*collected,\s*\n\s*netToRemit,/)
})

test('les trois libellés sont présents dans l\'ordre', () => {
  const a = dialog.indexOf('Monnaie en main')
  const b = dialog.indexOf('Encaissé auprès des clients')
  const c = dialog.indexOf('Net à remettre', b)
  assert.ok(a !== -1, 'Monnaie en main absent')
  assert.ok(b > a, 'Encaissé auprès des clients doit suivre Monnaie en main')
  assert.ok(c > b, 'Net à remettre doit suivre Encaissé auprès des clients')
})

test('la précision « à répartir en rendu et gardé » est affichée', () => {
  assert.ok(dialog.includes('à répartir en rendu et gardé'))
})

test('l\'ancien libellé « Argent sur le livreur » a disparu', () => {
  assert.ok(!dialog.includes('Argent sur le livreur'))
})

test('le bloc affiche cashOnHand, collected et netToRemit', () => {
  const start = dialog.indexOf('data-testid="driver-close-summary"')
  assert.ok(start !== -1)
  const zone = dialog.slice(start, start + 2500)
  assert.ok(zone.includes('cashOnHand.toFixed(0)'))
  assert.ok(zone.includes('collected.toFixed(0)'))
  assert.ok(zone.includes('netToRemit.toFixed(0)'))
})

test('le style reste dans la palette de la fenêtre', () => {
  assert.ok(dialog.includes('#C8B99A'))
  assert.ok(dialog.includes('#F5EDD6'))
  assert.ok(dialog.includes('#1A1610'))
})

test('page.tsx passe collected={closeCtx.collected} à la fenêtre', () => {
  const i = page.indexOf('<DriverCloseDialog')
  assert.ok(i !== -1)
  const bloc = page.slice(i, page.indexOf('/>', i))
  assert.ok(bloc.includes('collected={closeCtx.collected}'))
  assert.ok(bloc.includes('cashOnHand={closeCtx.cashOnHand}'))
  assert.ok(bloc.includes('netToRemit={closeCtx.netToRemit}'))
})

test('la règle de calcul de lib/driver-ledger.ts est intacte', () => {
  assert.ok(ledger.includes('netToRemit: given + collected - driverFees'))
  assert.ok(ledger.includes('cashOnHand: given - returned - kept'))
})

test('les montants préremplis et l\'écriture de clôture sont inchangés', () => {
  assert.ok(dialog.includes('useState(String(cashOnHand))'))
  assert.ok(dialog.includes("useState('0')"))
  assert.ok(dialog.includes('buildClosingMovements({ cashOnHand, stockOnHand, decisions })'))
  assert.ok(dialog.includes('netToRemit: netToRemit - written.cashKept'))
})

test('BLAC-P3-044 : la ligne au-dessus de Rendu / Gardé s\'appelle « Répartir la monnaie en main » avec sa valeur', () => {
  assert.ok(dialog.includes('Répartir la monnaie en main : {cashOnHand.toFixed(0)} {currency}'))
  const l = dialog.indexOf('Répartir la monnaie en main')
  const rendu = dialog.indexOf('>Rendu<', l)
  const garde = dialog.indexOf('>Gardé pour demain<', l)
  assert.ok(l !== -1 && rendu > l && garde > rendu, 'ordre : libellé, Rendu, Gardé pour demain')
})

test('BLAC-P3-044 : plus de doublon « Monnaie en main : N », le libellé du bloc de trois lignes est unique', () => {
  assert.ok(!dialog.includes('>Monnaie en main : {'))
  assert.equal(dialog.split('>Monnaie en main<').length - 1, 1)
})
