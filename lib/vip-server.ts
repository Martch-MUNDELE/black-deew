import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
// A3 / A9 : helpers serveur uniquement (service role). Ne jamais importer depuis un composant client.
export function vipServiceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
export function normalizePhone(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return '+' + raw.replace(/[^\d]/g, '')
  if (raw.startsWith('00')) return '+' + raw.slice(2).replace(/[^\d]/g, '')
  return '+' + raw.replace(/[^\d]/g, '')
}
function phoneVariants(value: string) {
  const normalized = normalizePhone(value)
  const digits = normalized.replace(/[^\d]/g, '')
  const variants = new Set<string>()
  if (normalized) variants.add(normalized)
  if (digits.length >= 8) variants.add(digits)
  if (digits.startsWith('0') && digits.length > 8) variants.add(digits.slice(1))
  if (digits.length > 9) variants.add(digits.slice(-9))
  if (digits.length > 10) variants.add(digits.slice(-10))
  return variants
}
export function phonesMatch(inputPhone: string, allowedPhoneList: string[]) {
  const inputVariants = phoneVariants(inputPhone)
  if (inputVariants.size === 0) return false
  return allowedPhoneList.some((allowedPhone) => {
    const allowedVariants = phoneVariants(allowedPhone)
    for (const variant of inputVariants) {
      if (variant.length >= 8 && allowedVariants.has(variant)) return true
    }
    return false
  })
}
export function parseAllowedPhones(value: string | null | undefined) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map(normalizePhone)
        .filter(Boolean)
    }
  } catch {}
  return value.split(/[\n,;|]+/).map(normalizePhone).filter(Boolean)
}
export function lastDigits9(phone: string) {
  return phone.replace(/[^\d]/g, '').slice(-9)
}
export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba)
    return false
  }
  return timingSafeEqual(ba, bb)
}
export type VipSettings = { enabled: boolean; commonPassword: string; allowedPhones: string[] }
export async function loadVipSettings(db: SupabaseClient): Promise<VipSettings | null> {
  const { data, error } = await db
    .from('settings')
    .select('key,value')
    .in('key', ['vip_access_enabled', 'vip_access_password', 'vip_allowed_phones'])
  if (error) return null
  let enabled = true
  let commonPassword = ''
  let allowedPhones: string[] = []
  for (const row of (data || []) as { key: string; value: string | null }[]) {
    const value = row.value ?? ''
    if (row.key === 'vip_access_enabled') enabled = value !== 'false'
    if (row.key === 'vip_access_password') commonPassword = value
    if (row.key === 'vip_allowed_phones') allowedPhones = parseAllowedPhones(value)
  }
  return { enabled, commonPassword, allowedPhones }
}
export async function findIndividualPassword(db: SupabaseClient, phone: string) {
  const last9 = lastDigits9(phone)
  const { data, error } = await db.from('vip_individual_passwords').select('phone,password')
  if (error) return { error: true as const, row: null }
  const row = ((data || []) as { phone: string; password: string }[]).find(
    (r) => lastDigits9(String(r.phone ?? '')) === last9
  )
  return { error: false as const, row: row ?? null }
}
export type VipCheck =
  | { ok: true; needsPasswordChange: boolean; phone: string; individualPhone: string | null }
  | { ok: false; status: number; error: string }
const DENIED = 'Accès VIP refusé. Vérifiez votre numéro et votre mot de passe.'
export async function verifyVipCredentials(rawPhone: unknown, rawPassword: unknown): Promise<VipCheck> {
  const phone = typeof rawPhone === 'string' ? normalizePhone(rawPhone) : ''
  const password = typeof rawPassword === 'string' ? rawPassword : ''
  if (!phone || !password) {
    return { ok: false, status: 400, error: 'Veuillez saisir votre numéro de téléphone et le mot de passe VIP.' }
  }
  const db = vipServiceClient()
  const settings = await loadVipSettings(db)
  if (!settings) return { ok: false, status: 500, error: 'Configuration VIP indisponible. Réessayez dans quelques instants.' }
  if (!settings.enabled) return { ok: false, status: 403, error: 'L’accès VIP est momentanément désactivé.' }
  if (settings.allowedPhones.length === 0) {
    return { ok: false, status: 503, error: 'Accès VIP non configuré : aucun numéro autorisé. Contactez la boutique.' }
  }
  if (!phonesMatch(phone, settings.allowedPhones)) return { ok: false, status: 401, error: DENIED }
  const individual = await findIndividualPassword(db, phone)
  if (individual.error) return { ok: false, status: 500, error: 'Configuration VIP indisponible. Réessayez dans quelques instants.' }
  const match = individual.row
  // A5 : numero autorise mais ni mot de passe individuel ni commun : message explicite renvoye par le serveur
  if (!match && !settings.commonPassword) {
    return { ok: false, status: 403, error: 'Votre numéro est autorisé, mais aucun mot de passe n’a encore été défini pour votre accès. Utilisez « Mot de passe perdu ? » ou contactez la boutique.' }
  }
  const passwordOk = match
    ? safeEqual(password, String(match.password ?? ''))
    : safeEqual(password, settings.commonPassword)
  if (!passwordOk) return { ok: false, status: 401, error: DENIED }
  return { ok: true, needsPasswordChange: !match, phone, individualPhone: match ? match.phone : null }
}
