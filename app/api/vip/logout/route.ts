import { NextResponse } from 'next/server'
import { clearVipSessionCookie } from '@/lib/vip-session'
// Deconnexion VIP : supprime le cookie de session signee.
export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearVipSessionCookie(res)
  return res
}
