# BLAC-SUIVI-LIVRAISON-PAGE — Rapport

## Fichiers créés
- `lib/tracking-view.ts` : `osmEmbedUrl`, `googleMapsUrl`, `trackingStatusText` (fonctions pures).
- `app/suivi/[token]/page.tsx` : page client publique de suivi (style sombre et doré), interrogation de `/api/tracking/<token>` à l'ouverture puis toutes les 10 secondes, carte OpenStreetMap en iframe, lien « Ouvrir dans Google Maps », heure de dernière mise à jour, message « Ce lien de suivi n'est plus valide » sur 404, message de fin sans carte quand la livraison est terminée. Aucune donnée personnelle affichée.
- `tests/tracking-view.test.mjs` : tests ciblés.

Aucune dépendance npm ni script externe ajouté.

## Résultats du fichier de test ciblé
Commande : `node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/tracking-view.test.mjs`

- tests 8
- pass 8
- fail 0
- cancelled 0
- skipped 0

## tsc
`npx tsc --noEmit -p tsconfig.json` : aucune erreur (code de sortie 0).

## Limites
- L'affichage n'a pas été vérifié dans un navigateur.
- La route `GET /api/tracking/[token]` appartient à un autre ticket (BLAC-SUIVI-LIVRAISON-BASE) ; la page ne fait que l'appeler.
