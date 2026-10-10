import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/admin-auth'
import { vipServiceClient } from '@/lib/vip-server'
// A9 : creation du jeton de reset reservee aux admins authentifies ; expiration (1 h) fixee cote serveur.
export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const requestId = typeof body.requestId === 'string' ? body.requestId : ''
  if (!requestId) return NextResponse.json({ error: 'requestId manquant' }, { status: 400 })
  const db = vipServiceClient()
  const { data: request, error: reqErr } = await db
    .from('vip_password_reset_requests')
    .select('id,phone,status')
    .eq('id', requestId)
    .maybeSingle()
  if (reqErr) {
    console.error('[vip-reset-link] lecture demande :', reqErr.code, reqErr.message)
    return NextResponse.json({ error: `Lecture de la demande impossible (${reqErr.code || 'erreur base'})` }, { status: 500 })
  }
  if (!request) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (request.status !== 'pending') return NextResponse.json({ error: 'Demande déjà traitée' }, { status: 409 })
  // La colonne token est de type uuid : un jeton hexadecimal de 64 caracteres serait rejete par Postgres (22P02).
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const { error: insErr } = await db
    .from('vip_password_reset_tokens')
    .insert({ phone: request.phone, token, expires_at: expiresAt })
  if (insErr) {
    console.error('[vip-reset-link] insertion jeton :', insErr.code, insErr.message)
    return NextResponse.json({ error: `Création du lien impossible (${insErr.code || 'erreur base'})` }, { status: 500 })
  }
  const { error: updErr } = await db
    .from('vip_password_reset_requests')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', request.id)
    .eq('status', 'pending')
  if (updErr) {
    console.error('[vip-reset-link] maj demande :', updErr.code, updErr.message)
    await db.from('vip_password_reset_tokens').delete().eq('token', token)
    return NextResponse.json({ error: `Mise à jour de la demande impossible (${updErr.code || 'erreur base'})` }, { status: 500 })
  }
  return NextResponse.json({ ok: true, token, expiresAt })
}
