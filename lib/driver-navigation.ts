// BLAC-P3-063 : liens d'itineraire (Google Maps, Waze, Plans, Android) vers l'adresse du client.
// Fonction pure : adresse ecrite en priorite, sinon coordonnees valides (secours), sinon null.
// Raison : les coordonnees enregistrees a la commande sont instables, l'adresse ecrite fait foi.

export type NavigationLinks = {
  google: string
  waze: string
  apple: string
  android: string
  /**
   * Vaut true UNIQUEMENT quand les liens sont construits a partir des coordonnees,
   * c'est-a-dire en secours quand l'adresse ecrite est vide et que lat/lng sont valides.
   * Vaut false des que les liens partent de l'adresse ecrite, meme si des coordonnees existent.
   */
  hasCoords: boolean
}

function toCoord(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return NaN
  if (typeof value === 'string') {
    if (value.trim() === '') return NaN
    return Number(value)
  }
  if (typeof value === 'number') return value
  return NaN
}

export function buildNavigationLinks(input: {
  address?: string | null
  lat?: number | string | null
  lng?: number | string | null
}): NavigationLinks | null {
  const lat = toCoord(input?.lat)
  const lng = toCoord(input?.lng)
  const hasCoords =
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  const address = String(input?.address ?? '').trim()

  if (!address && hasCoords) {
    const pair = `${lat},${lng}`
    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${pair}&travelmode=driving`,
      waze: `https://waze.com/ul?ll=${pair}&navigate=yes`,
      apple: `https://maps.apple.com/?daddr=${pair}&dirflg=d`,
      android: `geo:${pair}?q=${pair}`,
      hasCoords: true,
    }
  }

  if (!address) return null

  const encoded = encodeURIComponent(address)
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`,
    waze: `https://waze.com/ul?q=${encoded}&navigate=yes`,
    apple: `https://maps.apple.com/?daddr=${encoded}&dirflg=d`,
    android: `geo:0,0?q=${encoded}`,
    hasCoords: false,
  }
}
