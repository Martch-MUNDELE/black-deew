# BD-PROMOTION-BORNES - Rapport (BLAC-P2-016)

Statut final : PASS

## Constat sur les quatre endroits

1. lib/promotion-rules.ts, chargeur (ancienne fonction isRuleCurrentlyValid, ligne 273) : début inclus, fin incluse, date absente = pas de limite. Une date invalide était ignorée (aucune limite).
2. lib/promotion-rules.ts, selectPublicPromotions (lignes 354-355) : même logique de bornes, mais écrite à part. Une date invalide donnait un résultat différent du chargeur (comparaison avec NaN, la règle était exclue). C'est la seule incohérence trouvée.
3. lib/promotions.ts (applyPromotions, previewPublicPromotions) : aucun filtre de date. Fichier non modifié.
4. app/api/promotions/preview/route.ts et app/api/commandes/route.ts : aucun filtre de date propre. Les deux appellent loadActivePromotionRules, donc le panier et la commande partagent déjà le même filtre. Fichiers non modifiés.

Les bornes (début inclus, fin incluse à la milliseconde, dates absentes = pas de limite) étaient déjà correctes et identiques. Seul le traitement d'une date invalide divergeait.

## Corrigé

Dans lib/promotion-rules.ts uniquement :
- nouvelle fonction exportée isRuleActiveAt(rule, now = Date.now()) : début inclus, fin incluse, date absente ou invalide = pas de limite ;
- le chargeur loadActivePromotionRules et selectPublicPromotions l'utilisent désormais tous les deux ;
- l'ancienne fonction privée isRuleCurrentlyValid est supprimée (aucun résidu).

Non modifié : lib/promotions.ts, route d'aperçu, route de commande, base de données. Aucun SQL, aucun secret lu, aucun push.

## Tests ajoutés

tests/promotion-date-bounds.test.mjs (10 tests) : règle sans dates, avant le début, instant exact du début, 23:59:59 le jour de fin, une seconde après, début seul, fin seule, date invalide, et cohérence entre selectPublicPromotions et isRuleActiveAt à chaque borne. Avant la correction, ils échouaient (isRuleActiveAt is not a function). Aucune assertion existante supprimée ou affaiblie.

## Commandes exécutées (résultats réels)

- node --import ./tests/helpers/register.mjs --test tests/promotion-date-bounds.test.mjs : exit 0, 10 tests, 10 pass, 0 fail
- tests promotions existants (promotions, cart-preview, journey, phase2, fixes-p3-008) : exit 0, 70 tests, 70 pass, 0 fail
- npm test : exit 0, 239 tests, 239 pass, 0 fail
- npx tsc --noEmit : exit 0

## Limite

La sélection faite à la commande et celle de l'aperçu passent toutes deux par loadActivePromotionRules, qui utilise Date.now() en interne : la date de référence n'est donc injectée dans le test que via isRuleActiveAt et selectPublicPromotions, pas via le chargeur lui-même. L'identité du filtre côté panier et commande repose sur l'usage de la même fonction, constaté à la lecture du code.
