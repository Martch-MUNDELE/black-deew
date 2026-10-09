import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
export type AdminCheck =
  | { ok: true; email: string; role: string | null }
  | { ok: false; status: 401 | 403 | 500; error: string }
// Verifie cote serveur : session Supabase valide (cookies) + ligne active dans la table admins.
export async function requireAdmin(): Promise<AdminCheck> {
  const supabase = await createServerSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user?.email) {
    // Diagnostic serveur : raison du refus (message seulement, aucune valeur de cookie ni de jeton)
    console.warn('[requireAdmin] 401 :', authError?.message ?? 'aucune session dans les cookies')
    return { ok: false, status: 401, error: 'Authentification requise' }
  }
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: admin, error } = await service
    .from('admins')
    .select('role, status')
    .eq('email', user.email)
    .maybeSingle()
  if (error) return { ok: false, status: 500, error: 'Verification du role impossible' }
  if (!admin || admin.status !== 'active') return { ok: false, status: 403, error: 'Acces reserve aux administrateurs' }
  return { ok: true, email: user.email, role: (admin.role as string | null) ?? null }
}
