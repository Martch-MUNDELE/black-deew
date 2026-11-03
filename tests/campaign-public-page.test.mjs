// BLAC-P2-027 : page publique d'une offre de campagne, base simulee en memoire. Aucune vraie base, aucun envoi.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

await import('./helpers/env.mjs')
const { resetFakeDb, createClient } = await import('./helpers/fake-supabase.mjs')
const { loadPublicCampaign, buildCampaignPublicUrl } = await import('../lib/campaign-public.ts')
const { buildWhatsappLink } = await import('../lib/campaign-sends.ts')
const { STOP_LINE } = await import('../lib/campaigns.ts')

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-11-10T12:00:00.000Z')
const iso = (offsetDays) => new Date(NOW + offsetDays * DAY).toISOString()

const seed = (over = {}) =>
  resetFakeDb({
    campaigns: [
      {
        id: 'c1',
        name: 'Merci VIP',
        promotion_id: 'p1',
        message: 'Profite de -10 % ce week-end.\n\n' + STOP_LINE,
        starts_at: iso(-1),
        ends_at: iso(5),
        status: 'ready',
        audience_mode: 'all_consenting',
        ...over,
      },
    ],
    promotion_rules: [{ id: 'p1', name: 'Réduction week-end', status: 'active' }],
  })

const load = (id = 'c1', now = NOW, db = createClient()) => loadPublicCampaign(db, id, now)

test('campagne valide : seulement name, message, promotionName, startsAt, endsAt, sans ligne STOP', async () => {
  seed()
  const res = await load()
  assert.ok(res)
  assert.deepEqual(Object.keys(res).sort(), ['endsAt', 'message', 'name', 'promotionName', 'startsAt'])
  assert.equal(res.name, 'Merci VIP')
  assert.equal(res.promotionName, 'Réduction week-end')
  assert.ok(!res.message.includes(STOP_LINE))
  assert.ok(res.message.includes('-10 %'))
})

test('brouillon refuse', async () => {
  seed({ status: 'draft' })
  assert.equal(await load(), null)
})

test('campagne annulee refusee', async () => {
  seed({ status: 'cancelled' })
  assert.equal(await load(), null)
})

test('hors dates refuse (avant le debut et apres la fin)', async () => {
  seed()
  assert.equal(await load('c1', NOW - 3 * DAY), null)
  assert.equal(await load('c1', NOW + 10 * DAY), null)
})

test('identifiant inconnu ou vide : null', async () => {
  seed()
  assert.equal(await load('inconnu'), null)
  assert.equal(await load(''), null)
})

test('table absente ou en erreur : null, jamais d erreur', async () => {
  const err = { data: null, error: { code: '42P01' } }
  const failing = {
    select() { return this }, eq() { return this },
    maybeSingle() { return Promise.resolve(err) },
    then(res, rej) { return Promise.resolve(err).then(res, rej) },
  }
  assert.equal(await load('c1', NOW, { from: () => failing }), null)
  const throwing = { from() { throw new Error('base indisponible') } }
  assert.equal(await load('c1', NOW, throwing), null)
})

test('adresse publique : <site>/offre?c=<id>', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL
  process.env.NEXT_PUBLIC_SITE_URL = 'https://exemple.test/'
  try {
    assert.equal(buildCampaignPublicUrl('c1'), 'https://exemple.test/offre?c=c1')
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = previous
  }
})

test('message WhatsApp : lien avant STOP, lien une fois, STOP une fois', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL
  process.env.NEXT_PUBLIC_SITE_URL = 'https://exemple.test'
  try {
    const url = buildWhatsappLink('+243810000001', 'Profite de -10 %.\n\n' + STOP_LINE, 'c1')
    const text = decodeURIComponent(url.split('?text=')[1])
    const link = "Voir l'offre : https://exemple.test/offre?c=c1"
    assert.equal(text.split(link).length - 1, 1)
    assert.equal(text.split(STOP_LINE).length - 1, 1)
    assert.ok(text.indexOf(link) < text.indexOf(STOP_LINE))
    assert.ok(text.endsWith(STOP_LINE))
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = previous
  }
})

test('sans identifiant de campagne, le message reste inchange (STOP une fois, pas de lien)', () => {
  const url = buildWhatsappLink('+243810000001', 'Salut')
  const text = decodeURIComponent(url.split('?text=')[1])
  assert.ok(!text.includes("Voir l'offre"))
  assert.equal(text.split(STOP_LINE).length - 1, 1)
})

test('aucune donnee client dans le code de la page ni de la logique publique', () => {
  const forbidden = /phone|telephone|campaign_sends|marketing_refusals|vip_access|vip_individual|client_offers|customer|orders/i
  for (const file of ['../app/offre/page.tsx', '../lib/campaign-public.ts']) {
    const code = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(!forbidden.test(code), `donnee client trouvee dans ${file}`)
  }
})

test('page : openGraph, title, description, etat neutre noindex, bouton Commander, parametre c', () => {
  const code = readFileSync(new URL('../app/offre/page.tsx', import.meta.url), 'utf8')
  assert.match(code, /export async function generateMetadata/)
  assert.match(code, /openGraph/)
  assert.match(code, /title/)
  assert.match(code, /description/)
  assert.match(code, /images/)
  assert.match(code, /index: false/)
  assert.match(code, /Cette offre n&apos;est plus disponible|Cette offre n'est plus disponible/)
  assert.match(code, /Commander/)
  assert.match(code, /searchParams/)
  assert.ok(!/\[c\]|\[id\]/.test(code))
})
