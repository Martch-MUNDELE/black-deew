// BLAC-P3-060 : suivi de livraison en direct. Fonctions pures (sans acces base).
import { randomBytes } from 'node:crypto'

export const TRACKING_TOKEN_LENGTH = 32
export const POSITION_MAX_AGE_MS = 120000

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/

/** 32 caracteres aleatoires url-safe (24 octets en base64url). */
export function generateTrackingToken(): string {
  return randomBytes(24).toString('base64url')
}

export function isValidTrackingToken(t: unknown): t is string {
  return typeof t === 'string' && TOKEN_RE.test(t)
}

export type PositionParse =
  | { ok: true; lat: number; lng: number; accuracy_m: number | null }
  | { ok: false; error: string }

export function parsePositionBody(body: unknown): PositionParse {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Corps invalide' }
  }
  const b = body as Record<string, unknown>
  const lat = b.lat
  const lng = b.lng
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: 'Latitude invalide' }
  }
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, error: 'Longitude invalide' }
  }
  let accuracy: number | null = null
  if (b.accuracy !== undefined && b.accuracy !== null) {
    if (typeof b.accuracy !== 'number' || !Number.isFinite(b.accuracy) || b.accuracy < 0) {
      return { ok: false, error: 'Precision invalide' }
    }
    accuracy = b.accuracy
  }
  return { ok: true, lat, lng, accuracy_m: accuracy }
}

function toMs(v: string | number | Date | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const ms = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v)
  return Number.isFinite(ms) ? ms : null
}

export function isPositionFresh(
  positionUpdatedAt: string | number | Date | null | undefined,
  now: string | number | Date = Date.now(),
  maxAgeMs: number = POSITION_MAX_AGE_MS
): boolean {
  const updated = toMs(positionUpdatedAt)
  const current = toMs(now)
  if (updated === null || current === null) return false
  const age = current - updated
  return age >= 0 && age <= maxAgeMs
}

export function buildTrackingUrl(origin: string, token: string): string {
  return origin + '/suivi/' + token
}

export type TrackingRow = {
  active?: boolean | null
  lat?: number | null
  lng?: number | null
  position_updated_at?: string | null
  [key: string]: unknown
}

export type PublicTrackingView = {
  active: boolean
  lat: number | null
  lng: number | null
  updated_at: string | null
  fresh: boolean
}

/** Vue publique : jamais delivery_id, driver_id ni token. */
export function publicTrackingView(row: TrackingRow, now: string | number | Date = Date.now()): PublicTrackingView {
  const hasPos = typeof row.lat === 'number' && typeof row.lng === 'number'
  return {
    active: row.active === true,
    lat: hasPos ? (row.lat as number) : null,
    lng: hasPos ? (row.lng as number) : null,
    updated_at: row.position_updated_at ?? null,
    fresh: hasPos && isPositionFresh(row.position_updated_at, now),
  }
}
