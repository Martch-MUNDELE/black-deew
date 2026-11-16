# BLAC-SESSION-UNIQUE — Rapport (BLAC-P3-042)

Statut final : PASS

## Fichier créé
- supabase/migrations/20261107_bd_driver_sessions_one_open.sql : en-tête (pourquoi, date, « déjà appliquée à la main le 7 novembre 2026 ») et SQL exact, idempotent :
  `create unique index if not exists driver_sessions_one_open_per_driver on public.driver_sessions (driver_id) where session_status = 'open';`

## Autres fichiers créés
- tests/driver-sessions-one-open.test.mjs : lit la migration comme texte (chemin relatif au fichier de test) et vérifie : en-tête « déjà appliquée », index unique, if not exists, table public.driver_sessions, colonne driver_id, clause where session_status = 'open', une seule instruction, aucune instruction destructrice (drop, delete, truncate, update).

## Tests lancés
- node --test tests/driver-sessions-one-open.test.mjs : 7 tests, 7 pass, 0 fail, 0 cancelled, 0 skipped (code de sortie 0).
- npm test (suite complète) : 536 tests, 536 pass, 0 fail, 0 cancelled, 0 skipped (code de sortie 0).

## Portée
Aucun SQL exécuté, aucune base contactée, aucun code applicatif modifié, aucun .env touché, aucun push, aucun commit, aucun déploiement.
