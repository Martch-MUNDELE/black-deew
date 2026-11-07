-- =====================================================================
-- NON APPLIQUÉE : ne pas exécuter sans validation humaine
-- Migration : journal de monnaie et de stock VIP embarqué par les livreurs
-- Projet    : black-deew
-- Tables    : public.driver_cash_movements, public.driver_stock_movements (nouvelles)
-- Date      : 2026-11-06
-- Ticket    : BLAC-P3-032 (remplace BLAC-P3-031)
-- =====================================================================
-- Deux tables nouvelles, rien d'autre : aucune insertion de données,
-- aucune modification des tables existantes.
-- Types des clés repris du schéma réel (migration de clonage) :
--   driver_sessions.id, delivery_drivers.id, products.id, orders.id = uuid.
-- Sécurité : driver_sessions n'a ni RLS activée ni policy dans les migrations
-- du projet (seulement GRANT ALL à anon, authenticated, service_role).
-- Les deux nouvelles tables reproduisent exactement ce régime.
-- =====================================================================

create table if not exists public.driver_cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.driver_sessions(id) on delete cascade,
  driver_id uuid not null references public.delivery_drivers(id) on delete cascade,
  kind text not null
    constraint driver_cash_movements_kind_check
    check (kind in ('opening', 'topup', 'returned', 'kept_for_next_day')),
  amount numeric not null
    constraint driver_cash_movements_amount_check
    check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_cash_movements_session_id
  on public.driver_cash_movements (session_id);

create index if not exists idx_driver_cash_movements_driver_created
  on public.driver_cash_movements (driver_id, created_at);

comment on table public.driver_cash_movements is
  'Journal de la monnaie confiée à un livreur pendant une session : fonds d''ouverture, compléments, rendu et part gardée pour le lendemain.';
comment on column public.driver_cash_movements.session_id is
  'Session du livreur concernée. Suppression en cascade avec la session.';
comment on column public.driver_cash_movements.driver_id is
  'Livreur concerné (delivery_drivers.id).';
comment on column public.driver_cash_movements.kind is
  'Nature du mouvement : opening (monnaie donnée à l''ouverture), topup (complément en cours de journée), returned (rendu à la clôture), kept_for_next_day (gardé par le livreur pour le lendemain).';
comment on column public.driver_cash_movements.amount is
  'Montant, toujours positif ou nul ; le sens est porté par kind.';
comment on column public.driver_cash_movements.note is
  'Remarque facultative de l''administrateur.';
comment on column public.driver_cash_movements.created_at is
  'Date et heure d''enregistrement du mouvement.';

create table if not exists public.driver_stock_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.driver_sessions(id) on delete cascade,
  driver_id uuid not null references public.delivery_drivers(id) on delete cascade,
  product_id uuid not null references public.products(id),
  kind text not null
    constraint driver_stock_movements_kind_check
    check (kind in ('load', 'topup', 'delivered', 'returned', 'kept_for_next_day', 'adjust_plus', 'adjust_minus')),
  quantity integer not null
    constraint driver_stock_movements_quantity_check
    check (quantity > 0),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_stock_movements_session_id
  on public.driver_stock_movements (session_id);

create index if not exists idx_driver_stock_movements_driver_created
  on public.driver_stock_movements (driver_id, created_at);

comment on table public.driver_stock_movements is
  'Journal du stock de produits VIP embarqué par un livreur pendant une session (uniquement des produits dont is_vip est vrai, contrôle fait côté application).';
comment on column public.driver_stock_movements.session_id is
  'Session du livreur concernée. Suppression en cascade avec la session.';
comment on column public.driver_stock_movements.driver_id is
  'Livreur concerné (delivery_drivers.id).';
comment on column public.driver_stock_movements.product_id is
  'Produit VIP concerné (products.id).';
comment on column public.driver_stock_movements.kind is
  'Nature du mouvement : load (chargement), topup (complément), delivered (livré), returned (rendu), kept_for_next_day (gardé pour le lendemain), adjust_plus / adjust_minus (corrections).';
comment on column public.driver_stock_movements.quantity is
  'Quantité entière strictement positive ; le sens est porté par kind.';
comment on column public.driver_stock_movements.order_id is
  'Commande liée (facultatif, surtout pour delivered). Mise à null si la commande est supprimée.';
comment on column public.driver_stock_movements.created_at is
  'Date et heure d''enregistrement du mouvement.';

-- Même régime que driver_sessions : pas de RLS activée, droits complets
-- pour anon, authenticated et service_role.
grant all on table public.driver_cash_movements to anon;
grant all on table public.driver_cash_movements to authenticated;
grant all on table public.driver_cash_movements to service_role;
grant all on table public.driver_stock_movements to anon;
grant all on table public.driver_stock_movements to authenticated;
grant all on table public.driver_stock_movements to service_role;

-- =====================================================================
-- RETOUR ARRIÈRE (non exécuté) :
-- drop table if exists public.driver_stock_movements;
-- drop table if exists public.driver_cash_movements;
-- =====================================================================
