import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
// Session VIP signee cote serveur (HMAC-SHA256). Helpers serveur uniquement.
export const VIP_COOKIE_NAME = 'vip_session'
export const VIP_SESSION_MAX_AGE_S = 30 * 24 * 60 * 60
function getSecret(): string {
  const explicit = process.env.VIP_SESSION_SECRET
  if (explicit && explicit.length >= 16) return explicit
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (base) return createHmac('sha256', base).update('vip-session-secret-v1').digest('hex')
  // Jamais de session non signee : sans secret, on echoue explicitement.
  throw new Error('VIP_SESSION_SECRET et SUPABASE_SERVICE_ROLE_KEY absents : session VIP impossible')
}
function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}
function sign(payloadB64: string): string {
  return createHmac('sha256', getSecret()).update(payloadB64).digest('base64url')
}
export function createVipSessionValue(phone: string, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ p: phone, e: now + VIP_SESSION_MAX_AGE_S * 1000 }))
  return `${payload}.${sign(payload)}`
}
export function verifyVipSessionValue(value: string | undefined | null, now = Date.now()): string | null {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 2) return null
  const [payload, signature] = parts
  let expected: string
  try {
    expected = sign(payload)
  } catch {
    return null
  }
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { p?: unknown; e?: unknown }
    if (typeof data.p !== 'string' || !data.p) return null
    if (typeof data.e !== 'number' || data.e <= now) return null
    return data.p
  } catch {
    return null
  }
}
export function readVipSessionPhone(req: NextRequest): string | null {
  return verifyVipSessionValue(req.cookies.get(VIP_COOKIE_NAME)?.value)
}
export function setVipSessionCookie(res: NextResponse, phone: string): void {
  res.cookies.set({
    name: VIP_COOKIE_NAME,
    value: createVipSessionValue(phone),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VIP_SESSION_MAX_AGE_S,
  })
}
export function clearVipSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: VIP_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
