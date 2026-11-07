// BLAC-P3-046 : logique pure du role admin / livreur (sans dependance Next ni Supabase).
// Utilisee par app/admin/layout.tsx. La vraie securite des donnees reste la RLS et requireAdmin.
export type AdminRole = 'admin' | 'driver' | 'none'

export const DRIVER_HOME = '/admin/driver'
export const ACCESS_DENIED_REDIRECT = '/admin/login?error=acces'

function pathnameOf(path: string): string {
  return path.split(/[?#]/, 1)[0]
}

/** Meme regle que isAdminLoginPath de lib/supabase/proxy.ts (page de connexion, jamais redirigee). */
function isLoginPath(path: string): boolean {
  const p = pathnameOf(path)
  return p === '/admin/login' || p.startsWith('/admin/login/')
}

/** admin prioritaire, puis driver, sinon none. */
export function resolveAdminRole(input: { isAdmin: boolean; isDriver: boolean }): AdminRole {
  if (input.isAdmin) return 'admin'
  if (input.isDriver) return 'driver'
  return 'none'
}

/** Vrai pour /admin/driver et ses sous-chemins uniquement. */
export function isDriverAllowedPath(path: string): boolean {
  const p = pathnameOf(path)
  return p === DRIVER_HOME || p.startsWith(DRIVER_HOME + '/')
}

/** Chemin de redirection, ou null si aucune redirection. */
export function decideRoleRedirect(input: { role: AdminRole; path: string }): string | null {
  const { role, path } = input
  if (isLoginPath(path)) return null
  if (role === 'admin') return null
  if (role === 'driver') return isDriverAllowedPath(path) ? null : DRIVER_HOME
  return ACCESS_DENIED_REDIRECT
}
