// Rend le champ admin_logs.details (jsonb) sous forme de texte sur : objet, texte, nul ou autre.
export function formatLogDetails(details: unknown): string {
  if (details === null || details === undefined) return ''
  if (typeof details === 'string') return details
  if (typeof details === 'object') {
    const reason = (details as { reason?: unknown }).reason
    if (typeof reason === 'string' && reason.trim() !== '') return reason
    try {
      return JSON.stringify(details)
    } catch {
      return String(details)
    }
  }
  return String(details)
}
