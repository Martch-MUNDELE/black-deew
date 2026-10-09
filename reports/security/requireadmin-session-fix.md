Statut : BLOCKED (cause du 401 sur le poste de l'utilisateur non prouvee).
- Login admin : app/admin/login/page.tsx, client navigateur @supabase/ssr (lib/supabase/client.ts, createBrowserClient), signInWithPassword. La session est donc censee etre stockee dans des cookies.
- requireAdmin (lib/admin-auth.ts) lit la session via lib/supabase/server.ts (createServerClient @supabase/ssr, cookies). Les deux cotes sont compatibles : aucune divergence de methode trouvee, donc adapter requireAdmin n'est pas justifie.
- Aucun proxy.ts ni middleware.ts dans black-deew (git log vide). Les projets exalab, tiana-foods et tianacare-web en ont un. Les pages /admin sont rendues cote client et repondent 200 sans session (GET /admin/settings?tab=vip : 200), elles semblent donc fonctionner sans session dans les cookies.
- Test curl sans cookie : POST /api/admin/vip-approve => 401, log serveur "[requireAdmin] 401 : Auth session missing!". Le comportement sans session est correct.
- Non observe : cookies sb-...-auth-token du navigateur apres connexion, et log serveur au clic reel sur "Valider".
- lib/admin-auth.ts : journalisation serveur de la raison du refus 401 (message Supabase uniquement, aucune valeur de cookie ni de jeton). Aucun changement de logique d'autorisation.
- Tests ajoutes : tests/admin-auth.test.mjs (7 cas : sans session 401, non admin 403, admin bloque 403, admin actif ok, vip-approve 401 / 403 / 200), tests/helpers/fake-supabase-server.mjs, alias dans tests/helpers/loader.mjs.
Ajouter proxy.ts (racine) + lib/supabase/proxy.ts, sur le modele de tiana-foods, pour rafraichir la session dans les cookies et rediriger /admin vers /admin/login sans session. Prototype teste : GET /admin sans cookie => 307 vers /admin/login, /admin/login => 200. Retire car hors zone d'ecriture ; a valider par l'utilisateur.
- npm test : 53 tests, 53 pass, 0 fail.
- tsc --noEmit : 0 erreur.
- eslint : 0 erreur, 1 warning existant (PushNotificationManager.tsx, react-hooks/exhaustive-deps).
- build : OK (exit 0) avec une paire de cles VAPID jetable generee pour l'occasion. Un premier essai avec une fausse cle de format invalide avait echoue (erreur web-push validatePublicKey), cause liee a la cle de test et non au code.
1. npm run dev, ouvrir http://localhost:3001/admin/login et se connecter.
2. Outils de developpement > Application > Cookies > localhost : verifier la presence de cookies sb-...-auth-token.
3. Parametres > Acces VIP, cliquer "Valider" ; lire dans le terminal la ligne "[requireAdmin] 401 : ..." si echec.
4. Si aucun cookie sb-... : se deconnecter, vider les cookies du site, se reconnecter.
5. Sans connexion : curl -X POST -H 'Content-Type: application/json' -d '{"requestId":"x"}' http://localhost:3001/api/admin/vip-approve => 401.
