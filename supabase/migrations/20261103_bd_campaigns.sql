-- BLAC-P2-025 : table des campagnes Marketing. NON APPLIQUÉE : ne pas exécuter sans validation humaine
-- Préparation locale uniquement.
-- Ne pas exécuter en production Supabase sans validation humaine explicite.

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (length(btrim(name)) > 0),
  promotion_id uuid not null references public.promotion_rules(id) on delete cascade,
  message text not null
    check (length(btrim(message)) > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'cancelled')),
  audience_mode text not null
    check (audience_mode in ('all_consenting', 'best_clients', 'inactive_clients')),
  created_at timestamptz not null default now()
);

create index if not exists campaigns_status_idx
  on public.campaigns (status);

create index if not exists campaigns_promotion_idx
  on public.campaigns (promotion_id);

-- Sécurité par ligne activée SANS aucune politique : aucun accès public.
-- Le site passe par le serveur avec la clé de service.
alter table public.campaigns enable row level security;

comment on table public.campaigns is
  'Campagnes Marketing : message promotionnel lié à une promotion, avec validité et audience. Aucun envoi à ce stade. Accès uniquement via le serveur (clé de service).';
comment on column public.campaigns.id is 'Identifiant unique de la campagne.';
comment on column public.campaigns.name is 'Nom de la campagne (non vide).';
comment on column public.campaigns.promotion_id is 'Règle de promotion associée (public.promotion_rules). Suppression en cascade.';
comment on column public.campaigns.message is 'Texte du message promotionnel (non vide). La ligne de désinscription STOP est ajoutée à l''envoi.';
comment on column public.campaigns.starts_at is 'Début de validité de la campagne (facultatif).';
comment on column public.campaigns.ends_at is 'Fin de validité de la campagne (facultatif).';
comment on column public.campaigns.status is 'État : draft (brouillon), ready (prête), cancelled (annulée).';
comment on column public.campaigns.audience_mode is 'Audience : all_consenting (tous les clients ayant accepté), best_clients (meilleurs clients), inactive_clients (clients inactifs). Un client ayant refusé n''est jamais contacté.';
comment on column public.campaigns.created_at is 'Date de création de la campagne.';

-- RETOUR ARRIÈRE (non exécuté) :
-- drop table if exists public.campaigns;
