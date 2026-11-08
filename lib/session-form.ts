/**
 * Helpers purs du formulaire « Ouvrir une session » (admin > Livreurs).
 * Règle : un champ vide vaut 0, l'admin n'a jamais à saisir 0.
 */

/**
 * Fonds d'ouverture.
 * - chaîne vide ou espaces => 0
 * - nombre valide >= 0 (virgule décimale acceptée) => ce nombre
 * - sinon (négatif, non numérique) => null
 */
export function parseOpeningCash(raw: string): number | null {
  const value = (raw ?? '').trim().replace(',', '.')
  if (value === '') return 0
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(value)) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Quantités chargées par produit.
 * Vide, 0, négatif, décimal ou non numérique => ignoré ; entiers > 0 gardés.
 */
export function parseOpeningLoads(
  loads: Record<string, string>
): { product_id: string; quantity: number }[] {
  const result: { product_id: string; quantity: number }[] = []
  for (const [product_id, raw] of Object.entries(loads ?? {})) {
    const value = (raw ?? '').trim()
    if (!/^\d+$/.test(value)) continue
    const quantity = Number(value)
    if (Number.isSafeInteger(quantity) && quantity > 0) {
      result.push({ product_id, quantity })
    }
  }
  return result
}
