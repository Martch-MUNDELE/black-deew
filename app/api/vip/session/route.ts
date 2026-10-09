import { vipRateLimit } from '@/lib/vip-rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { loadVipSettings, phonesMatch, vipServiceClient } from '@/lib/vip-server'
import { clearVipSessionCookie, readVipSessionPhone, VIP_COOKIE_NAME } from '@/lib/vip-session'
// Session signee : le numero ne vient plus du navigateur, il est lu dans le cookie verifie (signature + expiration),
// puis on verifie que ce numero est toujours autorise.
async function handle(req: NextRequest) {
  const limited = await vipRateLimit(req, 'session', { max: 60 })
  if (limited) return limited
  const hadCookie = !!req.cookies.get(VIP_COOKIE_NAME)?.value
  const phone = readVipSessionPhone(req)
  if (!phone) {
    const res = NextResponse.json({ granted: false })
    if (hadCookie) clearVipSessionCookie(res)
    return res
  }
  const settings = await loadVipSettings(vipServiceClient())
  if (!settings) return NextResponse.json({ granted: false, error: 'unavailable' }, { status: 500 })
  const granted = settings.enabled && settings.allowedPhones.length > 0 && phonesMatch(phone, settings.allowedPhones)
  const res = NextResponse.json({ granted, phone: granted ? phone : undefined })
  if (!granted) clearVipSessionCookie(res)
  return res
}
export async function POST(req: NextRequest) {
  return handle(req)
}
export async function GET(req: NextRequest) {
  return handle(req)
}
