import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { runCampaignScenariosAction } from '@/lib/campaign-scenarios'

// BLAC-P3-025 : apercu des scenarios automatiques (admin Marketing), en lecture seule.
// Passe d'abord par requireAdmin. Toute la logique est dans lib/campaign-scenarios.ts.
export async function GET() {
  const check = await requireAdmin()
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const result = await runCampaignScenariosAction({ check, db, method: 'GET' })
  return NextResponse.json(result.body, { status: result.status })
}
