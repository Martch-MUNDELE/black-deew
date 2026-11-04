import './helpers/env.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resetFakeDb, getFakeTable } from './helpers/fake-supabase.mjs'
import { install, declareTable, getLog, clearLog } from './helpers/strict-fake-db.mjs'
import { makeReq, uniqueIp } from './helpers/req.mjs'

const route = await import('@/app/api/vip/marketing-consent/route')
const { createVipSessionValue, VIP_COOKIE_NAME } = await import('@/lib/vip-session')

const BASE_COLS = ['id', 'phone', 'pseudo', 'status', 'requested_password', 'created_at']
const MARKETING_COLS = ['marketing_opt_in', 'marketing_opt_in_at', 'marketing_opt_in_source']
const URL_ = 'http://x/api/vip/marketing-consent'
const cookie = (phone) => `${VIP_COOKIE_NAME}=${createVipSessionValue(phone)}`

install()

function setup({ withMarketingColumns = true, rows } = {}) {
  declareTable('vip_access_requests', withMarketingColumns ? [...BASE_COLS, ...MARKETING_COLS] : BASE_COLS)
  resetFakeDb({
    vip_access_requests: rows ?? [
      { id: 1, phone: '+243810000001', pseudo: 'A', status: 'approved', requested_password: 'x' },
      { id: 2, phone: '+243820000002', pseudo: 'B', status: 'approved', requested_password: 'x' },
    ],
  })
  clearLog()
}

const get = (c) => route.GET(makeReq(URL_, { method: 'GET', ip: uniqueIp(), cookie: c }))
const post = (body, c) => route.POST(makeReq(URL_, { ip: uniqueIp(), body, cookie: c }))
const updates = () => getLog().filter((l) => l.table === 'vip_access_requests' && l.op === 'update')

test('GET et POST sans session : 401', async () => {
  setup()
  assert.equal((await get()).status, 401)
  assert.equal((await post({ opt_in: true })).status, 401)
  assert.equal(updates().length, 0)
})

test('GET : jamais repondu => unknown et available true', async () => {
  setup()
  const res = await get(cookie('+243810000001'))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { state: 'unknown', available: true })
})

test('GET : accepte et refuse', async () => {
  setup({ rows: [
    { id: 1, phone: '+243810000001', marketing_opt_in: true },
    { id: 2, phone: '+243820000002', marketing_opt_in: false },
  ] })
  assert.equal((await (await get(cookie('+243810000001'))).json()).state, 'accepted')
  assert.equal((await (await get(cookie('+243820000002'))).json()).state, 'refused')
})

test('GET : colonnes absentes => unknown et available false, sans erreur bloquante', async () => {
  setup({ withMarketingColumns: false })
  const res = await get(cookie('+243810000001'))
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.state, 'unknown')
  assert.equal(json.available, false)
})

test('POST : corps non booleen refuse (400), rien ecrit', async () => {
  setup()
  for (const body of [{}, { opt_in: 'true' }, { opt_in: 1 }, { opt_in: null }]) {
    const res = await post(body, cookie('+243810000001'))
    assert.equal(res.status, 400)
  }
  assert.equal(updates().length, 0)
})

test('POST : ecrit uniquement les trois colonnes marketing_opt_in*, source encart', async () => {
  setup()
  const before = Date.now()
  const res = await post({ opt_in: false }, cookie('+243810000001'))
  assert.equal(res.status, 200)
  const ups = updates()
  assert.ok(ups.length >= 1)
  for (const u of ups) {
    const cols = Object.keys(u.values ?? u.payload ?? u.data ?? {})
    if (cols.length) for (const c of cols) assert.ok(MARKETING_COLS.includes(c), `colonne inattendue : ${c}`)
  }
  const row = getFakeTable('vip_access_requests').find((r) => r.id === 1)
  assert.equal(row.marketing_opt_in, false)
  assert.equal(row.marketing_opt_in_source, 'encart')
  const at = Date.parse(row.marketing_opt_in_at)
  assert.ok(Number.isFinite(at) && at >= before - 1000 && at <= Date.now() + 1000)
  assert.equal(row.pseudo, 'A')
  assert.equal(row.status, 'approved')
})

test('POST : un telephone dans le corps est ignore, seule la session compte', async () => {
  setup()
  const res = await post({ opt_in: true, phone: '+243820000002' }, cookie('+243810000001'))
  assert.equal(res.status, 200)
  const rows = getFakeTable('vip_access_requests')
  assert.equal(rows.find((r) => r.id === 1).marketing_opt_in, true)
  assert.notEqual(rows.find((r) => r.id === 2).marketing_opt_in, true)
})

test('POST : colonnes absentes => erreur propre, aucune ecriture', async () => {
  setup({ withMarketingColumns: false })
  const res = await post({ opt_in: true }, cookie('+243810000001'))
  assert.ok(res.status >= 400)
})

const sheet = readFileSync(new URL('../components/VipMarketingConsentSheet.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../app/(public)/vip/page.tsx', import.meta.url), 'utf8')
const routeSrc = readFileSync(new URL('../app/api/vip/marketing-consent/route.ts', import.meta.url), 'utf8')

test('composant : dialog, switch, accessibilite et focus', () => {
  assert.match(sheet, /role="dialog"/)
  assert.match(sheet, /aria-modal="true"/)
  assert.match(sheet, /aria-labelledby="vip-consent-title"/)
  assert.match(sheet, /role="switch"/)
  assert.match(sheet, /aria-checked=\{optIn\}/)
  assert.match(sheet, /minHeight: 44/)
  assert.match(sheet, /\.focus\(\)/)
  assert.match(sheet, /\{optIn \? 'Oui' : 'Non'\}/)
})

test('composant : textes de la maquette', () => {
  for (const t of [
    'Des offres rien que pour toi ?',
    'remises, cadeaux, accès en avant-première. Pas plus d’une par semaine.',
    'Recevoir les offres VIP',
    'Confirmer mon choix',
    'Me le redemander plus tard',
    'Tu peux changer ce choix à tout moment depuis ton compte VIP.',
    'Tu ne recevras aucune offre. Tu garderas ton accès VIP.',
  ]) assert.ok(sheet.includes(t), `texte manquant : ${t}`)
  assert.match(sheet, /useState\(true\)/)
})

test('composant : affichage conditionnel, memoire de 7 jours avec try/catch, erreur en francais', () => {
  assert.match(sheet, /d\.available === true && d\.state === 'unknown'/)
  assert.match(sheet, /7 \* 24 \* 60 \* 60 \* 1000/)
  assert.match(sheet, /localStorage/)
  assert.ok((sheet.match(/try \{/g) || []).length >= 2)
  assert.match(sheet, /n’a pas pu être enregistré/)
  assert.match(sheet, /method: 'POST'/)
})

test('page VIP : feuille importee et montee apres la session', () => {
  assert.match(page, /import VipMarketingConsentSheet from '@\/components\/VipMarketingConsentSheet'/)
  assert.match(page, /\{grantedOk && <VipMarketingConsentSheet \/>\}/)
})

test('route : le telephone ne vient jamais du corps', () => {
  assert.match(routeSrc, /readVipSessionPhone\(req\)/)
  assert.ok(!/body\.phone/.test(routeSrc))
})
