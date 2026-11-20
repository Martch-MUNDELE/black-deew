# BLAC-DETAIL-ERGONOMIE : rapport

Ticket : écran de détail de course livreur, ergonomie sur téléphone (Black Deew).

## Checklist
- [x] 1. Barre d'action fixe en bas (`ActionBar` dans `DriverDeliveryDetail.tsx` : `position: fixed`, `maxWidth: 480`, `env(safe-area-inset-bottom)`, fond opaque `#0B0906`, bordure haute). Course non acceptée = `DriverAcceptDelivery` ; acceptée = `DriverMarkDelivered` ; aucune barre pour livrée ou annulée (`actionBarKind` dans `lib/driver-delivery-view.ts`). Composants d'action non modifiés. Espace bas du contenu : 140 px + zone de sécurité quand la barre existe.
- [x] 2. Un seul Appeler (`CallLink`) sur la carte client, numéro visible à côté, même lien `tel:` (`buildTelUrl`). Retiré du bas de page. Rien d'affiché si le numéro est absent.
- [x] 3. Un seul bouton `Lancer l'itinéraire` ouvrant l'application adaptée (`detectNavigationTarget` : iPhone/iPad = Plans Apple, Android = lien Android, autre = Google Maps). Lien secondaire `Autre application` (`<details>`) avec Google Maps, Waze, Plans Apple, Android. Liens toujours construits par `buildNavigationLinks` (non modifiée). Bloc affiché uniquement pour une course acceptée, comme avant.
- [x] 4. Libellés purs `collectLabel` et `deliverLabel` : livrée = Encaissé / Livré, annulée = Montant / Articles (neutres), sinon À encaisser / À livrer.
- [x] 5. Lisibilité : étiquettes de 11 px à 12 px (`LABEL_FONT_SIZE`), couleur `#BFAF8F` sur le fond de carte `#15110B` : ratio mesuré par le test = **8,72:1** (minimum demandé 4,5:1). La couleur n'a pas changé : elle respectait déjà le seuil, seule la taille était insuffisante.

## Tests
- Nouveau : `tests/driver-detail-ergonomie.test.mjs` (barre fixe par état, un seul Appeler, un seul Lancer l'itinéraire, détection d'appareil, libellés ENCAISSE / LIVRE, contraste).
- Suite complète via `node scripts/run-tests.mjs` (le script `npm test` du projet), après modifications : 789 tests, 789 réussis, 0 échec.

## Tests existants adaptés
- `tests/driver-space-detail.test.mjs` : l'assertion `À encaisser` dans le source du composant vérifie maintenant l'appel à `collectLabel(delivery.status)` et la présence du libellé dans `lib/driver-delivery-view.ts`.
- `tests/driver-report-problem.test.mjs` : la ligne `<CallButton href={telHref} />` est remplacée par `<CallLink href={telHref} phone={delivery.customerPhone} />` + absence de `CallButton`. Les assertions d'ordre Accepter / Signaler / Marquer livrée / Signaler sont conservées telles quelles (le source place chaque `ActionBar` à cet endroit ; la barre est fixe donc l'ordre n'a pas d'effet visuel).

## Écarts
- **Fichier hors zones** : `tests/driver-report-problem.test.mjs` n'est pas dans les zones d'écriture déclarées, mais il casse à cause du ticket (consigne du ticket : adapter les tests qui cassent). Modification limitée à 3 lignes, à valider.
- **Baseline « avant » non mesurée** : le premier essai (`node --test` direct) échoue à cause de l'alias `@/` (sans le lanceur du projet), ce n'est pas un résultat de référence. Seul l'état « après » est mesuré (789/789).
- **Rendu sur téléphone non vérifié** : aucun essai sur appareil ni navigateur ; la barre fixe, la confirmation en deux temps ouverte dans la barre (hauteur limitée à 80 vh avec défilement) et le dégagement bas de 140 px sont validés par lecture du code et tests texte uniquement.
- **Détection d'appareil côté client** : après chargement, le bouton principal passe de Google Maps (premier rendu) à Plans Apple ou Android. Un iPad en mode « site de bureau » est reconnu via Macintosh + écran tactile.
- **Autre application** contient les quatre liens, y compris celui déjà utilisé par le bouton principal.
- **Appeler** s'affiche désormais aussi pour une course non acceptée (avant : seulement acceptée) ; masqué pour livrée ou annulée.
- **Contraste hors zones non traité** : les étiquettes des composants `DriverAcceptDelivery`, `DriverMarkDelivered`, `DriverReportProblem` (hors zones) n'ont pas été mesurées ni modifiées.
- `tsc` filtré sur les trois fichiers modifiés : aucune erreur signalée.
