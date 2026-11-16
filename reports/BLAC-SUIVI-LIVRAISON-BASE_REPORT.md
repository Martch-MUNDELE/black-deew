# BLAC-P3-060 — Suivi de livraison en direct : base (table, logique, routes)

## Fichiers livrés
- `supabase/migrations/20261109_bd_delivery_tracking.sql` : table `public.delivery_tracking`, index unique partiel (un seul suivi actif par livraison), RLS activée sans aucune règle d'accès (service role uniquement). Idempotente.
- `lib/delivery-tracking.ts` : fonctions pures `generateTrackingToken`, `isValidTrackingToken`, `parsePositionBody`, `isPositionFresh`, `buildTrackingUrl`, `publicTrackingView`.
- `app/api/driver/tracking/route.ts` : POST livreur (401 / 403 / 400 / 404 / 409, no-store, renvoie `{ok:true, token}`).
- `app/api/tracking/[token]/route.ts` : GET public (404 si token invalide ou inconnu, no-store, vue publique sans donnée personnelle).
- `tests/delivery-tracking.test.mjs`.

## Résultats exacts du fichier de test ciblé
Commande : `node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/delivery-tracking.test.mjs`

- tests 10, suites 0, pass 10, fail 0, cancelled 0, skipped 0, todo 0
- duration_ms 105.810042

`npx tsc --noEmit` : code de sortie 0, aucune erreur.

## Migration : à exécuter manuellement par Martial
La migration `supabase/migrations/20261109_bd_delivery_tracking.sql` n'a PAS été exécutée. Elle est à lancer manuellement par Martial (SQL Editor Supabase) avant d'utiliser les routes.

## Notes
- Aucun fichier existant modifié (`mark-delivered`, `order_deliveries`, `proxy.ts` intacts).
- Les routes `/api/tracking/*` sont publiques par construction (`proxy.ts` ne protège que `/admin`) ; la sécurité repose sur le token secret de 32 caractères.
- La page client `/suivi` et l'envoi côté livreur relèvent d'autres tickets.
