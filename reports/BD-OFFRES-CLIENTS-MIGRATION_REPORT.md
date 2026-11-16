# BD-OFFRES-CLIENTS-MIGRATION — Rapport (BLAC-P2-022)

Statut final : BLOCKED
Raison du blocage : le validateur du Hub classe ce ticket en sql_test et attend des assertions exécutables sur une base pour la mutation de schéma. Le ticket interdit toute exécution du SQL et toute connexion à une base : ce point ne peut donc pas être levé dans ce ticket.

Portée : le fichier de migration est préparé et contrôlé uniquement comme texte. Aucune validation sur base n'a été faite ni revendiquée. Le SQL n'a pas été joué, aucune base n'a été contactée, aucun secret lu, aucun push, aucun déploiement.

IMPORTANT : l'application de la migration attend la confirmation explicite de Martial.

## Résumé du SQL

Fichier : supabase/migrations/20261103_bd_client_offers.sql

- En-tête « NON APPLIQUÉE : ne pas exécuter sans validation humaine », comme les autres migrations préparées.
- Table public.client_offers (create table if not exists) :
  - id uuid clé primaire, défaut gen_random_uuid()
  - phone text non nul (format international utilisé par le site)
  - promotion_id uuid non nul, référence public.promotion_rules(id) avec suppression en cascade
  - campaign_label text
  - reason text, contrainte : manual, best_client, win_back
  - status text non nul, défaut 'active', contrainte : active, used, expired, cancelled
  - starts_at, ends_at, used_at timestamptz ; used_order_id uuid
  - created_at timestamptz non nul, défaut now()
- Index : client_offers_phone_status_idx sur (phone, status) ; client_offers_promotion_idx sur (promotion_id).
- Row level security activée, aucune politique créée : aucun accès public (accès via le serveur avec la clé de service).
- Commentaires de table et de colonnes en français.
- Aucune instruction destructrice hors commentaire de fin.

## Retour arrière (non exécuté)

    drop table if exists public.client_offers;

## Contrôles réalisés (lecture de texte uniquement)

- Test de lecture du fichier SQL (tests/client-offers-migration.test.mjs) : 10 tests sur 10 réussis. Il vérifie le texte du fichier, pas le comportement d'une base.
- Suite complète du projet (npm test) : 278 tests sur 278 réussis, sans lien avec une base.
- Relecture du fichier SQL : conforme au ticket.
- Recherche de create policy, drop, truncate, delete, update, grant, revoke hors commentaires : seule occurrence, la clause de cascade à la ligne 5 demandée par le ticket.
