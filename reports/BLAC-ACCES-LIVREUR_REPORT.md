# BLAC-ACCES-LIVREUR — Rapport (BLAC-P3-052)

Statut final : PASS

Portee du PASS : code et test controles par lecture du texte et en logique pure, plus tsc et eslint. Aucun controle navigateur ni base reelle.

## Cause
Le livreur de test (Martch) est lie a un compte (user_id renseigne) mais son delivery_drivers.status vaut 'inactive'. getAdminRole() filtrait avec .eq('status','active') : livreur non reconnu, role 'none', redirection du layout vers /admin/login?error=acces, sans aucun message. Le statut 'inactive' vient de lib/driver-ledger-data.ts finalizeSessionClose (fin de session) : il signifie « sans session ouverte » et ne doit pas bloquer la connexion. Seul 'suspended' doit bloquer.

## Fichiers modifies
- lib/admin-role.ts : ajout de la fonction pure isDriverStatusAllowed(status) (vrai pour 'active' et 'inactive' ; faux pour 'suspended', null, undefined, chaine vide, toute autre valeur), avec commentaire sur le sens de 'inactive'.
- lib/admin-role-server.ts : lecture du livreur lie au compte sans filtre sur 'active' (select id, full_name, status), puis retenue comme livreur seulement si isDriverStatusAllowed(status) ; un livreur 'suspended' reste role 'none'. Filtre status='active' conserve pour la table admins. Messages de journal inchanges.
- app/admin/login/page.tsx : si l'adresse contient error=acces (lu dans window.location.search dans le useEffect, sans useSearchParams), le bloc d'erreur existant affiche « Ce compte n'a pas acces a l'administration ni a l'espace livreur. Contacte l'administrateur. ».
- components/admin/AdminNav.tsx : lien { href: "/admin/driver", label: "Espace livreur", icon: "truck" } ajoute dans le groupe CONFIGURATION, juste apres Livreurs (icone truck deja utilisee par Livraison). AdminNavClient.tsx : non modifie (il ne porte pas la liste des liens).
- tests/driver-access.test.mjs : 7 tests (isDriverStatusAllowed, texte de getAdminRole, decideRoleRedirect inchange, message de la page de connexion, liens du menu, coherence du code de isDriverStatusAllowed lue directement dans lib/admin-role.ts et lib/admin-role-server.ts).
- Non modifies : app/admin/layout.tsx, lib/driver-ledger-data.ts, delivery_drivers, .env. Aucune migration, aucune ecriture en base.

## Comportement avant / apres
- Livreur 'active' : avant livreur reconnu ; apres livreur reconnu.
- Livreur 'inactive' (session fermee ou pas encore ouverte) : avant role 'none' et redirection vers /admin/login?error=acces ; apres role 'driver', acces a /admin/driver.
- Livreur 'suspended' ou statut inconnu : avant role 'none' ; apres role 'none' (inchange).
- decideRoleRedirect inchange : driver sur /admin/driver => aucune redirection ; driver ailleurs => /admin/driver ; none => /admin/login?error=acces.
- Page /admin/login?error=acces : avant aucun message ; apres message explicite dans le bloc d'erreur.
- Menu admin : avant aucun acces direct a l'espace livreur ; apres lien « Espace livreur ».

## Verification de la page noire (lecture du code de la page de connexion)
Le composant rend toujours la carte (logo, titre, formulaire, bouton) sur le fond #080603 ; tant que le logo se charge (siteLogo null), seul un bloc vide de 64 px remplace le logo, sans masquer le reste. Aucun cas de rendu entierement noir trouve a la lecture, donc aucune correction supplementaire n'a ete faite. L'ecran noir observe n'a pas ete reproduit : cette lecture ne le prouve pas.

## Tests lances
- node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/driver-access.test.mjs : 7 tests, 7 pass, 0 fail, 0 cancelled, 0 skipped.
- npx tsc --noEmit : code de sortie 0.
- npx eslint (lib/admin-role.ts, lib/admin-role-server.ts, app/admin/login/page.tsx, components/admin/AdminNav.tsx, components/admin/AdminNavClient.tsx) : code de sortie 0, 0 erreur, 1 avertissement preexistant (_permission inutilise, AdminNav.tsx ligne 112).

## Non verifie
- Aucun controle dans un navigateur (ni page noire, ni message d'erreur affiche, ni menu rendu).
- Aucun controle contre la vraie base : la connexion reelle du livreur Martch (status 'inactive') n'a pas ete rejouee.
- Aucun commit, aucun push, aucun deploiement, aucune ecriture en base.
