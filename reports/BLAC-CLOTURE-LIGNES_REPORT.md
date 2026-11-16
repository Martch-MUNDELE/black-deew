# BLAC-CLOTURE-LIGNES — Rapport (ticket BLAC-P3-043)

Statut final : PASS

## Ce qui change à l'écran
Dans la fenêtre « Clôturer la session » (écran Livreurs), un bloc de lecture à trois lignes apparaît sous le nom du livreur, dans cet ordre :
1. Monnaie en main (précision « à répartir en rendu et gardé ») : cashOnHand
2. Encaissé auprès des clients : collected
3. Net à remettre : netToRemit
Le libellé « Argent sur le livreur » devient « Monnaie en main ». Aucun calcul, aucune écriture en base, aucun montant prérempli de « Rendu » / « Gardé pour demain » n'est modifié.

## Fichiers modifiés
- components/DriverCloseDialog.tsx (prop collected, bloc de lecture, libellé renommé) : 23 insertions, 1 suppression
- app/admin/livreurs/page.tsx (collected={closeCtx.collected}) : 1 insertion
- tests/driver-close-dialog-lignes.test.mjs (créé)
- git diff sur lib/driver-ledger.ts et lib/driver-ledger-data.ts : vide (aucune modification)

## Tests lancés (mesures réelles)
- node --test tests/driver-close-dialog-lignes.test.mjs : 9 tests, 9 pass, 0 fail, 0 cancelled, 0 skipped.
- npm test : 545 tests, 545 pass, 0 fail, 0 cancelled, 0 skipped.
- npx tsc --noEmit : code de sortie 0, aucune sortie.
- npx eslint components/DriverCloseDialog.tsx app/admin/livreurs/page.tsx : code de sortie 0, aucune sortie.

## Écart déclaré
- app/admin/livreurs/page.tsx est hors des zones d'écriture standard du contrat MDH (reports, docs, tests), mais le ticket l'autorise explicitement et la modification est d'une seule ligne.

## Non vérifié visuellement
- Le rendu dans un navigateur n'a pas été contrôlé : disposition du bloc, lisibilité des couleurs, affichage sur petit écran mobile.
- Les valeurs affichées avec une vraie session de livreur (monnaie en main, encaissé, net) n'ont pas été comparées à l'écran.
- Aucune vérification sur une vraie base (interdit par le ticket).
