// BLAC-P3-048 : logique pure de l'accueil livreur (sans dependance Next ni Supabase).
// Statuts reels de order_deliveries (lus dans le code existant) :
//   'assigned' (creation depuis la page Commandes), 'pending' (filtre de la page Livreurs),
//   'delivered' (app/api/mark-livree), 'cancelled' (app/api/update-order-status).

export type DriverDelivery = {
  id: string
  orderId: string | null
  status: string
  customerName: string
  customerPhone: string | null
  address: string | null
  lat: number | null
  lng: number | null
  slotDate: string | null
  slotStart: string | null
  slotEnd: string | null
  amountToCollect: number
  amountCollected: number
  deliveredAt: string | null
}

export type DriverStockLine = {
  productId: string
  name: string
  onHand: number
  level: 'low' | 'empty' | null
}

export type DriverSessionInfo = {
  id: string
  startedAt: string
  openingCash: number
}

export type DriverCashInfo = {
  given: number
  collected: number
  driverFees: number
  netToRemit: number
}

export type DriverLastSession = {
  startedAt: string
  closedAt: string | null
  deliveriesCount: number
  collected: number
  driverFees: number
  netToRemit: number
}

export type DriverHomeData = {
  driver: { id: string; fullName: string | null }
  session: DriverSessionInfo | null
  cash: DriverCashInfo | null
  lastSession: DriverLastSession | null
  stock: DriverStockLine[]
  deliveries: DriverDelivery[]
  generatedAt: string
}

const CANCELLED_STATUSES = ['cancelled', 'canceled']

/** A faire = tout statut non termine et non annule ; deja livrees = 'delivered' ; les annulees sont ecartees. */
export function splitDeliveries<T extends { status: string | null | undefined }>(
  items: T[]
): { todo: T[]; done: T[] } {
  const todo: T[] = []
  const done: T[] = []
  for (const item of items) {
    const status = String(item.status ?? '').trim().toLowerCase()
    if (status === 'delivered') done.push(item)
    else if (CANCELLED_STATUSES.includes(status)) continue
    else todo.push(item)
  }
  return { todo, done }
}

function hhmm(value: string | null | undefined): string {
  if (!value) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value).trim())
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

/** "HH:MM – HH:MM" ; si les heures manquent, la date en jj/mm ; sinon chaine vide. */
export function formatSlot(
  date: string | null | undefined,
  timeStart: string | null | undefined,
  timeEnd: string | null | undefined
): string {
  const s = hhmm(timeStart)
  const e = hhmm(timeEnd)
  if (s && e) return `${s} \u2013 ${e}`
  if (s || e) return s || e
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date ?? ''))
  return d ? `${d[3]}/${d[2]}` : ''
}

/** Lien Google Maps : lat/lng si fournis, sinon l'adresse, sinon null. */
export function buildMapsUrl(input: {
  address?: string | null
  lat?: number | string | null
  lng?: number | string | null
}): string | null {
  const lat = input.lat === null || input.lat === undefined || input.lat === '' ? NaN : Number(input.lat)
  const lng = input.lng === null || input.lng === undefined || input.lng === '' ? NaN : Number(input.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  }
  const address = String(input.address ?? '').trim()
  if (address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
  return null
}

/** Lien tel: avec un numero nettoye (chiffres et + initial uniquement), ou null. */
export function buildTelUrl(phone: string | null | undefined): string | null {
  const raw = String(phone ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  return `tel:${raw.startsWith('+') ? '+' : ''}${digits}`
}

/** Initiale en majuscule du nom ('L' si le nom est vide). */
export function initialOf(name: string | null | undefined): string {
  const first = Array.from(String(name ?? '').trim())[0]
  return first ? first.toLocaleUpperCase('fr-FR') : 'L'
}

const TIME_ZONE = 'Africa/Kinshasa'

/** "HH:MM" dans le fuseau de Kinshasa (rendu identique serveur et navigateur). */
export function formatTimeOfDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

/** "7 nov." dans le fuseau de Kinshasa. */
export function formatDayShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' }).format(d)
}

export function formatMoney(amount: number | null | undefined): string {
  const n = Number(amount)
  const safe = Number.isFinite(n) ? n : 0
  return `${safe.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
}
