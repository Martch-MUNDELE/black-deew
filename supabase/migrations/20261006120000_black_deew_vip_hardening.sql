-- =====================================================================
-- Black Deew : durcissement des acces aux donnees VIP (A3 et A9)
-- Schema cible : public (jamais le schema style)
-- FICHIER ECRIT SEULEMENT, JAMAIS APPLIQUE PAR LE TICKET.
-- A appliquer uniquement APRES le deploiement du code (BLAC-P1-003, 006, 007).
-- Rejouable : tout est idempotent. Aucune donnee ni structure de table modifiee
-- (uniquement : regles RLS, droits, une fonction d aide).
--
-- Tables : vip_individual_passwords, vip_password_reset_tokens,
--          vip_password_reset_requests, vip_access_requests, settings
--
-- Resultat :
--   * anon : plus aucun droit sur les 4 tables VIP ; sur settings, lecture seule
--            des cles d affichage (sauf vip_access_password, vip_allowed_phones et notification_email)
--   * administrateurs connectes (ligne active dans public.admins, email = email
--     du jeton de session) : lecture et ecriture sur les 5 tables
--   * service_role : inchange (ignore RLS)
--
-- ---------------------------------------------------------------------
-- RETOUR ARRIERE EXACT (a executer manuellement si besoin)
-- PRE-REQUIS AVANT APPLICATION (lecture seule, ne montre aucune donnee) :
--   SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies
--   WHERE schemaname='public' AND tablename IN ('vip_individual_passwords',
--   'vip_password_reset_tokens','vip_password_reset_requests','vip_access_requests','settings');
--   SELECT relname, relrowsecurity FROM pg_class WHERE oid IN ('public.settings'::regclass);
--   Conserver ce resultat : l etape 3 bis supprime TOUTES les regles de ces 5 tables,
--   y compris celles non versionnees ; ce releve permet de les recreer a l identique.
--
-- Etat d origine reconstitue depuis la migration 20260811190237 (schema style,
-- clone de public). L etat reel de public n est pas versionne : verifier avant.
--
--   DROP POLICY IF EXISTS "vip_access_requests_admin_all" ON public.vip_access_requests;
--   DROP POLICY IF EXISTS "vip_individual_passwords_admin_all" ON public.vip_individual_passwords;
--   DROP POLICY IF EXISTS "vip_password_reset_requests_admin_all" ON public.vip_password_reset_requests;
--   DROP POLICY IF EXISTS "vip_password_reset_tokens_admin_all" ON public.vip_password_reset_tokens;
--   DROP POLICY IF EXISTS "settings_admin_all" ON public.settings;
--   DROP POLICY IF EXISTS "settings_public_read_display_keys" ON public.settings;
--
--   GRANT ALL ON TABLE public.vip_access_requests TO anon;
--   GRANT ALL ON TABLE public.vip_individual_passwords TO anon;
--   GRANT ALL ON TABLE public.vip_password_reset_requests TO anon;
--   GRANT ALL ON TABLE public.vip_password_reset_tokens TO anon;
--   GRANT ALL ON TABLE public.settings TO anon;
--   -- authenticated : retour aux droits d origine (GRANT ALL, y compris TRUNCATE/REFERENCES/TRIGGER)
--   GRANT ALL ON TABLE public.vip_access_requests TO authenticated;
--   GRANT ALL ON TABLE public.vip_individual_passwords TO authenticated;
--   GRANT ALL ON TABLE public.vip_password_reset_requests TO authenticated;
--   GRANT ALL ON TABLE public.vip_password_reset_tokens TO authenticated;
--   GRANT ALL ON TABLE public.settings TO authenticated;
--
--   CREATE POLICY "vip_access_requests_public_insert" ON public.vip_access_requests FOR INSERT WITH CHECK (("status" = 'pending'::text) AND (length(TRIM(BOTH FROM "phone")) > 0) AND (length(TRIM(BOTH FROM "pseudo")) > 0));
--   CREATE POLICY "vip_access_requests_select_all" ON public.vip_access_requests FOR SELECT USING (true);
--   CREATE POLICY "vip_access_requests_update_all" ON public.vip_access_requests FOR UPDATE USING (true) WITH CHECK (true);
--   CREATE POLICY "vip_individual_passwords_select_all" ON public.vip_individual_passwords FOR SELECT USING (true);
--   CREATE POLICY "vip_individual_passwords_update_all" ON public.vip_individual_passwords FOR UPDATE USING (true) WITH CHECK (true);
--   CREATE POLICY "vip_individual_passwords_write_all" ON public.vip_individual_passwords FOR INSERT WITH CHECK (true);
--   CREATE POLICY "vip_reset_requests_insert_anon" ON public.vip_password_reset_requests FOR INSERT TO authenticated, anon WITH CHECK (true);
--   CREATE POLICY "vip_reset_requests_select_all" ON public.vip_password_reset_requests FOR SELECT TO authenticated, anon USING (true);
--   CREATE POLICY "vip_reset_requests_update_all" ON public.vip_password_reset_requests FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
--   CREATE POLICY "vip_reset_tokens_insert_anon" ON public.vip_password_reset_tokens FOR INSERT TO authenticated, anon WITH CHECK (true);
--   CREATE POLICY "vip_reset_tokens_select_all" ON public.vip_password_reset_tokens FOR SELECT TO authenticated, anon USING (true);
--   CREATE POLICY "vip_reset_tokens_update_used_at" ON public.vip_password_reset_tokens FOR UPDATE TO authenticated, anon USING ((used_at IS NULL) AND (expires_at > now())) WITH CHECK (true);
--
--   -- settings n avait AUCUNE regle RLS dans l etat de reference : retour a l etat d origine
--   ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
--
--   DROP FUNCTION IF EXISTS public.is_active_admin();
-- =====================================================================
-- 1. Fonction d aide : l appelant est-il un administrateur actif ?
--    SECURITY DEFINER pour ne pas dependre des regles d acces de public.admins.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins a
    WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND a.status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO service_role;
-- 2. RLS actif sur les 5 tables (idempotent)
ALTER TABLE public.vip_individual_passwords       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_password_reset_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_password_reset_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_access_requests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings                       ENABLE ROW LEVEL SECURITY;
-- 3. Suppression des regles permissives connues (par nom)
DROP POLICY IF EXISTS "vip_access_requests_public_insert"   ON public.vip_access_requests;
DROP POLICY IF EXISTS "vip_access_requests_select_all"      ON public.vip_access_requests;
DROP POLICY IF EXISTS "vip_access_requests_update_all"      ON public.vip_access_requests;
DROP POLICY IF EXISTS "vip_individual_passwords_select_all" ON public.vip_individual_passwords;
DROP POLICY IF EXISTS "vip_individual_passwords_update_all" ON public.vip_individual_passwords;
DROP POLICY IF EXISTS "vip_individual_passwords_write_all"  ON public.vip_individual_passwords;
DROP POLICY IF EXISTS "vip_reset_requests_insert_anon"      ON public.vip_password_reset_requests;
DROP POLICY IF EXISTS "vip_reset_requests_select_all"       ON public.vip_password_reset_requests;
DROP POLICY IF EXISTS "vip_reset_requests_update_all"       ON public.vip_password_reset_requests;
DROP POLICY IF EXISTS "vip_reset_tokens_insert_anon"        ON public.vip_password_reset_tokens;
DROP POLICY IF EXISTS "vip_reset_tokens_select_all"         ON public.vip_password_reset_tokens;
DROP POLICY IF EXISTS "vip_reset_tokens_update_used_at"     ON public.vip_password_reset_tokens;
-- 3 bis. Filet de securite : l etat reel de public n est pas versionne, donc on
--        supprime aussi toute autre regle existante sur ces 5 tables
--        (noms inconnus, *_all, USING true...). Les regles voulues sont recreees plus bas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'vip_individual_passwords',
        'vip_password_reset_tokens',
        'vip_password_reset_requests',
        'vip_access_requests',
        'settings'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END
$$;
-- 4. Droits : anon perd tout sur les 4 tables VIP et sur settings (sauf lecture)
REVOKE ALL ON TABLE public.vip_individual_passwords    FROM anon;
REVOKE ALL ON TABLE public.vip_password_reset_tokens   FROM anon;
REVOKE ALL ON TABLE public.vip_password_reset_requests FROM anon;
REVOKE ALL ON TABLE public.vip_access_requests         FROM anon;
REVOKE ALL ON TABLE public.settings                    FROM anon;
GRANT SELECT ON TABLE public.settings TO anon;
-- authenticated : droits de table necessaires, filtres ensuite par les regles RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vip_individual_passwords    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vip_password_reset_tokens   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vip_password_reset_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vip_access_requests         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.settings                    TO authenticated;
-- 4 bis. Rejouabilite : DROP POLICY IF EXISTS explicite avant chaque CREATE POLICY
DROP POLICY IF EXISTS "vip_individual_passwords_admin_all"    ON public.vip_individual_passwords;
DROP POLICY IF EXISTS "vip_password_reset_tokens_admin_all"   ON public.vip_password_reset_tokens;
DROP POLICY IF EXISTS "vip_password_reset_requests_admin_all" ON public.vip_password_reset_requests;
DROP POLICY IF EXISTS "vip_access_requests_admin_all"         ON public.vip_access_requests;
DROP POLICY IF EXISTS "settings_admin_all"                    ON public.settings;
DROP POLICY IF EXISTS "settings_public_read_display_keys"     ON public.settings;
-- 5. Nouvelles regles : administrateurs actifs, lecture et ecriture
CREATE POLICY "vip_individual_passwords_admin_all" ON public.vip_individual_passwords
  FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY "vip_password_reset_tokens_admin_all" ON public.vip_password_reset_tokens
  FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY "vip_password_reset_requests_admin_all" ON public.vip_password_reset_requests
  FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY "vip_access_requests_admin_all" ON public.vip_access_requests
  FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
-- settings : ecriture reservee aux admins
CREATE POLICY "settings_admin_all" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
-- settings : lecture publique des cles d affichage uniquement
CREATE POLICY "settings_public_read_display_keys" ON public.settings
  FOR SELECT TO anon, authenticated
  USING (key NOT IN ('vip_access_password', 'vip_allowed_phones', 'notification_email'));
-- =====================================================================
-- VERIFICATION APRES APPLICATION (lecture seule, a lancer a la main)
--   1. Regles restantes : exactement 6, aucune permissive
--      SELECT tablename, policyname, cmd, roles FROM pg_policies
--      WHERE schemaname='public' AND tablename IN ('vip_individual_passwords',
--      'vip_password_reset_tokens','vip_password_reset_requests','vip_access_requests','settings')
--      ORDER BY tablename, policyname;
--   2. Droits de anon : seul SELECT sur settings doit apparaitre
--      SELECT table_name, privilege_type FROM information_schema.role_table_grants
--      WHERE table_schema='public' AND grantee='anon'
--      AND table_name IN ('vip_individual_passwords','vip_password_reset_tokens',
--      'vip_password_reset_requests','vip_access_requests','settings');
--   3. RLS actif sur les 5 tables
--      SELECT relname, relrowsecurity FROM pg_class
--      WHERE oid IN ('public.vip_individual_passwords'::regclass,'public.vip_password_reset_tokens'::regclass,
--      'public.vip_password_reset_requests'::regclass,'public.vip_access_requests'::regclass,'public.settings'::regclass);
--   4. Test navigateur sans session : la lecture de settings ne doit renvoyer ni
--      vip_access_password, ni vip_allowed_phones, ni notification_email ;
--      les 4 tables VIP doivent etre refusees.
-- =====================================================================
-- NOTES DE RELECTURE (commentaires uniquement, aucun effet a l execution)
--   * Realtime : components/AdminNav.tsx, components/admin/AdminNavClient.tsx et
--     app/admin/settings/page.tsx s abonnent a postgres_changes sur vip_access_requests,
--     vip_individual_passwords et vip_password_reset_requests. Realtime applique le RLS avec
--     le jeton de l utilisateur : seuls les admins actifs recevront ces evenements.
--   * Liste noire de settings : la lecture publique exclut vip_access_password,
--     vip_allowed_phones et notification_email. Toute nouvelle cle sensible ajoutee a settings
--     devra etre ajoutee a la regle settings_public_read_display_keys.
--   * public.admins n est pas traitee ici (hors perimetre du ticket) : verifier ses droits
--     et ses regles separement (le clone style lui donne GRANT ALL a anon).
--   * Les routes serveur (service role) ne sont pas concernees par ces regles.
-- =====================================================================
-- COUVERTURE DES ACCES NAVIGATEUR (verifiee par lecture du code)
--   * Admin (session authentifiee, ligne active dans public.admins) : couvert par *_admin_all
--       app/admin/settings/page.tsx : lecture et ecriture settings (dont vip_access_password,
--       vip_allowed_phones, notification_email), vip_individual_passwords (lecture),
--       vip_access_requests et vip_password_reset_requests (lecture, mise a jour), realtime.
--       components/AdminNav.tsx, components/admin/AdminNavClient.tsx : vip_access_requests
--       (compteur des demandes en attente), settings (site_name, site_logo), admins.
--       app/admin/creneaux/page.tsx : settings (upsert slots_*).
--       app/admin/superadmin/page.tsx : settings (lecture/ecriture status et module_livreurs) ;
--       le superadmin doit avoir une ligne active dans public.admins, sinon ces ecritures sont refusees.
--   * Visiteur anonyme : couvert par settings_public_read_display_keys (cles d affichage)
--       site_name, site_logo*, hero_image, stock_enabled, status, currency, tax_*, delivery_*,
--       module_livreurs, vip_access_enabled (VipAccessGate, panier, vip, cartes produits).
--   * Plus aucun acces navigateur anonyme aux 4 tables VIP : demande d acces, precheck,
--       connexion, changement et reinitialisation de mot de passe passent par app/api/vip/*,
--       app/api/vip-request et lib/vip-server.ts (cle service role).
-- =====================================================================
-- FIN DU FICHIER : migration ecrite seulement, JAMAIS APPLIQUEE par le ticket.
-- Relue manuellement (aucun analyseur syntaxique PostgreSQL disponible hors ligne) : aucune donnee, aucune
-- structure de table modifiee, schema public uniquement. Voir le rapport
-- reports/migration-durcissement-vip-black-deew.md (ordre de mise en ligne :
-- code deploye d abord, ce fichier ensuite, puis test complet VIP et admin).
-- =====================================================================
