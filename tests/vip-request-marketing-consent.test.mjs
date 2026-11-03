import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resetFakeDb, getFakeTable, createClient as fakeCreateClient } from './helpers/fake-supabase.mjs'
import { install, declareTable, getLog, clearLog } from './helpers/strict-fake-db.mjs'
import { makeReq, uniqueIp } from './helpers/req.mjs'

const route = await import('@/app/api/vip-request/route')

// Le push admin passe par fetch : on le neutralise (aucun reseau)
globalThis.fetch = async () => new Response('{}', { status: 200 })

const BASE_COLS = ['id', 'phone', 'pseudo', 'status', 'requested_password', 'created_at']
const MARKETING_COLS = ['marketing_opt_in', 'marketing_opt_in_at', 'marketing_opt_in_source']

install()
const proto = Object.getPrototypeOf(fakeCreateClient().from('x'))

function setup({ withMarketingColumns }) {
  declareTable('vip_access_requests', withMarketingColumns ? [...BASE_COLS, ...MARKETING_COLS] : BASE_COLS)
  resetFakeDb({ vip_access_requests: [] })
  clearLog()
}

const call = (extra = {}) =>
  route.POST(
    makeReq('http://x/api/vip-request', {
      ip: uniqueIp(),
      body: { phone: '+243810000001', pseudo: 'Martch', requested_password: 'secret1', ...extra },
    })
  )

const inserts = () => getLog().filter((l) => l.table === 'vip_access_requests' && l.op === 'insert')

test('marketing_opt_in vrai : enregistre avec le booleen, la date et la source demande', async () => {
  setup({ withMarketingColumns: true })
  const before = Date.now()
  const res = await call({ marketing_opt_in: true })
  assert.equal(res.status, 201)
  const rows = getFakeTable('vip_access_requests')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].marketing_opt_in, true)
  assert.equal(rows[0].marketing_opt_in_source, 'demande')
  const at = Date.parse(rows[0].marketing_opt_in_at)
  assert.ok(Number.isFinite(at) && at >= before - 1000 && at <= Date.now() + 1000)
  assert.equal(inserts().length, 1)
})

test('marketing_opt_in faux : demande enregistree avec faux', async () => {
  setup({ withMarketingColumns: true })
  const res = await call({ marketing_opt_in: false })
  assert.equal(res.status, 201)
  const rows = getFakeTable('vip_access_requests')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].marketing_opt_in, false)
  assert.equal(rows[0].marketing_opt_in_source, 'demande')
  assert.ok(Number.isFinite(Date.parse(rows[0].marketing_opt_in_at)))
})

test('champ absent : demande acceptee sans les colonnes d accord (un seul insert)', async () => {
  setup({ withMarketingColumns: false })
  const res = await call()
  assert.equal(res.status, 201)
  const rows = getFakeTable('vip_access_requests')
  assert.equal(rows.length, 1)
  for (const c of MARKETING_COLS) assert.ok(!(c in rows[0]), `colonne ${c} ne doit pas etre envoyee`)
  assert.equal(inserts().length, 1)
  for (const c of MARKETING_COLS) assert.ok(!inserts()[0].columns.includes(c))
})

for (const bad of ['oui', 'true', 1, 0, null, {}, []]) {
  test(`valeur non booleenne ${JSON.stringify(bad)} : traitee comme absente, sans erreur`, async () => {
    setup({ withMarketingColumns: false })
    const res = await call({ marketing_opt_in: bad })
    assert.equal(res.status, 201)
    const rows = getFakeTable('vip_access_requests')
    assert.equal(rows.length, 1)
    for (const c of MARKETING_COLS) assert.ok(!(c in rows[0]))
    assert.equal(inserts().length, 1)
    for (const c of MARKETING_COLS) assert.ok(!inserts()[0].columns.includes(c))
  })
}

test('colonnes inconnues refusees par la base : insertion refaite une seule fois sans elles, reponse 201', async () => {
  setup({ withMarketingColumns: false })
  const res = await call({ marketing_opt_in: true })
  assert.equal(res.status, 201)
  const ins = inserts()
  assert.equal(ins.length, 2)
  assert.ok(MARKETING_COLS.every((c) => ins[0].columns.includes(c)))
  assert.ok(MARKETING_COLS.every((c) => !ins[1].columns.includes(c)))
  const rows = getFakeTable('vip_access_requests')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].phone.includes('810000001'), true)
  for (const c of MARKETING_COLS) assert.ok(!(c in rows[0]))
})

test('autre erreur d insertion : erreur serveur 500, pas de nouvelle tentative', async () => {
  setup({ withMarketingColumns: true })
  const original = proto._run
  let attempts = 0
  proto._run = function () {
    if (this.table === 'vip_access_requests' && this.op === 'insert') {
      attempts++
      return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
    }
    return original.call(this)
  }
  try {
    const res = await call({ marketing_opt_in: true })
    assert.equal(res.status, 500)
    assert.deepEqual(await res.json(), { error: 'Erreur serveur' })
    assert.equal(attempts, 1)
  } finally {
    proto._run = original
  }
})

test('validations existantes inchangees : champs manquants -> 400', async () => {
  setup({ withMarketingColumns: true })
  const res = await route.POST(makeReq('http://x/api/vip-request', { ip: uniqueIp(), body: { marketing_opt_in: true } }))
  assert.equal(res.status, 400)
  assert.equal(getFakeTable('vip_access_requests').length, 0)
})

test('validations existantes inchangees : doublon pending -> 409', async () => {
  setup({ withMarketingColumns: true })
  assert.equal((await call({ marketing_opt_in: true })).status, 201)
  assert.equal((await call({ marketing_opt_in: true })).status, 409)
  assert.equal(getFakeTable('vip_access_requests').length, 1)
})

// --- Lecture du texte du formulaire ---
const formSrc = readFileSync(new URL('../components/VipAccessRequestForm.tsx', import.meta.url), 'utf8')

test('formulaire : role switch et aria-checked', () => {
  assert.match(formSrc, /role="switch"/)
  assert.match(formSrc, /aria-checked=\{marketingOptIn\}/)
  assert.match(formSrc, /aria-labelledby="vip-marketing-label"/)
  assert.match(formSrc, /id="vip-marketing-label"/)
  assert.match(formSrc, /Recevoir les nouvelles offres/)
})

test('formulaire : les deux phrases d aide et la ligne sous le bouton', () => {
  assert.ok(formSrc.includes('Offres réservées aux VIP, envoyées par WhatsApp. Pas plus d’une par semaine.') ||
            formSrc.includes("Offres réservées aux VIP, envoyées par WhatsApp. Pas plus d'une par semaine."))
  assert.ok(formSrc.includes('Tu ne recevras aucune offre. Tu garderas ton accès VIP.'))
  assert.ok(formSrc.includes('Tu peux changer ce choix à tout moment depuis ton compte VIP.'))
  assert.ok(formSrc.indexOf('Envoyer ma demande') < formSrc.indexOf('Tu peux changer ce choix'))
})

test('formulaire : etat initial vrai, envoye dans le corps JSON, cible tactile 44 px', () => {
  assert.match(formSrc, /const \[marketingOptIn, setMarketingOptIn\] = useState\(true\)/)
  assert.match(formSrc, /marketing_opt_in: marketingOptIn/)
  assert.match(formSrc, /minHeight: 44/)
})
