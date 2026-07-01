import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )
    const body = await req.json()
    const { type, client_phone, shop_id, session_id, user_agent } = body as {
      type: 'classique_visite' | 'classique_commande' | 'vip'
      client_phone?: string | null
      shop_id?: string | null
      session_id?: string | null
      user_agent?: string | null
    }

    if (!type || !['classique_visite', 'classique_commande', 'vip'].includes(type)) {
      return NextResponse.json({ error: 'type invalide' }, { status: 400 })
    }

    const { error } = await supabase.from('platform_connexions').insert({
      type,
      client_phone: client_phone || null,
      shop_id: shop_id || null,
      session_id: session_id || null,
      user_agent: user_agent || req.headers.get('user-agent') || null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
