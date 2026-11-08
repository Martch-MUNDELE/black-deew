// BLAC-P3-065 : aides pures pour l'envoi de position du livreur (intervalle et charge utile).
export const TRACKING_INTERVAL_MS = 15000

export function shouldSendPosition(
  lastSentAt: number | null | undefined,
  now: number,
  minIntervalMs: number = TRACKING_INTERVAL_MS
): boolean {
  if (lastSentAt === null || lastSentAt === undefined || !Number.isFinite(lastSentAt)) return true
  return now - lastSentAt >= minIntervalMs
}

export type PositionPayload = {
  delivery_id: string
  lat: number
  lng: number
  accuracy?: number
}

export function buildPositionPayload(
  deliveryId: string,
  coords: { latitude: number; longitude: number; accuracy?: number | null } | null | undefined
): PositionPayload | null {
  if (!coords) return null
  const { latitude, longitude, accuracy } = coords
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  const payload: PositionPayload = { delivery_id: deliveryId, lat: latitude, lng: longitude }
  if (typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0) {
    payload.accuracy = accuracy
  }
  return payload
}
