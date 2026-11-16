// BLAC-P3-059 : validation pure du corps de la route serveur « ouvrir une session livreur ».
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface OpenSessionLoad {
  product_id: string
  quantity: number
}

export interface OpenSessionBody {
  driver_id: string
  openingCash: number
  loads: OpenSessionLoad[]
}

export type ParseOpenSessionResult =
  | { ok: true; value: OpenSessionBody }
  | { ok: false; error: string }

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v.trim().replace(',', '.'))
  return NaN
}

export function parseOpenSessionBody(body: unknown): ParseOpenSessionResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Corps invalide' }
  }
  const raw = body as Record<string, unknown>

  const driverId = typeof raw.driver_id === 'string' ? raw.driver_id.trim() : ''
  if (!UUID_RE.test(driverId)) return { ok: false, error: 'Livreur invalide' }

  let openingCash = 0
  if (!isEmpty(raw.openingCash)) {
    const n = toNumber(raw.openingCash)
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Fonds de caisse invalide' }
    openingCash = n
  }

  const loads: OpenSessionLoad[] = []
  if (!isEmpty(raw.loads)) {
    if (!Array.isArray(raw.loads)) return { ok: false, error: 'Chargement invalide' }
    for (const item of raw.loads) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return { ok: false, error: 'Chargement invalide' }
      }
      const row = item as Record<string, unknown>
      // Quantite vide ou 0 : ligne ignoree
      if (isEmpty(row.quantity)) continue
      const q = toNumber(row.quantity)
      if (!Number.isFinite(q) || q < 0 || !Number.isInteger(q)) {
        return { ok: false, error: 'Quantite invalide' }
      }
      if (q === 0) continue
      const productId = typeof row.product_id === 'string' ? row.product_id.trim() : ''
      if (!UUID_RE.test(productId)) return { ok: false, error: 'Produit invalide' }
      loads.push({ product_id: productId, quantity: q })
    }
  }

  return { ok: true, value: { driver_id: driverId, openingCash, loads } }
}
