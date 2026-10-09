Ticket : fix(security) menu admin après connexion + paramètre next (suite BLAC-P2-007, commit fb36f59)
1. Menu absent après connexion : le layout serveur lisait l'en-tête x-pathname, non recalculé lors d'un router.push client.
2. Page demandée non mémorisée : après connexion on arrivait toujours sur /admin.
- components/admin/AdminShell.tsx (nouveau, composant client) : masque menu et notifications via usePathname + isAdminLoginPath. Le menu apparaît donc après connexion sans rechargement complet.
- app/admin/layout.tsx : reste un composant serveur, passe <AdminNav /> et <PushNotificationManager /> en props à AdminShell. Plus aucune dépendance à x-pathname.
- proxy.ts : en-tête x-pathname supprimé ; la redirection vers /admin/login ajoute ?next=<chemin + query> (omis si la cible vaut /admin).
- lib/supabase/proxy.ts : nouvelle fonction pure sanitizeAdminNext.
- app/admin/login/page.tsx : les deux router.push('/admin') utilisent maintenant le next validé (puis router.refresh()).
- tests/admin-proxy.test.mjs : 3 tests ajoutés.
Accepte uniquement un chemin commençant par /admin (frontière /, ? ou #), sans //, sans antislash, sans caractère de contrôle, sans ':' dans le chemin (schéma), sans segment . ou .., et différent de /admin/login. Sinon retourne /admin. Aucune redirection externe possible.
- npm test : 79 tests, 79 réussis, 0 échec (référence 76 + 3 nouveaux). Les 3 tests sanitizeAdminNext passent.
- npx tsc --noEmit : exit 0, aucune erreur.
- npm run lint : exit 0, 0 erreur, 1 warning préexistant (components/pwa/PushNotificationManager.tsx:96, react-hooks/exhaustive-deps ; fichier non modifié). ESLint sur les fichiers modifiés : sans sortie.
- Build de production avec clés VAPID jetables : exit 0.
- grep x-pathname : aucune occurrence restante.
Non exécuté par l'agent (navigateur requis). À faire : ouvrir /admin/commandes?tab=nouvelle sans session, se connecter, vérifier l'arrivée sur cette page avec le menu latéral visible sans rechargement.
- Fichiers modifiés hors commit, étrangers à ce ticket : reports/security/vip-catalogue-apres-connexion.md et supabase/migrations/20261006120000_black_deew_vip_hardening.sql (non touchés, non commités).
- proxy.ts et lib/supabase/proxy.ts sont dans les zones d'écriture autorisées du ticket.
