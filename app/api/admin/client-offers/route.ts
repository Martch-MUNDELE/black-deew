import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { runClientOffersAction } from '@/lib/client-offers'

// BLAC-P2-024 : offres personnelles (admin Marketing). Toute la logique est dans lib/client-offers.ts.
// Chaque methode passe d'abord par requireAdmin.

async function handle(method: 'GET' | 'POST' | 'PATCH', req: NextRequest) {
  const check = await requireAdmin()
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const body = method === 'GET' ? undefined : await req.json().catch(() => ({}))
  const rules = method === 'GET' && req.nextUrl.searchParams.get('rules') === '1'
  const result = await runClientOffersAction({ check, db, method, rules, body })
  return NextResponse.json(result.body, { status: result.status })
}

export async function GET(req: NextRequest) {
  return handle('GET', req)
}

export async function POST(req: NextRequest) {
  return handle('POST', req)
}

export async function PATCH(req: NextRequest) {
  return handle('PATCH', req)
}
