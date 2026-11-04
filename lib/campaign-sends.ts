// BLAC-P2-026 : file d'envoi WhatsApp d'une campagne (un clic par client, aucun envoi automatique).
// Logique pure (sans next/server) pour etre testee sur base simulee ; la route ne fait que l'appeler.
// Aucune donnee client dans les journaux. Table absente ou en erreur : 200 + unavailable true.
import { buildCampaignMessage, CAMPAIGN_AUDIENCES, STOP_LINE, type AdminCheckLike, type CampaignActionResult, type CampaignAudience } from '@/lib/campaigns'
import { selectBestClients, selectInactiveClients } from '@/lib/campaign-scenarios'
import { buildCampaignPublicUrl } from '@/lib/campaign-public'
import { getPhoneDigits } from '@/lib/phone-links'
import { normalizePhone, parseAllowedPhones, phonesMatch } from '@/lib/vip-server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = { from: (table: string) => any }

export const SEND_CAP_DAYS = 30
export const CAMPAIGN_SENDS_UNAVAILABLE_MESSAGE =
  "La file d'envoi n'est pas encore disponible : les tables nécessaires n'existent pas encore sur la base. Elles seront activées après validation de la migration."

// BLAC-P3-024 : pseudo (ou null) et texte exact du message ajoutes pour l'ecran 2 ; champs existants inchanges.
export type QueueItem = {
  phone: string
  status: 'to_send' | 'sent'
  whatsapp_url: string | null
  pseudo?: string | null
  message?: string | null
}

export const OFFER_LINE_PREFIX = "Voir l'offre : "
const OFFER_LINE_RE = /^[ \t]*Voir l'offre : .*$/gm

export const DEFAULT_PSEUDO = 'toi'
const VARIABLE_RE = /\{(pseudo|lien|date de fin)\}/g
const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export type MessageVariables = { pseudo?: string | null; endsAt?: unknown }

// Date en francais, ex. « lundi 30 novembre 2026 ». Date absente ou invalide : chaine vide.
export function formatFrenchDate(value: unknown): string {
  let t = NaN
  if (value instanceof Date) t = value.getTime()
  else if (typeof value === 'string' && value.trim()) t = Date.parse(value.trim())
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  return `${FR_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${FR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// Fonction pure : remplace {pseudo}, {lien} et {date de fin} en un seul passage (une valeur inseree n'est jamais reinterpretee).
// Pseudo inconnu : « toi ». Pas de date de fin : la variable disparait et les espaces laisses sont nettoyes.
export function applyCampaignVariables(
  message: string,
  vars: { pseudo?: string | null; offerUrl?: string | null; endsAt?: unknown } = {},
): string {
  const pseudo = typeof vars.pseudo === 'string' && vars.pseudo.trim() ? vars.pseudo.trim() : DEFAULT_PSEUDO
  const offerUrl = typeof vars.offerUrl === 'string' ? vars.offerUrl.trim() : ''
  const endDate = formatFrenchDate(vars.endsAt)
  let emptiedDate = false
  const out = String(message ?? '').replace(VARIABLE_RE, (_m, name: string) => {
    if (name === 'pseudo') return pseudo
    if (name === 'lien') return offerUrl
    if (!endDate) {
      emptiedDate = true
      return ''
    }
    return endDate
  })
  if (!emptiedDate) return out
  return out
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
}

// Message WhatsApp : texte, puis « Voir l'offre : <adresse> » (une seule fois, ancienne ligne remplacee), puis la ligne STOP (une seule fois).
// Si le texte contient deja {lien}, la ligne finale n'est pas ajoutee (pas de doublon). Sans identifiant de campagne : pas de lien, STOP seul.
export function buildCampaignMessageWithOffer(message: string, campaignId?: string | null, vars: MessageVariables = {}): string {
  const base = String(message ?? '')
    .split(STOP_LINE)
    .join('')
    .replace(OFFER_LINE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/, '')
  const ref = typeof campaignId === 'string' ? campaignId.trim() : ''
  // Accepte soit l'adresse complete de l'offre, soit l'identifiant de la campagne.
  const offerUrl = ref ? (/^https?:\/\//i.test(ref) ? ref : buildCampaignPublicUrl(ref)) : ''
  let text = base
  if (offerUrl && !base.includes('{lien}')) {
    const line = OFFER_LINE_PREFIX + offerUrl
    text = base ? `${base}\n\n${line}` : line
  }
  return buildCampaignMessage(applyCampaignVariables(text, { pseudo: vars.pseudo, offerUrl, endsAt: vars.endsAt }))
}

// Lien WhatsApp : https://wa.me/<chiffres>?text=<message encode>, lien de l'offre avant STOP, STOP exactement une fois.
export function buildWhatsappLink(
  phone: string,
  message: string,
  campaignId?: string | null,
  vars: MessageVariables = {},
): string | null {
  const digits = getPhoneDigits(phone)
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildCampaignMessageWithOffer(message, campaignId, vars))}`
}

type Row = Record<string, unknown>

class Unavailable extends Error {}

async function readRows(db: AdminDb, table: string, columns: string): Promise<Row[]> {
  const { data, error } = await db.from(table).select(columns)
  if (error || !Array.isArray(data)) throw new Unavailable()
  return data as Row[]
}

function phonesOf(rows: Row[]): string[] {
  return rows.map((r) => String(r.phone ?? '')).filter((p) => getPhoneDigits(p))
}

async function loadAllowedPhones(db: AdminDb): Promise<string[]> {
  const { data, error } = await db.from('settings').select('key,value').eq('key', 'vip_allowed_phones')
  if (error || !Array.isArray(data)) throw new Unavailable()
  const list: string[] = []
  for (const row of data as Row[]) {
    if (row.key === 'vip_allowed_phones') list.push(...parseAllowedPhones(String(row.value ?? '')))
  }
  const individual = phonesOf(await readRows(db, 'vip_individual_passwords', 'phone')).map(normalizePhone)
  const all: string[] = []
  for (const p of [...list, ...individual]) {
    if (p && !phonesMatch(p, all)) all.push(p)
  }
  return all
}

export const SCENARIO_UNAVAILABLE_MESSAGE =
  "Ce scénario n'est pas disponible pour le moment : les commandes ne peuvent pas être lues. Aucun client n'est proposé."

export type QueueResult = {
  items: QueueItem[]
  sent: number
  total: number
  audience: CampaignAudience
  unavailable?: boolean
}

class ScenarioUnavailable extends Error {}

// Scenario de la campagne : champ absent ou inconnu = all_consenting. Erreur de lecture de la campagne = indisponible.
async function loadAudience(db: AdminDb, campaignId: string): Promise<CampaignAudience> {
  const { data, error } = await db.from('campaigns').select('audience_mode').eq('id', campaignId).maybeSingle()
  if (error) throw new Unavailable()
  const mode = data && typeof data === 'object' ? (data as Row).audience_mode : null
  return (CAMPAIGN_AUDIENCES as readonly string[]).includes(String(mode)) ? (mode as CampaignAudience) : 'all_consenting'
}

// Numeros retenus par le scenario (null = pas de restriction). Table orders absente ou en erreur : ScenarioUnavailable, jamais de repli.
async function loadScenarioPhones(db: AdminDb, audience: CampaignAudience, nowMs: number): Promise<string[] | null> {
  if (audience === 'all_consenting') return null
  let rows: Row[]
  try {
    rows = await readRows(db, 'orders', 'customer_phone, customer_name, total, status, created_at')
  } catch {
    throw new ScenarioUnavailable()
  }
  const chosen = audience === 'best_clients' ? selectBestClients(rows, nowMs) : selectInactiveClients(rows, nowMs)
  return chosen.map((c) => c.phone)
}

// Destinataires eligibles : VIP autorises, restreints au scenario, hors refus, hors opt-out, hors envoi des 30 derniers jours.
export async function computeQueue(
  db: AdminDb,
  campaignId: string,
  nowMs: number = Date.now(),
): Promise<QueueResult> {
  const audience = await loadAudience(db, campaignId)
  let scenarioPhones: string[] | null
  try {
    scenarioPhones = await loadScenarioPhones(db, audience, nowMs)
  } catch (e) {
    if (e instanceof ScenarioUnavailable) return { items: [], sent: 0, total: 0, audience, unavailable: true }
    throw e
  }
  const allowed = await loadAllowedPhones(db)
  const refusals = phonesOf(await readRows(db, 'marketing_refusals', 'phone'))
  const optOuts = phonesOf(
    (await readRows(db, 'vip_access_requests', 'phone, marketing_opt_in')).filter((r) => r.marketing_opt_in === false),
  )
  const sends = await readRows(db, 'campaign_sends', 'campaign_id, phone, status, sent_at')
  const cutoff = nowMs - SEND_CAP_DAYS * 24 * 60 * 60 * 1000
  const recentSent = sends
    .filter((s) => s.status === 'sent' && Date.parse(String(s.sent_at ?? '')) >= cutoff)
    .map((s) => String(s.phone ?? ''))
  const alreadySentHere = sends.filter((s) => s.campaign_id === campaignId && s.status === 'sent').map((s) => String(s.phone ?? ''))

  const items: QueueItem[] = []
  for (const p of allowed) {
    if (scenarioPhones && !phonesMatch(p, scenarioPhones)) continue
    if (phonesMatch(p, refusals) || phonesMatch(p, optOuts)) continue
    if (phonesMatch(p, alreadySentHere)) {
      items.push({ phone: p, status: 'sent', whatsapp_url: null })
      continue
    }
    if (phonesMatch(p, recentSent)) continue
    items.push({ phone: p, status: 'to_send', whatsapp_url: null })
  }
  const sent = items.filter((i) => i.status === 'sent').length
  return { items, sent, total: items.length, audience }
}

function unavailable(): CampaignActionResult {
  return {
    status: 200,
    body: { unavailable: true, message: CAMPAIGN_SENDS_UNAVAILABLE_MESSAGE, queue: [], sent: 0, total: 0 },
  }
}

async function loadReadyCampaign(db: AdminDb, id: string) {
  const { data, error } = await db.from('campaigns').select('id, name, message, status, ends_at').eq('id', id).maybeSingle()
  if (error) throw new Unavailable()
  return data as { id: string; name?: string; message: string; status: string; ends_at?: string | null } | null
}

// Pseudos des clients VIP (lecture seule, table vip_access_requests deja utilisee par le module).
// Echec de lecture : liste vide, la file n'est jamais bloquee (le message dira « toi »).
async function loadPseudos(db: AdminDb): Promise<{ phone: string; pseudo: string }[]> {
  try {
    const rows = await readRows(db, 'vip_access_requests', 'phone, pseudo, status')
    const named = rows.filter(
      (r) => typeof r.pseudo === 'string' && r.pseudo.trim() && getPhoneDigits(String(r.phone ?? '')),
    )
    const ordered = [...named.filter((r) => r.status === 'approved'), ...named.filter((r) => r.status !== 'approved')]
    return ordered.map((r) => ({ phone: String(r.phone), pseudo: String(r.pseudo).trim() }))
  } catch {
    return []
  }
}

function pseudoFor(list: { phone: string; pseudo: string }[], phone: string): string | null {
  const found = list.find((e) => phonesMatch(phone, [e.phone]))
  return found ? found.pseudo : null
}

export async function runCampaignSendsAction(input: {
  check: AdminCheckLike
  db: AdminDb
  method: string
  campaignId?: string
  body?: unknown
}): Promise<CampaignActionResult> {
  const { check, db, method } = input
  if (!check.ok) return { status: check.status, body: { error: check.error } }

  try {
    if (method === 'GET') {
      const id = (input.campaignId ?? '').trim()
      if (!id) return { status: 400, body: { error: 'Identifiant de la campagne manquant' } }
      const campaign = await loadReadyCampaign(db, id)
      if (!campaign) return { status: 404, body: { error: 'Campagne introuvable' } }
      if (campaign.status !== 'ready') return { status: 409, body: { error: "La campagne n'est pas prête" } }
      const queue = await computeQueue(db, id)
      if (queue.unavailable) {
        return {
          status: 200,
          body: { unavailable: true, message: SCENARIO_UNAVAILABLE_MESSAGE, queue: [], sent: 0, total: 0, audience: queue.audience },
        }
      }
      const pseudos = await loadPseudos(db)
      const items = queue.items.map((i) => {
        const pseudo = pseudoFor(pseudos, i.phone)
        const vars = { pseudo, endsAt: campaign.ends_at ?? null }
        return {
          ...i,
          pseudo,
          message: buildCampaignMessageWithOffer(campaign.message, id, vars),
          whatsapp_url: i.status === 'to_send' ? buildWhatsappLink(i.phone, campaign.message, id, vars) : null,
        }
      })
      return { status: 200, body: { queue: items, sent: queue.sent, total: queue.total, audience: queue.audience } }
    }

    if (method === 'PATCH') {
      const p = (input.body && typeof input.body === 'object' ? input.body : {}) as Record<string, unknown>
      const id = typeof p.campaign_id === 'string' ? p.campaign_id.trim() : ''
      const rawPhone = typeof p.phone === 'string' ? p.phone : ''
      const phone = getPhoneDigits(rawPhone) ? normalizePhone(rawPhone) : ''
      const action = p.action
      if (!id) return { status: 400, body: { error: 'Identifiant de la campagne manquant' } }
      if (!phone) return { status: 400, body: { error: 'Numéro invalide' } }
      if (action !== 'sent' && action !== 'stop') return { status: 400, body: { error: 'Action invalide' } }
      const campaign = await loadReadyCampaign(db, id)
      if (!campaign) return { status: 404, body: { error: 'Campagne introuvable' } }
      if (campaign.status !== 'ready') return { status: 409, body: { error: "La campagne n'est pas prête" } }

      if (action === 'sent') {
        const queue = await computeQueue(db, id)
        if (queue.unavailable) {
          return {
            status: 200,
            body: { unavailable: true, message: SCENARIO_UNAVAILABLE_MESSAGE, queue: [], sent: 0, total: 0, audience: queue.audience },
          }
        }
        if (!phonesMatch(phone, queue.items.filter((i) => i.status === 'to_send').map((i) => i.phone))) {
          return { status: 409, body: { error: "Ce client ne fait pas partie de la file à contacter" } }
        }
      }

      const nowIso = new Date().toISOString()
      const patch = action === 'sent' ? { status: 'sent', sent_at: nowIso } : { status: 'refused' }
      const { data: existing, error: readErr } = await db
        .from('campaign_sends')
        .select('id')
        .eq('campaign_id', id)
        .eq('phone', phone)
        .maybeSingle()
      if (readErr) throw new Unavailable()
      const write = existing
        ? await db.from('campaign_sends').update(patch).eq('campaign_id', id).eq('phone', phone)
        : await db.from('campaign_sends').insert({ campaign_id: id, phone, created_at: nowIso, ...patch })
      if (write.error) throw new Unavailable()

      if (action === 'stop') {
        const { data: refused, error: refErr } = await db.from('marketing_refusals').select('phone').eq('phone', phone).maybeSingle()
        if (refErr) throw new Unavailable()
        if (!refused) {
          const ins = await db.from('marketing_refusals').insert({ phone, created_at: nowIso, source: 'whatsapp_stop' })
          if (ins.error) throw new Unavailable()
        }
      }
      return { status: 200, body: { ok: true, status: patch.status } }
    }

    return { status: 405, body: { error: 'Méthode non autorisée' } }
  } catch {
    // Pas de detail (peut contenir des donnees client) : message fixe.
    console.warn("[campaign-sends] base indisponible pour la file d'envoi")
    return unavailable()
  }
}
