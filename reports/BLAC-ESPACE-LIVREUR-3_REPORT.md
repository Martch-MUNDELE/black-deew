# BLAC-ESPACE-LIVREUR-3 — Accueil de l'espace livreur (BLAC-P3-048)

## Fichiers
Crees :
- lib/driver-space.ts (logique pure : types DriverHomeData, splitDeliveries, formatSlot, buildMapsUrl, buildTelUrl, initialOf, plus formatMoney, formatTimeOfDay, formatDayShort)
- lib/driver-space-server.ts (getDriverHome(driverId, fullName?), cle service_role, cote serveur uniquement)
- app/api/driver/home/route.ts (GET, getAdminRole, 401 / 403 / 500, Cache-Control: no-store)
- components/driver/DriverHome.tsx (composant client, rafraichissement toutes les 20 s et au retour de l'onglet)
- tests/driver-space-home.test.mjs (9 tests)
- reports/BLAC-ESPACE-LIVREUR-3_REPORT.md (ce rapport)

Modifie :
- app/admin/driver/page.tsx (appelle getDriverHome pour le premier affichage, rend DriverHome ; message « Aucun profil livreur lié à ce compte », lien /admin et bouton Déconnexion conserves)

Non modifies : app/admin/livreurs/page.tsx, lib/driver-ledger.ts, lib/driver-ledger-data.ts, supabase/migrations (git diff vide). Aucun .env lu ni modifie.

## Statuts reels de order_deliveries (lus dans le code)
- assigned (creation depuis la page Commandes), pending (filtre de la page Livreurs), delivered (app/api/mark-livree), cancelled (app/api/update-order-status).
- splitDeliveries : delivered = deja livree ; cancelled / canceled = ecartee ; tout autre statut = a faire.

## Donnees renvoyees au livreur (GET /api/driver/home)
- driver : id, fullName
- session (ou null) : id, startedAt, openingCash
- cash (ou null) : given, collected, driverFees, netToRemit (sessionCashSummary)
- lastSession (ou null, seulement sans session ouverte) : startedAt, closedAt, deliveriesCount, collected, driverFees, netToRemit
- stock : productId, name, onHand, level (low / empty / null), produits VIP portables ayant au moins un mouvement dans la session
- deliveries : id, orderId, status, customerName, customerPhone, address, lat, lng, slotDate, slotStart, slotEnd, amountToCollect, amountCollected, deliveredAt
- generatedAt
Aucun email client, aucun statut de paiement, aucune donnee d'un autre livreur : toutes les lectures filtrent sur driver_id = identifiant de la session.

## Tests lances (mesures reelles)
- node --test tests/driver-space-home.test.mjs : 9 tests, 9 pass, 0 fail.
- npm test (black-deew) : 592 tests, 592 pass, 0 fail, 0 cancelled, 0 skipped (583 avant le ticket + 9).
- npx tsc --noEmit : code de sortie 0.
- npx eslint sur les cinq fichiers de code : code de sortie 0.
- L'echec connu de tests/BLAC-P3-038.test.mjs (fichier non suivi, hors ticket) n'est pas apparu dans cette execution ; fichier non touche.

## Choix a connaitre
- La route n'accepte que le role driver (comme demande) : un administrateur qui previsualise /admin/driver voit la page mais son rafraichissement recoit 403 et affiche « Connexion perdue, nouvel essai... ».
- Le stock n'affiche que les produits VIP portables ayant un mouvement dans la session (sinon « Aucun stock chargé pour cette session. »).
- Heures affichees dans le fuseau Africa/Kinshasa.
- Sans session ouverte, aucune livraison n'est affichee (les livraisons sont celles de la session ouverte).

## Non verifie
- Aucun rendu dans un navigateur (mise en page 390 px, polices, zones tactiles, rafraichissement reel sans clignotement, fond plein ecran dans le conteneur du layout).
- Aucune lecture contre la vraie base : existence de la colonne order_deliveries.amount_to_collect et des colonnes de driver_sessions lues, comportement avec une vraie session, RLS reelle.
- Aucun SQL execute, aucun commit, aucun push, aucun deploiement.
