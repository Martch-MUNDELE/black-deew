import { hashPassword } from '@/lib/vip-password'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
function normalizePhone(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  if (raw.startsWith('00')) return '+' + raw.slice(2).replace(/[^\d]/g, '')
  return '+' + raw.replace(/[^\d]/g, '')
}
function parseAllowed(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string').map(normalizePhone).filter(Boolean)
  } catch {}
  return value.split(/[\n,;|]+/).map(normalizePhone).filter(Boolean)
}
// A12 / A13 : approbation cote serveur. Sans transaction SQL (modifications de base interdites dans ce lot),
// l'ordre des ecritures + un rollback compensatoire garantit qu'aucun etat partiel n'est laisse silencieusement.
export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
  const { requestId } = (await req.json().catch(() => ({}))) as { requestId?: string }
  if (!requestId) return NextResponse.json({ error: 'requestId manquant' }, { status: 400 })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: request, error: reqErr } = await db
    .from('vip_access_requests')
    .select('id, phone, pseudo, status, requested_password')
    .eq('id', requestId)
    .maybeSingle()
  if (reqErr) return NextResponse.json({ error: 'Lecture de la demande impossible' }, { status: 500 })
  if (!request) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (request.status !== 'pending') return NextResponse.json({ error: 'Demande déjà traitée' }, { status: 409 })
  const phone = normalizePhone(String(request.phone ?? ''))
  if (phone.replace(/[^\d]/g, '').length < 7) {
    return NextResponse.json({ error: 'Numéro de la demande invalide' }, { status: 400 })
  }
  // Etat precedent pour rollback
  const { data: prevPhonesRow, error: prevPhonesErr } = await db.from('settings').select('value').eq('key', 'vip_allowed_phones').maybeSingle()
  if (prevPhonesErr) return NextResponse.json({ error: 'Lecture des numéros autorisés impossible' }, { status: 500 })
  const prevPhonesValue = prevPhonesRow?.value ?? null
  const nextAllowed = Array.from(new Set([...parseAllowed(prevPhonesValue), phone]))
  let prevPassword: { phone: string; password: string } | null = null
  if (request.requested_password) {
    const { data: prev, error: prevErr } = await db.from('vip_individual_passwords').select('phone, password').eq('phone', phone).maybeSingle()
    if (prevErr) return NextResponse.json({ error: 'Lecture du mot de passe existant impossible' }, { status: 500 })
    prevPassword = prev as { phone: string; password: string } | null
  }
  const rollback = async () => {
    const failures: string[] = []
    if (request.requested_password) {
      const r = prevPassword
        ? await db.from('vip_individual_passwords').upsert({ phone, password: prevPassword.password, updated_at: new Date().toISOString() }, { onConflict: 'phone' })
        : await db.from('vip_individual_passwords').delete().eq('phone', phone)
      if (r.error) failures.push('mot de passe individuel')
    }
    const p = prevPhonesRow
      ? await db.from('settings').upsert({ key: 'vip_allowed_phones', value: prevPhonesValue })
      : await db.from('settings').delete().eq('key', 'vip_allowed_phones')
    if (p.error) failures.push('numéros autorisés')
    return failures
  }
  // 1) mot de passe individuel
  if (request.requested_password) {
    const { error } = await db.from('vip_individual_passwords').upsert(
      { phone, password: hashPassword(request.requested_password), updated_at: new Date().toISOString() },
      { onConflict: 'phone' }
    )
    if (error) return NextResponse.json({ error: 'Échec : le mot de passe individuel n’a pas pu être enregistré. Rien n’a été activé.' }, { status: 500 })
  }
  // 2) numero autorise
  const { error: phonesErr } = await db.from('settings').upsert({ key: 'vip_allowed_phones', value: JSON.stringify(nextAllowed) })
  if (phonesErr) {
    const failures = await rollback()
    return NextResponse.json({
      error: failures.length
        ? `Échec de l’activation du numéro ET du retour arrière (${failures.join(', ')}). Vérification manuelle requise pour ${phone}.`
        : 'Échec : le numéro n’a pas pu être activé. Les modifications ont été annulées.',
      partial: failures.length > 0,
    }, { status: 500 })
  }
  // 3) statut de la demande en dernier : sans lui la demande reste "pending" et peut etre rejouee
  const { error: statusErr } = await db.from('vip_access_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', request.id).eq('status', 'pending')
  if (statusErr) {
    const failures = await rollback()
    return NextResponse.json({
      error: failures.length
        ? `Échec du changement de statut ET du retour arrière (${failures.join(', ')}). Vérification manuelle requise pour ${phone}.`
        : 'Échec : le statut de la demande n’a pas pu être mis à jour. Les modifications ont été annulées.',
      partial: failures.length > 0,
    }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    phone,
    pseudo: request.pseudo,
    allowedPhones: nextAllowed,
  })
}
