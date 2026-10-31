-- BLAC-P2-013 : avantages de promotions (adapté de base-food BF-P2-001). NON APPLIQUÉE.
-- BF-P2-001 - Promotions V2 benefits + promo codes
-- Préparation locale uniquement.
-- Ne pas exécuter en production Supabase sans validation humaine explicite.

-- Extension progressive de promotion_rules.
alter table if exists public.promotion_rules
  add column if not exists promotion_mode text not null default 'automatic'
    check (promotion_mode in ('automatic', 'promo_code')),
  add column if not exists code text,
  add column if not exists usage_limit_total integer,
  add column if not exists usage_limit_per_customer integer,
  add column if not exists usage_count integer not null default 0,
  add column if not exists customer_identifier_type text
    check (customer_identifier_type in ('phone', 'email', 'customer_id')),
  add column if not exists is_stackable boolean not null default false;

-- Table enfant des avantages multiples.
create table if not exists public.promotion_benefits (
  id uuid primary key default gen_random_uuid(),
  promotion_rule_id uuid not null references public.promotion_rules(id) on delete cascade,
  benefit_type text not null
    check (benefit_type in ('gift_product', 'percent_discount', 'free_delivery', 'fixed_discount')),
  product_id uuid,
  quantity integer not null default 1 check (quantity > 0),
  discount_percent numeric(5,2),
  fixed_discount_amount numeric(12,2),
  free_delivery boolean not null default false,
  sort_order integer not null default 100,
  customer_message text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promotion_benefits_rule_idx
  on public.promotion_benefits (promotion_rule_id);

create index if not exists promotion_benefits_type_idx
  on public.promotion_benefits (benefit_type);

create index if not exists promotion_benefits_product_idx
  on public.promotion_benefits (product_id);

create index if not exists promotion_benefits_sort_idx
  on public.promotion_benefits (promotion_rule_id, sort_order);

create index if not exists promotion_rules_promotion_mode_idx
  on public.promotion_rules (promotion_mode);

create index if not exists promotion_rules_code_idx
  on public.promotion_rules (code);

create unique index if not exists promotion_rules_code_unique_idx
  on public.promotion_rules (lower(code))
  where code is not null and code <> '';

comment on table public.promotion_benefits is
  'BF-P2-001 - Avantages multiples liés aux règles promotionnelles';

comment on column public.promotion_rules.promotion_mode is
  'BF-P2-001 - automatic ou promo_code';

comment on column public.promotion_rules.code is
  'BF-P2-001 - Code promo saisi par le client si promotion_mode = promo_code';

comment on column public.promotion_benefits.benefit_type is
  'BF-P2-001 - gift_product, percent_discount, free_delivery ou fixed_discount';

-- BLAC-P2-013 : securite par lignes (non appliquee, fichier du depot uniquement).
alter table public.promotion_benefits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'promotion_benefits'
      and policyname = 'promotion_benefits_authenticated_all'
  ) then
    create policy "promotion_benefits_authenticated_all"
      on public.promotion_benefits
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- BLAC-P2-013 : coherence des avantages (fichier du depot uniquement, non appliquee)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promotion_benefits_values_check') then
    alter table public.promotion_benefits
      add constraint promotion_benefits_values_check
      check (
        (discount_percent is null or (discount_percent > 0 and discount_percent <= 100))
        and (fixed_discount_amount is null or fixed_discount_amount > 0)
      );
  end if;
end $$;

comment on table public.promotion_benefits is
  'BLAC-P2-013 - coherence des avantages : pourcentage entre 0 et 100, montant fixe positif';
