// BLAC-P3-007 : faux client Supabase STRICT (aucun reseau, aucune vraie base).
// S'appuie sur le faux client en memoire existant (meme instance que celle chargee par le loader)
// et lui ajoute : schema connu (avant/apres les 3 scripts SQL), refus de toute colonne inconnue
// (42703 en lecture/filtre, PGRST204 en ecriture), table absente (42P01) et securite par lignes
// de promotion_rules / promotion_benefits (apres script : seul authenticated lit/ecrit, anon ne voit rien).
import { createClient as baseCreateClient, resetFakeDb, getFakeTable } from './fake-supabase.mjs'

export { resetFakeDb, getFakeTable }

const PROMO_ORDER_ITEM_COLS = [
  'line_type', 'original_unit_price', 'discount_percent', 'discount_amount',
  'is_promotion_gift', 'promotion_rule_id', 'promotion_label', 'can_trigger_promotion',
]
const ORDER_ITEMS_BASE = [
  'id', 'order_id', 'product_id', 'product_name', 'quantity', 'unit_price', 'is_vip',
  'selected_variants', 'variant_price_extra', 'variant_name', 'variant_price', 'created_at',
]
const RULES_COLS_SCRIPT_1 = [
  'id', 'name', 'description', 'status', 'starts_at', 'ends_at', 'priority', 'scope', 'trigger_type',
  'trigger_product_ids', 'trigger_category_ids', 'minimum_order_amount', 'minimum_quantity',
  'benefit_type', 'gift_product_ids', 'discount_percent', 'exclude_discounted_products',
  'stacking_mode', 'customer_message', 'admin_note', 'created_at', 'updated_at',
]
const RULES_COLS_SCRIPT_2 = [
  'promotion_mode', 'code', 'usage_limit_total', 'usage_limit_per_customer', 'usage_count',
  'customer_identifier_type', 'is_stackable',
]
const BENEFITS_COLS = [
  'id', 'promotion_rule_id', 'benefit_type', 'product_id', 'quantity', 'discount_percent',
  'fixed_discount_amount', 'free_delivery', 'sort_order', 'customer_message', 'admin_note',
  'created_at', 'updated_at',
]

export const PROMO_COLS = PROMO_ORDER_ITEM_COLS
export const ORDER_ITEMS_ORIGINAL_COLS = ORDER_ITEMS_BASE.filter((c) => c !== 'id' && c !== 'created_at')

// phase : 'before' (aucun script applique) ou 'after' (les 3 scripts appliques)
export function schemaFor(phase) {
  const after = phase === 'after'
  const s = {
    order_items: [...ORDER_ITEMS_BASE, ...(after ? PROMO_ORDER_ITEM_COLS : [])],
  }
  if (after) {
    s.promotion_rules = [...RULES_COLS_SCRIPT_1, ...RULES_COLS_SCRIPT_2]
    s.promotion_benefits = [...BENEFITS_COLS]
  }
  return s
}

const RLS_TABLES = new Set(['promotion_rules', 'promotion_benefits'])
const FUTURE_TABLES = new Set(['promotion_rules', 'promotion_benefits'])

const state = {
  phase: 'before',
  schema: schemaFor('before'),
  extra: {}, // tables declarees par le test (colonnes connues), strictes elles aussi
  log: [],
  installed: false,
}

const err = (code, message) => ({ code, message })

function columnsOf(table) {
  if (state.schema[table]) return state.schema[table]
  if (state.extra[table]) return state.extra[table]
  return null // table non declaree : non verifiee
}

function tableExists(table) {
  if (FUTURE_TABLES.has(table)) return Boolean(state.schema[table])
  return true
}

export function declareTable(name, columns) { state.extra[name] = [...columns] }
export function setPhase(phase) {
  state.phase = phase
  state.schema = schemaFor(phase)
}
export function getPhase() { return state.phase }
export function getLog() { return state.log }
export function clearLog() { state.log.length = 0 }

// Valide les lignes injectees comme jeu de donnees initial (refuse les colonnes inconnues).
export function seedStrict(tables) {
  for (const [table, rows] of Object.entries(tables)) {
    const cols = columnsOf(table)
    if (!cols) continue
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!cols.includes(k)) throw new Error(`seed refuse : colonne inconnue ${table}.${k} (phase ${state.phase})`)
      }
    }
  }
  resetFakeDb(tables)
}

export function install() {
  if (state.installed) return
  const proto = Object.getPrototypeOf(baseCreateClient().from('x'))
  const realRun = proto._run
  const checkCol = (q, c) => {
    if (q.__err) return
    const col = String(c).split('->')[0].trim()
    const cols = columnsOf(q.table)
    if (cols && !cols.includes(col)) q.__err = err('42703', `column ${q.table}.${col} does not exist`)
  }
  for (const m of ['eq', 'in', 'is', 'gt', 'like', 'order']) {
    const orig = proto[m]
    proto[m] = function (c, ...rest) { checkCol(this, c); return orig.call(this, c, ...rest) }
  }
  const origSelect = proto.select
  proto.select = function (cols, ...rest) {
    if (typeof cols === 'string' && cols.trim() !== '*' && !cols.includes('(')) {
      cols.split(',').map((x) => x.trim()).filter(Boolean).forEach((c) => checkCol(this, c))
    }
    return origSelect.call(this, cols, ...rest)
  }
  proto._run = function () {
    const role = this.__role || 'service'
    const table = this.table
    const isWrite = this.op !== 'select'
    state.log.push({ table, op: this.op, role, phase: state.phase, columns: isWrite && this.patch ? [].concat(this.patch).flatMap((r) => Object.keys(r)) : [] })
    if (!tableExists(table)) return { data: null, error: err('42P01', `relation "public.${table}" does not exist`) }
    if (this.__err) return { data: null, error: this.__err }
    const cols = columnsOf(table)
    if (cols && isWrite && this.patch && this.op !== 'delete') {
      for (const r of [].concat(this.patch)) {
        for (const k of Object.keys(r)) {
          if (!cols.includes(k)) {
            return { data: null, error: err('PGRST204', `Could not find the '${k}' column of '${table}' in the schema cache`) }
          }
        }
      }
    }
    if (RLS_TABLES.has(table) && state.phase === 'after' && role === 'anon') {
      if (isWrite) return { data: null, error: err('42501', `new row violates row-level security policy for table "${table}"`) }
      return { data: [], error: null } // lecture : aucune ligne visible
    }
    return realRun.call(this)
  }
  state.installed = true
}

// Client avec un role donne : 'anon' | 'authenticated' | 'service'
export function strictClient(role = 'service') {
  install()
  return {
    from: (t) => {
      const q = baseCreateClient().from(t)
      q.__role = role
      return q
    },
  }
}
