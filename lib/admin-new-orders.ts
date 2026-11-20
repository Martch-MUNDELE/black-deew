// BLAC-PASTILLE-COMMANDES : logique pure de suivi des commandes au statut "nouvelle".
// L'ensemble d'identifiants est la source de verite ; le compteur = taille de l'ensemble
// (donc jamais negatif, jamais de doublon).

export const NEW_ORDER_STATUS = "nouvelle";

export type OrderRealtimeEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: { id?: string; status?: string } | null;
  old?: { id?: string; status?: string } | null;
};

export function applyOrderEvent(
  current: ReadonlySet<string>,
  evt: OrderRealtimeEvent,
): Set<string> {
  const next = new Set(current);
  if (evt.eventType === "DELETE") {
    const id = evt.old?.id;
    if (id) next.delete(id);
    return next;
  }
  const row = evt.new;
  const id = row?.id;
  if (!row || !id) return next;
  if (evt.eventType === "INSERT") {
    if (row.status === undefined || row.status === NEW_ORDER_STATUS) next.add(id);
    return next;
  }
  if (row.status === undefined) return next;
  if (row.status === NEW_ORDER_STATUS) next.add(id);
  else next.delete(id);
  return next;
}

export function newOrderCountOf(ids: ReadonlySet<string>): number {
  return ids.size;
}
