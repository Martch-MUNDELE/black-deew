# BLAC-ITINERAIRE-ADRESSE — Rapport

Date : 2026-11-19 — Black Deew, espace livreur.

## Checklist
- [x] lib/driver-navigation.ts : buildNavigationLinks part de l'adresse ecrite (Google Maps, Waze, Plans, Android) quand elle n'est pas vide ; coordonnees en secours uniquement si l'adresse est vide ; null si les deux sont vides.
- [x] lib/driver-space.ts : buildMapsUrl applique la meme regle.
- [x] hasCoords documente dans le type NavigationLinks : true uniquement quand les liens sont construits a partir des coordonnees (secours, adresse vide) ; false des que l'adresse ecrite est utilisee, meme si des coordonnees existent.
- [x] Usages de hasCoords verifies : components/driver/DriverNavigationLinks.tsx n'utilise pas hasCoords (il lit seulement links.google/waze/apple/android et affiche rien si null) ; aucun envoi de position dans ce composant ni dans DriverDeliveryDetail.tsx (seul usage : <DriverNavigationLinks address lat lng />). Les autres occurrences de hasCoords (app/(public)/confirmation/[id]/page.tsx) sont une variable locale sans rapport.
- [x] components/driver/DriverHome.tsx : la carte TodoCard (course a livrer) garde Appeler et Itineraire et gagne le bouton principal « Voir et accepter la course » vers /admin/driver/livraison/<id> (ecran de detail ou l'acceptation existe deja). DriverAcceptDelivery n'est pas modifie, aucune logique d'acceptation dupliquee.
- [x] Bouton Appeler conserve (accueil et detail), comportement inchange.
- [x] Aucune migration SQL necessaire, aucun fichier .env lu, aucun push, aucune action sur la base de production.

## Tests
- npm test AVANT (mesure en debut de reprise, apres creation du fichier de test et avant correction de lib/) : tests 756, pass 754, fail 2. Les 2 echecs etaient ceux du nouveau fichier tests/driver-itineraire-adresse.test.mjs (adresse prioritaire), attendus tant que lib/ n'etait pas corrige.
- npm test APRES : tests 767, pass 767, fail 0 (exit 0).
- Test cible : tests/driver-itineraire-adresse.test.mjs (5 tests) lance avec le chargeur du projet (--import ./tests/helpers/register.mjs) ; un « node --test » nu echoue car l'alias @/ n'est pas resolu sans ce chargeur.
- Tests adaptes (rien supprime ni affaibli) :
  - tests/driver-navigation.test.mjs : le test « coordonnees numeriques » utilisait address 'Rue X' avec coordonnees et attendait des liens par coordonnees ; il passe maintenant address '' (cas de secours).
  - tests/driver-space-home.test.mjs : le test buildMapsUrl attendait les coordonnees avec address 'x' ; il attend maintenant l'adresse, et un cas adresse vide + coordonnees est ajoute.
  - tests/driver-home-maquette.test.mjs : aucune adaptation necessaire.

## Ecarts
- Le lanceur npm test (scripts/run-tests.mjs) ignore les arguments et rejoue toute la suite ; le test cible demande par le ticket se lance avec la commande node ci-dessus et non avec « node --test » seul.
- Le premier ajout du test de la carte a livrer avait ete ignore par une garde de mon script ; il a ete ajoute ensuite (5e test du fichier).
- Non verifie dans ce run : rendu visuel de la carte a livrer dans le navigateur.
- Ecart non explique : le total passe de 756 (avant) a 767 (apres) soit +11, alors que ce run n'ajoute qu'un seul test (le test de la carte a livrer) a un fichier deja compte. Cause non mesuree dans ce run (hypothese non verifiee : fichiers de test modifies par un autre travail du depot en parallele). Tous les tests passent apres (767/767).

## Note d'ecart apres controle (Claude, 19 novembre 2026)
Le controle a rendu FAIL sur le critere des tests non affaiblis : dans tests/driver-navigation.test.mjs, le test « le detail n affiche pas le bloc pour delivered et cancelled » avait perdu deux assertions (la constante navigable et l appel buildMapsUrl dans le detail). Cette reecriture vient du ticket BLAC-P3-068 (le composant de detail n utilise plus navigable ni buildMapsUrl ; l adaptation est listee dans BLAC-ECRAN-COURSE-MAQUETTE_REPORT.md), pas de ce ticket. Pour ne pas laisser un affaiblissement : deux assertions equivalentes ont ete ajoutees au test (accepted vaut picked_up, donc jamais delivered ni cancelled ; un seul bloc DriverNavigationLinks dans le detail). Test relance : tous passent.
