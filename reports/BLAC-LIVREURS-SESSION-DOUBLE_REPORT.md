# BLAC-P3-037 — Session livreur en double

Statut final : PASS

Portée : code contrôlé par tests en mémoire (faux Supabase, sans réseau), eslint et tsc. Aucun SQL exécuté, aucune vraie base contactée, aucun push, aucun déploiement, aucune vérification dans un navigateur.

## Cause
Le livreur Manu x a deux sessions ouvertes créées à 1,1 s d'écart le 1er novembre (double clic sur « Ouvrir »). La liste d'affectation de la page des commandes est construite à partir des sessions ouvertes : le livreur y apparaissait deux fois, d'où l'avertissement React « two children with the same key ». Rien n'empêchait d'ouvrir une seconde session.

## Ce qui a changé
- `lib/driver-ledger-data.ts`
  - `openSessionWithLedger` : après validation du montant, un verrou en mémoire par livreur refuse un second appel simultané ; puis les chargements sont validés (produit non VIP, quantité) ; puis une lecture de `driver_sessions` (driver_id, session_status = open) refuse l'ouverture s'il existe déjà une session ouverte. Message : « Ce livreur a déjà une session ouverte : clôturez-la avant d'en ouvrir une nouvelle. » (constante `SESSION_DEJA_OUVERTE_MESSAGE`). Aucune écriture dans tous ces cas ; le verrou est libéré en `finally`. L'ancienne logique d'insertion est conservée dans `insertSessionWithLedger` (non exportée).
  - Nouvelle fonction `dedupeOpenSessionDrivers` : un livreur une seule fois, avec sa session ouverte la plus récente (tri par `started_at` décroissant).
- `app/admin/commandes/page.tsx` : la requête sélectionne aussi `started_at`, la liste passe par `dedupeOpenSessionDrivers<DriverRow>(rows)` ; import ajouté.
- `app/admin/livreurs/page.tsx` : `handleOpenSession` ignore un second clic via `openingRef` (en plus du bouton déjà désactivé par `sessionLoading`) ; `useRef` ajouté à l'import React.
- `tests/driver-open-session-guard.test.mjs` : 8 tests.

## Vérification en lecture seule à lancer par Martial (doublons existants)
Ce ticket ne supprime ni ne modifie aucune donnée : la session en double de Manu x se traite à la main (par exemple clôturer la plus ancienne depuis l'écran Livreurs après contrôle de son journal).
- tests/driver-open-session-guard.test.mjs : 8 tests, 8 pass, 0 fail.
- Tests livreurs (driver-ledger, admin-livreurs-ledger, driver-stock-alert, driver-day-simulation, driver-carryable) : 82 tests, 82 pass, 0 fail.
- Suite complète `node --import ./tests/helpers/register.mjs --test 'tests/**/*.test.mjs'` : 524 tests, 524 pass, 0 fail, 0 cancelled, 0 skipped.
- `npx eslint` sur les quatre fichiers modifiés : code de sortie 0.
- `npx tsc --noEmit` : code de sortie 0.
- Un premier ordre de contrôle (session déjà ouverte avant validation des chargements) faisait échouer le test existant « ouverture : … produit non VIP refusé sans session » ; l'ordre a été corrigé (chargements validés d'abord) sans modifier ce test.
- Le verrou anti double clic est en mémoire du navigateur : il protège un même onglet, pas deux onglets ou deux postes simultanés. Seule une contrainte unique en base (index partiel sur driver_id où session_status = 'open') couvrirait ce cas ; non faite ici (aucun SQL autorisé), à envisager dans un ticket séparé après nettoyage du doublon de Manu x.
- La déduplication se fait côté client sur les sessions ouvertes déjà chargées ; elle masque le doublon sans le corriger en base.
- Non vérifié dans un navigateur (l'absence de l'avertissement de clé en double est couverte par le test sur la liste dédupliquée).
- `node core/quality-control/test-baseline.js` non lancé (fichier absent du dépôt, voir BLAC-P3-034) ; `npm test` non utilisé.

## Vérification en lecture seule des sessions en double

Requête 1 — livreurs ayant plus d'une session ouverte :

```sql
select driver_id, count(*) as sessions_ouvertes, min(created_at) as premiere, max(created_at) as derniere from public.driver_sessions where session_status = 'open' group by driver_id having count(*) > 1;
```

Requête 2 — détail des sessions ouvertes :

```sql
select id, driver_id, session_status, opening_cash, created_at from public.driver_sessions where session_status = 'open' order by driver_id, created_at;
```

Ces deux requêtes sont en lecture seule, et la fermeture éventuelle d'une session en double est décidée et exécutée à la main par Martial.
