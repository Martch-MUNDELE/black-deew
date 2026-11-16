# BLAC-LIVREURS-LEDGER — Rapport

Statut final : PASS

Portée du PASS : fichiers écrits et contrôlés, test du ticket 24/24, npm test 454/454, tsc et eslint sans erreur. Le SQL n est PAS appliqué ni exécuté : la migration est contrôlée uniquement comme texte.

Ticket : BLAC-P3-032 (remplace BLAC-P3-031) — BLACK DEEW : livreurs 1/3 bis, journal de monnaie et de stock VIP embarqué.

**Le SQL n'est PAS appliqué.** Le fichier de migration est écrit et contrôlé uniquement comme texte. Aucune base n'a été contactée, aucun SQL exécuté, aucun push, aucun déploiement. Seul Martial l'applique après relecture.

## Fichiers touchés (liste exacte)

- supabase/migrations/20261106_bd_driver_ledger.sql (nouveau)
- lib/driver-ledger.ts (nouveau)
- tests/driver-ledger.test.mjs (nouveau)
- reports/BLAC-LIVREURS-LEDGER_REPORT.md (ce rapport, nouveau)
- Rapport de validation du Hub, hors dépôt : $HOME/PROJECTS_APPLI/00_SYSTEM/reports/hub/BLAC-P3-032_VALIDATION_REPORT.md

Aucun fichier existant du projet n'a été modifié ni supprimé par ce run. Le git status relevé était tronqué aux 20 premières lignes : dans cet extrait, lib/driver-ledger.ts apparaît comme nouveau ; les autres lignes visibles sont d'anciens rapports reports/BD-*, non touchés par ce run.

## Types vérifiés (lus dans la migration de clonage 20260811190237_mdh_clone_public_to_style_for_style.sql)

- driver_sessions.id, delivery_drivers.id, products.id, orders.id : uuid.
- driver_sessions : opening_cash, collected_cash, expected_cash, net_to_remit, driver_fee_total = numeric ; started_at, closed_at, ended_at, settled_at, created_at = timestamptz.
- order_deliveries : order_id uuid, driver_id uuid nullable, status text, amount_collected numeric, driver_fee_total numeric, delivered_at / created_at timestamptz.
- products.stock = integer ; products.is_vip = boolean (défaut false).

## Schéma retenu

Schéma public (comme les migrations récentes ; le clone cible le schéma style).

driver_cash_movements : id uuid pk (gen_random_uuid), session_id uuid not null → driver_sessions(id) on delete cascade, driver_id uuid not null → delivery_drivers(id) on delete cascade, kind text (opening, topup, returned, kept_for_next_day), amount numeric not null check >= 0, note text, created_at timestamptz default now().

driver_stock_movements : id uuid pk, session_id uuid not null → driver_sessions(id) on delete cascade, driver_id uuid not null → delivery_drivers(id) on delete cascade, product_id uuid not null → products(id), kind text (load, topup, delivered, returned, kept_for_next_day, adjust_plus, adjust_minus), quantity integer not null check > 0, order_id uuid → orders(id) on delete set null, created_at timestamptz default now().

Index : session_id et (driver_id, created_at) sur chaque table. Commentaires de colonnes en français. Bloc de retour arrière en commentaire. Aucune insertion, aucune modification de table existante.

## Choix de la colonne de date des livraisons

order_deliveries possède delivered_at et created_at. Retenu : **delivered_at** (moment réel de la livraison), avec repli sur **created_at** quand delivered_at est vide pour une livraison au statut delivered. Une livraison sans aucune date exploitable est exclue. Fenêtre inclusive : de started_at à closed_at ; si closed_at est vide, repli sur ended_at, puis sur maintenant (session ouverte).

## Fonctions de lib/driver-ledger.ts (toutes pures, sans réseau ni base)

- DEFAULT_VIP_LOW_STOCK = 3.
- deliveriesOfSession(deliveries, session, now?) : garde les livraisons du livreur, au statut delivered, dans la fenêtre de la session.
- computeSessionCash({movements, deliveries, session, now?}) : renvoie opening, topup, given (fonds donné), collected, driverFees, netToRemit = given + collected - driverFees (règle conservée), returned, kept, cashOnHand. Montant négatif : erreur.
- vipStockBalance(movements) : tableau par produit avec loaded (load + topup), delivered, returned, kept, adjustPlus, adjustMinus, onHand (load + topup + adjust_plus - delivered - returned - kept_for_next_day - adjust_minus), insufficient (vrai si le solde passe sous zéro à un moment, mouvements pris dans l'ordre chronologique). Quantité non entière ou non positive : erreur.
- buildClosingMovements({cashOnHand, stockOnHand, decisions}) : exige rendu + gardé = en main pour la monnaie et pour chaque produit, sinon LedgerError explicite ; jamais de quantité négative ; renvoie cashMovements et stockMovements (lignes à zéro omises).
- carryOverFromSession({cash, stock}) : openingCash (monnaie gardée) et stockLoads (une ligne load par produit gardé).
- lowStockAlerts(balances, threshold = 3) : empty (en main <= 0) et low (en main <= seuil) ; rien au-dessus du seuil.
- assertVipProduct(product) : refuse tout produit dont is_vip n'est pas exactement true.

## Résultats mesurés dans ce run

- node --test tests/driver-ledger.test.mjs (avec le loader du projet) : 24 tests, 24 pass, 0 fail.
- npm test (suite complète, sans réseau) : 454 tests, 454 pass, 0 fail, 0 cancelled, 0 skipped. Sans les 24 nouveaux tests, cela correspond à 430 (calcul 454 - 24, non mesuré séparément).
- npx tsc --noEmit : code de sortie 0, aucune sortie d'erreur.
- npx eslint lib/driver-ledger.ts : aucune erreur (ESLINT_OK).

## Écarts déclarés

1. RLS : driver_sessions n'a ni ALTER TABLE ... ENABLE ROW LEVEL SECURITY ni policy dans les migrations du projet (seulement GRANT ALL à anon, authenticated, service_role). Les deux nouvelles tables reproduisent exactement ce régime (pas de RLS, mêmes GRANT). Je n'ai pas pu vérifier l'état réel en base de production (aucune connexion autorisée) : il peut différer des migrations.
2. session_status : le schéma réel admet open, closed, cancelled, settled ; le ticket cite open, closed, settled. Les fonctions ne dépendent pas de ce statut.
3. driver_sessions possède closed_at et ended_at ; le ticket cite closed_at. Repli sur ended_at ajouté.
4. Suppression des driver_id : non précisée par le ticket ; on delete cascade retenu, comme driver_sessions.driver_id. products(id) : sans action (suppression d'un produit mouvementé bloquée).
5. Le contrôle « produit VIP » est fait côté application (assertVipProduct), pas par contrainte SQL.
6. « Argent sur le livreur » (cashOnHand) est défini comme la monnaie confiée (fonds donné) moins rendu moins gardé ; il n'inclut pas l'argent collecté, qui reste suivi par netToRemit.
7. Le contrat MDH indique de ne jamais utiliser npm test et de lancer node core/quality-control/test-baseline.js ; le ticket impose npm test. npm test a été lancé comme demandé par le ticket ; test-baseline.js n'a pas été lancé dans ce run.
8. Le runner de tests a été lancé via npm test et via node --test avec le loader tests/helpers/register.mjs ; aucun test existant n'a été modifié.
