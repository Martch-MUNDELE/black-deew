import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { vipServiceClient } from '@/lib/vip-server'
// BLAC-P2-011 : archivage (refus) d'une demande de reinitialisation, cote serveur (service role).
// Un update direct depuis le navigateur etait bloque en silence par les regles RLS (0 ligne modifiee, aucune erreur).
export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const requestId = typeof body.requestId === 'string' ? body.requestId : ''
  if (!requestId) return NextResponse.json({ error: 'requestId manquant' }, { status: 400 })
  const db = vipServiceClient()
  const { data: request, error: reqErr } = await db
    .from('vip_password_reset_requests')
    .select('id,status')
    .eq('id', requestId)
    .maybeSingle()
  if (reqErr) {
    console.error('[vip-reset-reject] lecture demande :', reqErr.code, reqErr.message)
    return NextResponse.json({ error: `Lecture de la demande impossible (${reqErr.code || 'erreur base'})` }, { status: 500 })
  }
  if (!request) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (request.status !== 'pending') return NextResponse.json({ error: 'Demande déjà traitée' }, { status: 409 })
  const { error: updErr } = await db
    .from('vip_password_reset_requests')
    .update({ status: 'rejected' })
    .eq('id', request.id)
    .eq('status', 'pending')
  if (updErr) {
    console.error('[vip-reset-reject] maj demande :', updErr.code, updErr.message)
    return NextResponse.json({ error: `Archivage impossible (${updErr.code || 'erreur base'})` }, { status: 500 })
  }
  // Ne jamais ignorer un resultat vide : on relit pour confirmer que la ligne a reellement change.
  const { data: after, error: afterErr } = await db
    .from('vip_password_reset_requests')
    .select('id,status')
    .eq('id', request.id)
    .maybeSingle()
  if (afterErr) return NextResponse.json({ error: `Vérification impossible (${afterErr.code || 'erreur base'})` }, { status: 500 })
  if (!after) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (after.status !== 'rejected') return NextResponse.json({ error: 'Demande déjà traitée' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
