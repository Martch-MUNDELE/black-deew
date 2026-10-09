import { NextRequest, NextResponse } from 'next/server'
import { loadVipSettings, phonesMatch, vipServiceClient } from '@/lib/vip-server'
import { readVipSessionPhone } from '@/lib/vip-session'
// Catalogue VIP servi uniquement a une session VIP signee valide (lecture via service role).
export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store' }
function unauthorized() {
  return NextResponse.json({ error: 'Session VIP requise.' }, { status: 401, headers: NO_STORE })
}
export async function GET(req: NextRequest) {
  const phone = readVipSessionPhone(req)
  if (!phone) return unauthorized()
  const db = vipServiceClient()
  const settings = await loadVipSettings(db)
  if (!settings) {
    return NextResponse.json({ error: 'Configuration VIP indisponible.' }, { status: 500, headers: NO_STORE })
  }
  if (!settings.enabled || !phonesMatch(phone, settings.allowedPhones)) return unauthorized()
  const { data, error } = await db
    .from('products')
    .select('*')
    .eq('is_vip', true)
    .eq('active', true)
    .order('name')
  if (error) {
    return NextResponse.json({ error: 'Catalogue VIP indisponible.' }, { status: 500, headers: NO_STORE })
  }
  return NextResponse.json({ products: data ?? [] }, { status: 200, headers: NO_STORE })
}
