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

// BLAC-DETAIL-ERGONOMIE : libelles selon l'etat de la course (livree = passe, annulee = neutre).
export function collectLabel(status: string | null | undefined): string {
  switch (normStatus(status)) {
    case 'delivered':
      return 'Encaissé'
    case 'cancelled':
      return 'Montant'
    default:
      return 'À encaisser'
  }
}

export function deliverLabel(status: string | null | undefined): string {
  switch (normStatus(status)) {
    case 'delivered':
      return 'Livré'
    case 'cancelled':
      return 'Articles'
    default:
      return 'À livrer'
  }
}

// Barre d'action fixe : 'accept' (course non acceptee), 'deliver' (acceptee), null (livree ou annulee).
export type ActionBarKind = 'accept' | 'deliver' | null
export function actionBarKind(status: string | null | undefined): ActionBarKind {
  switch (normStatus(status)) {
    case 'picked_up':
      return 'deliver'
    case 'delivered':
    case 'cancelled':
      return null
    default:
      return 'accept'
  }
}

// Itineraire : application adaptee a l'appareil (iPhone/iPad = Plans Apple, Android = lien Android, autre = Google Maps).
export type NavigationTarget = 'apple' | 'android' | 'google'
export function detectNavigationTarget(input: { userAgent?: string | null; maxTouchPoints?: number | null }): NavigationTarget {
  const ua = input.userAgent ?? ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'apple'
  // iPadOS se presente comme un Mac avec ecran tactile
  if (/Macintosh/i.test(ua) && (input.maxTouchPoints ?? 0) > 1) return 'apple'
  if (/Android/i.test(ua)) return 'android'
  return 'google'
}

// Lisibilite des petites etiquettes : taille minimale et contraste sur le fond des cartes.
export const LABEL_FONT_SIZE = 12
export const LABEL_COLOR = '#BFAF8F'
export const CARD_BG = '#15110B'

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
