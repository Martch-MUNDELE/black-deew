-- =====================================================================
-- NON APPLIQUÉE : ne pas exécuter sans validation humaine
-- Migration : produits embarquables par un livreur (products.driver_carryable)
-- Projet    : black-deew
-- Table     : public.products (une colonne ajoutée, rien d'autre)
-- Date      : 2026-11-06
-- Ticket    : BLAC-P3-036
-- =====================================================================
-- Objectif : distinguer les produits VIP physiques qu'un livreur embarque
-- des services de facturation marqués is_vip (ex. « Service de préparation
-- produit »), qui doivent rester is_vip pour être commandables sur la
-- boutique VIP mais ne doivent pas apparaître dans « Produits VIP à embarquer ».
--
-- Aucune modification de données : la colonne vaut true pour toutes les
-- lignes existantes (valeur par défaut). Le passage du service à false se
-- fait à la main par Martial (requête donnée dans
-- reports/BLAC-LIVREURS-EMBARQUABLE_REPORT.md).
-- =====================================================================

alter table public.products
  add column if not exists driver_carryable boolean not null default true;

-- ---------------------------------------------------------------------
-- RETOUR ARRIÈRE (à lancer à la main si besoin, ne pas décommenter ici) :
--   alter table public.products drop column if exists driver_carryable;
-- ---------------------------------------------------------------------
