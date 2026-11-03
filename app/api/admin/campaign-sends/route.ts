import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { runCampaignSendsAction } from '@/lib/campaign-sends'

// BLAC-P2-026 : file d'envoi WhatsApp (admin). Toute la logique est dans lib/campaign-sends.ts.
// Chaque methode passe d'abord par requireAdmin. Aucune donnee client dans les journaux.

async function handle(method: 'GET' | 'PATCH', req: NextRequest) {
  const check = await requireAdmin()
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const body = method === 'GET' ? undefined : await req.json().catch(() => ({}))
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? undefined
  const result = await runCampaignSendsAction({ check, db, method, campaignId, body })
  return NextResponse.json(result.body, { status: result.status })
}

export async function GET(req: NextRequest) {
  return handle('GET', req)
}

export async function PATCH(req: NextRequest) {
  return handle('PATCH', req)
}
