# BLAC-CLOTURE-LIGNES-2 — Rapport (ticket BLAC-P3-044)

Statut final : PASS

Portée du PASS : contrôle sur le texte du code et tests, plus suite complète, tsc et eslint ; aucun contrôle dans un navigateur.

## Ce qui est à l'écran (fenêtre « Clôturer la session »)
- Bloc de trois lignes (data-testid="driver-close-summary"), inchangé, dans l'ordre : Monnaie en main (précision « à répartir en rendu et gardé »), Encaissé auprès des clients, Net à remettre.
- Ligne au-dessus des champs « Rendu » et « Gardé pour demain » : libellé changé de « Monnaie en main : N » en « Répartir la monnaie en main : N » (valeur cashOnHand et devise conservées). Le doublon avec le bloc de trois lignes disparaît.
- Prop collected={closeCtx.collected} toujours passée par app/admin/livreurs/page.tsx (fichier non modifié dans ce run : git diff vide).
- Calculs, montants préremplis (Rendu = monnaie en main, Gardé = 0), écriture de clôture : inchangés.

## Fichier modifié
- components/DriverCloseDialog.tsx : une seule ligne (libellé, ligne 140).
- tests/driver-close-dialog-lignes.test.mjs : 2 tests ajoutés (libellé + ordre avant Rendu / Gardé ; absence de doublon). Aucune vérification existante affaiblie.

## Tests lancés (mesures réelles)
- node --test tests/driver-close-dialog-lignes.test.mjs : 11 tests, 11 pass, 0 fail, 0 cancelled, 0 skipped.
- npm test (black-deew) : 547 tests, 547 pass, 0 fail, 0 cancelled, 0 skipped.
- npx tsc --noEmit : code de sortie 0, aucune sortie.
- npx eslint components/DriverCloseDialog.tsx : code de sortie 0, aucune sortie.
- git diff sur lib/driver-ledger.ts, lib/driver-ledger-data.ts, app/admin/livreurs/page.tsx : vide ; formules « netToRemit: given + collected - driverFees » et « cashOnHand: given - returned - kept » présentes.

## Non vérifié visuellement
- Rendu dans un navigateur (casse en majuscules via CSS, retour à la ligne du libellé plus long sur petit écran) et valeurs avec une vraie session : non vérifiés.
- test-baseline.js du Hub non lancé ; npm test lancé car imposé par le ticket.

Aucun push, aucun commit, aucun déploiement, aucun SQL exécuté.
