-- =====================================================================
-- BLAC-SIGNALER-PROBLEME : signalements de probleme par le livreur
-- Table public.delivery_reports : un signalement rattache a une livraison.
-- Recu par l'admin du portail (ecran de controle = ticket suivant) ; rien
-- n'est automatique cote course (ni statut, ni stock).
--
-- Idempotent (if not exists) : le rejouer ne change rien.
-- Aucune modification de donnees existantes.
-- RLS activee sans aucune regle : acces service role uniquement.
-- A executer manuellement par Martial (SQL Editor Supabase).
-- =====================================================================

create table if not exists public.delivery_reports (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.order_deliveries(id) on delete cascade,
  driver_id uuid references public.delivery_drivers(id) on delete set null,
  kind text not null check (kind in (
    'address_not_found',
    'customer_unreachable',
    'customer_refused',
    'amount_mismatch',
    'product_damaged',
    'breakdown_delay',
    'insufficient_stock',
    'cannot_continue',
    'other'
  )),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'handled', 'closed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by text,
  handled_decision text
);

create index if not exists delivery_reports_status_idx on public.delivery_reports (status);
create index if not exists delivery_reports_created_at_idx on public.delivery_reports (created_at desc);
create index if not exists delivery_reports_delivery_id_idx on public.delivery_reports (delivery_id);

-- Un seul signalement ouvert par livraison et par type (garde-fou contre les doubles envois)
create unique index if not exists delivery_reports_open_unique_idx
  on public.delivery_reports (delivery_id, kind) where status = 'open';

alter table public.delivery_reports enable row level security;
-- Volontairement aucune policy : seul le service role (serveur) y accede.
