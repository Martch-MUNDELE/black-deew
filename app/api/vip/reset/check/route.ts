import { vipRateLimit } from '@/lib/vip-rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { vipServiceClient } from '@/lib/vip-server'
// A9 : lecture/validation du jeton cote serveur, expiration et usage verifies ici. Ne renvoie jamais le jeton ni le numero.
export async function POST(req: NextRequest) {
  const limited = await vipRateLimit(req, 'reset-check')
  if (limited) return limited
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token || token.length > 200) return NextResponse.json({ ok: false, error: 'Lien invalide.' }, { status: 400 })
  const db = vipServiceClient()
  const { data: row, error } = await db
    .from('vip_password_reset_tokens')
    .select('id,expires_at,used_at')
    .eq('token', token)
    .maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: 'Vérification impossible. Réessayez.' }, { status: 500 })
  if (!row) return NextResponse.json({ ok: false, error: 'Lien invalide ou introuvable.' }, { status: 404 })
  if (row.used_at) return NextResponse.json({ ok: false, error: 'Ce lien a déjà été utilisé. Demandez un nouveau lien depuis la page VIP.' }, { status: 410 })
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'Ce lien a expiré (validité 1 heure). Demandez un nouveau lien depuis la page VIP.' }, { status: 410 })
  }
  return NextResponse.json({ ok: true })
}
