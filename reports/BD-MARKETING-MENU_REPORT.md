# BD-MARKETING-MENU — Rapport (BLAC-P2-021)

Statut final : PASS

BLACK DEEW : entrée « Marketing » dans le menu admin (groupe CONFIGURATION, juste après Promotions), permission associée et page d'accueil vide. Aucune donnée, aucune base, aucun envoi.

## Modifications
- lib/admin/permissions.ts : section { key: 'marketing', label: 'Marketing', path: '/admin/marketing', group: 'Configuration' } ajoutée juste après promotions.
- lib/admin/roles.ts : marketing ajouté dans les cinq tables de rôles, au même niveau que promotions (owner FULL, manager WRITE, cashier READ, stock READ, readonly READ).
- components/admin/AdminNav.tsx : entrée { href: "/admin/marketing", label: "Marketing", icon: "star", permission: "marketing" } juste après Promotions. L'icône megaphone n'existe pas dans ICON_MAP de AdminNavClient.tsx et n'a pas été créée : l'icône déjà disponible « star » est utilisée.
- components/admin/AdminNavClient.tsx : non modifié.
- app/admin/marketing/page.tsx : titre « Marketing », phrase d'introduction, carte d'état vide « Aucune campagne pour l'instant » avec texte expliquant que la création de campagnes arrive bientôt, sans bouton actif. Thème sombre et or (mêmes couleurs que statistiques).
- tests/admin-marketing-nav.test.mjs : 4 tests de lecture de texte.

## Points vérifiés
- La section marketing existe dans permissions.ts, après promotions.
- Les cinq tables de roles.ts contiennent marketing, au même niveau que promotions (relecture : lignes 38, 57, 76, 95, 114).
- AdminNav.tsx contient /admin/marketing avec permission marketing, placé après /admin/promotions.
- La page contient « Aucune campagne pour l'instant ».

## Commandes exécutées et résultats réels
- node --import ./tests/helpers/register.mjs --test tests/admin-marketing-nav.test.mjs : exit 0, 4 tests, 4 pass, 0 fail
- npm test : exit 0, 278 tests, 278 pass, 0 fail
- npx tsc --noEmit : exit 0

Aucune assertion existante supprimée ou affaiblie.

## Limites
- L'affichage n'a pas été vérifié dans un navigateur.
- L'icône est « star » faute de megaphone dans ICON_MAP.

## Interdits respectés
Aucune base modifiée, aucun SQL, aucun secret lu, aucun push, aucun déploiement.
