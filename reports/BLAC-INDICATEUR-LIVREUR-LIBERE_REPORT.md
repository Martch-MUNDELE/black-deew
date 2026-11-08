# BLAC-P3-054 - Indicateur "Livreurs libérés" (dashboard admin Black Deew)

## Réalisé
- lib/driver-delivery-feed.ts : fonction pure buildDeliveryFeed(rows, drivers, now) ; courses 'delivered' des dernières 24 h, plus récentes d'abord, { order_id, driver_name, delivered_at, amount_collected, minutes_ago } ; lignes sans delivered_at ou non 'delivered' ignorées.
- components/admin/DriverDeliveryIndicator.tsx : bloc « Livreurs libérés », lignes « <Nom> a terminé sa course (il y a X min) – <montant> », état vide « Aucune course terminée récemment », rafraîchi toutes les 30 s, lecture seule (client Supabase du dashboard, tables order_deliveries et delivery_drivers).
- app/admin/page.tsx : import + <DriverDeliveryIndicator currency={currency} /> en haut du dashboard, sans condition de rôle (visible pour l'admin). Aucun autre changement.
- tests/driver-delivery-feed.test.mjs : 5 tests ; copie dans 00_SYSTEM/reports/hub/BLAC-P3-054_work/.

## Vérifié (exécuté réellement)
- node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/driver-delivery-feed.test.mjs : 5 tests, 5 pass, 0 fail
- npx tsc --noEmit : exit 0

## Limites
- Composant non vérifié dans un navigateur ni sur la vraie base (tests sur la fonction pure uniquement).
- Si un livreur n'est pas retrouvé dans delivery_drivers, le nom affiché est « Livreur ».
- Les RLS Supabase sur order_deliveries / delivery_drivers pour le rôle admin n'ont pas été contrôlées.

## Interdits respectés
Aucune base modifiée, aucune migration, aucun commit, aucun push, aucun déploiement.
