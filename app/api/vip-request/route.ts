import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { lastDigits9, normalizePhone } from '@/lib/vip-server'

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
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const pseudo = typeof body.pseudo === 'string' ? body.pseudo.trim() : ''
    const requested_password = typeof body.requested_password === 'string' ? body.requested_password : ''

    if (!rawPhone || !pseudo || !requested_password) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }
    // A7 : validation minimale des entrees
    if (rawPhone.length > 40 || pseudo.length > 100 || requested_password.length > 200) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }
    const phone = normalizePhone(rawPhone)
    const last9 = lastDigits9(phone)
    if (last9.length < 7) {
      return NextResponse.json({ error: 'Numéro de téléphone invalide' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // A7 : controle de doublon fiable (9 derniers chiffres, tolere 0 ou plusieurs lignes pending)
    const { data: pendings, error: pendingError } = await supabase
      .from('vip_access_requests')
      .select('phone')
      .eq('status', 'pending')

    if (pendingError) throw pendingError

    const duplicate = ((pendings || []) as { phone: string | null }[]).some(
      (r) => lastDigits9(String(r.phone ?? '')) === last9
    )
    if (duplicate) {
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
