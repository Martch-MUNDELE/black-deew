# BLAC-SIGNALEMENT-FENETRE - Rapport

## Checklist
- [x] 1. DriverReportProblem : fenetre modale montant du bas, fond rgba(0,0,0,0.7), hauteur max 85vh avec liste defilante (overflowY auto), coins hauts arrondis, role="dialog", aria-modal="true", croix Fermer 44 x 44 px, fermeture par Echap et par tap sur le fond, defilement de la page bloque (body overflow hidden, restaure a la fermeture).
- [x] 2. Chaque type est une ligne avec un rond de selection visible ; le type choisi est surligne en or (#F5C842) avec une coche SVG. Un seul type a la fois (etat kind unique). Envoyer inactif sans choix, texte d'aide "Choisis un type pour envoyer". Les 9 types, les libelles, la limite de 500 caracteres et l'appel a /api/driver/report-problem sont inchanges. Apres l'envoi, "Signalement envoyé" s'affiche puis la fenetre se ferme au bout de 1,8 s (bouton Fermer aussi disponible).
- [x] 3. DriverTrackingSender : badge "Position partagée avec le client" ; message d'erreur "Active la localisation pour que le client te suive" conserve.
- [x] 4. DriverMarkDelivered : le lien souligne devient un bouton secondaire de 44 px de hauteur avec icone SVG ; meme libelle, meme comportement (aria-expanded, ouverture de l'aide). Logique de confirmation de livraison non touchee.
- [x] 5. Nouveau test tests/driver-signalement-fenetre.test.mjs (12 cas).

## Tests (mesures dans ce run)
- node --test tests/driver-signalement-fenetre.test.mjs : 12 reussis, 0 echec.
- Suite complete `node scripts/run-tests.mjs` (apres les modifications) : 807 tests, 807 reussis, 0 echec lors du premier passage ; repassee en verification finale : 815 tests, 815 reussis, 0 echec (8 tests de plus entre les deux passages, non ajoutes par ce ticket : probablement un autre run en parallele, non verifie).
- Fichiers du ticket rejoues avec le loader du projet : 48 tests, 48 reussis, 0 echec.
- Lancer certains fichiers avec `node --test` seul echoue sur l'alias `@/lib` (driver-accept-whatsapp, driver-detail-ergonomie) : c'est le lanceur sans le loader du projet, sans lien avec ce ticket ; ils passent via scripts/run-tests.mjs.

## Tests adaptes
- Aucun test existant n'a ete modifie ni affaibli. Un premier essai avait fait echouer driver-report-problem.test.mjs (controle minHeight >= 44) a cause d'un `minHeight: 0` que j'avais mis sur la zone defilante ; je l'ai retire du composant au lieu d'adapter le test.
- Les fichiers tests/driver-report-problem.test.mjs, driver-tracking-sender.test.mjs et driver-accept-whatsapp.test.mjs (zones autorisees) n'ont pas eu besoin d'etre modifies.

## Ecarts
- Le "npm test complet avant" n'a PAS ete lance : les modifications ont commence avant. Seule la suite apres modification est mesuree (807/807).
- Rendu sur telephone non verifie : les tests lisent le code source, ils ne rendent pas le composant. L'animation, le blocage du defilement, la hauteur 85vh et la touche Echap n'ont pas ete observes dans un navigateur ou sur un appareil.
- Hauteur 85vh (pas 85dvh) : sur certains navigateurs mobiles, la barre d'adresse peut rendre la fenetre un peu plus haute que la zone visible.
- La confirmation "Signalement envoyé" s'affiche environ 1,8 s avant fermeture automatique ; cette duree est un choix de ce ticket, non specifie.
- Le chemin des livrables a verifier : test dans tests/, rapport dans reports/ (zones du ticket).
