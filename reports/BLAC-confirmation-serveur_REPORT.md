# BLAC-P3-045 — Confirmation de commande via route serveur

Statut : PASS

La page publique de confirmation ne lit plus les tables orders et order_items depuis le navigateur. Elle appelle une route serveur GET qui utilise SUPABASE_SERVICE_ROLE_KEY et ne renvoie que les donnees utiles au client pour une seule commande.

## Fichiers modifies ou crees
- cree : app/api/commandes/[id]/confirmation/route.ts (runtime nodejs, dynamic force-dynamic)
- modifie : app/(public)/confirmation/[id]/page.tsx (un seul fetch('/api/commandes/' + orderId + '/confirmation') ; import createClient et son usage supprimes ; import useMemo retire car devenu inutile ; rendu et etats loading / commande introuvable inchanges)
- cree : tests/confirmation-route-serveur.test.mjs
- cree : reports/BLAC-confirmation-serveur_REPORT.md
- non touches : app/api/commandes/route.ts, migrations, SQL, fichiers .env

## Comportement de la route
- id non UUID : 400 { error }
- commande introuvable : 404 { error }
- erreur de lecture : 500 { error }
- succes : 200 { order, items, slot }, en-tete Cache-Control: no-store sur toutes les reponses

## Champs renvoyes
- order : id, customer_name, customer_address, customer_note, lat, lng, slot_id, total, delivery_fee, delivery_mode
- items : id, quantity, product_name, unit_price
- slot : date, time_start, time_end (null si pas de creneau)
- Aucun telephone, email, note interne, statut ni paiement.

## Tests lances (mesures reelles)
- node --test tests/confirmation-route-serveur.test.mjs : 11 tests, 11 pass, 0 fail, 0 cancelled, 0 skipped
- npm test : 558 tests, 558 pass, 0 fail, 0 cancelled, 0 skipped
- npx tsc --noEmit : code de sortie 0
- npx eslint sur la route et la page : code de sortie 0
- git diff sur app/api/commandes/route.ts et supabase/migrations : vide

## Non verifie
- Aucun appel reel a la base ni rendu dans un navigateur : controle du code sous forme de texte uniquement.
- La fermeture RLS de orders et order_items reste a faire par Martial (SQL), apres deploiement de cette route.
- Aucun commit, aucun push, aucun deploiement.
