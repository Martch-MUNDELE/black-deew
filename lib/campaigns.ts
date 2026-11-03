// BLAC-P2-025 : campagnes Marketing (creation, liste, annulation). Aucun envoi, aucun visuel.
// Logique pure (sans next/server) pour etre testee sur base simulee ; la route ne fait que l'appeler.
// Aucune donnee client dans les journaux. Table absente ou en erreur : 200 + unavailable true.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = { from: (table: string) => any }

export type AdminCheckLike =
  | { ok: true; email: string; role: string | null }
  | { ok: false; status: number; error: string }

export type CampaignActionResult = { status: number; body: Record<string, unknown> }

export const STOP_LINE = 'Réponds STOP pour ne plus recevoir nos offres.'
export const CAMPAIGN_AUDIENCES = ['all_consenting', 'best_clients', 'inactive_clients'] as const
export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number]
export const CAMPAIGN_STATUSES = ['draft', 'ready', 'cancelled'] as const

export const CAMPAIGNS_UNAVAILABLE_MESSAGE =
  "Les campagnes ne sont pas encore disponibles : la table des campagnes n'existe pas encore sur la base. Elle sera activée après validation de la migration."

const CAMPAIGN_COLUMNS_BASE = 'id, name, promotion_id, message, starts_at, ends_at, status, audience_mode, created_at'
const CAMPAIGN_COLUMNS = CAMPAIGN_COLUMNS_BASE + ', image_url'

// BLAC-P3-015 : image facultative de la campagne (apercu WhatsApp).
export const CAMPAIGN_IMAGE_MAX_LENGTH = 500
export const CAMPAIGN_IMAGE_COLUMN_MISSING_MESSAGE = "La colonne image n'existe pas encore sur la base"

// Vrai si la requete a echoue parce que la colonne image_url est absente.
function isMissingImageColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const msg = typeof e.message === 'string' ? e.message : ''
  return code === '42703' || code === 'PGRST204' || /image_url/i.test(msg)
}

// Adresse d'image valide : https uniquement, longueur maximale 500.
export function isValidCampaignImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (!v || v.length > CAMPAIGN_IMAGE_MAX_LENGTH) return false
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}

// Ajoute la ligne STOP a la fin, une seule fois (jamais en double si elle est deja presente).
export function buildCampaignMessage(text: string): string {
  const base = String(text ?? '')
    .split(STOP_LINE)
    .join('')
    .replace(/\s+$/, '')
  return base ? base + '\n\n' + STOP_LINE : STOP_LINE
}

export type CampaignInput = {
  name: string
  promotion_id: string
  message: string
  starts_at: string | null
  ends_at: string | null
  audience_mode: CampaignAudience
  image_url: string | null
}

function parseOptionalDate(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return { ok: false }
  return { ok: true, value: new Date(ms).toISOString() }
}

export function validateCampaignInput(
  payload: unknown,
): { ok: true; value: CampaignInput } | { ok: false; error: string } {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const name = typeof p.name === 'string' ? p.name.trim().slice(0, 120) : ''
  if (!name) return { ok: false, error: 'Nom de la campagne manquant' }
  const message = typeof p.message === 'string' ? p.message.split(STOP_LINE).join('').trim() : ''
  if (!message) return { ok: false, error: 'Message manquant' }
  const promotionId = typeof p.promotion_id === 'string' ? p.promotion_id.trim() : ''
  if (!promotionId) return { ok: false, error: 'Promotion manquante' }
  const audience = p.audience_mode
  if (typeof audience !== 'string' || !(CAMPAIGN_AUDIENCES as readonly string[]).includes(audience)) {
    return { ok: false, error: 'Audience invalide' }
  }
  const starts = parseOptionalDate(p.starts_at)
  const ends = parseOptionalDate(p.ends_at)
  if (!starts.ok || !ends.ok) return { ok: false, error: 'Date invalide' }
  if (starts.value && ends.value && Date.parse(ends.value) <= Date.parse(starts.value)) {
    return { ok: false, error: 'La date de fin doit être postérieure à la date de début' }
  }
  let imageUrl: string | null = null
  const rawImage = p.image_url
  if (rawImage !== undefined && rawImage !== null && !(typeof rawImage === 'string' && rawImage.trim() === '')) {
    if (typeof rawImage !== 'string') return { ok: false, error: "L'adresse de l'image est invalide" }
    const trimmed = rawImage.trim()
    if (trimmed.length > CAMPAIGN_IMAGE_MAX_LENGTH) {
      return { ok: false, error: "L'adresse de l'image est trop longue (500 caractères maximum)" }
    }
    if (!isValidCampaignImageUrl(trimmed)) {
      return { ok: false, error: "L'adresse de l'image doit commencer par https://" }
    }
    imageUrl = trimmed
  }
  return {
    ok: true,
    value: {
      name,
      promotion_id: promotionId,
      message,
      starts_at: starts.value,
      ends_at: ends.value,
      audience_mode: audience as CampaignAudience,
      image_url: imageUrl,
    },
  }
}

function campaignsUnavailable(): CampaignActionResult {
  return { status: 200, body: { unavailable: true, message: CAMPAIGNS_UNAVAILABLE_MESSAGE, campaigns: [], rules: [] } }
}

function badRequest(error: string): CampaignActionResult {
  return { status: 400, body: { error } }
}

async function loadRuleOptions(db: AdminDb): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db.from('promotion_rules').select('id, name, status').eq('status', 'active')
  if (error || !Array.isArray(data)) return []
  return data
    .filter((r: { id?: unknown }) => typeof r.id === 'string')
    .map((r: { id: string; name?: string | null }) => ({ id: r.id, name: String(r.name ?? r.id) }))
}

export async function runCampaignsAction(input: {
  check: AdminCheckLike
  db: AdminDb
  method: string
  body?: unknown
}): Promise<CampaignActionResult> {
  const { check, db, method } = input
  if (!check.ok) return { status: check.status, body: { error: check.error } }

  try {
    if (method === 'GET') {
      let { data, error } = await db
        .from('campaigns')
        .select(CAMPAIGN_COLUMNS)
        .order('created_at', { ascending: false })
      if (error && isMissingImageColumn(error)) {
        // Colonne image absente : relecture sans image_url, image vide, sans erreur.
        const retry = await db
          .from('campaigns')
          .select(CAMPAIGN_COLUMNS_BASE)
          .order('created_at', { ascending: false })
        data = Array.isArray(retry.data) ? retry.data.map((r: Record<string, unknown>) => ({ ...r, image_url: null })) : retry.data
        error = retry.error
      }
      if (error || !Array.isArray(data)) return campaignsUnavailable()
      const campaigns = [...data].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      return { status: 200, body: { campaigns, rules: await loadRuleOptions(db) } }
    }

    if (method === 'POST') {
      const v = validateCampaignInput(input.body)
      if (!v.ok) return badRequest(v.error)
      const { data: rule, error: ruleErr } = await db
        .from('promotion_rules')
        .select('id, name, status')
        .eq('id', v.value.promotion_id)
        .maybeSingle()
      if (ruleErr) return campaignsUnavailable()
      if (!rule) return badRequest('Promotion introuvable')
      const { image_url: imageUrl, ...rest } = v.value
      const row: Record<string, unknown> = {
        id: globalThis.crypto.randomUUID(),
        ...rest,
        status: 'draft',
        created_at: new Date().toISOString(),
      }
      if (imageUrl) row.image_url = imageUrl
      const { data, error } = await db.from('campaigns').insert(row).select().single()
      if (error) {
        if (imageUrl && isMissingImageColumn(error)) return badRequest(CAMPAIGN_IMAGE_COLUMN_MISSING_MESSAGE)
        return campaignsUnavailable()
      }
      return { status: 201, body: { ok: true, campaign: data ?? row } }
    }

    if (method === 'PATCH') {
      const payload = (input.body && typeof input.body === 'object' ? input.body : {}) as Record<string, unknown>
      const id = typeof payload.id === 'string' ? payload.id.trim() : ''
      if (!id) return badRequest('Identifiant de la campagne manquant')
      const hasImageField = Object.prototype.hasOwnProperty.call(payload, 'image_url')
      const status = payload.status
      if (hasImageField && status === undefined) {
        // Changement d'image seul (ajout ou retrait), sans changer le statut.
        const raw = payload.image_url
        const removing = raw === null || (typeof raw === 'string' && raw.trim() === '')
        if (!removing && !isValidCampaignImageUrl(raw)) {
          return badRequest(
            typeof raw === 'string' && raw.trim().length > CAMPAIGN_IMAGE_MAX_LENGTH
              ? "L'adresse de l'image est trop longue (500 caractères maximum)"
              : "L'adresse de l'image doit commencer par https://",
          )
        }
        const { data: found, error: foundErr } = await db.from('campaigns').select('id').eq('id', id).maybeSingle()
        if (foundErr) return campaignsUnavailable()
        if (!found) return { status: 404, body: { error: 'Campagne introuvable' } }
        const nextImage = removing ? null : String(raw).trim()
        const { error: imgErr } = await db.from('campaigns').update({ image_url: nextImage }).eq('id', id)
        if (imgErr) {
          if (isMissingImageColumn(imgErr)) return badRequest(CAMPAIGN_IMAGE_COLUMN_MISSING_MESSAGE)
          return campaignsUnavailable()
        }
        return { status: 200, body: { ok: true, campaign: { id, image_url: nextImage } } }
      }
      if (status !== 'cancelled' && status !== 'ready') return badRequest('Statut invalide')
      let { data: current, error: readErr } = await db
        .from('campaigns')
        .select(CAMPAIGN_COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (readErr && isMissingImageColumn(readErr)) {
        const retry = await db.from('campaigns').select(CAMPAIGN_COLUMNS_BASE).eq('id', id).maybeSingle()
        current = retry.data ? { ...retry.data, image_url: null } : retry.data
        readErr = retry.error
      }
      if (readErr) return campaignsUnavailable()
      if (!current) return { status: 404, body: { error: 'Campagne introuvable' } }
      const allowed = status === 'ready' ? current.status === 'draft' : current.status === 'draft' || current.status === 'ready'
      if (!allowed) {
        return {
          status: 409,
          body: { error: status === 'ready' ? 'Seul un brouillon peut être marqué prêt' : 'Cette campagne ne peut plus être annulée' },
        }
      }
      const { error: updErr } = await db.from('campaigns').update({ status }).eq('id', id)
      if (updErr) return campaignsUnavailable()
      return { status: 200, body: { ok: true, campaign: { ...current, status } } }
    }

    return { status: 405, body: { error: 'Méthode non autorisée' } }
  } catch {
    // Pas de detail (peut contenir des donnees client) : message fixe.
    console.warn('[campaigns] base indisponible pour les campagnes')
    return campaignsUnavailable()
  }
}
