// BLAC-CARTE-LIVRAISON : fonctions pures pour la carte de geolocalisation du detail de course.
// Aucune dependance reseau ni navigateur : testable directement.

export type LatLng = { lat: number; lng: number }
export type MapBounds = { south: number; west: number; north: number; east: number }
export type MapView =
  | { kind: 'point'; center: LatLng; zoom: number }
  | { kind: 'bounds'; bounds: MapBounds }

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION_TEXT = '© OpenStreetMap contributors'
export const OSM_ATTRIBUTION_HTML =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
export const OSM_MAX_ZOOM = 19
export const SINGLE_POINT_ZOOM = 16
export const MAP_HEIGHT_PX = 220

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < -90 || lat > 90) return false
  if (lng < -180 || lng > 180) return false
  if (lat === 0 && lng === 0) return false
  return true
}

export function toLatLng(lat: unknown, lng: unknown): LatLng | null {
  return isValidCoordinate(lat, lng) ? { lat: lat as number, lng: lng as number } : null
}

export function computeBounds(points: Array<LatLng | null | undefined>): MapBounds | null {
  const valid = points.filter((p): p is LatLng => !!p && isValidCoordinate(p.lat, p.lng))
  if (valid.length === 0) return null
  const lats = valid.map((p) => p.lat)
  const lngs = valid.map((p) => p.lng)
  return { south: Math.min(...lats), west: Math.min(...lngs), north: Math.max(...lats), east: Math.max(...lngs) }
}

// Vue a appliquer : un seul point (ou deux points confondus) -> centre + zoom ; sinon bornes des deux points.
export function computeView(destination: LatLng | null | undefined, driver?: LatLng | null): MapView | null {
  if (!destination || !isValidCoordinate(destination.lat, destination.lng)) return null
  const driverOk = driver && isValidCoordinate(driver.lat, driver.lng) ? driver : null
  if (!driverOk) return { kind: 'point', center: destination, zoom: SINGLE_POINT_ZOOM }
  const bounds = computeBounds([destination, driverOk])
  if (!bounds) return null
  if (bounds.south === bounds.north && bounds.west === bounds.east) {
    return { kind: 'point', center: destination, zoom: SINGLE_POINT_ZOOM }
  }
  return { kind: 'bounds', bounds }
}
