Date : 2026-10-09 — projet black-deew — commit local, aucun push.
- `app/(public)/vip/page.tsx` (avant correctif), useEffect de chargement (l.85-155) : s'execute au montage de la page, **avant** la connexion. L.91 : `fetch('/api/vip/products')` recoit 401 (`app/api/vip/products/route.ts` l.11-12 : pas de cookie de session) et `r.ok ? ... : []` transforme toute reponse non OK en liste vide. Dependances `[items, supabase]` : rien ne relance le chargement apres la connexion.
- `components/VipAccessGate.tsx` : `setGranted(true)` (l.261 connexion, l.351 changement de mot de passe, l.113 session existante) ouvre la section sans notifier la page.
- Resultat : l'ecran affiche "Aucun produit disponible pour le moment." jusqu'au rafraichissement (le cookie est alors present des le montage).
- Regression introduite par b56051f (lecture Supabase directe remplacee par la route serveur).
- `VipAccessGate` : prop optionnelle `onGranted` (appelee a chaque passage `granted=true`, couvre connexion, reconnexion, changement de mot de passe, session existante) et prop `revokeToken` (le parent l'incremente sur 401 : la porte se referme et affiche le portail de connexion).
- `page.tsx` : le chargement ne demarre que quand `grantedOk` est vrai ; compteur `reloadKey` pour "Reessayer" ; 401 -> retour au portail ; erreur (500/reseau/JSON invalide) -> message + bouton Reessayer ; liste vide reelle -> "Aucun produit disponible".
- Choix : callback `onGranted` (piste 1 du ticket) plutot que deplacer le chargement : changement minimal, la page garde sa logique (panier, suggestions classiques) intacte.
- `PopularVipCard` : reprend la meme logique (inline). Il est rendu comme enfant de la porte, donc monte seulement apres acces ; pas de bug de 401 au montage, mais il ne confondait pas non plus erreur et vide : aligne par coherence.
- Autres appels VIP au montage : `reset/page.tsx` (reset/check) est volontairement public ; `VipAccessRequestForm`, `VipPasswordResetRequestForm` n'appellent qu'a l'envoi. Aucun autre cas trouve.
Aucun nouveau fichier de logique : la distinction ok / unauthorized / error est inlinee dans `app/(public)/vip/page.tsx` (l.77-86) et dans `components/PopularVipCard.tsx`. Les tests Node ne pouvant importer ni `.tsx` ni du code React, `tests/vip-catalogue-contract.test.mjs` verifie le code source (tests de contrat) plutot que le comportement a l'execution.
- tsc --noEmit : exit 0
- eslint : 0 erreur, 1 warning preexistant (PushNotificationManager.tsx l.96)
- npm test : pass=58 fail=0 (dont 5 nouveaux : tests/vip-catalogue-contract.test.mjs)
- npm run build : exit 0 (cles VAPID jetables)
- Limite : les tests nouveaux sont des tests de contrat sur le code source (pas de jsdom ni testing-library) ; ils ne prouvent pas le comportement a l'execution. Celui-ci repose sur le test manuel ci-dessous.
1. npm run dev (port 3001), navigation privee, ouvrir /vip sans cookie.
2. Se connecter : les produits VIP s'affichent immediatement, sans rafraichir.
3. Deconnexion puis reconnexion : meme resultat.
4. Cas changement de mot de passe obligatoire : produits affiches apres validation.
5. Session expiree : supprimer le cookie VIP, declencher un rechargement du catalogue (ex. modifier le panier) : retour au portail de connexion.
6. Erreur : couper le reseau puis cliquer sur Reessayer : message d'erreur distinct de "Aucun produit".
Statut manuel : NON VALIDE tant que non fait par l'utilisateur.
