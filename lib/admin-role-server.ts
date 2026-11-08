// BLAC-P3-046 : role admin / livreur cote serveur uniquement (cle service_role jamais exposee au navigateur).
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAdminRole, isDriverStatusAllowed, type AdminRole } from '@/lib/admin-role'

export type AdminRoleInfo = {
  role: AdminRole
  email: string | null
  driver: { id: string; full_name: string | null } | null
}

/**
 * Role de l'utilisateur connecte (session des cookies), lu avec la cle service_role.
 * Renvoie null si le role ne peut pas etre determine (pas de session, config absente, erreur de lecture) :
 * le layout affiche alors comme avant. Jamais 'admin' par defaut.
 */
export async function getAdminRole(): Promise<AdminRoleInfo | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.warn('[getAdminRole] configuration Supabase serveur absente : role non determine')
      return null
    }
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const service = createClient(supabaseUrl, serviceKey)
    const email = user.email ?? null

    let isAdmin = false
    if (email) {
      const { data: admin, error: adminError } = await service
        .from('admins')
        .select('email')
        .eq('email', email)
        .eq('status', 'active')
        .maybeSingle()
      if (adminError) {
        console.warn('[getAdminRole] lecture de la table admins impossible')
        return null
      }
      isAdmin = !!admin
    }

    const { data: driver, error: driverError } = await service
      .from('delivery_drivers')
      .select('id, full_name, status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (driverError) {
      console.warn('[getAdminRole] lecture de la table delivery_drivers impossible')
      return null
    }

    // BLAC-P3-052 : 'inactive' (sans session ouverte) reste un livreur valide ; 'suspended' => role 'none'.
    const allowedDriver = driver && isDriverStatusAllowed(driver.status) ? driver : null
    const role = resolveAdminRole({ isAdmin, isDriver: !!allowedDriver })
    return {
      role,
      email,
      driver: allowedDriver ? { id: String(allowedDriver.id), full_name: (allowedDriver.full_name as string | null) ?? null } : null,
    }
  } catch {
    console.warn('[getAdminRole] erreur inattendue : role non determine')
    return null
  }
}
