# MART-BD-PROMOTIONS — Rapport (BLAC-P2-013)

Statut final : BLOCKED

Raison : le moteur serveur est complet et testé, mais l'affichage client (aperçu des promotions dans le panier et la page VIP) et le lien dans la navigation admin ne sont pas réalisés. Le statut passera à PASS une fois ces points faits.

## Fichiers créés / modifiés
- lib/promotions.ts, lib/promotion-rules.ts, lib/promotion-product-guards.ts, lib/types/promotion.ts, lib/types.ts
- lib/admin/permissions.ts, lib/admin/roles.ts (section promotions)
- app/admin/promotions/page.tsx (import features remplacé par une constante)
- app/api/commandes/route.ts (recalcul serveur : règles actives, code promo, cadeaux, livraison gratuite, remise fixe, champs promotion sur order_items)
- store/cart.ts (promoCode), app/(public)/panier/page.tsx (envoi du promo_code)
- app/(public)/vip/page.tsx (arrondi à l'entier supérieur, 3 endroits)
- Migrations (non appliquées) : supabase/migrations/20261031_bd_promotion_rules.sql, _promotion_benefits.sql, _order_items_promotion_fields.sql
- tests/promotions.test.mjs

## Écarts avec base-food
- Ajout de fixed_discount dans le moteur, exclusion des produits dont discount > 0 (remise simple conservée, cumul exclu par défaut)
- Prix remisé arrondi à l'entier supérieur
- Modes de cumul (exclusive, best_offer, cumulable_*) réellement appliqués ; filterRulesForPromoCode ajouté
- lib/features.ts absent : ENABLE_VIP_FEATURE = true en constante

## Résultats des tests
- node --test tests/promotions.test.mjs : 19/19
- npm test : 141/141 ; npx tsc --noEmit : sans erreur
- Aucune base modifiée, aucun push

## Limites / reste à faire
- Champ code promo ajouté au panier (étape créneau) ; aperçu détaillé des remises dans le panier et la page VIP non implémenté (prix final recalculé côté serveur)
- Lien Promotions dans la navigation : components/admin/AdminNav.tsx est hors des zones autorisées
- Limites d'usage des codes (usage_limit_*) non appliquées par la route

## Blocage
Cause du blocage : le Completion Validator signale « livrable migration manquant » alors que les trois migrations existent dans la zone autorisée supabase/migrations/ (20261031_bd_promotion_rules.sql, 20261031_bd_promotion_benefits.sql, 20261031_bd_order_items_promotion_fields.sql). Il attend un chemin dans 00_SYSTEM/reports/hub/, ce qui contredit la consigne du ticket (migrations en fichiers du dépôt). Aucune migration n'a été copiée ni appliquée : rien n'a été modifié en base.
Hypothèse non vérifiée : le validateur ne reconnaît peut-être pas ces fichiers pour une raison de détection de sa part.
Reste à faire côté fonctionnel : aperçu des remises dans le panier et la page VIP ; lien Promotions dans la navigation admin (components/admin/AdminNav.tsx, hors zone) ; limites d'usage des codes (usage_limit_*) dans la route.

## Précision sur le lien de navigation admin
- base-food ne contient aucun lien « Promotions » dans components/admin : le module y est une section de permissions (déjà reprise dans lib/admin/permissions.ts et lib/admin/roles.ts).
- Black Deew code ses liens en dur dans components/admin/AdminNav.tsx (hors zone d'écriture) ; app/admin/layout.tsx ne peut pas y injecter de lien sans modifier ce fichier.
- Action requise : ajouter { href: "/admin/promotions", label: "Promotions", icon: "tag" } dans le groupe CONFIGURATION de AdminNav.tsx via un ticket qui l'autorise.
- Aperçu client des remises : nécessite une route API publique de lecture des règles (hors zone), car la RLS réserve les tables promotions aux utilisateurs authentifiés.
