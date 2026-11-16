-- =====================================================================
-- BLAC-P3-060 : suivi de livraison en direct (lien secret, sans connexion client)
-- Table public.delivery_tracking : un suivi actif au plus par livraison.
-- Acces uniquement par le service role (RLS activee, aucune regle d'acces ouverte).
--
-- Idempotent (if not exists) : le rejouer ne change rien.
-- Aucune modification de donnees existantes.
-- A executer manuellement par Martial (SQL Editor Supabase).
-- =====================================================================

create table if not exists public.delivery_tracking (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.order_deliveries(id) on delete cascade,
  token text not null unique,
  active boolean not null default true,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  position_updated_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Un seul suivi actif par livraison
create unique index if not exists delivery_tracking_one_active_per_delivery
  on public.delivery_tracking (delivery_id)
  where active;

alter table public.delivery_tracking enable row level security;
