# BLAC-P3-076 : première position du livreur dès l'acceptation

Date : 20 novembre 2026. Projet : black-deew.

## Checklist

- [x] `components/driver/DriverAcceptDelivery.tsx` : après une acceptation réussie et avant `window.open` de WhatsApp, une seule lecture de position (`navigator.geolocation.getCurrentPosition`, `timeout: 4000`) puis envoi à `/api/driver/tracking`.
- [x] Payload construit par `buildPositionPayload` importé depuis `@/lib/tracking-sender` (aucune logique dupliquée) ; identifiant = `deliveryId` déjà utilisé par le composant.
- [x] Attente totale ajoutée plafonnée à 4000 ms (minuteur de 4000 ms en course avec la lecture et l'envoi, `Promise.race`).
- [x] Tout échec (refus, délai dépassé, erreur réseau, coordonnées invalides, géolocalisation absente) est ignoré silencieusement ; WhatsApp s'ouvre quand même.
- [x] Message WhatsApp, lien de suivi, API, schéma et autres composants non modifiés.
- [x] `tests/driver-accept-first-position.test.mjs` écrit (13 tests) et réussi.
- [x] Tests existants relancés : driver-accept-whatsapp, driver-accept-delivery, driver-tracking-sender, delivery-tracking.
- [x] Suite complète relancée avec `node --test --import ./tests/helpers/register.mjs`.
- [x] Aucun push, aucune opération Supabase, aucun déploiement.

## Mesures (avant / après)

| Mesure | Avant | Après |
|---|---|---|
| Tests exécutés | 824 | 837 |
| Réussis | 824 | 837 |
| Échecs | 0 | 0 |
| Ignorés | 0 | 0 |
| Annulés | 0 | 0 |

- Baseline avant : relevée avec le squelette du nouveau test déjà créé (825 réussis) ; moins ce squelette, 824 réussis, 0 échec, 0 ignoré.
- Écart : +13 tests, qui sont les 13 tests du nouveau fichier. Aucun autre test n'a changé d'état.
- Les 5 fichiers ciblés ensemble : 47 tests, 47 réussis, 0 échec, 0 ignoré.

## Ce que couvre le test

- Position envoyée à `/api/driver/tracking` (POST JSON) avec le format exact de `buildPositionPayload`, quand la géolocalisation répond.
- L'envoi est attendu avant la fin de la fonction ; dans le composant, l'appel se situe entre `setAccepted` et `window.open`.
- WhatsApp reste ouvrable en cas de refus, d'exception, de géolocalisation absente, de délai dépassé, d'envoi réseau bloqué ou rejeté, de coordonnées invalides.
- Délai maximal : constante à 4000, `timeout: 4000` passé à `getCurrentPosition`, minuteur de 4000 ms, relâché dans tous les cas.
- Pas de duplication : import et appel de `buildPositionPayload`, aucune construction de payload dans le bloc.
- Méthode : le code réel de `sendFirstPosition` est extrait du composant, ses types sont retirés (`module.stripTypeScriptTypes`) et il est exécuté avec des doubles de `navigator`, `fetch` et des minuteurs. Le test ne s'exécute donc pas dans un vrai navigateur.

## Écarts et points d'attention

- Le test est placé dans `tests/`, conformément aux zones d'écriture du ticket (et non dans `00_SYSTEM/reports/hub/`).
- `git status` montrait déjà `app/admin/commandes/page.tsx` modifié et plusieurs rapports non suivis dans `reports/` avant mes modifications : non touchés par ce ticket.
- Le contrôle de types `tsc --noEmit` n'a remonté aucune erreur sur `DriverAcceptDelivery.tsx` ni `tracking-sender` ; son exécution complète n'a pas été chronométrée.
- Non mesuré : le comportement sur un vrai téléphone. Après une attente pouvant aller jusqu'à 4 s, certains navigateurs peuvent bloquer l'ouverture automatique de WhatsApp par `window.open` ; le lien « Prévenir le client sur WhatsApp » reste alors affiché (comportement déjà prévu par le composant). À vérifier en test réel.
- La valeur de 4 s s'applique à la lecture de position (hors invite de permission), mais l'attente de l'écran est plafonnée dans tous les cas à 4000 ms par le minuteur.

## Limite connue

L'envoi continu en arrière-plan reste limité par le navigateur : une fois le livreur dans WhatsApp, l'application est suspendue et `DriverTrackingSender` n'envoie plus de position. Cette modification garantit seulement une première position en base dès l'acceptation ; la position en direct WhatsApp du livreur est le relais pendant la course.
