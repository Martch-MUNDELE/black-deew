# BLAC-LIVREURS-EMBARQUABLE — Rapport

Statut final : PASS

Portée du PASS : code et migration écrits, contrôlés par tests en mémoire (faux Supabase), eslint et tsc. Aucun SQL appliqué, aucune vraie base contactée, aucune vérification dans un navigateur, aucun push, aucun déploiement.

## Ce qui a changé
- `supabase/migrations/20261106_bd_products_driver_carryable.sql` : `alter table public.products add column if not exists driver_carryable boolean not null default true`. En-tête « NON APPLIQUÉE », aucune modification de données, retour arrière en commentaire.
- `lib/driver-ledger.ts` : `assertVipProduct` refuse un produit dont `driver_carryable` est `false` (message « Produit non embarquable par un livreur refusé »). Colonne absente ou `null` : produit accepté, comme avant.
- `lib/driver-ledger-data.ts` :
  - `listVipProducts` n'expose que les produits `is_vip` dont `driver_carryable` n'est pas `false`. Le select reste `select('*')` et le filtre est fait dans le code : si la colonne n'existe pas encore, la propriété est absente donc le produit reste embarquable, et l'écran n'est pas cassé (repli sur le comportement actuel).
  - `requireVipProduct` (donc `addStockMovement` et `openSessionWithLedger`) refuse le produit non embarquable, avant toute écriture.
  - `loadClosingContext` ignore ce produit dans le stock à clôturer.
  - `loadLedgers` écarte les mouvements de stock de ce produit : l'alerte « Stock VIP bas » de l'écran Livreurs et celles qui passent par `loadLedgers` l'ignorent sans modifier l'écran.
  - `stockAlertLevel` accepte un second paramètre optionnel `ignoredProductIds`.

## À lancer par Martial (rien n'est appliqué par ce ticket)
1. Appliquer la migration `20261106_bd_products_driver_carryable.sql`.
2. Contrôler la ligne visée :

```sql
select id, name, is_vip, driver_carryable from public.products where id = '36362ca1-77f6-404e-8b79-f87e3a0c98e1';
```

3. Passer le service à non embarquable (le produit reste `is_vip`, donc commandable sur la boutique VIP) :

```sql
update public.products set driver_carryable = false where id = '36362ca1-77f6-404e-8b79-f87e3a0c98e1';
```

Si le nom diffère en base, utiliser l'`id` renvoyé à l'étape 2 : `where id = '<id>'`.
- Remettre le service comme avant : `update public.products set driver_carryable = true where name = 'Service de préparation produit';`
- Retirer la colonne : `alter table public.products drop column if exists driver_carryable;` (le code retombe alors sur l'ancien comportement).
- tests/driver-carryable.test.mjs : 8 tests, 8 pass, 0 fail.
- Tests livreurs existants (driver-ledger, admin-livreurs-ledger, driver-stock-alert, driver-day-simulation) : 74 tests, 74 pass, 0 fail.
- Suite complète tests/**/*.test.mjs lancée par node --test : 512 tests, 512 pass, 0 fail, 0 cancelled, 0 skipped.
- npx eslint lib/driver-ledger.ts lib/driver-ledger-data.ts tests/driver-carryable.test.mjs : code de sortie 0.
- npx tsc --noEmit : code de sortie 0.
- `app/admin/livreurs/page.tsx` n'est pas modifié (hors zones d'écriture). Les alertes et la clôture sont corrigées dans la couche de données (`loadLedgers`, `loadClosingContext`).
- Effet de bord de `loadLedgers` : les anciens mouvements du service déjà journalisés (s'il y en a) n'apparaissent plus dans l'historique des sessions. Ils restent en base.
- `loadLedgers` fait une requête `products` supplémentaire, seulement quand des mouvements de stock existent ; si elle échoue, rien n'est filtré.
- Le bandeau de l'écran Commandes passe par `lib/driver-stock-alert.ts`, qui appelle `loadLedgers` : il bénéficie du même filtre, sans test dédié dans ce ticket.
- Pas de vérification sur une vraie base ni dans un navigateur : la mise à jour du service par Martial est la première exécution réelle.
- Contrat : suite lancée par `node --test` directement, pas par `npm test` ; `test-baseline.js` du Hub non lancé.
