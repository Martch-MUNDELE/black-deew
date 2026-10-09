- `app/admin/layout.tsx` rendait toujours `<AdminNav />`, y compris sur `/admin/login` : menu visible hors connexion.
- Aucun `proxy.ts` / `middleware.ts` : les pages `/admin/*` repondaient 200 sans session (constat BLAC-P1-015). Non-regression : fichiers inchanges depuis 2026-06-27.
- `lib/supabase/proxy.ts` : logique pure (`isAdminProtectedPath`, `isAdminLoginPath`, `hasSupabaseSessionCookie`, `decideAdminAccess`).
- `proxy.ts` (racine, convention Next 16 `proxy`), adapte de tiana-foods / tianacare-web : sans cookie `sb-*-auth-token` => redirection `/admin/login` sans appel reseau ; avec cookie => `supabase.auth.getUser()` avec rafraichissement des cookies (@supabase/ssr), redirection si pas d'utilisateur. Matcher limite a `/admin` et `/admin/:path*` : site public, `/vip`, `/api/*` et statiques ne passent pas par le proxy.
- Difference volontaire avec tiana-foods : un utilisateur deja connecte qui ouvre `/admin/login` n'est PAS redirige (evite toute boucle avec la garde par role existante, laissee intacte).
- `app/admin/layout.tsx` : le proxy transmet `x-pathname` ; sur `/admin/login` le layout rend seulement les enfants (ni AdminNav ni PushNotificationManager). Ailleurs, rendu identique a avant.
- Garde par role / admin non actif : aucun fichier concerne modifie.
| Controle | Resultat |
|---|---|
| npm test | PASS —  |
| tsc --noEmit | PASS |
| eslint (fichiers modifies) | PASS |
| npm run build (VAPID jetables) | PASS |
| Smoke `next start` : /admin/commandes sans cookie | 307 -> http://localhost:3999/admin/login |
| Smoke : /admin/login | 200 |
| Smoke : /vip | 200 |
1. `npm run dev`, fenetre de navigation privee.
2. `http://localhost:3001/admin/commandes` sans connexion : redirection vers `/admin/login`, sans menu lateral.
3. Se connecter : arrivee sur le dashboard, menu present.
4. Naviguer dans l'admin : acces normal.
5. Se deconnecter : retour sur `/admin/login`, puis `/admin/commandes` redirige a nouveau.
6. Verifier que `/`, `/panier` et `/vip` sont inchanges.
