import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { runCampaignResultsAction } from '@/lib/campaign-results'

// BLAC-P3-014 : resultats d'une campagne (admin). Toute la logique est dans lib/campaign-results.ts.
// requireAdmin d'abord. Aucune donnee client dans les journaux.
export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const campaignId = req.nextUrl.searchParams.get('id') ?? req.nextUrl.searchParams.get('campaign_id') ?? undefined
  const result = await runCampaignResultsAction({ check, db, campaignId })
  return NextResponse.json(result.body, { status: result.status })
}
