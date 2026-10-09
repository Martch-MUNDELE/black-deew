import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
const TYPES = ['classique_visite', 'classique_commande', 'vip'] as const
type ConnexionType = (typeof TYPES)[number]
// A10 : validation minimale (types et longueurs) des donnees recues
function optionalString(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length > max) return undefined
  return trimmed || null
}
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'corps invalide' }, { status: 400 })
    }
    const body = raw as Record<string, unknown>
    if (typeof body.type !== 'string' || !(TYPES as readonly string[]).includes(body.type)) {
      return NextResponse.json({ error: 'type invalide' }, { status: 400 })
    }
    const type = body.type as ConnexionType
    const clientPhone = optionalString(body.client_phone, 40)
    const shopId = optionalString(body.shop_id, 64)
    const sessionId = optionalString(body.session_id, 128)
    const userAgent = optionalString(body.user_agent, 512)
    if (clientPhone === undefined || shopId === undefined || sessionId === undefined || userAgent === undefined) {
      return NextResponse.json({ error: 'donnees invalides' }, { status: 400 })
    }
    if (clientPhone && !/^\+?[0-9 ()\-.]{6,40}$/.test(clientPhone)) {
      return NextResponse.json({ error: 'telephone invalide' }, { status: 400 })
    }
    if (type === 'vip' && !clientPhone) {
      return NextResponse.json({ error: 'telephone requis pour une connexion VIP' }, { status: 400 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )
    const { error } = await supabase.from('platform_connexions').insert({
      type,
      client_phone: clientPhone,
      shop_id: shopId,
      session_id: sessionId,
      user_agent: userAgent || (req.headers.get('user-agent') || '').slice(0, 512) || null,
    })
    if (error) {
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
