import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { loadActivePromotionRules, selectPublicPromotions } from '@/lib/promotion-rules'

export const dynamic = 'force-dynamic'

// Route publique de lecture seule : regles actives et en cours de validite, champs de la liste blanche uniquement.
// BLAC-P3-008 : lecture avec la cle de service (comme la route de commande), car apres les scripts SQL de securite
// un visiteur (cle anonyme) ne voit plus les tables de promotion. Cle absente : liste vide, sans erreur.
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ promotions: [] })
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
    const rules = await loadActivePromotionRules(supabase)
    return NextResponse.json({ promotions: selectPublicPromotions(rules) })
  } catch {
    return NextResponse.json({ promotions: [] })
  }
}
