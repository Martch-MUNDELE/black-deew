# BLAC-P3-062 — URL courte livreur /driver

## Changements
- `next.config.ts` : ajout de `async redirects()` avec quatre redirections temporaires (`permanent: false`) :
  - `/driver` -> `/admin/driver`
  - `/driver/:path*` -> `/admin/driver/:path*`
  - `/admin/drivers` -> `/admin/driver`
  - `/livreur` -> `/admin/driver`
- `lib/driver-short-url.ts` (nouveau) : fonction pure `loginHeading(nextParam)` ; renvoie `Espace livreur` si le parametre commence par `/admin/driver` (insensible a la casse, parametres apres acceptes), sinon `Administration`.
- `app/admin/login/page.tsx` : l'intitule fixe est remplace par `loginHeading(?next=)`, calcule cote client apres le montage (etat initial `Administration`, rendu serveur inchange).
- `lib/admin-role.ts` (DRIVER_HOME) et `proxy.ts` : non modifies.

## Adresse affichee apres redirection
Apres redirection, l'adresse affichee dans le navigateur est `/admin/driver` (redirection temporaire, l'adresse interne reste en place). Un livreur non connecte est ensuite renvoye par le proxy vers `/admin/login?next=/admin/driver`, et la page affiche alors « Espace livreur ».

## Resultats du test cible
Commande : `node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/driver-short-url.test.mjs`

- tests 8, suites 0, pass 8, fail 0, cancelled 0, skipped 0, todo 0
- Cas couverts : `/admin/driver` et `/admin/driver/livraison/abc` => Espace livreur ; casse et parametre apres => Espace livreur ; `/admin/commandes` => Administration ; null, undefined et vide => Administration ; les quatre redirections exactes avec `permanent: false` dans `next.config.ts` ; la page de connexion utilise `loginHeading`.

## Verification de types
`npx tsc --noEmit` : aucune erreur (code de sortie 0).
