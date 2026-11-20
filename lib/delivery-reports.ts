// BLAC-SIGNALER-PROBLEME : types et validation purs des signalements de probleme livreur.
// Aucune dependance serveur : utilisable cote client comme cote route.

export const REPORT_NOTE_MAX = 500

export const REPORT_KINDS = [
  { value: 'address_not_found', label: 'Adresse introuvable ou fausse' },
  { value: 'customer_unreachable', label: 'Client injoignable ou absent' },
  { value: 'customer_refused', label: 'Client refuse ou conteste la commande' },
  { value: 'amount_mismatch', label: 'Montant différent ou client qui ne peut pas payer' },
  { value: 'product_damaged', label: 'Produit abîmé ou manquant' },
  { value: 'breakdown_delay', label: 'Panne, accident ou retard important' },
  { value: 'insufficient_stock', label: 'Stock insuffisant' },
  { value: 'cannot_continue', label: 'Je ne peux plus prendre la course' },
  { value: 'other', label: 'Autre' },
] as const

export type ReportKind = (typeof REPORT_KINDS)[number]['value']
export type ReportStatus = 'open' | 'handled' | 'closed'

export type DeliveryReport = {
  id: string
  delivery_id: string
  driver_id: string | null
  kind: ReportKind
  note: string | null
  status: ReportStatus
  created_at: string
  handled_at: string | null
  handled_by: string | null
  handled_decision: string | null
}

export function isValidReportKind(value: unknown): value is ReportKind {
  return typeof value === 'string' && REPORT_KINDS.some(k => k.value === value)
}

export function reportKindLabel(kind: string): string {
  return REPORT_KINDS.find(k => k.value === kind)?.label ?? kind
}

export type ReportNoteResult = { ok: true; note: string | null } | { ok: false; error: string }

// La note est facultative : absente ou vide => null ; au-dela de 500 caracteres => refus.
export function validateReportNote(value: unknown): ReportNoteResult {
  if (value === undefined || value === null) return { ok: true, note: null }
  if (typeof value !== 'string') return { ok: false, error: 'Precisions invalides' }
  const trimmed = value.trim()
  if (trimmed.length === 0) return { ok: true, note: null }
  if (trimmed.length > REPORT_NOTE_MAX) {
    return { ok: false, error: `Precisions trop longues (${REPORT_NOTE_MAX} caracteres maximum)` }
  }
  return { ok: true, note: trimmed }
}
