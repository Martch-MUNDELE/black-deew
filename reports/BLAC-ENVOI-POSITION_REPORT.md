# BLAC-P3-065 — Envoi de position du livreur

## Fichiers
- lib/tracking-sender.ts : TRACKING_INTERVAL_MS = 15000, shouldSendPosition, buildPositionPayload.
- components/driver/DriverTrackingSender.tsx : watchPosition (enableHighAccuracy), envoi à /api/driver/tracking au plus toutes les 15 s, clearWatch au démontage, pastille « Position partagée » ou « Active la localisation pour que le client te suive ». Les échecs réseau sont ignorés.
- components/driver/DriverMarkDelivered.tsx : monte DriverTrackingSender et ajoute le bouton repliable « Partager ma position en direct dans WhatsApp » avec trois consignes. Le formulaire de confirmation et de livraison est inchangé.
- app/api/driver/mark-delivered/route.ts : après markOrderDelivered réussi, delivery_tracking passe à active=false et ended_at=maintenant (là où active est vrai) ; l'échec est ignoré et la réponse ne change pas. Les contrôles 401/403/400/404/409 sont inchangés. Cette modification est explicitement demandée par le ticket (travail demandé 4 et ZONES) ; elle n'apparaît pas dans les zones d'écriture du contrat V2.
- tests/driver-tracking-sender.test.mjs : tests du ticket.

## Résultats exacts des tests ciblés
Commande : node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/driver-tracking-sender.test.mjs tests/driver-mark-delivered.test.mjs
- tests/driver-tracking-sender.test.mjs : 7 tests, 7 réussis, 0 échec.
- tests/driver-mark-delivered.test.mjs : 9 tests, 9 réussis, 0 échec.
- (les deux fichiers lancés ensemble : 16 tests, 16 réussis, 0 échec)

## tsc
npx tsc --noEmit : code de sortie 0, aucune erreur.

## Limite
La géolocalisation réelle n'a pas été vérifiée sur téléphone : seuls les tests de texte et de fonctions pures et tsc ont été exécutés.
