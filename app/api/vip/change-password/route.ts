import { hashPassword } from '@/lib/vip-password'
import { vipRateLimit } from '@/lib/vip-rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { verifyVipCredentials, vipServiceClient } from '@/lib/vip-server'
import { setVipSessionCookie } from '@/lib/vip-session'
// A3 : changement de mot de passe individuel uniquement apres verification du mot de passe actuel (commun ou individuel).
export async function POST(req: NextRequest) {
  const limited = await vipRateLimit(req, 'change-password')
  if (limited) return limited
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const check = await verifyVipCredentials(body.phone, body.currentPassword)
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: check.status })
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : ''
  if (newPassword.length < 4 || newPassword.length > 200) {
    return NextResponse.json({ ok: false, error: 'Choisissez un mot de passe d’au moins 4 caractères.' }, { status: 400 })
  }
  const db = vipServiceClient()
  const { error } = await db
    .from('vip_individual_passwords')
    .upsert(
      { phone: check.individualPhone ?? check.phone, password: hashPassword(newPassword), updated_at: new Date().toISOString() },
      { onConflict: 'phone' }
    )
  if (error) return NextResponse.json({ ok: false, error: 'Impossible d’enregistrer votre nouveau mot de passe. Réessayez.' }, { status: 500 })
  const res = NextResponse.json({ ok: true })
  try {
    setVipSessionCookie(res, check.phone)
  } catch {
    return NextResponse.json({ ok: false, error: 'Session VIP indisponible (configuration serveur). Contactez la boutique.' }, { status: 500 })
  }
  return res
}
