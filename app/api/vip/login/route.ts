import { vipRateLimit } from '@/lib/vip-rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { verifyVipCredentials } from '@/lib/vip-server'
import { setVipSessionCookie } from '@/lib/vip-session'
// A3 : verification du numero + mot de passe cote serveur. Aucun mot de passe n'est renvoye au navigateur.
// Session signee : le cookie n'est pose que si aucun changement de mot de passe n'est requis (sinon il est pose par change-password).
export async function POST(req: NextRequest) {
  const limited = await vipRateLimit(req, 'login')
  if (limited) return limited
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const result = await verifyVipCredentials(body.phone, body.password)
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
  const res = NextResponse.json({ ok: true, needsPasswordChange: result.needsPasswordChange, phone: result.phone })
  if (!result.needsPasswordChange) {
    try {
      setVipSessionCookie(res, result.phone)
    } catch {
      return NextResponse.json({ ok: false, error: 'Session VIP indisponible (configuration serveur). Contactez la boutique.' }, { status: 500 })
    }
  }
  return res
}
