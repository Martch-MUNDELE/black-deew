# BD-PANIER-BANDEAU-OFFRE : bandeau « Ton offre est appliquée » dans le panier (BLAC-P3-027)

## Fichiers modifiés / créés
- app/(public)/panier/page.tsx : bandeau ajouté en haut du contenu de l'étape panier (19 lignes ajoutées, 0 supprimée par rapport à HEAD).
- tests/cart-offer-banner.test.mjs : nouveau test (lecture du source et comparaison avec git show HEAD).
- reports/BD-PANIER-BANDEAU-OFFRE_REPORT.md : ce rapport.

## Ce qui correspond à la maquette (écran 8)
- Bandeau doré (fond doré léger, bordure dorée) en haut du panier, avec role="status".
- Icône d'étiquette, titre « Ton offre est appliquée » suivi du premier libellé de serverPromo.labels.
- Ligne secondaire avec le montant économisé, au format de prix déjà utilisé dans la page (toFixed(2) + devise) ; si seul un cadeau est présent, la ligne indique le cadeau offert.
- Affiché uniquement si discount_total > 0 ou si un cadeau est présent, et si le téléphone saisi est renseigné.
- Couleurs reprises de la page (#F5C842, #F5EDD6, #C8B99A) : aucune nouvelle palette.

## Ce qui diffère de la maquette
- Le bouton « Retirer l'offre de ce panier » n'est pas fait : il exigerait de modifier la création de commande et le calcul des prix, ce qui est interdit dans ce ticket.
- La ligne de remise dans les totaux n'a pas été modifiée (hors périmètre : aucun autre texte ni calcul du panier ne change).
- Le bandeau est placé dans l'étape 1 (panier) uniquement.

## Calculs inchangés
Aucune ligne supprimée ou modifiée dans la page ; les lignes serverDiscount, totalAfterPromo, grandTotal, deliveryFee, l'appel à /api/promotions/preview et ses dépendances sont identiques à HEAD (vérifié par le test).

## Commandes exécutées et résultats
- npx tsc --noEmit : exit 0.
- node --import ./tests/helpers/register.mjs --test tests/cart-offer-banner.test.mjs tests/client-offers-cart.test.mjs : exit 0, 12 tests, 12 pass, 0 fail.
- git diff --numstat HEAD sur la page : 19 ajoutées, 0 supprimée.

## Limites
- Affichage non vérifié dans un navigateur ; comportement sur la vraie base non vérifié.

## Interdits respectés
Aucune route, migration, SQL, changement de prix, commit, push ni déploiement.

Statut final : PASS
