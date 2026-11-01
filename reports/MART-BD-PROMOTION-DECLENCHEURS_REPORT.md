# MART-BD-PROMOTION-DECLENCHEURS — Rapport

Statut final : PASS

## Points de contrôle

| Point | Contenu | Résultat |
|---|---|---|
| (a) | Liste exacte des déclencheurs permis pour chaque périmètre (tous, classique, VIP, mixte) | PASS |
| (b) | VIP refuse classique et mixte ; classique refuse VIP et mixte ; mixte refuse classique et VIP | PASS |
| (c) | Déclencheur par défaut = Panier à partir d'un montant (cart_amount) | PASS |
| (d) | Validation serveur : règle incohérente refusée avec message en français, règle valide acceptée | PASS |
| (e) | Tests promotions existants verts (62/62) et suite complète verte (218/218) | PASS |

## Modifications
- lib/promotion-triggers.ts (nouveau) : table par périmètre, fonction de validité d'une combinaison, fonction du déclencheur par défaut, message d'incohérence en français.
- lib/promotion-rules.ts : validatePromotionRule refuse une combinaison périmètre et déclencheur incohérente (le déclencheur promo_code reste hors contrôle).
- app/admin/promotions/page.tsx : liste du déclencheur filtrée selon le périmètre ; au changement de périmètre, remise sur le défaut avec message visible et champs produit, catégorie et seuils vidés ; avertissement sur la carte et dans le formulaire pour une promotion enregistrée incohérente (affichable et modifiable) ; activation d'une promotion incohérente refusée.

## Commandes exécutées et résultats réels
- node --import ./tests/helpers/register.mjs --test tests/promotion-triggers.test.mjs : exit 0, 7 tests, 7 pass, 0 fail
- tests promotions existants : 62 tests, 62 pass, 0 fail
- npm test : exit 0, 218 tests, 218 pass, 0 fail, 0 todo
- npx tsc --noEmit : exit 0
- Un premier échec du test dédié (import relatif non résolu) a été corrigé puis revérifié.

## Limites connues
- L'affichage de la page d'administration n'est pas vérifié dans un navigateur.
- Les routes de commande et d'aperçu ignorent désormais les règles incohérentes déjà enregistrées (elles ne pouvaient pas se déclencher). Le moteur d'application n'est pas modifié.

## Interdits respectés
Aucune base modifiée, aucun script SQL, aucun fichier de secrets lu, aucun push.
