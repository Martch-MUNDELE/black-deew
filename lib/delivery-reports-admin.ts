// BLAC-ADMIN-SIGNALEMENTS : logique pure de l'ecran admin des signalements livreurs.
// Aucune dependance serveur. Aucune action ne touche au stock ni a l'argent : seule la ligne delivery_reports change.
import type { DeliveryReport, ReportStatus } from '@/lib/delivery-reports'

export type ReportAction = 'acknowledge' | 'close'
export type ReportFilter = 'open' | 'all'

// Actions livrees. 'reassign' et 'new_slot' ne sont volontairement pas livrees (ecarts declares dans le rapport).
export const REPORT_ACTIONS: { value: ReportAction; label: string }[] = [
  { value: 'acknowledge', label: 'Prendre en compte' },
  { value: 'close', label: 'Clore' },
]

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Ouvert',
  handled: 'Pris en compte',
  closed: 'Clos',
}

export function reportStatusLabel(status: string): string {
  return REPORT_STATUS_LABELS[status as ReportStatus] ?? status
}

export function isReportAction(value: unknown): value is ReportAction {
  return value === 'acknowledge' || value === 'close'
}

// Seuls les roles admin (admin et super admin) accedent a l'ecran ; un livreur est refuse.
export function canAccessReports(role: string | null | undefined): boolean {
  return role === 'admin'
}

export function decisionFor(action: ReportAction): { status: ReportStatus; decision: string } {
  if (action === 'close') return { status: 'closed', decision: 'closed' }
  return { status: 'handled', decision: 'acknowledged' }
}

// Colonnes ecrites par une decision : uniquement celles de delivery_reports.
export function buildDecisionUpdate(action: ReportAction, adminEmail: string, now: Date = new Date()) {
  const { status, decision } = decisionFor(action)
  return {
    status,
    handled_at: now.toISOString(),
    handled_by: adminEmail,
    handled_decision: decision,
  }
}

// Ouverts d'abord, puis traites ; dans chaque groupe, du plus recent au plus ancien.
export function sortReports<T extends Pick<DeliveryReport, 'status' | 'created_at'>>(reports: T[]): T[] {
  return [...reports].sort((a, b) => {
    const ao = a.status === 'open' ? 0 : 1
    const bo = b.status === 'open' ? 0 : 1
    if (ao !== bo) return ao - bo
    return b.created_at.localeCompare(a.created_at)
  })
}

export function filterReports<T extends Pick<DeliveryReport, 'status'>>(reports: T[], filter: ReportFilter): T[] {
  return filter === 'open' ? reports.filter(r => r.status === 'open') : reports
}

export function countOpenReports(reports: Pick<DeliveryReport, 'status'>[]): number {
  return reports.filter(r => r.status === 'open').length
}

export function parseReportFilter(value: unknown): ReportFilter {
  return value === 'all' ? 'all' : 'open'
}

// Un signalement deja traite ne peut plus etre pris en compte ; il peut seulement etre clos.
export function canApply(action: ReportAction, current: ReportStatus): boolean {
  if (current === 'closed') return false
  if (action === 'acknowledge') return current === 'open'
  return true
}

// Ligne affichee par l'ecran admin (serialisable, preparee cote serveur).
export type AdminReportRow = {
  id: string
  created_at: string
  driver_name: string | null
  customer_name: string | null
  address: string | null
  kind: string
  kind_label: string
  note: string | null
  status: ReportStatus
  status_label: string
  handled_at: string | null
  handled_by: string | null
  handled_decision: string | null
}

export function decisionLabel(decision: string | null | undefined): string {
  if (decision === 'acknowledged') return 'Pris en compte'
  if (decision === 'closed') return 'Clos'
  return decision ?? ''
}
