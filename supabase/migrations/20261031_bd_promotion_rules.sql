-- BLAC-P2-013 : tables des règles de promotions (adapté de base-food BF-P2-001). NON APPLIQUÉE.
-- BF-P2-001 - Promotion rules V1
-- Préparation locale uniquement.
-- Ne pas exécuter en production sans validation humaine.

create table if not exists public.promotion_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'inactive')),
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 100,
  scope text not null default 'all'
    check (scope in ('all', 'classic', 'vip', 'mixed')),
  trigger_type text not null
    check (trigger_type in (
      'cart_amount',
      'cart_quantity',
      'product',
      'category',
      'vip_purchase',
      'classic_purchase',
      'mixed_purchase'
    )),
  trigger_product_ids uuid[] default '{}',
  trigger_category_ids text[] default '{}',
  minimum_order_amount numeric(12,2),
  minimum_quantity integer,
  benefit_type text not null
    check (benefit_type in ('gift_product', 'percent_discount')),
  gift_product_ids uuid[] default '{}',
  discount_percent numeric(5,2),
  exclude_discounted_products boolean not null default true,
  stacking_mode text not null default 'best_offer'
    check (stacking_mode in (
      'exclusive',
      'best_offer',
      'cumulable_gift_only',
      'cumulable_discount_only'
    )),
  customer_message text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promotion_rules_status_idx
  on public.promotion_rules (status);

create index if not exists promotion_rules_dates_idx
  on public.promotion_rules (starts_at, ends_at);

create index if not exists promotion_rules_priority_idx
  on public.promotion_rules (priority);

comment on table public.promotion_rules is
  'BF-P2-001 - Règles promotions génériques Base food V1';

-- BF-P2-001 - Promotion rules V2 constraints
-- Local only. Do not apply to Supabase production without explicit validation.

do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.promotion_rules'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%benefit_type%';

  if c is not null then
    execute format('alter table public.promotion_rules drop constraint %I', c);
  end if;
end $$;

alter table if exists public.promotion_rules
  add constraint promotion_rules_benefit_type_v2_check
  check (benefit_type in ('gift_product', 'percent_discount', 'free_delivery', 'fixed_discount'));

do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.promotion_rules'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%trigger_type%';

  if c is not null then
    execute format('alter table public.promotion_rules drop constraint %I', c);
  end if;
end $$;

alter table if exists public.promotion_rules
  add constraint promotion_rules_trigger_type_v2_check
  check (trigger_type in (
    'cart_amount',
    'cart_quantity',
    'product',
    'category',
    'vip_purchase',
    'classic_purchase',
    'mixed_purchase',
    'promo_code'
  ));

-- BLAC-P2-013 : securite par lignes (non appliquee, fichier du depot uniquement).
-- Lecture/ecriture reservees aux utilisateurs authentifies (admin). Aucun acces anonyme.
-- La route serveur /api/commandes utilise la cle service (contourne la RLS).
alter table public.promotion_rules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'promotion_rules'
      and policyname = 'promotion_rules_authenticated_all'
  ) then
    create policy "promotion_rules_authenticated_all"
      on public.promotion_rules
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- BLAC-P2-013 : documentation des colonnes cles (fichier du depot uniquement, non appliquee)
comment on column public.promotion_rules.stacking_mode is
  'BLAC-P2-013 - stacking_mode : exclusive, best_offer, cumulable_gift_only ou cumulable_discount_only';
comment on column public.promotion_rules.exclude_discounted_products is
  'BLAC-P2-013 - true par defaut : les produits deja remises (products.discount > 0) sont exclus des regles';
