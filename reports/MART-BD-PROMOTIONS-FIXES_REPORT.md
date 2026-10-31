# MART-BD-PROMOTIONS-FIXES — Rapport (BLAC-P3-008)

Statut final : PASS

Portée : correction des 3 défauts relevés par BLAC-P3-007. Aucun script SQL appliqué, aucun réseau, aucune vraie base, aucune lecture de .env.local, aucun push.

## Résultat par correction
1. Validation des valeurs : PASS. `validatePromotionRule` exportée par `lib/promotion-rules.ts`, appelée par `app/admin/promotions/page.tsx` avant l'enregistrement, et par `app/api/commandes/route.ts` qui ignore toute règle invalide (défense serveur). Refus couverts : pourcentage hors 1-100, montant ou seuil négatif, quantité nulle ou négative, code promo vide ou avec espaces, date de fin avant le début, cadeau sans produit. Messages en français. Tests : J-a4, J-a5, J-a6.
2. Limite par client : PASS. `usage_limit_per_customer` appliquée dans `app/api/commandes/route.ts` (téléphone par défaut, e-mail si la règle le demande). Les usages antérieurs sont comptés à partir des lignes de commande déjà enregistrées ; limite atteinte : 409 avec message français. Si le comptage est impossible (colonnes absentes), la commande n'est pas bloquée et le journal ne contient que le code d'erreur, sans donnée client. Test : J-e3.
   - Défaut trouvé pendant le ticket : le premier essai de J-e3 répondait 200 au lieu de 409, car le comptage filtrait `orders` sur `phone`/`email` alors que la table utilise `customer_phone`/`customer_email`. Corrigé, J-e3 passe.
3. Liste publique visible : PASS. `app/api/promotions/route.ts` lit avec la clé de service, en lecture seule, uniquement les champs de la liste blanche ; clé absente : liste vide sans erreur. Tests : J-b3 et J-b4 (nouveaux), qui vérifient qu'un visiteur anonyme (RLS après scripts) ne voit rien en lecture directe mais que la route renvoie les promotions publiques sans fuite (admin_note, code, compteurs).
4. Tests : les marques todo de J-a4 et J-e3 sont retirées (0 todo restant dans le test et le faux client). J-c4 rejoue maintenant le calcul de l'aperçu : sous le seuil (remise 0, reste 50), au-dessus (remise 20, prix final 180), cadeau (remise 0, éligible), code promo.

## Commandes exécutées et résultats réels
- `node --import ./tests/helpers/register.mjs --test tests/promotions-journey.test.mjs` : 32 tests, 32 pass, 0 fail, 0 todo, exit 0
- `npm test` : 182 tests, 182 pass, 0 fail, 0 todo, exit 0
- `npx tsc --noEmit` : exit 0, aucune erreur

## Livrables
- test : tests/promotions-journey.test.mjs
- faux client strict : tests/helpers/strict-fake-db.mjs (inchangé : aucune modification n'était nécessaire)
- rapport : reports/MART-BD-PROMOTIONS-FIXES_REPORT.md
