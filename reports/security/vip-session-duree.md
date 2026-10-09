Date : 2026-10-09 — projet black-deew — commit local, aucun push.
Session VIP raccourcie pour limiter l'exposition d'un telephone pret ou perdu :
- cookie de session du navigateur (aucun Max-Age ni Expires), supprime a la fermeture complete du navigateur ;
- expiration cote serveur a 12 h, controlee dans la verification de la valeur signee.
Une deconnexion a la sortie de page est impossible : /api/commandes verifie le cookie VIP apres le passage par /panier.
- La valeur signee portait deja une expiration `e` (signee HMAC-SHA256), mais pas d'horodatage d'emission. Duree : 30 jours (`VIP_SESSION_MAX_AGE_S`), utilisee pour la valeur ET pour le Max-Age du cookie.
- `lib/vip-session.ts` :
  - `VIP_SESSION_MAX_AGE_S = 12 * 60 * 60`, constante unique (valeur signee).
  - `createVipSessionValue` ajoute l'horodatage d'emission `i` (signe) en plus de `e`.
  - `verifyVipSessionValue` refuse toute valeur emise depuis 12 h ou plus. Retrocompatibilite : sans `i` (ancienne valeur, emise pour 30 jours), l'emission est deduite de `e - 30 jours`, donc les anciennes valeurs sont aussi refusees au-dela de 12 h.
  - `setVipSessionCookie` : `maxAge` retire (cookie de session). `clearVipSessionCookie` : `maxAge: 0` conserve.
- `tests/vip-session-duree.test.mjs` (nouveau) : 11 tests (constante 12 h, valeur valide, 11 h acceptee, 13 h refusee, 12 h pile refusee, ancienne valeur sans horodatage a 11 h / 13 h / 10 jours, horodatage falsifie refuse, absence de Max-Age et Expires sur le cookie de login, Max-Age=0 conserve au logout).
- `app/api/vip/login/route.ts` et `logout/route.ts` : aucune modification necessaire (ils passent par les helpers). `change-password` et `reset/consume` utilisent aussi `setVipSessionCookie` et heritent du comportement.
- tsc --noEmit : exit 0
- eslint : exit 0
- npm test : pass=69 fail=0 (58 avant, +11 nouveaux)
- npm run build : exit 0 (cles VAPID jetables generees pour l'occasion)
- Les cookies deja poses dans les navigateurs conservent leur ancien Max-Age de 30 jours cote navigateur, mais le serveur les refuse au-dela de 12 h.
- Les tests verifient les helpers et les routes login/logout ; les routes session, produits, commandes et change-password n'ont pas de nouveau test dedie (couvertes par les tests existants, au vert).
1. npm run dev (port 3001), navigation privee, ouvrir /vip, se connecter.
2. Verifier dans les outils du navigateur (Application > Cookies) : `vip_session` a Expires/Max-Age = "Session".
3. Naviguer /vip puis /panier puis retour : les produits restent accessibles.
4. Fermer completement le navigateur, rouvrir /vip : reconnexion demandee.
5. Optionnel : passer une commande depuis /panier apres connexion : acceptee.
Statut manuel : NON VALIDE tant que non fait par l'utilisateur.
