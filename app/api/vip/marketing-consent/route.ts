import { NextRequest, NextResponse } from 'next/server'
import { lastDigits9, vipServiceClient } from '@/lib/vip-server'
import { readVipSessionPhone } from '@/lib/vip-session'

// Consentement aux offres VIP (WhatsApp). Le telephone vient uniquement du cookie de session signe,
// jamais du corps de la requete. Aucune migration : les colonnes marketing_opt_in* existent deja.
const MARKETING_COLUMNS = ['marketing_opt_in', 'marketing_opt_in_at', 'marketing_opt_in_source']

type ConsentRow = { id: unknown; phone: string | null; marketing_opt_in: boolean | null }

function isMissingMarketingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
  const text = [e.message, e.details, e.hint].filter((v) => typeof v === 'string').join(' ')
  if (!MARKETING_COLUMNS.some((c) => text.includes(c))) return false
  const code = typeof e.code === 'string' ? e.code : ''
  return code === '42703' || code === 'PGRST204' || /column|schema cache/i.test(text)
}

function unauthorized() {
  return NextResponse.json({ error: 'Session VIP requise' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  const phone = readVipSessionPhone(req)
  if (!phone) return unauthorized()
  const last9 = lastDigits9(phone)
  // Lecture impossible ou colonnes absentes : unknown + available false (l'encart ne s'affiche jamais)
  const fallback = () => NextResponse.json({ state: 'unknown', available: false })
  try {
    const db = vipServiceClient()
    const { data, error } = await db.from('vip_access_requests').select('id,phone,marketing_opt_in')
    if (error) return fallback()
    const rows = ((data || []) as ConsentRow[]).filter((r) => lastDigits9(String(r.phone ?? '')) === last9)
    if (rows.length === 0) return fallback()
    if (rows.some((r) => r.marketing_opt_in === true)) {
      return NextResponse.json({ state: 'accepted', available: true })
    }
    if (rows.some((r) => r.marketing_opt_in === false)) {
      return NextResponse.json({ state: 'refused', available: true })
    }
    return NextResponse.json({ state: 'unknown', available: true })
  } catch {
    return fallback()
  }
}

export async function POST(req: NextRequest) {
  const phone = readVipSessionPhone(req)
  if (!phone) return unauthorized()
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  if (typeof body.opt_in !== 'boolean') {
    return NextResponse.json({ error: 'Choix invalide' }, { status: 400 })
  }
  const optIn = body.opt_in
  const last9 = lastDigits9(phone)
  try {
    const db = vipServiceClient()
    const { data, error } = await db.from('vip_access_requests').select('id,phone,marketing_opt_in')
    if (error) {
      if (isMissingMarketingColumnError(error)) {
        return NextResponse.json({ error: 'Choix indisponible pour le moment' }, { status: 503 })
      }
      throw error
    }
    const rows = ((data || []) as ConsentRow[]).filter((r) => lastDigits9(String(r.phone ?? '')) === last9)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Compte VIP introuvable' }, { status: 404 })
    }
    // Uniquement les trois colonnes marketing_opt_in*, source = encart (valeur autorisee par la contrainte)
    const patch = {
      marketing_opt_in: optIn,
      marketing_opt_in_at: new Date().toISOString(),
      marketing_opt_in_source: 'encart',
    }
    for (const row of rows) {
      const { error: updError } = await db.from('vip_access_requests').update(patch).eq('id', row.id)
      if (updError) {
        if (isMissingMarketingColumnError(updError)) {
          return NextResponse.json({ error: 'Choix indisponible pour le moment' }, { status: 503 })
        }
        throw updError
      }
    }
    return NextResponse.json({ success: true, state: optIn ? 'accepted' : 'refused' })
  } catch (err) {
    console.error('[VIP marketing-consent]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
