-- =====================================================================
-- DÉJÀ APPLIQUÉE à la main le 7 novembre 2026 (dans Supabase, par Martial)
-- Migration : un seul passage ouvert par livreur (une session ouverte maximum)
-- Projet    : black-deew
-- Table     : public.driver_sessions (un index unique partiel, rien d'autre)
-- Date      : 2026-11-07
-- Ticket    : BLAC-P3-042
-- =====================================================================
-- Pourquoi : un livreur ne doit avoir qu'une seule session ouverte.
-- Le code le garantit déjà (BLAC-P3-041) ; cet index ajoute la garantie
-- directement en base. Ce fichier enregistre dans le dépôt ce qui a été
-- appliqué à la main, pour que le dépôt reflète la base.
--
-- Idempotent (if not exists) : le rejouer ne change rien.
-- Aucune modification de données.
-- =====================================================================

create unique index if not exists driver_sessions_one_open_per_driver on public.driver_sessions (driver_id) where session_status = 'open';
