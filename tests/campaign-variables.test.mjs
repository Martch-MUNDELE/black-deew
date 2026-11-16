// BLAC-P3-023 : variables {pseudo}, {lien}, {date de fin} remplacees a l'envoi. Base simulee en memoire, aucune vraie base.
import test from 'node:test'
import assert from 'node:assert/strict'

await import('./helpers/env.mjs')
const { resetFakeDb, createClient } = await import('./helpers/fake-supabase.mjs')
const { applyCampaignVariables, buildCampaignMessageWithOffer, buildWhatsappLink, formatFrenchDate, runCampaignSendsAction, OFFER_LINE_PREFIX } =
  await import('../lib/campaign-sends.ts')
const { STOP_LINE, buildCampaignMessage } = await import('../lib/campaigns.ts')
const { buildCampaignPublicUrl } = await import('../lib/campaign-public.ts')

const count = (text, part) => text.split(part).length - 1
const URL1 = buildCampaignPublicUrl('c1')
const END = '2026-11-30T12:00:00Z'

test('les trois variables sont remplacees', () => {
  const out = buildCampaignMessageWithOffer("Salut {pseudo}, ton offre : {lien} valable jusqu'au {date de fin}.", 'c1', { pseudo: 'Kevin', endsAt: END })
  assert.ok(out.includes('Salut Kevin,'))
  assert.ok(out.includes(`ton offre : ${URL1} valable`))
  assert.ok(out.includes("jusqu'au lundi 30 novembre 2026."))
  assert.ok(!/\{(pseudo|lien|date de fin)\}/.test(out))
})

test('formatFrenchDate : exemple du ticket et valeurs invalides', () => {
  assert.equal(formatFrenchDate(END), 'lundi 30 novembre 2026')
  assert.equal(formatFrenchDate('2026-11-30'), 'lundi 30 novembre 2026')
  assert.equal(formatFrenchDate(null), '')
  assert.equal(formatFrenchDate(''), '')
  assert.equal(formatFrenchDate('pas une date'), '')
})

test('pseudo inconnu : le mot « toi »', () => {
  for (const pseudo of [undefined, null, '', '   ']) {
    const out = applyCampaignVariables('Salut {pseudo} !', { pseudo })
    assert.equal(out, 'Salut toi !')
  }
})

test('absence de date de fin : variable retiree proprement', () => {
  const out = buildCampaignMessageWithOffer("Offre valable {date de fin}.", 'c1', { pseudo: 'Kevin', endsAt: null })
  assert.ok(!out.includes('{'))
  assert.ok(!out.includes('undefined') && !out.includes('null'))
  assert.ok(out.startsWith('Offre valable.'))
  assert.ok(!/ {2,}/.test(out.split('\n')[0]))
})

test('{lien} deja present : pas de doublon, pas de ligne finale', () => {
  const out = buildCampaignMessageWithOffer('Clique ici : {lien}', 'c1', { pseudo: 'Kevin' })
  assert.equal(count(out, URL1), 1)
  assert.ok(!out.includes(OFFER_LINE_PREFIX))
  assert.ok(out.indexOf(URL1) < out.indexOf(STOP_LINE))
})

test('sans {lien} : comportement actuel conserve (ligne avant STOP)', () => {
  const out = buildCampaignMessageWithOffer('Profite de -10 %.', 'c1', { pseudo: 'Kevin' })
  assert.equal(out, `Profite de -10 %.\n\n${OFFER_LINE_PREFIX}${URL1}\n\n${STOP_LINE}`)
})

test('STOP exactement une fois, dans tous les cas', () => {
  const cases = [
    buildCampaignMessageWithOffer('Salut {pseudo}', 'c1', { pseudo: 'Kevin' }),
    buildCampaignMessageWithOffer(`Salut {pseudo}\n\n${STOP_LINE}`, 'c1', { pseudo: 'Kevin' }),
    buildCampaignMessageWithOffer('Voici {lien}', 'c1'),
    buildCampaignMessageWithOffer('Salut {pseudo} {date de fin}', null, {}),
  ]
  for (const out of cases) {
    assert.equal(count(out, STOP_LINE), 1)
    assert.ok(out.endsWith(STOP_LINE))
  }
})

test('message sans variable inchange', () => {
  assert.equal(buildCampaignMessageWithOffer('Profite de -10 %.', null), buildCampaignMessage('Profite de -10 %.'))
  assert.equal(buildCampaignMessageWithOffer('Profite de -10 %.', null, { pseudo: 'Kevin', endsAt: END }), `Profite de -10 %.\n\n${STOP_LINE}`)
  assert.equal(applyCampaignVariables('Rien a remplacer {autre}'), 'Rien a remplacer {autre}')
})

test('une valeur inseree n\'est jamais reinterpretee', () => {
  const out = applyCampaignVariables('Salut {pseudo} {lien}', { pseudo: '{lien}', offerUrl: 'https://x.test/o' })
  assert.equal(out, 'Salut {lien} https://x.test/o')
})

test('buildWhatsappLink transmet pseudo et date de fin', () => {
  const link = buildWhatsappLink('+243810000001', 'Salut {pseudo} {date de fin}', 'c1', { pseudo: 'Kevin', endsAt: END })
  const text = new URL(link).searchParams.get('text')
  assert.ok(text.startsWith('Salut Kevin lundi 30 novembre 2026'))
})

const P1 = '+243810000001'
const P5 = '+212600000005'
const seed = () =>
  resetFakeDb({
    campaigns: [{ id: 'c1', name: 'T', message: 'Salut {pseudo}, fin : {date de fin}.', status: 'ready', ends_at: END, audience_mode: 'all_consenting' }],
    settings: [{ key: 'vip_allowed_phones', value: JSON.stringify([P1]) }],
    vip_individual_passwords: [{ phone: P5, password: 'x' }],
    marketing_refusals: [],
    vip_access_requests: [{ phone: P1, pseudo: 'Kevin', status: 'approved', marketing_opt_in: true }],
    campaign_sends: [],
  })
const ADMIN = { ok: true, email: 'admin@example.test', role: 'owner' }
const textFor = (res, digits) => {
  const item = res.body.queue.find((i) => i.phone.includes(digits))
  assert.ok(item && item.whatsapp_url, 'client absent de la file')
  return new URL(item.whatsapp_url).searchParams.get('text')
}

test('file d\'envoi : pseudo lu en base, « toi » pour un numero inconnu, date de fin de la campagne', async () => {
  seed()
  const res = await runCampaignSendsAction({ check: ADMIN, db: createClient(), method: 'GET', campaignId: 'c1' })
  assert.equal(res.status, 200)
  assert.ok(textFor(res, '810000001').startsWith('Salut Kevin, fin : lundi 30 novembre 2026.'))
  assert.ok(textFor(res, '600000005').startsWith('Salut toi, fin : lundi 30 novembre 2026.'))
})

test('file d\'envoi : lecture des pseudos en echec = « toi », file non bloquee', async () => {
  seed()
  const base = createClient()
  const db = {
    from(table) {
      const q = base.from(table)
      if (table !== 'vip_access_requests') return q
      return { select: (cols) => (String(cols).includes('pseudo') ? Promise.resolve({ data: null, error: { code: 'x' } }) : q.select(cols)) }
    },
  }
  const res = await runCampaignSendsAction({ check: ADMIN, db, method: 'GET', campaignId: 'c1' })
  assert.equal(res.status, 200)
  assert.ok(!res.body.unavailable)
  assert.ok(textFor(res, '810000001').startsWith('Salut toi,'))
})
