// BLAC-P3-060 : lecture publique du suivi par lien secret. Aucune donnee personnelle, jamais de cache.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidTrackingToken, publicTrackingView } from '@/lib/delivery-tracking'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!isValidTrackingToken(token)) {
    return NextResponse.json({ error: 'Suivi introuvable' }, { status: 404, headers: NO_STORE })
  }
  try {
    const { data, error } = await supabase
      .from('delivery_tracking')
      .select('active, lat, lng, position_updated_at')
      .eq('token', token)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
    }
    if (!data) {
      return NextResponse.json({ error: 'Suivi introuvable' }, { status: 404, headers: NO_STORE })
    }
    return NextResponse.json(publicTrackingView(data, Date.now()), { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
  }
}
