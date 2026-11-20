# BLAC-ESLINT-ZERO - Rapport

Statut : TERMINE sous reserve du fichier exclu par le ticket (DriverTrackingSender.tsx, ticket BLAC-P3-077).

## Checklist
- [x] Baseline eslint relevee (ticket : 23 erreurs, 4 warnings) et eslint remesure apres
- [x] tsc --noEmit --incremental false propre avant (exit 0) et apres (exit 0)
- [x] Suite complete mesuree avant et apres : aucun test ne change d'etat
- [x] no-unescaped-entities corrige (CampaignsPanel 9, ClientOffersPanel 1, ScenariosPanel 4, suivi 1)
- [x] prefer-const corrige (tracking/route.ts)
- [x] no-html-link-for-pages corrige (offre/page.tsx, composant Link)
- [x] set-state-in-effect corrige dans les 5 fichiers concernes, sans commentaire de desactivation
- [x] 4 warnings corriges (AdminNav, PushNotificationManager, driver-delivery-feed, test client-offers)
- [x] DriverTrackingSender.tsx non touche
- [x] eslint.config.mjs non modifie, aucune regle baissee, aucun eslint-disable ajoute

## Mesures

| Mesure | Avant | Apres |
|---|---|---|
| eslint (projet entier) | 23 erreurs, 4 warnings (valeurs du ticket, mesure du 20 novembre 2026) | 1 erreur, 0 warning |
| erreur restante | - | components/driver/DriverTrackingSender.tsx 19:7 react-hooks/set-state-in-effect (fichier exclu par le ticket) |
| tsc --noEmit --incremental false | exit 0 (mesure au debut) | exit 0 |
| node --test --import ./tests/helpers/register.mjs | 846 tests, 846 reussis, 0 echec, 0 ignore | 846 tests, 846 reussis, 0 echec, 0 ignore |

Comparaison test par test (nom et etat, tries) entre avant et apres : aucun changement d'etat.

Precisions de methode :
- Le decompte eslint "avant" est celui du ticket. Ma premiere mesure detaillee (format json) a ete faite apres les corrections d'apostrophes : 8 erreurs et 3 warnings.
- La baseline des tests "avant" a ete mesuree en fin de travail sur l'etat HEAD, en remisant temporairement (git stash) uniquement les 15 fichiers de ce ticket, puis en les restaurant immediatement (stash vide ensuite). Elle n'a donc pas ete prise au tout debut.
- Les sorties TAP brutes sont dans /tmp (hors depot) : /tmp/mdh-tests-before.tap et /tmp/mdh-tests-after.tap.

## Fichier par fichier

| Fichier | Avant | Apres | Ce qui a ete fait |
|---|---|---|---|
| app/(public)/panier/page.tsx | 1 erreur set-state-in-effect (l.262) | 0 | Le reset du apercu promo quand le panier est vide se fait pendant le rendu (setState conditionnel sur la valeur) ; l'effet ne fait plus que return si le panier est vide. Meme valeur affichee. |
| app/admin/marketing/page.tsx | 1 erreur set-state-in-effect (l.31) | 0 | Onglet lu dans le hash via useSyncExternalStore (defaut 'campagnes' cote serveur) ; etat "chosen" pour le choix local (clic, clavier, repli si le hash n'est pas modifiable), remis a zero sur hashchange. |
| app/api/driver/tracking/route.ts | 1 erreur prefer-const (l.72) | 0 | La destructuration est separee : readErr en const, tracking reste let (il est reassigne). |
| app/offre/page.tsx | 1 erreur no-html-link-for-pages (l.142) | 0 | a href="/" remplace par Link de next/link, meme destination et meme style. |
| app/suivi/[token]/page.tsx | 2 erreurs (set-state-in-effect l.18, no-unescaped-entities l.77) | 0 | invalid devient une valeur derivee (!token || notFound) ; plus de setState synchrone dans l'effet. Le texte "Ce lien de suivi n'est plus valide" est une expression de chaine (rendu identique, texte source inchange pour le test). |
| components/admin/CampaignsPanel.tsx | 9 erreurs no-unescaped-entities | 0 | Apostrophes de texte JSX remplacees par &apos; (lignes 293, 302, 314, 329, 430, 488). |
| components/admin/ClientOffersPanel.tsx | 1 erreur no-unescaped-entities | 0 | &apos; (l.219). |
| components/admin/DriverDeliveryIndicator.tsx | 1 erreur set-state-in-effect (l.31) | 0 | La lecture est separee (fetchFeed retourne la liste ou null) ; le setFeed se fait dans le .then. Meme periodicite (30 s), meme comportement en cas d'erreur (liste inchangee). |
| components/admin/ScenariosPanel.tsx | 4 erreurs no-unescaped-entities | 0 | &apos; (lignes 168 et 248). |
| components/driver/DriverNavigationLinks.tsx | 1 erreur set-state-in-effect (l.67) | 0 | useSyncExternalStore : 'google' cote serveur, detection de l'appareil cote client. useEffect et useState retires de l'import (plus utilises). |
| components/admin/AdminNav.tsx | 1 warning variable inutilisee (l.112) | 0 | Copie de l'objet puis suppression de la cle permission, sans variable inutilisee. |
| components/pwa/PushNotificationManager.tsx | 1 warning exhaustive-deps (l.99) | 0 | isLocalMdh ajoute aux dependances (booleen constant pour une page donnee). |
| lib/driver-delivery-feed.ts | 1 warning variable inutilisee (l.55) | 0 | Retour construit champ par champ, memes cles dans le meme ordre. |
| tests/client-offers-migration.test.mjs | 1 warning variable inutilisee (l.10) | 0 | Ligne const bodyLower supprimee (aucune utilisation). |

## Tests adaptes (lisant le texte d'un fichier modifie)
- tests/admin-marketing-layout.test.mjs, test "onglet Campagnes par defaut, hash garde, un seul panneau visible" : l'assertion sur le texte useState<TabId>('campagnes') est remplacee par deux assertions sur useSyncExternalStore(subscribeHash, getHashTab, getServerHashTab) et return 'campagnes'. Justification : la page marketing ne peut plus initialiser l'onglet par un setState dans un effet sans changer le comportement (hash lu au premier affichage). Les autres assertions du test sont inchangees.
- tests/tracking-view.test.mjs : non modifie (le texte du message est conserve dans la source grace a l'expression de chaine).

## Fichiers volontairement laisses
- components/driver/DriverTrackingSender.tsx (1 erreur set-state-in-effect, l.19) : exclu par le ticket car modifie par BLAC-P3-077. Non touche par ce ticket.
- Aucun autre fichier laisse : toutes les corrections set-state-in-effect ont pu etre faites en gardant le meme comportement visible.

## Ecarts
- tests/admin-marketing-layout.test.mjs a ete modifie alors qu'il n'est pas dans la liste des zones d'ecriture : le ticket autorise d'adapter un test qui lit le texte d'un fichier modifie, a condition de le lister ici (c'est fait).
- Nombre d'erreurs : le titre du ticket parle de 22 erreurs hors DriverTrackingSender, le corps de 23 au total avec ce fichier : c'est coherent (22 + 1).
- Baseline des tests prise en fin de travail sur HEAD (voir Mesures), pas au debut.
- Les corrections de comportement n'ont pas ete verifiees dans un navigateur : la verification repose sur eslint, tsc et les 846 tests (qui lisent le texte des sources).
