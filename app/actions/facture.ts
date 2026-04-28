'use server'
import { generateFactureToken } from '@/lib/facture-token'

export async function getFactureUrl(order_id: string): Promise<string> {
  const token = generateFactureToken(order_id)
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://black-deew.vercel.app'
  return `${base}/facture/${order_id}?token=${token}`
}
