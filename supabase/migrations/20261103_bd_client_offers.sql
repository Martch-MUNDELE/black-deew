-- BLAC-P2-022 : table des offres clients (campagnes Marketing). APPLIQUÉE en production le 3 novembre 2026 (version Supabase 20261103202806) : ne pas réexécuter
-- Préparation locale uniquement.
-- Ne pas exécuter en production Supabase sans validation humaine explicite.

create table if not exists public.client_offers (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  promotion_id uuid not null references public.promotion_rules(id) on delete cascade,
  campaign_label text,
  reason text
    check (reason in ('manual', 'best_client', 'win_back')),
  status text not null default 'active'
    check (status in ('active', 'used', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  used_at timestamptz,
  used_order_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists client_offers_phone_status_idx
  on public.client_offers (phone, status);

create index if not exists client_offers_promotion_idx
  on public.client_offers (promotion_id);

-- Sécurité par ligne activée SANS aucune politique : aucun accès public.
-- Le site passe par le serveur avec la clé de service.
alter table public.client_offers enable row level security;

comment on table public.client_offers is
  'Offres attribuées à un client VIP par une campagne Marketing. Le client est identifié par son numéro de téléphone (pas d''identifiant client). Accès uniquement via le serveur (clé de service).';
comment on column public.client_offers.id is 'Identifiant unique de l''offre client.';
comment on column public.client_offers.phone is 'Numéro de téléphone du client au format international utilisé par le site.';
comment on column public.client_offers.promotion_id is 'Règle de promotion attribuée (public.promotion_rules). Suppression en cascade.';
comment on column public.client_offers.campaign_label is 'Nom libre de la campagne Marketing à l''origine de l''offre.';
comment on column public.client_offers.reason is 'Motif d''attribution : manual (manuel), best_client (meilleur client), win_back (reconquête).';
comment on column public.client_offers.status is 'État de l''offre : active, used (utilisée), expired (expirée), cancelled (annulée).';
comment on column public.client_offers.starts_at is 'Début de validité de l''offre (facultatif).';
comment on column public.client_offers.ends_at is 'Fin de validité de l''offre (facultatif).';
comment on column public.client_offers.used_at is 'Date d''utilisation de l''offre par le client.';
comment on column public.client_offers.used_order_id is 'Commande dans laquelle l''offre a été utilisée.';
comment on column public.client_offers.created_at is 'Date de création de l''offre.';

-- RETOUR ARRIÈRE (non exécuté) :
-- drop table if exists public.client_offers;
