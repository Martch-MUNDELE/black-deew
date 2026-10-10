import { hashPassword } from '@/lib/vip-password'
import { vipRateLimit } from '@/lib/vip-rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { findIndividualPassword, loadVipSettings, normalizePhone, phonesMatch, vipServiceClient } from '@/lib/vip-server'
import { setVipSessionCookie } from '@/lib/vip-session'
// A9 : consommation du jeton + changement du mot de passe, entierement cote serveur.
// Le jeton est reserve (used_at) de facon conditionnelle avant l'ecriture du mot de passe : usage unique et expiration garantis.
export async function POST(req: NextRequest) {
  const limited = await vipRateLimit(req, 'reset-consume')
  if (limited) return limited
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const token = typeof body.token === 'string' ? body.token : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : ''
  if (!token || token.length > 200) return NextResponse.json({ ok: false, error: 'Lien invalide.' }, { status: 400 })
  if (newPassword.length < 4 || newPassword.length > 200) {
    return NextResponse.json({ ok: false, error: 'Choisissez un mot de passe d’au moins 4 caractères.' }, { status: 400 })
  }
  const db = vipServiceClient()
  const { data: row, error } = await db
    .from('vip_password_reset_tokens')
    .select('id,phone,expires_at,used_at')
    .eq('token', token)
    .maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: 'Vérification impossible. Réessayez.' }, { status: 500 })
  if (!row) return NextResponse.json({ ok: false, error: 'Lien invalide ou introuvable.' }, { status: 404 })
  // BLAC-P2-010 : le numero doit toujours figurer dans la liste autorisee. Controle fait AVANT la reservation du jeton : jeton non consomme.
  const settings = await loadVipSettings(db)
  if (!settings) return NextResponse.json({ ok: false, error: 'Vérification impossible. Réessayez.' }, { status: 500 })
  if (!phonesMatch(String(row.phone ?? ''), settings.allowedPhones)) {
    return NextResponse.json({ ok: false, error: 'Ce numéro n’est pas autorisé pour l’accès VIP. Contactez la boutique.' }, { status: 403 })
  }
  const nowIso = new Date().toISOString()
  const { data: claimed, error: claimErr } = await db
    .from('vip_password_reset_tokens')
    .update({ used_at: nowIso })
    .eq('id', row.id)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('id')
    .maybeSingle()
  if (claimErr) return NextResponse.json({ ok: false, error: 'Vérification impossible. Réessayez.' }, { status: 500 })
  if (!claimed) return NextResponse.json({ ok: false, error: 'Ce lien a expiré ou a déjà été utilisé. Demandez un nouveau lien depuis la page VIP.' }, { status: 410 })
  const phone = normalizePhone(String(row.phone ?? ''))
  const existing = await findIndividualPassword(db, phone)
  const { error: upsertErr } = existing.error
    ? { error: new Error('lookup') }
    : await db
        .from('vip_individual_passwords')
        .upsert(
          { phone: existing.row?.phone ?? phone, password: hashPassword(newPassword), updated_at: new Date().toISOString() },
          { onConflict: 'phone' }
        )
  if (upsertErr) {
    await db.from('vip_password_reset_tokens').update({ used_at: null }).eq('id', row.id)
    return NextResponse.json({ ok: false, error: 'Impossible d’enregistrer votre nouveau mot de passe. Réessayez.' }, { status: 500 })
  }
  const res = NextResponse.json({ ok: true, phone })
  try {
    setVipSessionCookie(res, phone)
  } catch {
    // mot de passe deja enregistre : on ne bloque pas, l'utilisateur pourra se connecter normalement
  }
  return res
}
