# BLAC-P3-064 — Ouverture de session branchée sur la route serveur

## Changement
- `app/admin/livreurs/page.tsx` : `handleOpenSession` appelle désormais `fetch('/api/admin/open-driver-session', { method: 'POST', headers: Content-Type application/json, credentials: 'same-origin', body: { driver_id, openingCash, loads } })`.
- Réponse non ok : le champ `error` du JSON est mis dans `openError` (défaut « Ouverture impossible »). Erreur réseau : « Ouverture impossible ».
- Inchangés : validation du montant, `openingRef`, `setSessionLoading`, `updateDriverStatus(sessionDriver.id, "active")`, remise à zéro, `void load()`.
- Import `openSessionWithLedger` retiré (plus utilisé dans le fichier) ; autres imports intacts.

## Test ciblé : tests/driver-open-session-wiring.test.mjs
Commande : `node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/driver-open-session-wiring.test.mjs`

Résultat exact : tests 6, suites 0, pass 6, fail 0, cancelled 0, skipped 0, todo 0.
- handleOpenSession est localisee : OK
- handleOpenSession appelle fetch('/api/admin/open-driver-session' en POST : OK
- handleOpenSession ne contient plus openSessionWithLedger( : OK
- le champ error de la reponse est repris dans le message : OK
- parseOpeningCash et parseOpeningLoads sont toujours utilises : OK
- updateDriverStatus(sessionDriver.id, "active") appele apres ouverture reussie : OK

## tsc
`npx tsc --noEmit` : exit 0, aucune erreur.
