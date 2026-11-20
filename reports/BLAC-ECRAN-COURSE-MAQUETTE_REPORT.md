# BLAC-P3-068 — Ecran de detail d'une course selon la maquette « 2 · Nouvelle course »

## Etat de la reprise
Au demarrage, seuls page.tsx et DriverDeliveryDetail.tsx (ancienne version) existaient. Les autres fichiers du ticket etaient absents et ont ete crees. Releve de la suite complete AVANT : non mesure (aucun lancement avant les modifications, la reprise etant vide).

## Fichiers (ZONES)
- components/driver/DriverRouteIllustration.tsx : SVG pur sans etat (fond sombre, rues, courbe pointillee or, depart vert, epingle orange, pastille de distance en bas a gauche, aria-hidden, aucun http).
- lib/driver-delivery-view.ts : headerBadge, steps, stockNote (fonctions pures).
- lib/driver-delivery-stock-server.ts : getDriverStockBalances(driverId), meme lecture que getDriverHome (listVipProducts, loadLedgers, vipStockBalance), filtree sur le livreur, renvoie [] sans session ouverte ou en erreur.
- app/admin/driver/livraison/[id]/page.tsx : appelle getDriverStockBalances(driver.id) avec repli sur [] et passe stockBalances au composant.
- components/driver/DriverDeliveryDetail.tsx : refait selon la maquette ; composants DriverAcceptDelivery, DriverNavigationLinks, DriverMarkDelivered inchanges.
- tests/driver-delivery-maquette.test.mjs : 15 tests.
- Non modifies : DriverHome.tsx, lib/driver-space.ts, lib/driver-space-server.ts, fichiers .env.

## Resultats mesures (fichiers de test cibles)
- tests/driver-delivery-maquette.test.mjs : 15 tests, 15 pass, 0 fail.
- tests/driver-space-detail.test.mjs : 7 tests, 7 pass, 0 fail.
- tests/driver-accept-delivery.test.mjs : 8 tests, 8 pass, 0 fail.
- tests/driver-accept-whatsapp.test.mjs : 9 tests, 9 pass, 0 fail.
- tests/driver-navigation.test.mjs : 7 tests, 7 pass, 0 fail.
- npx tsc --noEmit : code de sortie 0.

Tests existants adaptes (uniquement ce que la nouvelle mise en page impose) : driver-space-detail (plus de barre fixe ni libelle « Mes livraisons » : fleche retour vers /admin/driver ; Itineraire fourni par DriverNavigationLinks), driver-accept-delivery (variables accepted et notYetAccepted, composants d'action), driver-navigation (liens d'itineraire dans le bloc course acceptee).

## Suite complete (ecart ferme)
Apres la premiere passe, npm test donnait 749 tests, 748 pass, 1 fail : le test « DriverDeliveryDetail : bouton seulement si non livree, Appeler et Itineraire conserves » de tests/driver-mark-delivered.test.mjs verifiait l'ancien JSX. Il a ete adapte (adaptation autorisee a la reprise) : il verifie maintenant que DriverMarkDelivered n'apparait que pour une course acceptee (picked_up), qu'il est unique et place avant Appeler, que DriverNavigationLinks est present et que le bandeau d'etapes s'affiche pour delivered.
Resultats finaux mesures :
- tests/driver-mark-delivered.test.mjs : 9 tests, 9 pass, 0 fail.
- Les 6 fichiers cibles ensemble : 55 tests, 55 pass, 0 fail.
- npm test (suite complete, apres) : 749 tests, 749 pass, 0 fail.
- npx tsc --noEmit : code de sortie 0.

## Ce qui correspond a la maquette
En-tete (fleche retour 44 px vers /admin/driver, libelle NOUVELLE COURSE / COURSE EN COURS / COURSE LIVREE, titre « Commande # » + orderRef en Playfair, pastille headerBadge), carte trajet avec illustration et distance (formatDistanceKm, aucune duree inventee), carte client avec A ENCAISSER en Playfair or, tuiles Creneau et Mes frais (+ en vert), bloc A LIVRER avec lignes x quantite et pastilles de stock VIP (verte suffisant / orange insuffisant), phrase d'acceptation puis bouton existant, bandeau d'etapes (rond or courant, coche verte faites), Navigation + Marquer livree + Appeler pour picked_up, bandeau termine sans action pour delivered, etats d'erreur conserves (Livraison introuvable, Lecture impossible), couleurs et polices du ticket, icones SVG, aucun emoji.

## Ce qui differe ou n'est pas fait
- Lien « Signaler un probleme » : NON fait (aucune destination definie).
- Duree du trajet : NON faite (aucune donnee fiable).
- Vraie carte : NON faite (illustration SVG stylisee).
- Libelles affiches avec accents (« À accepter », « Livrée », « Annulée », « Acceptée ») alors que le ticket les ecrit sans accents ; les tests le refletent.
- Les liens d'itineraire ne s'affichent plus pour une course non encore acceptee (seulement picked_up), comme demande par le ticket ; la barre d'actions fixe en bas a ete remplacee par des blocs dans le flux de la page.
- Le rendu visuel n'a PAS ete verifie sur telephone (ni dans un navigateur).
- Contrat Hub : « node core/quality-control/test-baseline.js » introuvable depuis ce depot (core/ absent), remplace par npm test.
