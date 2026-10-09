// Logique pure de protection des pages /admin/* (sans dependance Next/Supabase).
// Utilisee par proxy.ts (racine) et par app/admin/layout.tsx.
export type AdminAccessDecision = 'allow' | 'redirect-login' | 'check-session'
/** Pages de connexion admin : jamais redirigees, sans menu lateral. */
export function isAdminLoginPath(path: string): boolean {
  return path === '/admin/login' || path.startsWith('/admin/login/')
}
/** Vrai pour /admin et /admin/* hors page de connexion. Faux pour tout le reste (public, /vip, /api...). */
export function isAdminProtectedPath(path: string): boolean {
  if (path !== '/admin' && !path.startsWith('/admin/')) return false
  return !isAdminLoginPath(path)
}
/** Detecte un cookie de session Supabase (sb-<ref>-auth-token, eventuellement fragmente .0 .1). */
export function hasSupabaseSessionCookie(cookieNames: string[]): boolean {
  return cookieNames.some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n))
}
/**
 * Decision d'acces. hasUser = undefined tant que la session n'a pas ete verifiee aupres de Supabase.
 * - chemin non protege            => allow
 * - aucun cookie de session       => redirect-login (sans appel reseau)
 * - cookie present, non verifie   => check-session
 * - verifie : utilisateur present => allow, sinon redirect-login
 */
export function decideAdminAccess(input: {
  path: string
  hasSessionCookie: boolean
  hasUser?: boolean
}): AdminAccessDecision {
  if (!isAdminProtectedPath(input.path)) return 'allow'
  if (!input.hasSessionCookie) return 'redirect-login'
  if (input.hasUser === undefined) return 'check-session'
  return input.hasUser ? 'allow' : 'redirect-login'
}
