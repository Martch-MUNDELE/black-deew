-- =====================================================================
-- BLAC-P3-050 : notifications push livreur
-- Lie un abonnement push a un livreur (NULL = abonnement admin).
-- Les alertes admin (/api/push/send) ne vont qu'aux abonnements sans livreur ;
-- l'assignation d'une commande notifie uniquement le livreur concerne.
--
-- Idempotent (if not exists) : le rejouer ne change rien.
-- Aucune modification de donnees existantes.
-- A executer manuellement par Martial (SQL Editor Supabase).
-- =====================================================================

alter table public.push_subscriptions add column if not exists driver_id uuid references public.delivery_drivers(id) on delete cascade;

create index if not exists push_subscriptions_driver_id_idx on public.push_subscriptions (driver_id);
