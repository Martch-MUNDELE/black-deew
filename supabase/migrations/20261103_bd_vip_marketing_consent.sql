-- =====================================================================
-- APPLIQUÉE en production le 3 novembre 2026 (version Supabase 20261103202757) : ne pas réexécuter
-- Migration : consentement aux offres marketing VIP (WhatsApp)
-- Projet    : black-deew
-- Table     : public.vip_access_requests
-- Date      : 2026-11-03
-- Ticket    : BLAC-P2-020
-- =====================================================================
-- Trois états de marketing_opt_in :
--   NULL  = accord non confirmé (VIP déjà approuvés, exclus des envois)
--   true  = le client a accepté de recevoir des offres
--   false = le client a refusé de recevoir des offres
-- Aucune valeur par défaut : seul un choix explicite renseigne la colonne.
-- Cette migration ne modifie ni les règles d'accès ni les droits.
-- =====================================================================

alter table public.vip_access_requests
  add column if not exists marketing_opt_in boolean;

alter table public.vip_access_requests
  add column if not exists marketing_opt_in_at timestamptz;

alter table public.vip_access_requests
  add column if not exists marketing_opt_in_source text
    constraint vip_access_requests_marketing_opt_in_source_check
    check (marketing_opt_in_source in ('demande', 'encart', 'admin'));

comment on column public.vip_access_requests.marketing_opt_in is
  'Accord pour recevoir des offres VIP par WhatsApp. NULL = non confirmé (exclu des envois), true = accepté, false = refusé. Sans valeur par défaut.';

comment on column public.vip_access_requests.marketing_opt_in_at is
  'Date et heure du choix du client (accord ou refus). NULL tant que le client n''a pas choisi.';

comment on column public.vip_access_requests.marketing_opt_in_source is
  'Origine du choix : demande (formulaire de demande VIP), encart (encart proposé à un VIP existant) ou admin (saisi par un administrateur). NULL tant que non choisi.';

-- =====================================================================
-- RETOUR ARRIÈRE (non exécuté) :
-- alter table public.vip_access_requests
--   drop column if exists marketing_opt_in_source,
--   drop column if exists marketing_opt_in_at,
--   drop column if exists marketing_opt_in;
-- =====================================================================
