import { NextRequest, NextResponse } from 'next/server'
import { lastDigits9, vipServiceClient } from '@/lib/vip-server'
// A9 : creation de la demande de reset cote serveur (plus d'insert/select anonyme depuis le navigateur).
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const digits = phone.replace(/[^\d]/g, '')
    if (digits.length < 7 || digits.length > 20) {
      return NextResponse.json({ error: 'Numéro invalide' }, { status: 400 })
    }
    const db = vipServiceClient()
    const { data: pending, error: pendingErr } = await db
      .from('vip_password_reset_requests')
      .select('id,phone')
      .eq('status', 'pending')
    if (pendingErr) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    const last9 = lastDigits9(phone)
    if ((pending || []).some((r: { phone: string }) => lastDigits9(String(r.phone ?? '')) === last9)) {
      return NextResponse.json({ error: 'Demande déjà en attente' }, { status: 409 })
    }
    const { error } = await db.from('vip_password_reset_requests').insert({ phone, status: 'pending' })
    if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[VIP reset-request]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
