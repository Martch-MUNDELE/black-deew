// Lecture seule : total embarque chez les livreurs (session ouverte) par produit.
// Fonction pure : ne modifie ni le stock du catalogue ni le journal des livreurs.

export type EmbarkedBalance = { product_id?: unknown; onHand?: unknown }
export type EmbarkedDriver = { balances?: EmbarkedBalance[] | null } | null | undefined

export function embarkedByProduct(
  drivers: ReadonlyArray<EmbarkedDriver> | null | undefined
): Record<string, number> {
  const totals: Record<string, number> = {}
  if (!Array.isArray(drivers)) return totals
  for (const driver of drivers) {
    const balances = driver && Array.isArray(driver.balances) ? driver.balances : []
    for (const b of balances) {
      if (!b || b.product_id === null || b.product_id === undefined) continue
      const n = typeof b.onHand === 'number' ? b.onHand : Number.NaN
      if (!Number.isFinite(n) || n <= 0) continue
      const key = String(b.product_id)
      totals[key] = (totals[key] || 0) + n
    }
  }
  return totals
}
