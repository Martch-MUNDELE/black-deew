// BLAC-P3-015 : image de campagne (apercu WhatsApp). Base simulee en memoire, aucun reseau.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { resetFakeDb, getFakeTable, createClient } = await import('./helpers/fake-supabase.mjs')
const {
  runCampaignsAction, validateCampaignInput, isValidCampaignImageUrl,
  CAMPAIGN_IMAGE_MAX_LENGTH, CAMPAIGN_IMAGE_COLUMN_MISSING_MESSAGE,
} = await import('../lib/campaigns.ts')
const { loadPublicCampaign, resolveCampaignOgImage } = await import('../lib/campaign-public.ts')

const ADMIN = { ok: true, email: 'admin@example.test', role: 'owner' }
const FALLBACK = 'https://black-deew.vercel.app/og-image.png'
const IMG = 'https://cdn.example.test/products/offre.png'
const valid = {
  name: 'Merci VIP', promotion_id: 'promo-1', message: 'Profite de -10 % ce week-end.',
  audience_mode: 'all_consenting',
}
const seed = (campaigns = []) =>
  resetFakeDb({ promotion_rules: [{ id: 'promo-1', name: 'Moins 10 pour cent', status: 'active' }], campaigns })

// Base simulee dont la table campaigns n'a pas la colonne image_url.
function dbWithoutImageColumn() {
  const base = createClient()
  const err = { data: null, error: { code: '42703', message: 'column campaigns.image_url does not exist' } }
  const failing = () => {
    const f = {
      select() { return f }, order() { return f }, eq() { return f }, single() { return Promise.resolve(err) },
      maybeSingle() { return Promise.resolve(err) }, then(res, rej) { return Promise.resolve(err).then(res, rej) },
    }
    return f
  }
  return {
    from(t) {
      if (t !== 'campaigns') return base.from(t)
      const q = base.from(t)
      const sel = q.select.bind(q)
      const ins = q.insert.bind(q)
      const upd = q.update.bind(q)
      q.select = (cols) => (typeof cols === 'string' && cols.includes('image_url') ? failing() : sel(cols))
      q.insert = (row) => (row && 'image_url' in row ? failing() : ins(row))
      q.update = (patch) => (patch && 'image_url' in patch ? failing() : upd(patch))
      return q
    },
  }
}

test('validation : https accepte, http et autres refuses, longueur maximale 500', () => {
  assert.equal(isValidCampaignImageUrl(IMG), true)
  assert.equal(isValidCampaignImageUrl('http://cdn.example.test/a.png'), false)
  assert.equal(isValidCampaignImageUrl('ftp://cdn.example.test/a.png'), false)
  assert.equal(isValidCampaignImageUrl('javascript:alert(1)'), false)
  assert.equal(isValidCampaignImageUrl('pas une adresse'), false)
  const at500 = 'https://x.test/' + 'a'.repeat(CAMPAIGN_IMAGE_MAX_LENGTH - 'https://x.test/'.length)
  assert.equal(at500.length, 500)
  assert.equal(isValidCampaignImageUrl(at500), true)
  assert.equal(isValidCampaignImageUrl(at500 + 'a'), false)

  const ok = validateCampaignInput({ ...valid, image_url: IMG })
  assert.equal(ok.ok, true)
  assert.equal(ok.value.image_url, IMG)
  const none = validateCampaignInput(valid)
  assert.equal(none.ok, true)
  assert.equal(none.value.image_url, null)
  const http = validateCampaignInput({ ...valid, image_url: 'http://cdn.example.test/a.png' })
  assert.equal(http.ok, false)
  assert.match(http.error, /https/)
  const long = validateCampaignInput({ ...valid, image_url: at500 + 'a' })
  assert.equal(long.ok, false)
  assert.match(long.error, /trop longue/)
})

test('lecture tolerante : colonne absente, relecture sans image, aucune erreur', async () => {
  seed([{ id: 'c1', name: 'A', promotion_id: 'promo-1', message: 'm', status: 'draft', created_at: '2026-11-01T10:00:00Z' }])
  const r = await runCampaignsAction({ check: ADMIN, db: dbWithoutImageColumn(), method: 'GET' })
  assert.equal(r.status, 200)
  assert.notEqual(r.body.unavailable, true)
  assert.equal(r.body.campaigns.length, 1)
  assert.equal(r.body.campaigns[0].image_url ?? null, null)
})

test('ecriture : image refusee proprement sans la colonne, campagne sans image toujours creee', async () => {
  seed()
  const refused = await runCampaignsAction({ check: ADMIN, db: dbWithoutImageColumn(), method: 'POST', body: { ...valid, image_url: IMG } })
  assert.equal(refused.status, 400)
  assert.equal(refused.body.error, CAMPAIGN_IMAGE_COLUMN_MISSING_MESSAGE)
  assert.equal(getFakeTable('campaigns').length, 0)

  const created = await runCampaignsAction({ check: ADMIN, db: dbWithoutImageColumn(), method: 'POST', body: valid })
  assert.equal(created.status, 201)
  assert.equal(getFakeTable('campaigns').length, 1)
  assert.equal('image_url' in getFakeTable('campaigns')[0], false)

  const patch = await runCampaignsAction({
    check: ADMIN, db: dbWithoutImageColumn(), method: 'PATCH', body: { id: getFakeTable('campaigns')[0].id, image_url: IMG },
  })
  assert.equal(patch.status, 400)
  assert.equal(patch.body.error, CAMPAIGN_IMAGE_COLUMN_MISSING_MESSAGE)
})

test('ecriture avec colonne : image enregistree, lue, puis retiree', async () => {
  seed()
  const created = await runCampaignsAction({ check: ADMIN, db: createClient(), method: 'POST', body: { ...valid, image_url: IMG } })
  assert.equal(created.status, 201)
  const id = getFakeTable('campaigns')[0].id
  assert.equal(getFakeTable('campaigns')[0].image_url, IMG)
  const refused = await runCampaignsAction({ check: ADMIN, db: createClient(), method: 'PATCH', body: { id, image_url: 'http://x.test/a.png' } })
  assert.equal(refused.status, 400)
  assert.equal(getFakeTable('campaigns')[0].image_url, IMG)
  const removed = await runCampaignsAction({ check: ADMIN, db: createClient(), method: 'PATCH', body: { id, image_url: null } })
  assert.equal(removed.status, 200)
  assert.equal(getFakeTable('campaigns')[0].image_url, null)
})

test('metadonnees : image de la campagne si https, sinon repli', async () => {
  assert.equal(resolveCampaignOgImage(IMG, FALLBACK), IMG)
  assert.equal(resolveCampaignOgImage(undefined, FALLBACK), FALLBACK)
  assert.equal(resolveCampaignOgImage(null, FALLBACK), FALLBACK)
  assert.equal(resolveCampaignOgImage('', FALLBACK), FALLBACK)
  assert.equal(resolveCampaignOgImage('http://cdn.example.test/a.png', FALLBACK), FALLBACK)

  const row = (extra) => ({
    id: 'c1', name: 'A', promotion_id: 'promo-1', message: 'm', status: 'ready', starts_at: null, ends_at: null, ...extra,
  })
  seed([row({ image_url: IMG })])
  assert.equal((await loadPublicCampaign(createClient(), 'c1')).imageUrl, IMG)
  seed([row({ image_url: 'http://cdn.example.test/a.png' })])
  assert.equal((await loadPublicCampaign(createClient(), 'c1')).imageUrl, undefined)
  seed([row({})])
  assert.equal((await loadPublicCampaign(createClient(), 'c1')).imageUrl, undefined)
  // Colonne absente : la page reste disponible, sans image.
  seed([row({})])
  const offer = await loadPublicCampaign(dbWithoutImageColumn(), 'c1')
  assert.ok(offer)
  assert.equal(offer.imageUrl, undefined)
})

test('la page d\'offre utilise l\'image resolue dans openGraph et twitter', () => {
  const src = readFileSync(new URL('../app/offre/page.tsx', import.meta.url), 'utf8')
  assert.match(src, /resolveCampaignOgImage\(offer\.imageUrl, OG_IMAGE\)/)
  assert.match(src, /images: ogImages/)
  assert.match(src, /images: \[ogImage\]/)
})
