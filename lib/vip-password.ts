import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
// Hachage des mots de passe VIP individuels : "scrypt$N$r$p$sel_base64$hash_base64".
// Serveur uniquement. Aucune dependance npm.
const N = 16384
const R = 8
const P = 1
const KEYLEN = 32
const SALT_BYTES = 16
const PREFIX = 'scrypt$'
export function isHashed(stored: unknown): boolean {
  return typeof stored === 'string' && stored.startsWith(PREFIX)
}
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES)
  const hash = scryptSync(plain, salt, KEYLEN, { N, r: R, p: P })
  return [PREFIX.slice(0, -1), N, R, P, salt.toString('base64'), hash.toString('base64')].join('$')
}
// Comparaison en clair a temps constant (compatibilite transitoire).
function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba)
    return false
  }
  return timingSafeEqual(ba, bb)
}
export function verifyPassword(stored: unknown, plain: string): boolean {
  const value = typeof stored === 'string' ? stored : ''
  if (!isHashed(value)) return constantTimeEqual(value, plain)
  try {
    const parts = value.split('$')
    if (parts.length !== 6) return false
    const n = Number(parts[1])
    const r = Number(parts[2])
    const p = Number(parts[3])
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false
    const salt = Buffer.from(parts[4], 'base64')
    const expected = Buffer.from(parts[5], 'base64')
    if (salt.length === 0 || expected.length === 0) return false
    const actual = scryptSync(plain, salt, expected.length, { N: n, r, p })
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
