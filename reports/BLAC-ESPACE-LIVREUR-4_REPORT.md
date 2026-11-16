# BLAC-ESPACE-LIVREUR-4 — Detail d'une livraison (livreur)

Ticket : BLAC-P3-049. Lecture seule, aucune ecriture, aucune migration.

## Fichiers modifies ou crees
- lib/driver-space.ts : types DriverDeliveryItem et DriverDeliveryDetail ; fonctions pures shortOrderRef, formatDistanceKm, formatLongDate.
- lib/driver-space-server.ts : getDriverDelivery(driverId, deliveryId) (service_role, driver_id impose, null si inconnue ou d'un autre livreur).
- app/admin/driver/livraison/[id]/page.tsx : page serveur ; getAdminRole, role driver, UUID valide avant requete, redirection vers /admin/driver sans profil, « Livraison introuvable ».
- components/driver/DriverDeliveryDetail.tsx : ecran de la maquette (retour, titre, pastille, creneau et adresse, note du client, contenu et montant, barre fixe Appeler / Itineraire avec safe-area).
- components/driver/DriverHome.tsx : zone nom et adresse des cartes a livrer et cartes deja livrees devenues de vrais liens <a> vers /admin/driver/livraison/<id> ; boutons Appeler et Itineraire inchanges (liens separes, pas d'imbrication).
- tests/driver-space-detail.test.mjs : 7 tests.

## Champs renvoyes au livreur
id de livraison, reference courte de commande, nom, telephone, adresse, lat, lng, note du client, creneau (date, debut, fin), distance, statut, articles (nom, quantite, prix unitaire), frais de livraison, montant a encaisser. Aucun email client, aucune donnee de paiement.

## Tests lances
- Test du ticket : 7 tests, 7 pass, 0 fail.
- npm test : 599 tests, 599 pass, 0 fail (l'echec connu de tests/BLAC-P3-038.test.mjs n'est pas apparu).
- npx tsc --noEmit : 0. npx eslint sur les cinq fichiers de code : 0.

## Non verifie
- Aucun controle dans un navigateur (390 px, barre fixe, safe-area, polices, liens tel: et Maps).
- Aucune lecture contre la vraie base (noms de colonnes selon le ticket ; ordre des articles non garanti).
