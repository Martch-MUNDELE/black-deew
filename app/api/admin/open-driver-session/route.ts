// BLAC-P3-059 : ouverture d'une session livreur cote serveur, reservee aux admins actifs.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminRole } from '@/lib/admin-role-server'
import { openSessionWithLedger, SESSION_DEJA_OUVERTE_MESSAGE } from '@/lib/driver-ledger-data'
import { parseOpenSessionBody } from '@/lib/driver-open-session-api'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(req: NextRequest) {
  const info = await getAdminRole()
  if (!info) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401, headers: NO_STORE })
  }
  if (info.role !== 'admin') {
    return NextResponse.json({ error: 'Acces reserve aux administrateurs' }, { status: 403, headers: NO_STORE })
  }

  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    body = null
  }
  const parsed = parseOpenSessionBody(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { session_id } = await openSessionWithLedger(supabase, parsed.value)
    return NextResponse.json({ ok: true, session_id }, { headers: NO_STORE })
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : 'Ouverture impossible'
    const status = message === SESSION_DEJA_OUVERTE_MESSAGE ? 409 : 500
    return NextResponse.json({ error: message }, { status, headers: NO_STORE })
  }
}
