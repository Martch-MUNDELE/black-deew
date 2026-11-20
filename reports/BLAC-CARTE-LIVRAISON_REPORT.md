# BLAC-CARTE-LIVRAISON : vraie carte de geolocalisation sur le detail de course

## Checklist
- [x] lib/driver-route-map.ts : validation des coordonnees (nombres finis, lat -90..90, lng -180..180, couple 0,0 exclu), bornes, vue (point ou bornes), URL des tuiles, attribution OpenStreetMap
- [x] components/driver/DriverRouteMap.tsx : composant client, Leaflet charge une seule fois (promesse partagee, CDN unpkg 1.9.4, comme LeafletMap.tsx), carte de 220 px aux coins arrondis, theme sombre, epingle orange (destination), point vert (livreur), cadrage automatique, bouton Recentrer 44 px, boutons de zoom, attribution OpenStreetMap, pastille distanceText en bas a gauche
- [x] Telephone : dragging desactive sur appareil mobile (un doigt fait defiler la page), touchZoom actif (deux doigts), zoom a la molette desactive
- [x] Geolocalisation refusee ou indisponible : seule la destination est affichee
- [x] Position du livreur en lecture seule (watchPosition) : aucun envoi depuis la carte (test sur le source)
- [x] Repli vers DriverRouteIllustration : coordonnees absentes ou invalides, echec de chargement de Leaflet ou delai de 8 s
- [x] components/driver/DriverDeliveryDetail.tsx : DriverRouteMap lat, lng, distanceText a la place de l'illustration
- [x] DriverRouteIllustration.tsx et LeafletMap.tsx non modifies (absents de git status), aucune nouvelle dependance npm (package.json non modifie)
- [x] tests/driver-route-map.test.mjs cree
- [x] npm test complet avant et apres
- [x] Verification de la politique de securite (voir ci-dessous)

## Tests
- Avant (npm test, avant mes ecritures) : 1 echec, tests/driver-report-problem.test.mjs:98 (« composant : libelles, confirmation, cibles tactiles >= 44 px, types de la lib », assertion minHeight 0). Le nombre total de tests avant n'a pas ete releve.
- Apres (npm test) : 815 tests, 815 passes, 0 echec, code de sortie 0.
- Ciblés : tests/driver-route-map.test.mjs et tests/driver-delivery-maquette.test.mjs : 29 passes sur 29.
- Types : npx tsc --noEmit lance, sortie filtree sur driver-route-map, DriverRouteMap, DriverDeliveryDetail : aucune ligne.

## Tests adaptes
- tests/driver-delivery-maquette.test.mjs, test « detail : composants et phrase de la maquette » : dans la liste des mots attendus dans DriverDeliveryDetail.tsx, 'DriverRouteIllustration' est remplace par 'DriverRouteMap'. Aucune autre assertion supprimee ni affaiblie.

## Politique de securite (en-tetes)
- Lecture de next.config.ts, vercel.json et proxy.ts : aucune en-tete Content-Security-Policy n'y est definie ; le proxy ne s'applique qu'a /admin et n'ajoute pas d'en-tete de securite. Rien dans le depot n'empeche donc le chargement de unpkg.com ni de tile.openstreetmap.org. Un test le verrouille.
- Limite : les en-tetes ajoutes par l'hebergement ou la plateforme (hors depot) n'ont pas pu etre mesures ici. Aucune configuration modifiee.

## Ecarts
1. Rendu sur telephone non verifie : la carte n'a pas ete affichee dans un navigateur dans ce run (ni ordinateur, ni telephone). Le chargement reel des tuiles, le theme sombre (filtre CSS sur les tuiles), le defilement a un doigt et le deplacement a deux doigts sont ecrits dans le code et verifies par lecture du source, pas par usage.
2. Test en echec avant : driver-report-problem.test.mjs:98 echouait avant mes ecritures et passe apres. Je n'ai modifie ni ce test ni DriverReportProblem.tsx (hors zones) ; ces deux fichiers, ainsi que DriverMarkDelivered, DriverNavigationLinks, DriverTrackingSender, lib/driver-delivery-view.ts et tests/driver-space-detail.test.mjs, apparaissent deja modifies dans git status (tickets precedents ou autre run). La cause du passage de l'echec au succes n'est pas etablie.
3. Les tuiles utilisent https://tile.openstreetmap.org/{z}/{x}/{y}.png (sans sous-domaine {s}, contrairement a LeafletMap.tsx), URL standard actuelle d'OpenStreetMap.
4. DriverRouteMap ouvre son propre suivi de position en lecture (watchPosition), en plus de celui de DriverTrackingSender : deux lectures navigateur en parallele sur la page. Aucune donnee envoyee par la carte.
5. Le contrat du Hub cite 00_SYSTEM/reports/hub/ comme emplacement du livrable « test » ; le test a ete place dans la zone autorisee par le ticket (tests/driver-route-map.test.mjs).
