// BLAC-P3-058 : le livreur accepte (prend en charge) une course avant de la livrer.
export type AcceptTransition =
  | { ok: false; reason: string }
  | { ok: true; already: true }
  | { ok: true; status: 'picked_up'; already?: false }

export function nextStatusOnAccept(status: unknown): AcceptTransition {
  const state = String(status ?? '').trim().toLowerCase()
  if (state === 'delivered') return { ok: false, reason: 'Livraison deja livree' }
  if (state === 'cancelled') return { ok: false, reason: 'Livraison annulee' }
  if (state === 'picked_up') return { ok: true, already: true }
  return { ok: true, status: 'picked_up' }
}
