// BLAC-ACCUEIL-LIVREUR-MAQUETTE : URL du logo du site (reglage site_logo), lue cote serveur avec la cle service_role.
import { createClient } from '@supabase/supabase-js'

/** Renvoie l'URL du logo ou null ; ne leve jamais d'exception. */
export async function getSiteLogoUrl(): Promise<string | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    const db = createClient(url, key)
    const { data, error } = await db.from('settings').select('value').eq('key', 'site_logo').maybeSingle()
    if (error || !data) return null
    const value = typeof data.value === 'string' ? data.value.trim() : ''
    return value ? value : null
  } catch {
    return null
  }
}
