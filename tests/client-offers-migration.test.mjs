import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = new URL('../supabase/migrations/20261103_bd_client_offers.sql', import.meta.url);
const sql = readFileSync(file, 'utf8');
const marker = '-- RETOUR ARRIÈRE';
const idx = sql.indexOf(marker);
const body = idx >= 0 ? sql.slice(0, idx) : sql;
const bodyLower = body.toLowerCase();
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ');
const n = norm(body);

test('en-tête APPLIQUÉE en production', () => {
  assert.match(sql.split('\n').slice(0, 4).join('\n'), /APPLIQUÉE en production le 3 novembre 2026 \(version Supabase 20261103202806\) : ne pas réexécuter/);
});

test('création idempotente de la table', () => {
  assert.ok(n.includes('create table if not exists public.client_offers'));
});

test('colonnes demandées', () => {
  for (const frag of [
    'id uuid primary key default gen_random_uuid()',
    'phone text not null',
    'promotion_id uuid not null',
    'campaign_label text',
    'reason text',
    "status text not null default 'active'",
    'starts_at timestamptz',
    'ends_at timestamptz',
    'used_at timestamptz',
    'used_order_id uuid',
    'created_at timestamptz not null default now()',
  ]) assert.ok(n.includes(frag), 'manquant : ' + frag);
});

test('contraintes de valeurs reason et status', () => {
  assert.ok(n.includes("check (reason in ('manual', 'best_client', 'win_back'))"));
  assert.ok(n.includes("check (status in ('active', 'used', 'expired', 'cancelled'))"));
});

test('référence à promotion_rules avec cascade', () => {
  assert.ok(n.includes('references public.promotion_rules(id) on delete cascade'));
});

test('deux index', () => {
  assert.ok(n.includes('create index if not exists client_offers_phone_status_idx on public.client_offers (phone, status)'));
  assert.ok(n.includes('create index if not exists client_offers_promotion_idx on public.client_offers (promotion_id)'));
});

test('row level security activée', () => {
  assert.ok(n.includes('alter table public.client_offers enable row level security'));
});

test('aucune politique', () => {
  assert.ok(!/create\s+policy/i.test(body));
});

test('aucune instruction destructrice hors retour arrière', () => {
  const code = body.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').toLowerCase();
  for (const kw of ['drop', 'truncate', 'delete', 'update', 'grant', 'revoke']) {
    const re = kw === 'delete' ? /\bdelete\s+from\b/ : new RegExp('\\b' + kw + '\\b');
    assert.ok(!re.test(code), 'instruction interdite : ' + kw);
  }
});

test('retour arrière présent en commentaire', () => {
  assert.ok(idx >= 0);
  const tail = sql.slice(idx).split('\n').filter((l) => l.trim() && !l.trim().startsWith('--'));
  assert.equal(tail.length, 0, 'le retour arrière doit être entièrement commenté');
  assert.ok(/--\s*drop table if exists public\.client_offers;/i.test(sql));
});
