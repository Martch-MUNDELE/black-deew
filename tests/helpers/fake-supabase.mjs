// Faux client Supabase en memoire (aucun reseau, aucune base reelle).
function db() {
  if (!globalThis.__FAKE_DB__) globalThis.__FAKE_DB__ = { tables: {} }
  return globalThis.__FAKE_DB__
}
export function resetFakeDb(tables = {}) {
  globalThis.__FAKE_DB__ = { tables: structuredClone(tables) }
}
export function getFakeTable(name) {
  return db().tables[name] ?? []
}
class Query {
  constructor(table) {
    this.table = table
    this.op = 'select'
    this.filters = []
    this.patch = null
    this.opts = {}
  }
  select() { return this }
  order(c) { this.sortKey = c; return this }
  in(c, a) { this.filters.push((r) => a.includes(r[c])); return this }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this }
  is(c, v) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this }
  gt(c, v) { this.filters.push((r) => new Date(r[c]).getTime() > new Date(v).getTime()); return this }
  like(c, p) {
    const re = new RegExp('^' + p.replace(/[.*+?^()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$')
    this.filters.push((r) => re.test(String(r[c] ?? '')))
    return this
  }
  update(patch) { this.op = 'update'; this.patch = patch; return this }
  upsert(row, opts) { this.op = 'upsert'; this.patch = row; this.opts = opts || {}; return this }
  _run() {
    const d = db()
    if (!d.tables[this.table]) d.tables[this.table] = []
    const rows = d.tables[this.table]
    if (this.op === 'upsert') {
      const key = this.opts.onConflict
      const idx = key ? rows.findIndex((r) => r[key] === this.patch[key]) : -1
      if (idx >= 0) Object.assign(rows[idx], this.patch)
      else rows.push({ ...this.patch })
      return { data: [this.patch], error: null }
    }
    const matched = rows.filter((r) => this.filters.every((f) => f(r)))
    if (this.op === 'update') {
      matched.forEach((r) => Object.assign(r, this.patch))
      return { data: matched.map((r) => ({ ...r })), error: null }
    }
    const out = matched.map((r) => ({ ...r }))
    if (this.sortKey) out.sort((a, b) => String(a[this.sortKey] ?? '').localeCompare(String(b[this.sortKey] ?? '')))
    return { data: out, error: null }
  }
  maybeSingle() {
    const r = this._run()
    return Promise.resolve({ data: r.data[0] ?? null, error: r.error })
  }
  single() { return this.maybeSingle() }
  then(res, rej) { return Promise.resolve(this._run()).then(res, rej) }
}
export function createClient() {
  return { from: (t) => new Query(t) }
}
