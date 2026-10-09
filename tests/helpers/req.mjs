import { NextRequest } from 'next/server'
let counter = 0
export function uniqueIp() { counter += 1; return `10.0.${Math.floor(counter / 250)}.${(counter % 250) + 1}` }
export function makeReq(url, { method = 'POST', body, ip, cookie } = {}) {
  const headers = { 'x-forwarded-for': ip || uniqueIp(), 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return new NextRequest(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}
