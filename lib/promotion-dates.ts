// BLAC-P2-015 : dates de début et de fin des promotions (logique pure, sans dépendance)

// Décalage horaire propre au site Black Deew : heure de Kinshasa (UTC+1, sans heure d'été).
// Il n'est pas celui de la machine de l'administrateur : les bornes d'une promotion
// sont toujours exprimées dans le fuseau du site.
export const PROMOTION_TIMEZONE_OFFSET = '+01:00'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000
const OFFSET_MS = 60 * 60 * 1000 // +01:00

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function parseDate(date: string | null | undefined): number | null {
  if (!date) return null
  const match = DATE_RE.exec(date)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const ms = Date.UTC(y, m - 1, d)
  const check = new Date(ms)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null
  return ms
}

function formatDate(ms: number): string {
  const d = new Date(ms)
  const y = String(d.getUTCFullYear()).padStart(4, '0')
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** AAAA-MM-JJ -> début de journée avec le décalage du site (null si vide ou invalide). */
export function dateToStartIso(date: string | null | undefined): string | null {
  if (parseDate(date) === null) return null
  return `${date}T00:00:00${PROMOTION_TIMEZONE_OFFSET}`
}

/** AAAA-MM-JJ -> 23:59:59 avec le décalage du site (null si vide ou invalide). */
export function dateToEndIso(date: string | null | undefined): string | null {
  if (parseDate(date) === null) return null
  return `${date}T23:59:59${PROMOTION_TIMEZONE_OFFSET}`
}

/** ISO -> AAAA-MM-JJ (jour calendaire dans le fuseau du site) pour un champ date ; '' si absent ou invalide. */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ''
  return formatDate(time + OFFSET_MS)
}

/** Ajoute n jours (négatif permis) à une date AAAA-MM-JJ ; '' si la date est invalide. */
export function addDays(date: string, days: number): string {
  const ms = parseDate(date)
  if (ms === null) return ''
  return formatDate(ms + days * DAY_MS)
}

/** Dernier jour du mois de la date donnée ; '' si la date est invalide. */
export function endOfMonth(date: string): string {
  const ms = parseDate(date)
  if (ms === null) return ''
  const d = new Date(ms)
  return formatDate(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

/** Nombre de jours calendaires, bornes incluses (3 au 30 novembre = 28) ; null si une date est invalide. */
export function daysBetween(start: string, end: string): number | null {
  const a = parseDate(start)
  const b = parseDate(end)
  if (a === null || b === null) return null
  return Math.round((b - a) / DAY_MS) + 1
}

/** « Active pendant 28 jours » ; null si les dates sont invalides ou si la fin précède le début. */
export function durationLabel(start: string, end: string): string | null {
  const n = daysBetween(start, end)
  if (n === null || n < 1) return null
  return `Active pendant ${n} ${n === 1 ? 'jour' : 'jours'}`
}

/** « 30 novembre 2026 à 23 h 59 » pour une date de fin AAAA-MM-JJ ; '' si invalide. */
export function formatEndDateFr(date: string): string {
  const ms = parseDate(date)
  if (ms === null) return ''
  const d = new Date(ms)
  const day = d.getUTCDate() === 1 ? '1er' : String(d.getUTCDate())
  return `${day} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()} à 23 h 59`
}
