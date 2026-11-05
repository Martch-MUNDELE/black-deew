-- BLAC-P2-026 : file d'envoi WhatsApp des campagnes. APPLIQUÉE en production le 3 novembre 2026 (version Supabase 20261103202850) : ne pas réexécuter
-- Préparation locale uniquement.
-- Ne pas exécuter en production Supabase sans validation humaine explicite.
-- Dépend de public.campaigns (migration 20261103_bd_campaigns.sql, elle aussi non appliquée).

create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  phone text not null
    check (length(btrim(phone)) > 0),
  status text not null default 'to_send'
    check (status in ('to_send', 'sent', 'refused')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint campaign_sends_campaign_phone_unique unique (campaign_id, phone)
);

create index if not exists campaign_sends_status_sent_at_idx
  on public.campaign_sends (status, sent_at);

create table if not exists public.marketing_refusals (
  phone text primary key
    check (length(btrim(phone)) > 0),
  created_at timestamptz not null default now(),
  source text
);

-- Sécurité par ligne activée SANS aucune politique : aucun accès public.
-- Le site passe par le serveur avec la clé de service.
alter table public.campaign_sends enable row level security;
alter table public.marketing_refusals enable row level security;

comment on table public.campaign_sends is
  'File d''envoi WhatsApp d''une campagne : un client par ligne, envoi manuel (clic de l''admin). Accès uniquement via le serveur (clé de service).';
comment on column public.campaign_sends.campaign_id is 'Campagne concernée (public.campaigns). Suppression en cascade.';
comment on column public.campaign_sends.phone is 'Numéro du client (format international).';
comment on column public.campaign_sends.status is 'to_send (à envoyer), sent (envoyé), refused (a répondu STOP).';
comment on column public.campaign_sends.sent_at is 'Date de marquage « envoyé ». Sert au plafond d''un message par client et par mois.';
comment on table public.marketing_refusals is
  'Numéros ayant répondu STOP : ne jamais les contacter. Accès uniquement via le serveur (clé de service).';
comment on column public.marketing_refusals.phone is 'Numéro du client (clé primaire).';
comment on column public.marketing_refusals.source is 'Origine du refus (ex. réponse STOP sur WhatsApp).';

-- RETOUR ARRIÈRE (non exécuté) :
-- drop table if exists public.campaign_sends;
-- drop table if exists public.marketing_refusals;
