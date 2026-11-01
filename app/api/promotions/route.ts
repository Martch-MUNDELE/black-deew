import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { attachPublicGifts, loadActivePromotionRules, selectPublicPromotions } from '@/lib/promotion-rules'

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
    // BLAC-P3-011 : cadeaux (nom, photo, quantite) des regles a produit offert, lus avec la meme cle serveur
    const promotions = await attachPublicGifts(supabase, rules, selectPublicPromotions(rules))
    return NextResponse.json({ promotions })
  } catch {
    return NextResponse.json({ promotions: [] })
  }
}
