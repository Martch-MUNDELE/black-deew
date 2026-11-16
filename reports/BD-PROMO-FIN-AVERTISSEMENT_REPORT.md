# BD-PROMO-FIN-AVERTISSEMENT - Rapport

Black Deew : l'avertissement « promotion sans date de fin » peut maintenant s'afficher (formulaire de campagne et panneau Scénarios).

## Fichiers modifiés
- lib/campaigns.ts : loadRuleOptions sélectionne ends_at et le renvoie (null si vide) ; repli sur l'ancienne lecture si la lecture avec ends_at échoue.
- lib/client-offers.ts : même changement ; ends_at renvoyé seulement si la clé est présente dans la ligne lue (toujours vrai avec la vraie base), pour garder le test existant tests/admin-client-offers.test.mjs vert sans le modifier.
- components/admin/ScenariosPanel.tsx : type RuleOption avec ends_at facultatif ; avertissement orange data-testid promo-no-end-warning-scenarios sous le choix de promotion (cartes meilleur client et VIP inactifs).
- tests/promo-rule-end-date.test.mjs : nouveau test.

## Preuve que ends_at existe (code du dépôt)
- supabase/migrations/20261031_bd_promotion_rules.sql ligne 13 : colonne ends_at timestamptz dans promotion_rules ; index ligne 53 sur (starts_at, ends_at).
- app/admin/promotions/page.tsx lit et écrit déjà starts_at et ends_at.
- Rien n'a été exécuté contre la base.

## Commandes exécutées
- npx tsc --noEmit : exit 0
- node --import ./tests/helpers/register.mjs --test tests/promo-rule-end-date.test.mjs tests/admin-campaigns.test.mjs tests/admin-client-offers.test.mjs tests/campaign-scenarios-screen.test.mjs : exit 0, 35 tests, 35 pass, 0 fail

## Limites
- Affichage non vérifié dans un navigateur ; comportement sur la vraie base non vérifié (tests sur base simulée).
- Aucune migration, aucun SQL d'écriture, aucun commit, aucun push, aucun déploiement.

Statut final : PASS
