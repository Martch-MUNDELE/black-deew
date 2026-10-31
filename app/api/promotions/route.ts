import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadActivePromotionRules, selectPublicPromotions } from '@/lib/promotion-rules'

export const dynamic = 'force-dynamic'

// Route publique de lecture : regles actives et en cours de validite, champs d'affichage uniquement.
export async function GET() {
  try {
    const supabase = await createClient()
    const rules = await loadActivePromotionRules(supabase)
    return NextResponse.json({ promotions: selectPublicPromotions(rules) })
  } catch {
    return NextResponse.json({ promotions: [] })
  }
}
