// BLAC-P3-007 : parcours promotion complet avec base simulee STRICTE (aucun reseau, aucune vraie base).
import './helpers/env.mjs'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import {
  install, strictClient, setPhase, seedStrict, getFakeTable, getLog, clearLog,
  PROMO_COLS, ORDER_ITEMS_ORIGINAL_COLS,
} from './helpers/strict-fake-db.mjs'
import { makeReq } from './helpers/req.mjs'

install()
const fetchCalls = []
globalThis.fetch = async (u) => { fetchCalls.push(String(u)); return { ok: true, json: async () => ({}) } }
Object.defineProperty(Object.prototype, 'rpc', {
  configurable: true, writable: true, enumerable: false,
  value: async (n) => (n === 'get_next_invoice_seq' ? { data: 1, error: null } : { data: null, error: null }),
})
after(() => { delete Object.prototype.rpc })

const commandes = await import('@/app/api/commandes/route')
const publicRoute = await import('@/app/api/promotions/route')
const { loadActivePromotionRules, selectPublicPromotions } = await import('@/lib/promotion-rules')
const promos = await import('@/lib/promotions')

const PAST = '2020-01-01T00:00:00Z'
const FUTURE = '2099-01-01T00:00:00Z'
const base = (o) => ({
  description: null, status: 'active', starts_at: null, ends_at: null, priority: 1, scope: 'all',
  trigger_type: 'cart_amount', trigger_product_ids: [], trigger_category_ids: [],
  minimum_order_amount: null, minimum_quantity: null, benefit_type: 'percent_discount',
  gift_product_ids: [], discount_percent: null, exclude_discounted_products: true,
  stacking_mode: 'best_offer', customer_message: 'msg', admin_note: 'SECRET ADMIN',
  promotion_mode: 'automatic', code: null, usage_limit_total: null, usage_limit_per_customer: null,
  usage_count: 0, customer_identifier_type: null, is_stackable: false, ...o,
})
const pct10 = base({ id: 'r1', name: 'Remise 10', discount_percent: 10, minimum_order_amount: 150 })
const gift = base({ id: 'r2', name: 'Cadeau', benefit_type: 'gift_product', gift_product_ids: ['g1'], minimum_order_amount: 150 })
const second = base({ id: 'r3', name: 'Deuxieme article', trigger_type: 'cart_quantity', minimum_quantity: 2, discount_percent: 20 })
const codeRule = (o) => base({ id: 'rc', name: 'Code', trigger_type: 'promo_code', promotion_mode: 'promo_code', code: 'PROMO10', discount_percent: 10, ...o })

const PRODUCTS = [
  { id: 'p1', name: 'Produit 1', price: 100, discount: 0, variants: null, is_vip: false, active: true },
  { id: 'p2', name: 'Produit remise', price: 200, discount: 20, variants: null, is_vip: false, active: true },
  { id: 'pv', name: 'Produit VIP', price: 300, discount: 0, variants: null, is_vip: true, active: true },
  { id: 'g1', name: 'Cadeau', price: 50, discount: 0, variants: null, is_vip: false, active: true, stock: 10 },
]
function seed(phase, rules = [], benefits = []) {
  setPhase(phase)
  const t = {
    settings: [{ key: 'status', value: 'open' }],
    products: PRODUCTS, delivery_slots: [{ id: 's1', capacity: 50, booked: 0, blocked: false }],
    orders: [], order_items: [],
  }
  if (phase === 'after') { t.promotion_rules = rules; t.promotion_benefits = benefits }
  seedStrict(t)
  clearLog()
}
const body = (o = {}) => ({
  name: 'Client J', phone: '+33611111111', address: '1 rue J', slot_id: 's1',
  items: [{ product_id: 'p1', product_name: 'x', quantity: 2, unit_price: 1 }], ...o,
})
const post = (b) => commandes.POST(makeReq('http://x/api/commandes', { body: b }))
const lines = (cart) => cart.map((c) => ({
  product_id: c.id, product_name: c.id, quantity: c.q, unit_price: c.price, original_unit_price: c.price,
  product: PRODUCTS.find((p) => p.id === c.id), is_vip: !!c.vip, line_type: c.vip ? 'vip' : 'classic', can_trigger_promotion: true,
}))
const apply = (cart, rules, caps = { vipEnabled: true }) => promos.applyPromotions(lines(cart), PRODUCTS, rules, caps)

// ---------- (a) creation de regles ----------
test('J-a1 schema avant script : promotion_rules absente (42P01)', async () => {
  seed('before')
  const r = await strictClient('service').from('promotion_rules').select('*').eq('status', 'active')
  assert.equal(r.error?.code, '42P01')
})
test('J-a2 colonne inconnue refusee (42703 filtre, PGRST204 ecriture)', async () => {
  seed('after')
  const c = strictClient('authenticated')
  assert.equal((await c.from('promotion_rules').select('*').eq('colonne_x', 1)).error?.code, '42703')
  assert.equal((await c.from('promotion_rules').insert({ id: 'z', name: 'z', colonne_x: 1 })).error?.code, 'PGRST204')
  // colonne de script 2 refusee sur schema "avant script 2" : order_items sans colonnes promotion
  seed('before')
  assert.equal((await strictClient('service').from('order_items').insert({ line_type: 'classic' })).error?.code, 'PGRST204')
})
test('J-a3 regles valides inserees (pourcentage+seuil, cadeau, 2e article, code)', async () => {
  seed('after')
  const c = strictClient('authenticated')
  for (const r of [pct10, gift, second, codeRule()]) {
    const res = await c.from('promotion_rules').insert(r)
    assert.equal(res.error, null, `insertion ${r.id} : ${JSON.stringify(res.error)}`)
  }
  assert.equal(getFakeTable('promotion_rules').length, 4)
})
test('J-a4 regles invalides refusees (validateur applicatif)', async () => {
  seed('after')
  const bad = [
    base({ id: 'b1', name: 'pct>100', discount_percent: 150 }),
    base({ id: 'b2', name: 'pct negatif', discount_percent: -5 }),
    base({ id: 'b3', name: 'cadeau sans produit', benefit_type: 'gift_product', gift_product_ids: [] }),
    codeRule({ id: 'b4', code: '' }),
  ]
  const lib = await import('@/lib/promotion-rules')
  const validator = Object.entries({ ...lib, ...promos }).find(([k]) => /^(validate|isValid|check).*(Rule|Promotion)/i.test(k) && k !== 'checkPromoCodeUsage')
  assert.ok(validator, 'aucun validateur de regle exporte par lib/promotion-rules.ts ni lib/promotions.ts : refus des regles invalides non verifiable cote application (la base n applique les CHECK que via le script SQL)')
  for (const b of bad) {
    const out = validator[1](b)
    assert.ok(out === false || out?.ok === false || out?.valid === false || (Array.isArray(out) && out.length > 0) || (Array.isArray(out?.errors) && out.errors.length > 0), `regle ${b.id} acceptee`)
  }
})

// ---------- (b) liste publique ----------
const RULES_B = [
  pct10, base({ id: 'x1', name: 'inactive', status: 'inactive', discount_percent: 5 }),
  base({ id: 'x2', name: 'future', starts_at: FUTURE, discount_percent: 5 }),
  base({ id: 'x3', name: 'expiree', ends_at: PAST, discount_percent: 5 }),
  codeRule({ id: 'x4' }),
]
test('J-b1 service : seules les regles publiques, champs en liste blanche', async () => {
  seed('after', RULES_B)
  const rules = await loadActivePromotionRules(strictClient('service'))
  const pub = selectPublicPromotions(rules)
  assert.deepEqual(pub.map((p) => p.id), ['r1'])
  assert.deepEqual(Object.keys(pub[0]).sort(), ['benefit_type', 'customer_message', 'discount_percent', 'id', 'minimum_order_amount', 'minimum_quantity', 'name', 'scope'])
  const flat = JSON.stringify(pub)
  for (const f of ['admin_note', 'SECRET ADMIN', 'PROMO10', 'usage_count', 'usage_limit']) assert.ok(!flat.includes(f), `fuite : ${f}`)
})
test('J-b2 visiteur anonyme apres script SQL : aucune ligne visible (RLS)', async () => {
  seed('after', RULES_B)
  const anon = await loadActivePromotionRules(strictClient('anon'))
  assert.deepEqual(selectPublicPromotions(anon), [])
  assert.equal((await strictClient('anon').from('promotion_rules').insert(base({ id: 'h' , name: 'h' }))).error?.code, '42501')
})
test('J-b3 authentifie apres script SQL : lit et ecrit', async () => {
  seed('after', RULES_B)
  const auth = await loadActivePromotionRules(strictClient('authenticated'))
  assert.equal(auth.length >= 2, true)
  assert.equal((await strictClient('authenticated').from('promotion_benefits').insert({ id: 'bn1', promotion_rule_id: 'r1', benefit_type: 'percent_discount', quantity: 1, sort_order: 1 })).error, null)
  seed('after', RULES_B)
  assert.deepEqual((await strictClient('anon').from('promotion_benefits').select('*')).data, [])
})
test('J-b4 route GET /api/promotions : repond sans erreur, tableau promotions', async () => {
  seed('after', RULES_B)
  const res = await publicRoute.GET()
  const j = await res.json()
  assert.ok(Array.isArray(j.promotions))
  assert.ok(!JSON.stringify(j).includes('SECRET ADMIN'))
})
test('J-b5 avant script SQL : liste publique vide, sans exception', async () => {
  seed('before')
  assert.deepEqual(selectPublicPromotions(await loadActivePromotionRules(strictClient('service'))), [])
})

// ---------- (c) panier et apercu ----------
test('J-c1 panier au-dessus du seuil : remise 10% appliquee', () => {
  const r = apply([{ id: 'p1', q: 2, price: 100 }], [pct10])
  assert.equal(r.items[0].unit_price, 90)
  assert.equal(r.items[0].promotion_rule_id, 'r1')
})
test('J-c2 panier sous le seuil : aucune remise', () => {
  const r = apply([{ id: 'p1', q: 1, price: 100 }], [pct10])
  assert.equal(r.items[0].unit_price, 100)
  assert.equal(r.applied.length, 0)
})
test('J-c3 produit offert ajoute a prix 0', () => {
  const r = apply([{ id: 'p1', q: 2, price: 100 }], [gift])
  const g = r.items.find((i) => i.is_promotion_gift)
  assert.ok(g, 'ligne cadeau attendue')
  assert.equal(g.product_id, 'g1')
})
test('J-c4 apercu client : rejeu du calcul (sous seuil, au-dessus, cadeau, code promo)', () => {
  assert.equal(typeof promos.previewPublicPromotions, 'function')
  const pub = (r) => ({ id: r.id, name: r.name, customer_message: r.customer_message, benefit_type: r.benefit_type, discount_percent: r.discount_percent, minimum_order_amount: r.minimum_order_amount, minimum_quantity: r.minimum_quantity })
  // remise 10 % a partir de 150 : sous le seuil
  const under = promos.previewPublicPromotions([pub(pct10)], 100, 1)[0]
  assert.equal(under.eligible, false)
  assert.equal(under.discount, 0)
  assert.equal(under.finalPrice, 100)
  assert.equal(under.missingAmount, 50)
  // au-dessus du seuil : 200 -> remise 20, prix final 180
  const over = promos.previewPublicPromotions([pub(pct10)], 200, 2)[0]
  assert.equal(over.eligible, true)
  assert.equal(over.discount, 20)
  assert.equal(over.finalPrice, 180)
  assert.equal(over.missingAmount, 0)
  // cadeau : eligible au-dessus du seuil, aucune remise sur le prix
  const g = promos.previewPublicPromotions([pub(gift)], 200, 2)[0]
  assert.equal(g.eligible, true)
  assert.equal(g.discount, 0)
  assert.equal(g.finalPrice, 200)
  // code promo : le code valide donne 10 % cote moteur ; il est absent de la liste publique
  const filtered = promos.filterRulesForPromoCode([codeRule()], 'PROMO10')
  assert.equal(filtered.codeValid, true)
  const rc = apply([{ id: 'p1', q: 2, price: 100 }], [codeRule()])
  assert.equal(rc.items[0].unit_price, 90)
  assert.deepEqual(selectPublicPromotions([codeRule()]), [])
})

// ---------- (d) commande ----------
test('J-d1 apres script : remise falsifiee corrigee, colonnes promotion presentes', async () => {
  seed('after', [pct10])
  const res = await post(body({ items: [{ product_id: 'p1', product_name: 'x', quantity: 2, unit_price: 1, discount_percent: 99, discount_amount: 500, original_unit_price: 1, promotion_rule_id: 'forge', is_promotion_gift: true, line_type: 'promotion_gift' }] }))
  assert.equal(res.status, 200)
  const row = getFakeTable('order_items')[0]
  assert.equal(row.unit_price, 90)
  assert.equal(row.discount_percent, 10)
  assert.equal(row.promotion_rule_id, 'r1')
  assert.equal(row.is_promotion_gift, false)
  for (const c of PROMO_COLS) assert.ok(c in row, `colonne manquante : ${c}`)
  assert.equal(getFakeTable('orders')[0].total, 180)
})
test('J-d2 avant script : colonnes d origine uniquement, prix serveur', async () => {
  seed('before')
  const res = await post(body({ items: [{ product_id: 'p1', product_name: 'x', quantity: 2, unit_price: 1, discount_percent: 99 }] }))
  assert.equal(res.status, 200)
  const row = getFakeTable('order_items')[0]
  assert.deepEqual(Object.keys(row).sort(), [...ORDER_ITEMS_ORIGINAL_COLS].sort())
  assert.equal(row.unit_price, 100)
  assert.equal(getFakeTable('orders')[0].total, 200)
})
test('J-d3 avant script avec regle en memoire : aucune ecriture de colonne inconnue par la route', async () => {
  seed('before')
  await post(body())
  const bad = getLog().filter((l) => l.table === 'order_items' && l.op === 'insert').flatMap((l) => l.columns).filter((c) => PROMO_COLS.includes(c))
  assert.deepEqual(bad, [])
})
test('J-d4 aucun appel reseau reel (fetch stubbe uniquement)', () => {
  assert.ok(fetchCalls.every((u) => u.startsWith('http://x/')))
})

// ---------- (e) limites d usage ----------
test('J-e1 limite totale : compteur incremente puis 409 quand epuise', async () => {
  seed('after', [codeRule({ usage_limit_total: 1, usage_count: 0 })])
  const r1 = await post(body({ promo_code: 'PROMO10' }))
  assert.equal(r1.status, 200)
  assert.equal(getFakeTable('promotion_rules')[0].usage_count, 1)
  const r2 = await post(body({ promo_code: 'PROMO10' }))
  assert.equal(r2.status, 409)
})
test('J-e2 code invalide : 400', async () => {
  seed('after', [codeRule()])
  assert.equal((await post(body({ promo_code: 'FAUX' }))).status, 400)
})
test('J-e3 limite par client : 2e commande du meme telephone refusee (409)', async () => {
  seed('after', [codeRule({ usage_limit_per_customer: 1, usage_limit_total: null })])
  assert.equal((await post(body({ promo_code: 'PROMO10' }))).status, 200)
  const r2 = await post(body({ promo_code: 'PROMO10' }))
  assert.equal(r2.status, 409, 'limite par client non appliquee par la route (BLAC-P2-014 limite connue)')
})

// ---------- (f) cumul ----------
test('J-f1 exclusive : une seule regle appliquee', () => {
  const a = base({ id: 'f1', name: 'A', discount_percent: 10, minimum_order_amount: 100, stacking_mode: 'exclusive', priority: 1 })
  const b = base({ id: 'f2', name: 'B', discount_percent: 20, minimum_order_amount: 100, stacking_mode: 'exclusive', priority: 2 })
  const r = apply([{ id: 'p1', q: 2, price: 100 }], [a, b])
  assert.equal(new Set(r.applied.map((x) => x.promotion_id)).size, 1)
})
test('J-f2 best_offer : la meilleure remise est retenue', () => {
  const a = base({ id: 'f1', name: 'A', discount_percent: 10, minimum_order_amount: 100 })
  const b = base({ id: 'f2', name: 'B', discount_percent: 20, minimum_order_amount: 100 })
  const r = apply([{ id: 'p1', q: 2, price: 100 }], [a, b])
  assert.equal(r.items[0].unit_price, 80)
})
test('J-f3 cumulable_gift_only : cadeau + remise cumulables', () => {
  const a = base({ id: 'f1', name: 'A', discount_percent: 10, minimum_order_amount: 100, stacking_mode: 'cumulable_discount_only' })
  const g = base({ id: 'f2', name: 'G', benefit_type: 'gift_product', gift_product_ids: ['g1'], minimum_order_amount: 100, stacking_mode: 'cumulable_gift_only' })
  const r = apply([{ id: 'p1', q: 2, price: 100 }], [a, g])
  assert.ok(r.items.some((i) => i.is_promotion_gift), 'cadeau attendu')
  assert.equal(r.items[0].unit_price, 90)
})

// ---------- (g) VIP ----------
test('J-g1 commande VIP sans session VIP : 401', async () => {
  seed('after', [pct10])
  const res = await post(body({ items: [{ product_id: 'pv', product_name: 'x', quantity: 1, unit_price: 1 }] }))
  assert.equal(res.status, 401)
})
test('J-g2 regle scope vip : appliquee au VIP, refusee au classique', () => {
  const v = base({ id: 'v1', name: 'VIP', scope: 'vip', discount_percent: 10, minimum_order_amount: 100 })
  assert.equal(apply([{ id: 'pv', q: 1, price: 300, vip: true }], [v]).items[0].unit_price, 270)
  assert.equal(apply([{ id: 'p1', q: 2, price: 100 }], [v]).items[0].unit_price, 100)
})
test('J-g3 site VIP desactive : regle VIP rejetee', () => {
  const v = base({ id: 'v1', name: 'VIP', scope: 'vip', discount_percent: 10, minimum_order_amount: 100 })
  const r = apply([{ id: 'pv', q: 1, price: 300, vip: true }], [v], { vipEnabled: false })
  assert.equal(r.items[0].unit_price, 300)
})

// ---------- (h) produits deja remises ----------
test('J-h1 produit deja remis exclu (exclude_discounted_products)', () => {
  const r = apply([{ id: 'p2', q: 2, price: 160 }], [base({ id: 'h1', name: 'H', discount_percent: 10, minimum_order_amount: 100 })])
  assert.equal(r.items[0].unit_price, 160)
  assert.equal(r.items[0].promotion_rule_id ?? null, null)
})
test('J-h2 commande : produit deja remis garde son prix remise, sans colonne promotion', async () => {
  seed('after', [base({ id: 'h1', name: 'H', discount_percent: 10, minimum_order_amount: 100 })])
  const res = await post(body({ items: [{ product_id: 'p2', product_name: 'x', quantity: 2, unit_price: 1 }] }))
  assert.equal(res.status, 200)
  const row = getFakeTable('order_items')[0]
  assert.equal(row.unit_price, 160)
  assert.equal(row.promotion_rule_id ?? null, null)
})

// ---------- BLAC-P3-008 : corrections ----------
test('J-a5 validation : chaque valeur invalide est refusee avec un message francais', async () => {
  const { validatePromotionRule } = await import('@/lib/promotion-rules')
  const cases = [
    ['pct 0', { benefit_type: 'percent_discount', discount_percent: 0 }],
    ['pct 150', { benefit_type: 'percent_discount', discount_percent: 150 }],
    ['pct -5', { benefit_type: 'percent_discount', discount_percent: -5 }],
    ['montant negatif', { minimum_order_amount: -10 }],
    ['quantite nulle', { minimum_quantity: 0 }],
    ['quantite negative', { minimum_quantity: -2 }],
    ['code vide', { promotion_mode: 'promo_code', code: '' }],
    ['code avec espace', { promotion_mode: 'promo_code', code: 'AB CD' }],
    ['fin avant debut', { starts_at: '2026-02-01T00:00:00Z', ends_at: '2026-01-01T00:00:00Z' }],
    ['cadeau sans produit', { benefit_type: 'gift_product', gift_product_ids: [] }],
  ]
  for (const [label, rule] of cases) {
    const out = validatePromotionRule(rule)
    assert.equal(out.ok, false, `${label} acceptee`)
    assert.ok(out.errors.length > 0 && /[a-z]/i.test(out.errors[0]), `${label} sans message`)
  }
  assert.equal(validatePromotionRule({ benefit_type: 'percent_discount', discount_percent: 10, minimum_order_amount: 150 }).ok, true)
  assert.equal(validatePromotionRule({ promotion_mode: 'promo_code', code: 'PROMO10', benefit_type: 'percent_discount', discount_percent: 100 }).ok, true)
})
test('J-a6 commande : une regle invalide est ignoree cote serveur', async () => {
  seed('after', [base({ id: 'bad', name: 'pct150', discount_percent: 150, minimum_order_amount: 100 })])
  const res = await post(body())
  assert.equal(res.status, 200)
  assert.equal(getFakeTable('order_items')[0].unit_price, 100)
})
test('J-b3 route publique : le visiteur voit les promotions publiques apres scripts SQL (cle de service cote serveur)', async () => {
  seed('after', RULES_B)
  const anon = await loadActivePromotionRules(strictClient('anon'))
  assert.deepEqual(selectPublicPromotions(anon), [])
  const res = await publicRoute.GET()
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.deepEqual(json.promotions.map((p) => p.id), ['r1'])
  const flat = JSON.stringify(json)
  for (const f of ['admin_note', 'SECRET ADMIN', 'PROMO10', 'usage_count']) assert.ok(!flat.includes(f), `fuite : ${f}`)
})
test('J-b4 route publique : cle de service absente -> liste vide sans erreur', async () => {
  seed('after', RULES_B)
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const res = await publicRoute.GET()
    assert.equal(res.status, 200)
    assert.deepEqual((await res.json()).promotions, [])
  } finally {
    if (saved !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved
  }
})
