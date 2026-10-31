-- BLAC-P2-013 : champs promotion sur les lignes de commande (adapté de base-food BF-P2-001). NON APPLIQUÉE.
-- BF-P2-001 - Order items promotion fields V1
-- Préparation locale uniquement.
-- Ne pas exécuter en production sans validation humaine.

alter table if exists public.order_items
  add column if not exists line_type text default 'classic'
    check (line_type in ('classic', 'vip', 'promotion_gift')),
  add column if not exists original_unit_price numeric(12,2),
  add column if not exists discount_percent numeric(5,2),
  add column if not exists discount_amount numeric(12,2),
  add column if not exists is_promotion_gift boolean not null default false,
  add column if not exists promotion_rule_id uuid,
  add column if not exists promotion_label text,
  add column if not exists can_trigger_promotion boolean not null default true,
  add column if not exists is_vip boolean not null default false;

create index if not exists order_items_promotion_rule_id_idx on public.order_items (promotion_rule_id);
create index if not exists order_items_line_type_idx on public.order_items (line_type);

-- BLAC-P2-013 : garde-fous Black Deew (non appliques, fichier du depot uniquement)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'order_items_line_type_check'
  ) then
    alter table public.order_items
      add constraint order_items_line_type_check
      check (line_type is null or line_type in ('classic', 'vip', 'promotion_gift'));
  end if;
end $$;

create index if not exists order_items_is_promotion_gift_idx
  on public.order_items (is_promotion_gift) where is_promotion_gift = true;

comment on column public.order_items.original_unit_price is
  'BLAC-P2-013 - Prix unitaire avant promotion (apres remise simple produit)';
comment on column public.order_items.promotion_label is
  'BLAC-P2-013 - Libelle de la regle de promotion appliquee';

-- BLAC-P2-013 : coherence des montants de remise (fichier du depot uniquement, non appliquee)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_discount_values_check') then
    alter table public.order_items
      add constraint order_items_discount_values_check
      check (
        (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100))
        and (discount_amount is null or discount_amount >= 0)
        and (original_unit_price is null or original_unit_price >= 0)
      );
  end if;
end $$;

comment on column public.order_items.discount_amount is
  'BLAC-P2-013 - coherence remises : montant total de remise promotion sur la ligne';
