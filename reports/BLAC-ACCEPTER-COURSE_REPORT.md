# BLAC-P3-058 — Accepter la course (espace livreur Black Deew)

## Livrables
- lib/accept-delivery.ts : fonction pure nextStatusOnAccept(status).
- app/api/driver/accept-delivery/route.ts : POST {delivery_id}, 401 / 403 / 400 / 404, 409 si livree ou annulee, idempotent (already:true), ecrit status='picked_up' et picked_up_at, reponses no-store. Identifiant livreur pris uniquement dans la session (getAdminRole).
- components/driver/DriverAcceptDelivery.tsx : bouton « Accepter la course », etat de chargement, message d'erreur, router.refresh() apres succes.
- components/driver/DriverDeliveryDetail.tsx : bouton Accepter tant que la course n'est pas acceptee ; « Marquer comme livrée » seulement quand le statut est 'picked_up' ; badge « Acceptée » ensuite ; « Livrée » une fois livree.
- tests/driver-accept-delivery.test.mjs : fichier de test du ticket.

## Resultats mesures (fichier de test cible)
Commande : node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/driver-accept-delivery.test.mjs
Resultat : 8 tests, 8 pass, 0 fail, 0 cancelled, 0 skipped.

Tests couverts :
- nextStatusOnAccept : assigned => picked_up ; picked_up => already ; delivered et cancelled => refus avec raison ; casse et espaces ignores.
- route : controles 401, 403, 400, 404 dans l'ordre (lecture du code), driver_id impose par la session, transition idempotente, 409 si refus, no-store.
- composant : appel de la route, rafraichissement, chargement, erreur, ni confirm( ni alert(.
- detail : Livrée seulement apres acceptation, badge Acceptée, bouton Accepter avant.

npx tsc --noEmit : code de sortie 0 (sortie vide).

## Compatibilite
La ligne `{!delivered ? <DriverMarkDelivered ... /> : null}` est conservee a l'identique (placee dans le bloc `accepted`), donc tests/driver-mark-delivered.test.mjs reste vert : 9 tests, 9 pass, 0 fail. app/api/driver/mark-delivered/route.ts et components/driver/DriverMarkDelivered.tsx ne sont pas modifies.

## Points d'attention
- components/driver/DriverDeliveryDetail.tsx est modifie car le ticket l'exige (point 4 et ZONES), alors que la liste « zones d'ecriture autorisees » du contrat ne le mentionne pas.
- Aucune migration, aucun SQL, aucun push, aucun deploiement.
- Non verifie : navigateur et vraie base (le comportement reel sur une livraison en base n'a pas ete teste).
