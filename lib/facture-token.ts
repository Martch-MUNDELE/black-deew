import crypto from 'crypto'

export function generateFactureToken(order_id: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const secret = process.env.FACTURE_SECRET!
  const hmac = crypto.createHmac('sha256', secret)
    .update(`${order_id}:${timestamp}`)
    .digest('hex')
  return Buffer.from(`${timestamp}.${hmac}`).toString('base64url')
}

export function verifyFactureToken(order_id: string, token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const dotIdx = decoded.indexOf('.')
    if (dotIdx === -1) return false
    const timestamp = decoded.slice(0, dotIdx)
    const hmac = decoded.slice(dotIdx + 1)

    const secret = process.env.FACTURE_SECRET!
    const expected = crypto.createHmac('sha256', secret)
      .update(`${order_id}:${timestamp}`)
      .digest('hex')

    const a = Buffer.from(hmac, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    if (!crypto.timingSafeEqual(a, b)) return false

    const ts = parseInt(timestamp, 10)
    const now = Math.floor(Date.now() / 1000)
    return now - ts <= 72 * 60 * 60
  } catch {
    return false
  }
}
