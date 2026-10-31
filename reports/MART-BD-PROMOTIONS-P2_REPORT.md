# MART-BD-PROMOTIONS-P2 — Rapport

Statut final : PASS

Voir le rapport de validation détaillé : 00_SYSTEM/reports/hub/BLAC-P2-014_VALIDATION_REPORT.md

## Fichiers modifiés ou créés
- components/admin/AdminNav.tsx (lien Promotions + filtre par permission)
- app/api/promotions/route.ts (route publique, liste blanche)
- lib/promotion-rules.ts (selectPublicPromotions, toPublicPromotion)
- lib/promotions.ts (findPromoCodeRule, checkPromoCodeUsage, previewPublicPromotions)
- app/api/commandes/route.ts (refus code épuisé, incrément d'usage)
- app/(public)/panier/page.tsx, app/(public)/vip/page.tsx (aperçu indicatif)
- tests/promotions-phase2.test.mjs, config/promotions-public.json

## Résultats
tsc sans erreur ; npm test : 147/147.

## Limites
- Limite par client (usage_limit_per_customer) non appliquée : pas de table d'historique par client, schéma non modifiable dans ce ticket.
- Incrément du compteur non atomique (best effort).
- Pages non vérifiées visuellement dans un navigateur.
