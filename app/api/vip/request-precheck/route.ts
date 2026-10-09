import { NextRequest, NextResponse } from 'next/server'
import { loadVipSettings, phonesMatch, lastDigits9, vipServiceClient } from '@/lib/vip-server'
import { vipRateLimit } from '@/lib/vip-rate-limit'
// A3 : le formulaire de demande ne lit plus vip_access_requests ni vip_allowed_phones. Seuls deux booleens sont renvoyes.
export async function POST(req: NextRequest) {
  const limited = await vipRateLimit(req, 'precheck', { max: 30 })
  if (limited) return limited
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const phone = typeof body.phone === 'string' ? body.phone : ''
  if (!phone || phone.length > 40) return NextResponse.json({ alreadyAllowed: false, alreadyPending: false })
  const db = vipServiceClient()
  const settings = await loadVipSettings(db)
  const alreadyAllowed = !!settings && settings.allowedPhones.length > 0 && phonesMatch(phone, settings.allowedPhones)
  const { data, error } = await db.from('vip_access_requests').select('phone').eq('status', 'pending')
  const last9 = lastDigits9(phone)
  const alreadyPending =
    !error && last9.length >= 7 && ((data || []) as { phone: string }[]).some((r) => lastDigits9(String(r.phone ?? '')) === last9)
  return NextResponse.json({ alreadyAllowed, alreadyPending })
}
