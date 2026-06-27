import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getBaseUrl(req: Request) {
  const proto = req.headers.get('x-forwarded-proto')
  const host = req.headers.get('x-forwarded-host')
  if (host) return `${proto || 'https'}://${host}`
  return new URL(req.url).origin
}

export async function POST(req: NextRequest) {
  try {
    const { phone, pseudo, requested_password } = await req.json()

    if (!phone || !pseudo || !requested_password) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Vérifier si déjà une demande pending
    const { data: existing } = await supabase
      .from('vip_access_requests')
      .select('id')
      .eq('phone', phone)
      .eq('status', 'pending')
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Demande déjà en cours' }, { status: 409 })
    }

    // Insérer la demande
    const { error: insertError } = await supabase
      .from('vip_access_requests')
      .insert({ phone, pseudo, status: 'pending', requested_password })

    if (insertError) throw insertError

    // Push notification admin
    try {
      await fetch(`${getBaseUrl(req)}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '⭐ Nouvelle demande VIP !',
          body: `${pseudo} (${phone}) demande l'accès VIP`,
          tag: 'demande-vip',
          url: '/admin/settings?tab=vip'
        })
      })
    } catch (e) { console.error('[Push VIP]', e) }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[VIP Request]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
