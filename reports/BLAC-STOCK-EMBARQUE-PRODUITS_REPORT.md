# BLAC-P3-057 — Stock embarqué chez les livreurs sur admin > Produits

## Résumé
Sur chaque produit VIP de admin > Produits, la ligne « dont N embarqués chez les livreurs » s'affiche sous le stock, uniquement si N > 0. Lecture seule : aucune écriture, ni sur le stock du catalogue ni sur le journal des livreurs.

## Fichiers
- `lib/vip-embarked-by-product.ts` (nouveau) : fonction pure `embarkedByProduct(drivers)`. Additionne les `onHand` strictement positifs de tous les livreurs en session ouverte. Les négatifs, nuls et valeurs invalides sont ignorés. Entrée null, undefined ou vide => `{}`.
- `app/admin/produits/page.tsx` : `loadOpenDriverStock` appelé une fois avec le client déjà utilisé par la page, après le chargement des produits et sans bloquer l'affichage. En cas d'échec, `embarked` reste `{}` et la page fonctionne comme avant. Affichage conditionné à `p.is_vip` et `embarked[p.id] > 0`.
- `tests/vip-embarked-by-product.test.mjs` (nouveau).
- `lib/driver-stock-alert.ts` : non modifié.

## Résultats du fichier de test ciblé
Commande : `node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/vip-embarked-by-product.test.mjs`

- ✔ deux livreurs avec le meme produit => somme
- ✔ solde negatif, nul ou invalide ignore
- ✔ produit absent => pas de cle
- ✔ entree null, undefined ou [] => {}
- ✔ la page utilise loadOpenDriverStock + embarkedByProduct et affiche le libelle seulement si N > 0
- ✔ la page n appelle aucune ecriture sur le journal des livreurs

tests 6 / pass 6 / fail 0 / cancelled 0 / skipped 0

## TypeScript
`npx tsc --noEmit` : aucune erreur (code de sortie 0).
