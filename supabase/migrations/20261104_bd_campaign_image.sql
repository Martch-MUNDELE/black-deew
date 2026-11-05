-- BLAC-P3-015 : image d'une campagne (apercu WhatsApp de la page d'offre)
-- APPLIQUÉE en production le 3 novembre 2026 (version Supabase 20261103211243) : ne pas réexécuter.
--
-- Ajoute l'adresse (https) de l'image choisie pour une campagne.
-- Facultative : tant qu'elle est vide, la page d'offre garde l'image de repli de la marque.

alter table public.campaigns
  add column if not exists image_url text;

comment on column public.campaigns.image_url is
  'Adresse https de l''image de la campagne, utilisee dans l''apercu WhatsApp (Open Graph). Facultative, 500 caracteres maximum.';

-- Retour arriere (a executer seulement si necessaire, apres validation humaine) :
-- alter table public.campaigns drop column if exists image_url;
