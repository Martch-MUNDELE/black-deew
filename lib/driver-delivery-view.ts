// BLAC-ECRAN-COURSE-MAQUETTE : fonctions pures de mise en forme de l'ecran de detail d'une course.
export type HeaderBadgeTone = 'gold' | 'green' | 'alert'
export type HeaderBadge = { label: string; tone: HeaderBadgeTone }

export type StepState = 'done' | 'current' | 'upcoming'
export type DeliveryStep = { label: 'Acceptée' | 'En route' | 'Livrée'; state: StepState }

export type StockItemInput = { name: string; quantity: number }
export type StockBalanceInput = { name: string; onHand: number }
export type StockNoteLine = { name: string; onHand: number; enough: boolean }

function normStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase()
}

function normName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

export function headerBadge(status: string | null | undefined): HeaderBadge {
  switch (normStatus(status)) {
    case 'picked_up':
      return { label: 'En route', tone: 'green' }
    case 'delivered':
      return { label: 'Livrée', tone: 'green' }
    case 'cancelled':
      return { label: 'Annulée', tone: 'alert' }
    default:
      // assigned, pending et tout statut inconnu : la course reste a accepter
      return { label: 'À accepter', tone: 'gold' }
  }
}

export function steps(status: string | null | undefined): DeliveryStep[] {
  switch (normStatus(status)) {
    case 'picked_up':
      return [
        { label: 'Acceptée', state: 'done' },
        { label: 'En route', state: 'current' },
        { label: 'Livrée', state: 'upcoming' },
      ]
    case 'delivered':
      return [
        { label: 'Acceptée', state: 'done' },
        { label: 'En route', state: 'done' },
        { label: 'Livrée', state: 'done' },
      ]
    default:
      return []
  }
}

// Une ligne par article present dans les soldes ; les articles absents des soldes sont ignores.
export function stockNote(items: StockItemInput[], balances: StockBalanceInput[]): StockNoteLine[] {
  const byName = new Map<string, StockBalanceInput>()
  for (const b of balances) byName.set(normName(b.name), b)
  const lines: StockNoteLine[] = []
  for (const item of items) {
    const balance = byName.get(normName(item.name))
    if (!balance) continue
    lines.push({ name: item.name, onHand: balance.onHand, enough: balance.onHand >= item.quantity })
  }
  return lines
}
