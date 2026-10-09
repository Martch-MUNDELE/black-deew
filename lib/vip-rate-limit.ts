import { NextRequest, NextResponse } from 'next/server'
// A3 / A9 : limitation de tentatives en memoire (par adresse IP et par numero/jeton).
// Protection au mieux : en serverless chaque instance a son propre compteur, qui est perdu a l'arret de l'instance.
type Bucket = { count: number; resetAt: number }
const WINDOW_MS = 15 * 60 * 1000
const buckets = new Map<string, Bucket>()
let lastSweep = 0
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
}
function hit(key: string, max: number, now: number) {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { limited: false, retryAfter: 0 }
  }
  bucket.count += 1
  if (bucket.count > max) return { limited: true, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  return { limited: false, retryAfter: 0 }
}
function clientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
export async function vipRateLimit(
  req: NextRequest,
  scope: string,
  opts: { max?: number } = {}
): Promise<NextResponse | null> {
  const max = opts.max ?? 10
  const now = Date.now()
  sweep(now)
  let identifier = ''
  try {
    const body = (await req.clone().json()) as Record<string, unknown>
    const raw = typeof body.phone === 'string' ? body.phone : typeof body.token === 'string' ? body.token : ''
    identifier = raw.replace(/[^\w+]/g, '').slice(-40)
  } catch {}
  const keys = [`${scope}:ip:${clientIp(req)}`]
  if (identifier) keys.push(`${scope}:id:${identifier}`)
  let worst = 0
  let limited = false
  for (const key of keys) {
    const r = hit(key, max, now)
    if (r.limited) {
      limited = true
      worst = Math.max(worst, r.retryAfter)
    }
  }
  if (!limited) return null
  return NextResponse.json(
    { ok: false, granted: false, error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
    { status: 429, headers: { 'Retry-After': String(worst) } }
  )
}
