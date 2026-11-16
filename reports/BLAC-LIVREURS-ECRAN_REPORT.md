# BLAC-P3-033 — Écran Livreurs : monnaie, stock VIP, clôture rendre ou garder

Statut final : PASS

Portée : code écrit et contrôlé par tests en mémoire (faux Supabase, sans réseau), tsc et eslint. Rien n'a été vérifié dans un navigateur ni sur une vraie base. Aucun SQL exécuté, aucun push, aucun déploiement.

## Écarts du contexte : avant / après

1. Courses de la session
   - Avant : loadDriverDetails lisait les 30 dernières livraisons du livreur, sans filtre de session ; l'affichage montrait « Aucune course » ou des courses d'une autre session.
   - Après : la liste passe par deliveriesOfSession (session ouverte, sinon dernière session clôturée). La lecture a été portée de 30 à 200 livraisons pour que le filtre ait de la matière.
2. Bouton « Argent remis »
   - Avant : proposé dans le bloc « Trésorerie session » d'une session ouverte (handleSettle(openSess.id)).
   - Après : le bloc est remplacé par DriverLedgerPanel ; « Argent remis » n'existe plus que sur les sessions clôturées non réglées (cs.session_status === 'closed' && !cs.settled_at).
3. Frais livreur
   - Avant : fraisLivreur = fonds + CA - total à remettre (déduit à l'envers).
   - Après : somme des frais des livraisons de la session, via computeSessionCash (driverFees). Affichée dans le résumé du panneau.
4. Net à remettre
   - Avant : calculé à la main (ouverture + collecté - frais) dans load et handleCloseSession.
   - Après : vient de computeSessionCash (sessionCashSummary) pour l'affichage, et loadClosingContext pour la clôture.

## Lignes d'appel ajoutées dans page.tsx (numéros de ligne du fichier final)
- l.6-20 : imports de DriverLedgerPanel, DriverCloseDialog, deliveriesOfSession et des helpers de lib/driver-ledger-data.
- l.190-192 : loadLedgers et listVipProducts dans load.
- l.215 : sessionCashSummary pour les KPI (net et frais).
- l.264 : loadLedgers des sessions clôturées dans loadDriverDetails.
- l.308 : loadClosingContext (effet à l'ouverture de la fenêtre de clôture).
- l.383 : openSessionWithLedger dans handleOpenSession.
- l.397 : prepareOpening (report du lendemain) dans startOpening.
- l.408 : loadLedgers après ajout de monnaie ou réapprovisionnement.
- l.417 : finalizeSessionClose dans handleSessionClosed.
- l.502 : deliveriesOfSession pour la liste des courses.
- l.524 : pastille « Stock VIP bas » (stockAlertLevel).
- l.543-552 : DriverLedgerPanel avec addCashMovement et addStockMovement.
- l.607 : describeClosing dans l'historique des sessions.
- l.722 : DriverCloseDialog.
- Fenêtre d'ouverture : champ « Fonds ouverture » conservé, bloc « Produits VIP à embarquer » ajouté.
- Diff mesuré de page.tsx (git diff --stat) : 136 insertions, 76 suppressions.

## Compteurs réels des tests
- tests/admin-livreurs-ledger.test.mjs : 21 tests, 21 pass, 0 fail (modules de données : 14 ; câblage de page.tsx : 7).
- npm test (suite complète) : 475 tests, 475 pass, 0 fail, 0 cancelled, 0 skipped.
- npx tsc --noEmit : code de sortie 0, aucune ligne de sortie.
- npx eslint (page.tsx, DriverLedgerPanel.tsx, DriverCloseDialog.tsx, lib/driver-ledger-data.ts) : code de sortie 0, aucune ligne de sortie.
- node core/quality-control/test-baseline.js du Hub : non lancé.

## Fichiers touchés
- app/admin/livreurs/page.tsx (modifié, 753 lignes)
- lib/driver-ledger-data.ts (créé, 389 lignes)
- components/DriverLedgerPanel.tsx (créé, 196 lignes)
- components/DriverCloseDialog.tsx (créé, 162 lignes)
- tests/admin-livreurs-ledger.test.mjs (créé, 309 lignes)
- reports/BLAC-LIVREURS-ECRAN_REPORT.md (ce rapport)
- Aucun fichier hors zone modifié (git status contrôlé). Sauvegardes de travail hors dépôt : /tmp/page.tsx.bak_BLAC-P3-033 et /tmp/DriverLedgerPanel.tsx.bak_BLAC-P3-033.

## Écarts déclarés
- Net remis à la clôture : le ticket dit « somme réellement rendue ». Choix retenu : net à remettre calculé (computeSessionCash) moins la monnaie gardée. À confirmer par Martial.
- Seules les livraisons au statut delivered comptent (règle de deliveriesOfSession). Les livraisons pending ne sont plus dans la liste des courses ni dans le net ; le compteur « Livraisons » des KPI compte encore pending et delivered (requête inchangée).
- Aucun mouvement « delivered » de stock n'est écrit par ce ticket : la colonne « Livré » du panneau reste à 0 tant qu'un autre ticket n'écrit pas ces mouvements.
- Un réapprovisionnement ou une monnaie ajoutée en cours de journée relance load() : l'écran affiche brièvement « Chargement... ».
- Si les tables de journal n'existent pas encore (SQL non appliqué), loadLedgers renvoie des journaux vides au lieu de casser l'écran ; la clôture utilise alors opening_cash comme fonds.
- Le mode de remise au lendemain suppose que la dernière session closed ou settled du livreur porte le report.
- Un peu d'orchestration reste dans page.tsx (startOpening, runLedgerAction, handleSessionClosed, un effet de chargement) ; les calculs et accès base sont dans lib/driver-ledger-data.ts.
- Incident de run : une première application du script de modification avait supprimé la ligne du champ « Fonds ouverture » et laissé un « $1 » parasite ; réparé (champ restauré depuis la sauvegarde), avec deux tests de câblage qui protègent désormais ce champ.
- Le faux Supabase n'a ni limit ni lte ni gte : loadClosingContext n'applique le filtre de date côté base que si le client le supporte.
- Le produit VIP est affiché par son champ name ; si ce champ n'existe pas, l'identifiant s'affiche (non vérifié sur la vraie table products).

## À vérifier à l'écran par Martial
1. Appliquer d'abord le SQL de BLAC-P3-032 (le run ne l'applique jamais).
2. Ouvrir une session pour un livreur : saisir un fonds et une quantité sur un ou deux produits VIP, valider.
3. Dans le panneau de la session : « Ajouter de la monnaie », puis « Réapprovisionner » un produit ; vérifier l'argent sur le livreur et le stock en main.
4. Mettre un stock à 3 ou moins : la pastille « Stock VIP bas » doit apparaître sur la ligne du livreur.
5. Faire une livraison ; vérifier que « Courses de la session » n'affiche que celles de la session, et que « Argent remis » n'apparaît pas sur la session ouverte.
6. Clôturer : saisir rendu et gardé pour la monnaie et chaque produit ; tester rendu + gardé différent de la quantité (message attendu) ; valider.
7. Dans l'historique : la session doit montrer ce qui a été rendu et gardé ; « Argent remis » n'apparaît que sur la session clôturée.
8. Rouvrir une session le lendemain : le fonds et les produits gardés doivent être préremplis et modifiables.
