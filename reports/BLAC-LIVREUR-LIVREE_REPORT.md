# BLAC-P3-051 — Rapport (depot)

Statut final : PASS


Depot : black-deew. Aucune migration, aucune ecriture en base, aucun .env lu ni modifie, aucun commit, aucun push, aucun deploiement.

## Fichiers modifies ou crees
- lib/mark-delivered.ts (nouveau) : `markOrderDelivered(supabase, orderId, total)` renvoie `{ ok:true, driverSessionUpdated }` ou `{ ok:false, status, error }`. Contient les etapes 1 a 4 de l'ancienne route admin, dans le meme ordre, avec les memes ecritures, les memes best-effort (historique, recalcul facturation, journal de stock VIP) et les memes messages « orders: ... », « order_deliveries: ... », « driver_sessions: ... ». Aucune suppression de commande.
- app/api/mark-livree/route.ts : garde `requireAdmin`, la validation (400 `invalid params`) et la branche numero de test (suppression, `testOrderDeleted: true`) ; puis appelle `markOrderDelivered`. Reponses JSON inchangees : `{ ok:true, driverSessionUpdated }` ou `{ error, status }`.
- app/api/driver/mark-delivered/route.ts (nouveau) : POST `{ delivery_id }`. 401 sans session, 403 si non livreur (`getAdminRole`), 400 si `delivery_id` n'est pas un UUID (avant toute requete), lecture de `order_deliveries` avec la cle service_role en imposant `driver_id` = livreur de la session (inconnue ou d'un autre livreur : 404), deja livree : 200 `{ ok:true, already:true }` sans ecriture, annulee : 409. Le montant n'est jamais lu dans la requete : `orders.total` est relu cote serveur. Un numero de test est traite comme une commande normale (aucune suppression). Reponse sans donnee client.
- components/driver/DriverMarkDelivered.tsx (nouveau, composant client) : bouton « Marquer comme livrée » (52 px, vert, texte sombre) ; premier toucher = confirmation dans la page (« Confirmer la livraison ? », « Montant encaissé : ... », « Annuler », « Oui, livrée ») ; boutons desactives pendant l'envoi ; message d'erreur et nouvel essai possible ; `router.refresh()` en cas de succes. Ni `confirm(` ni `alert(`.
- components/driver/DriverDeliveryDetail.tsx : le bouton est integre au-dessus de Appeler / Itineraire dans la barre fixe, seulement si la livraison n'est pas livree ; marge safe-area conservee ; padding bas de la page augmente (260 px + safe-area) tant que le bouton est affiche.
- tests/driver-stock-alert.test.mjs : seul changement, `lib/mark-delivered.ts` ajoute a la liste des fichiers lus par le test « aucun code du ticket n écrit dans la table products ». Aucune assertion modifiee, affaiblie ou supprimee.
- tests/driver-mark-delivered.test.mjs (nouveau) : 9 tests par lecture du texte (dont l'ordre des ecritures et les messages d'erreur de markOrderDelivered).
- tests/driver-day-simulation.test.mjs : NON modifie (voir ecarts).

## Preuve que le comportement admin est inchange
- Les tests de tests/driver-stock-alert.test.mjs executent la vraie route `POST /api/mark-livree` contre un faux Supabase en memoire, qui appelle maintenant `markOrderDelivered`. Ils passent tous sans changement d'assertion : journal de stock VIP (mouvement `delivered`, idempotence), echec du journal sans blocage de la livraison, recalcul de la session, refus sans administrateur (rien d'ecrit), commande de test toujours supprimee sans mouvement ni calcul.
- Resultat mesure (stock-alert + day-simulation ensemble) : 29 tests, 29 pass, 0 fail.
- Le test de lecture du texte « products jamais ecrit » scanne desormais la route ET lib/mark-delivered.ts, avec les memes expressions regulieres.
- tests tests/driver-mark-delivered.test.mjs verifie que la route admin garde `requireAdmin`, `isTestPhone`, `testOrderDeleted: true` et appelle `markOrderDelivered(supabase, orderId, total)` apres la garde.

## Tests lances (resultats mesures)
- node --test tests/driver-mark-delivered.test.mjs : 9 tests, 9 pass, 0 fail, 0 cancelled, 0 skipped.
- node --test tests/driver-stock-alert.test.mjs tests/driver-day-simulation.test.mjs : 29 tests, 29 pass, 0 fail.
- npm test (black-deew) : 616 tests, 616 pass, 0 fail, 0 cancelled, 0 skipped, code de sortie 0.
- npx tsc --noEmit : code de sortie 0.
- npx eslint sur les cinq fichiers de code (lib/mark-delivered.ts, app/api/mark-livree/route.ts, app/api/driver/mark-delivered/route.ts, components/driver/DriverMarkDelivered.tsx, components/driver/DriverDeliveryDetail.tsx) : code de sortie 0.

## Ecarts et points a signaler
- tests/driver-day-simulation.test.mjs ne lit pas le texte de app/api/mark-livree/route.ts : la seule mention de `mark-livree` est une phrase de rapport (l.441) et sa lecture de fichier (l.471) concerne un autre fichier. Il n'y avait donc aucun chemin a adapter ; le fichier est laisse intact.
- `markOrderDelivered` relit `orders.status` (pour `from_status` de l'historique), car sa signature n'a que trois parametres ; la route admin lit deja ce statut pour la branche numero de test. C'est une lecture supplementaire, sans ecriture ajoutee ni changement d'ordre des ecritures.
- L'echec connu de tests/BLAC-P3-038.test.mjs (fichier non suivi, hors ticket) n'est pas apparu lors du run complet : 0 fail. Le fichier est present et non suivi ; il n'a pas ete modifie.
- Fichiers non suivis hors ticket (non touches) : tests/BLAC-P3-038.test.mjs, tests/campaign-variables.test.mjs, plusieurs reports/BD-*.

## Non verifie
- Aucun controle dans un navigateur ni sur telephone : rendu du bouton, de la confirmation, de la barre fixe et de la marge basse, double toucher, `router.refresh()`.
- Aucun controle contre la vraie base : la route livreur n'a pas ete appelee pour de vrai (401/403/404/409/200 verifies par lecture du texte, pas par requete reelle) ; `orders.total` et les colonnes lues n'ont pas ete confrontees a la base.
- Comportement de la route admin non rejoue sur la vraie base (seulement le faux Supabase en memoire).
