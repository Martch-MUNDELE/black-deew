# BLAC-P3-034 — Rapport : affectation, décrément du stock VIP embarqué, alerte stock bas

Statut final : PASS

Portée du PASS : code contrôlé par tests en mémoire, tsc et eslint ; aucune vérification dans un navigateur ni sur une vraie base.
Aucun SQL exécuté, aucun push, aucun déploiement. Le SQL du journal (BLAC-P3-032) est supposé appliqué par Martial : le code ne l'applique jamais.

## Fichiers touchés (liste exacte, d'après git status)
- app/api/mark-livree/route.ts (modifié)
- app/admin/commandes/page.tsx (modifié)
- lib/driver-stock-alert.ts (créé)
- components/DriverVipAlert.tsx (créé)
- tests/driver-stock-alert.test.mjs (créé)
- reports/BLAC-LIVREURS-COMMANDES_REPORT.md (ce rapport)
Aucun fichier de test existant modifié ni supprimé.

## Lignes modifiées avant / après

### app/api/mark-livree/route.ts
- Imports : ajout de addStockMovement, listCashMovements, listStockMovements, sessionCashSummary (lib/driver-ledger-data), vipQuantities et OrderLineInput (lib/driver-stock-alert), type LedgerDelivery (lib/driver-ledger). Type local DeliveryCashRow supprimé (devenu inutile).
- Avant : `})()` (bloc de recalcul de facturation) ; après : `})().catch(() => {})` (une promesse rejetée ne peut plus remonter non gérée).
- Avant : `.select('id, opening_cash')` sur driver_sessions ; après : `.select('*')` (besoin de started_at et closed_at).
- Ajout (après la recherche de la session ouverte) : lecture de order_items de la commande, quantités VIP par produit (vipQuantities), lecture des mouvements de la session, écriture d'un mouvement `delivered` (quantité de l'article, order_id) pour chaque produit VIP qui n'en a pas déjà un pour cette commande. Tout est dans un try/catch : un échec est écrit par console.error et ne bloque pas la livraison.
- Avant : `.select('amount_collected, driver_fee_total')` puis somme sur TOUTES les livraisons livrées du livreur, `net_to_remit: openingCash + collected - feesTotal` avec `openingCash = Number(sess.opening_cash)`.
- Après : `.select('*')`, lecture du journal de monnaie de la session (repli sur opening_cash si le journal est vide ou illisible), puis `sessionCashSummary(...)` (qui utilise deliveriesOfSession et computeSessionCash) ; `collected_cash: cash.collected`, `net_to_remit: cash.netToRemit`. Fonds réel = ouverture + compléments.
- Inchangé : exigence administrateur, suppression des commandes de test, passage à livrée, mise à delivered de order_deliveries, historique de statuts.

### app/admin/commandes/page.tsx
- Imports (lignes 6 à 15) : DriverVipAlert, driverVipAlerts, driverVipNote, hasVipLines, loadOpenDriverStock et types.
- Fenêtre d'affectation (DispatchModal, lignes 302 à 305) : état vipStock, orderLines, vipOrder, chargement par loadOpenDriverStock.
- Ligne de la liste des livreurs (avant la ligne 401, après la ligne 415) : sous le téléphone, quand la commande contient des articles VIP, affichage `VIP en main : ...` (data-testid vip-driver-stock) et, si insuffisant, un avertissement orange (data-testid vip-stock-warning). Le bouton « Confirmer la livraison » garde `disabled={!selectedDriver || saving}` : rien ne bloque l'affectation. handleConfirm n'est pas modifiée.
- Page principale (lignes 447 à 449 et 639) : chargement des alertes et `<DriverVipAlert alerts={vipAlerts} />` avant le titre « Commandes ».
- Toute la logique est dans lib/driver-stock-alert.ts ; la page ne contient que des lignes d'appel.

## Preuve que products.stock n'est jamais diminué
- Dans app/api/mark-livree/route.ts, lib/driver-stock-alert.ts et components/DriverVipAlert.tsx, aucune écriture (update, upsert, delete, insert, rpc) sur la table products : contrôlé par le test « aucun code du ticket n écrit dans la table products » (lecture du texte des trois fichiers).
- addStockMovement (BLAC-P3-033) ne fait qu'une lecture de products (requireVipProduct) puis un insert dans driver_stock_movements.
- Test de la route « products.stock jamais modifié » : la table products est identique avant et après deux appels de livraison (comparaison profonde).

## Compteurs réels des tests (mesurés dans ce run)
- tests/driver-stock-alert.test.mjs : 18 tests, 18 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo.
- npm test : 493 tests, 493 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo.
- npx tsc --noEmit : code de sortie 0, aucune sortie.
- npx eslint app/api/mark-livree/route.ts app/admin/commandes/page.tsx lib/driver-stock-alert.ts components/DriverVipAlert.tsx : code de sortie 0, aucune sortie.

Couverture du test du ticket : fonctions pures (manquants, texte d'avertissement, alertes empty et low, aucune alerte), route (stock embarqué diminué, deuxième appel sans doublon, products.stock inchangé, commande sans article VIP sans mouvement, recalcul limité à la session avec fonds 120, collecté 40, net 155, échec du journal non bloquant, refus sans administrateur, commande de test supprimée), câblage de la page et du bandeau.

## Écarts déclarés
1. node core/quality-control/test-baseline.js : ce fichier n'existe pas dans le dépôt black-deew (ls : introuvable). npm test a été lancé car imposé par le ticket.
2. Ajout de `.catch(() => {})` sur le bloc de facturation de la route (hors demande) : le faux Supabase des tests n'a pas lte/gte, ce qui produisait une promesse rejetée non gérée ; sans effet sur le comportement réel.
3. Le bandeau est chargé à l'ouverture de la page ; il n'est pas rafraîchi automatiquement après une livraison : recharger la page.
4. Une alerte n'existe que pour un produit qui a au moins un mouvement dans le journal de la session ; un livreur sans aucun chargement VIP n'a pas d'alerte, mais l'avertissement d'affectation s'affiche (0 en main).
5. Sans session ouverte pour le livreur, aucun mouvement n'est écrit (rien où l'écrire).
6. Si le journal de monnaie est vide ou illisible, repli sur opening_cash comme fonds (comportement de sessionCashSummary).
7. Les livraisons sans delivered_at ni created_at ne sont pas comptées par deliveriesOfSession.
8. Une quantité livrée supérieure au stock en main rend le solde négatif : le bandeau l'affiche comme « plus de produit », sans blocage.
9. Aucune vérification dans un navigateur ni sur la vraie base.

## À vérifier à l'écran par Martial
1. Ouvrir une session livreur avec un chargement VIP faible (par exemple 1 ou 2 unités d'un produit) via l'écran Livreurs.
2. Dans Commandes, affecter une commande contenant plus de ce produit VIP que ce que le livreur a en main : sous le livreur, « VIP en main : ... » et l'avertissement orange doivent s'afficher, et le bouton « Confirmer la livraison » doit rester utilisable.
3. Affecter quand même, puis marquer la commande livrée : dans l'écran Livreurs, la ligne « Livré » du produit doit augmenter de la quantité de la commande et le stock embarqué doit baisser.
4. Recharger la page Commandes : le bandeau « Stock VIP des livreurs » doit apparaître en haut (« plus de produit X » si le solde est nul ou négatif, « stock bas de X : n restant » au seuil de 3 ou moins).
5. Marquer la même commande livrée une seconde fois : le stock embarqué ne doit pas baisser une deuxième fois.
6. Vérifier que le stock général du produit dans Produits n'a pas été diminué une seconde fois à la livraison (il baisse seulement à la création de la commande).
7. Vérifier le net à remettre de la session : fonds (ouverture plus compléments) plus argent collecté moins frais livreur, sans les livraisons d'une session précédente.
