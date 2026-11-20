# BLAC-ACCUEIL-LIVREUR-MAQUETTE — Rapport

Black Deew, espace livreur : accueil (components/driver/DriverHome.tsx) refait selon les maquettes validees (1 - Espace livreur Black Deew.pdf, 3 · En attente de course.pdf). Routes et logique d'argent inchangees.

## Fichiers modifies ou crees
- lib/driver-space.ts : onlineBadge, stockBarRatio, activeDelivery, deliveryStepIndex (fonctions pures).
- lib/driver-space-server.ts : getDriverHome lit maintenant les statuts assigned, pending, picked_up, delivered (bug corrige : une course acceptee ne disparait plus de l'accueil).
- lib/site-logo-server.ts : getSiteLogoUrl() lit settings key = site_logo (service_role), renvoie l'URL ou null, sans exception.
- app/admin/driver/page.tsx : appelle getSiteLogoUrl et passe logoUrl a DriverHome.
- components/driver/DriverHome.tsx : nouvelle mise en forme.
- tests/driver-home-maquette.test.mjs : 13 cas.
- DriverNavigationLinks.tsx et DriverMarkDelivered.tsx : reutilises sans modification.

## Resultats des tests cibles (mesures reelles, fichier par fichier)
- tests/driver-home-maquette.test.mjs : 13 tests, 13 pass, 0 fail, 0 cancelled, 0 skipped (code de sortie 0).
- tests/driver-delivery-feed.test.mjs : 5 tests, 5 pass, 0 fail, 0 cancelled, 0 skipped (code de sortie 0).
- tests/driver-space-detail.test.mjs : 7 tests, 7 pass, 0 fail, 0 cancelled, 0 skipped (code de sortie 0).
- tests/driver-access.test.mjs : 7 tests, 7 pass, 0 fail, 0 cancelled, 0 skipped (code de sortie 0).

Commande : node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test <fichier>
Les trois tests existants (driver-delivery-feed, driver-space-detail, driver-access) n'ont pas eu besoin d'etre adaptes.
npx tsc --noEmit : code de sortie 0.

## Ce qui correspond aux maquettes
- En-tete : logo du site rond 44 px (initiale si pas de logo), ESPACE LIVREUR, nom en Playfair Display, pastille En ligne / Hors session a droite.
- Sans course acceptee : carte NET A REMETTRE AUJOURD'HUI (fonds + encaisse - frais), tuiles Livraisons (X sur Y) et Session (depuis HH:MM).
- Avec course acceptee : tuiles Encaisse, Livraisons, A remettre ; carte de course avec etapes Acceptee / En route / Livree, client, adresse, creneau en or, A ENCAISSER en Playfair or, DriverNavigationLinks, bouton Appeler, DriverMarkDelivered.
- Stock VIP : une barre par produit (vert, orange si stock bas), quantite en gras, pastille Epuise.
- Aucune course : carte a coche verte, titre Aucune course en attente et texte prevu.
- Conserves : TodoCard, Deja livrees, polling toutes les 20 s, cas sans session, Ma derniere session, messages d'erreur.
- Bouton Se deconnecter (signOutAction) en bas de page, 44 px. Couleurs, polices, SVG sans emoji conformes au ticket.

## Ce qui differe ou n'est pas fait
- Barre du bas : non realisee (hors ticket).
- Trajet dessine : non realise (hors ticket).
- Le rendu visuel n'est pas verifie sur telephone : controles par tests de logique pure, lecture du texte et tsc uniquement.
- Aucun commit, aucun push, aucun SQL, aucun .env lu ou modifie.
