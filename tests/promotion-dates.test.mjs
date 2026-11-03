// BLAC-P2-015 : dates de début et de fin dans le formulaire des promotions
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const {
  PROMOTION_TIMEZONE_OFFSET,
  dateToStartIso,
  dateToEndIso,
  isoToDateInput,
  addDays,
  endOfMonth,
  daysBetween,
  durationLabel,
  formatEndDateFr,
} = await import('@/lib/promotion-dates')

const pageText = readFileSync(new URL('../app/admin/promotions/page.tsx', import.meta.url), 'utf8')

test('décalage du site : +01:00', () => {
  assert.equal(PROMOTION_TIMEZONE_OFFSET, '+01:00')
})

test('dateToStartIso et dateToEndIso : valeurs exactes', () => {
  assert.equal(dateToStartIso('2026-11-03'), '2026-11-03T00:00:00+01:00')
  assert.equal(dateToEndIso('2026-11-30'), '2026-11-30T23:59:59+01:00')
  assert.equal(dateToStartIso(''), null)
  assert.equal(dateToEndIso(''), null)
  assert.equal(dateToStartIso('2026-13-40'), null)
  assert.equal(dateToEndIso('pas-une-date'), null)
})

test('aller-retour isoToDateInput', () => {
  for (const d of ['2026-11-03', '2028-02-29', '2026-12-31', '2027-01-01']) {
    assert.equal(isoToDateInput(dateToStartIso(d)), d)
    assert.equal(isoToDateInput(dateToEndIso(d)), d)
  }
  assert.equal(isoToDateInput('2026-11-30T22:59:59Z'), '2026-11-30')
  assert.equal(isoToDateInput('2026-11-30T23:30:00Z'), '2026-12-01')
  assert.equal(isoToDateInput(null), '')
  assert.equal(isoToDateInput(undefined), '')
  assert.equal(isoToDateInput(''), '')
  assert.equal(isoToDateInput('n importe quoi'), '')
})

test('addDays', () => {
  assert.equal(addDays('2026-11-03', 6), '2026-11-09')
  assert.equal(addDays('2026-11-03', 29), '2026-12-02')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('invalide', 3), '')
})

test('endOfMonth, fin février bissextile comprise', () => {
  assert.equal(endOfMonth('2026-11-03'), '2026-11-30')
  assert.equal(endOfMonth('2026-12-15'), '2026-12-31')
  assert.equal(endOfMonth('2026-02-10'), '2026-02-28')
  assert.equal(endOfMonth('2028-02-10'), '2028-02-29')
  assert.equal(endOfMonth('2100-02-01'), '2100-02-28')
  assert.equal(endOfMonth('2026-04-30'), '2026-04-30')
  assert.equal(endOfMonth(''), '')
})

test('daysBetween (bornes incluses)', () => {
  assert.equal(daysBetween('2026-11-03', '2026-11-30'), 28)
  assert.equal(daysBetween('2026-11-03', '2026-11-03'), 1)
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 3)
  assert.equal(daysBetween('2026-11-10', '2026-11-03'), -6)
  assert.equal(daysBetween('', '2026-11-03'), null)
})

test('libellé de durée en français', () => {
  assert.equal(durationLabel('2026-11-03', '2026-11-30'), 'Active pendant 28 jours')
  assert.equal(durationLabel('2026-11-03', '2026-11-03'), 'Active pendant 1 jour')
  assert.equal(durationLabel('2026-11-10', '2026-11-03'), null)
  assert.equal(durationLabel('', '2026-11-03'), null)
})

test('formatEndDateFr', () => {
  assert.equal(formatEndDateFr('2026-11-30'), '30 novembre 2026 à 23 h 59')
  assert.equal(formatEndDateFr('2027-01-01'), '1er janvier 2027 à 23 h 59')
  assert.equal(formatEndDateFr('2026-08-15'), '15 août 2026 à 23 h 59')
  assert.equal(formatEndDateFr(''), '')
})

test('page.tsx : champs, boutons et payload', () => {
  assert.match(pageText, /Période de validité/)
  assert.match(pageText, /type="date"/)
  assert.match(pageText, /Début/)
  assert.match(pageText, /\bFin\b/)
  assert.match(pageText, /7 jours/)
  assert.match(pageText, /30 jours/)
  assert.match(pageText, /Jusqu'à fin de mois/)
  assert.match(pageText, /Sans date de fin/)
  assert.match(pageText, /dateToStartIso\(/)
  assert.match(pageText, /dateToEndIso\(/)
  assert.match(pageText, /starts_at:\s*dateToStartIso\(/)
  assert.match(pageText, /ends_at:\s*dateToEndIso\(/)
  assert.match(pageText, /Sans date de fin : elle reste active tant qu'elle est active/)
  assert.match(pageText, /Dans le panier, elle cesse de s'appliquer le/)
  assert.match(pageText, /date de fin doit être/i)
})
