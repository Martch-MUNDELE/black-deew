# BLAC-P3-059 - Ouverture de session livreur cote serveur

## Probleme
Admin > Livreurs > Ouvrir une session lisait les produits VIP depuis le navigateur. Avec une connexion qui n'est pas celle d'un admin actif, la lecture etait filtree et l'ouverture echouait avec « Produit introuvable ».

## Changements livres (zones d'ecriture autorisees)
- `lib/driver-open-session-api.ts` (nouveau) : fonction pure `parseOpenSessionBody(body)` qui renvoie `{ok:true, value}` ou `{ok:false, error}`.
  - `driver_id` : uuid obligatoire.
  - `openingCash` : nombre >= 0 ; vide ou absent = 0.
  - `loads` : `{product_id (uuid), quantity (entier > 0)}` ; quantite vide ou 0 ignoree ; decimale ou negative = erreur.
- `app/api/admin/open-driver-session/route.ts` (nouveau) : POST.
  - 401 sans session ; 403 si `info.role !== 'admin'` ; 400 si corps invalide.
  - Sinon `openSessionWithLedger` avec un client service role, reponse `{ok:true, session_id}`.
  - Erreur du journal : `{error: message}` avec 409 pour « session deja ouverte », 500 sinon.
  - Toutes les reponses portent `Cache-Control: no-store`.
- `tests/driver-open-session-api.test.mjs` (nouveau).
- Non modifies : `app/api/driver/mark-delivered/route.ts`, `lib/driver-ledger-data.ts`, `lib/admin-role-server.ts`.

## Etape 3 (page livreurs) : NON appliquee
Le contrat d'execution actif n'autorise pas l'ecriture dans `app/admin/livreurs/page.tsx` (hors zones d'ecriture autorisees), bien que l'etape 3 du ticket la demande. La modification a ete annulee : la page est identique a HEAD.
Le correctif est conserve dans `reports/BLAC-P3-059_page-livreurs.patch` (remplace l'appel direct a `openSessionWithLedger` par un `fetch POST /api/admin/open-driver-session` avec affichage de l'erreur renvoyee). Pour l'appliquer : `git apply reports/BLAC-P3-059_page-livreurs.patch`.
Tant que ce correctif n'est pas applique, la page appelle toujours le client navigateur : la route est creee mais pas encore utilisee par l'interface.

## Resultats du fichier de test cible
Commande : `node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/driver-open-session-api.test.mjs`

- tests 9, suites 0, pass 9, fail 0, cancelled 0, skipped 0, todo 0
- corps valide => ok ; driver_id non uuid => erreur ; corps non objet => erreur
- openingCash vide ou absent => 0 ; openingCash negatif ou non numerique => erreur
- quantite 0 ou vide ignoree ; quantite decimale ou negative => erreur
- product_id non uuid avec quantite > 0 => erreur
- route : 401 sans session, 403 non admin, no-store (lecture du code de la route)

## Typage
`npx tsc --noEmit` : code de sortie 0, aucune erreur.

## Hors perimetre
Aucun push distant, aucune operation Supabase, aucun deploiement.
