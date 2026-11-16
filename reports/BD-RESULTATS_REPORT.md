# BD-RESULTATS - Résultats d'une campagne (BLAC-P3-014)

Statut final : PASS

Portée du PASS : code, route et composant écrits, vérifiés par des tests sur base simulée en mémoire (tests/helpers/fake-supabase.mjs) et par la compilation TypeScript. Le ticket interdit toute opération sur la base ; aucune requête n'a été envoyée à Supabase.

## Preuve d'exécution base
Aucune. Aucune exécution sur base réelle n'a été faite ni n'est revendiquée. Les tables marketing (campaign_sends, marketing_refusals) n'existent pas encore sur la base. Le fichier supabase/tests/bd_campaign_results_readonly.sql est fourni pour une vérification ultérieure, il n'a pas été exécuté.

## Commandes exécutées (résultats sur base simulée)
- node --import ./tests/helpers/register.mjs --test tests/campaign-results.test.mjs : exit 0, 13 tests, 13 réussis, 0 échec
- node --import ./tests/helpers/register.mjs --test tests/admin-campaign-sends.test.mjs tests/admin-campaigns.test.mjs tests/campaign-scenarios.test.mjs tests/campaign-public-page.test.mjs : exit 0, 51 tests, 51 réussis, 0 échec, fichiers non modifiés
- npx tsc --noEmit : exit 0, aucune erreur

## Fichiers
- lib/campaign-results.ts (computeCampaignResults, runCampaignResultsAction, RESULTS_WINDOW_DAYS = 7)
- app/api/admin/campaign-results/route.ts (GET, requireAdmin, paramètre id)
- components/admin/CampaignResults.tsx
- app/admin/marketing/page.tsx (bloc ajouté, reste inchangé)
- tests/campaign-results.test.mjs
- supabase/tests/bd_campaign_results_readonly.sql (non exécuté)

## Règles implémentées
- Envoyés : campaign_sends au statut sent pour la campagne.
- Refus : marketing_refusals créés depuis le premier envoi, un numéro compté une fois.
- Commandes : non annulées, numéro rapproché par phonesMatch, créées dans les 7 jours après l'envoi.
- Taux : clients distincts ayant commandé / envoyés, 1 décimale, 0 sans envoi.
- Table absente ou en erreur : unavailable avec message, sans exception.
- Totaux uniquement : aucun numéro affiché ni journalisé.

## Limites
- Affichage non vérifié dans un navigateur.
- Route testée via la logique pure, pas de bout en bout.
- Valeurs réelles de orders.status non confirmées (plusieurs orthographes d'annulation reconnues).

## Interdits respectés
Aucune opération base, aucune migration, aucun commit, aucun push, aucun déploiement, aucun envoi à un client, WhatsApp non ouvert.
