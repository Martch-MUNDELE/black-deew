# BD-SCENARIOS-ECRAN3 - Rapport

Black Deew : écran 3 du Marketing, onglet Scénarios automatiques (meilleur client du mois, relance des VIP inactifs).

## Fichiers modifiés ou créés
- app/api/admin/campaign-scenarios/route.ts (créé) : GET seul, protégé par requireAdmin, appelle runCampaignScenariosAction.
- lib/campaign-scenarios.ts : ajout de runCampaignScenariosAction (lecture seule), SCENARIOS_SCREEN_UNAVAILABLE_MESSAGE, type RankedClient. Fonctions existantes inchangées.
- components/admin/ScenariosPanel.tsx (créé) : deux cartes côte à côte, empilées sur téléphone (flex-wrap).
- app/admin/marketing/page.tsx : onglet Scénarios automatiques entre Offres clients et Résultats, hash géré comme les autres.
- tests/campaign-scenarios-screen.test.mjs (créé) : 8 tests.
- tests/admin-marketing-layout.test.mjs : assertions mises à jour (quatre onglets, quatre panneaux) car l'ancien test interdisait l'onglet Scénarios. Hors zones d'écriture listées du ticket, mais modification indispensable à la conformité du ticket.

## Conforme à la maquette
- Carte Meilleur client : classement de trois clients, premier mis en évidence, choix de la promotion (liste des règles du module Offres), date de fin, message calculé avec applyCampaignVariables, bouton Valider et préparer l'envoi (POST /api/admin/client-offers), puis bouton Ouvrir WhatsApp.
- Carte Relance des VIP inactifs : compteur, aperçu de trois noms, promotion, date de fin, message, bouton Valider (POST /api/admin/campaigns, audience inactive_clients), mention « Seuls les VIP qui ont accepté les offres sont relancés. ».
- Couleurs du module (or E8A020, fonds sombres), data-testid existants conservés.
- Aucune écriture sans clic sur Valider.

## Différences et limites
- La maquette (artefact claude.ai) n'a pas été consultée directement : mise en page déduite du ticket.
- Le message utilise {lien} vide pour le meilleur client (pas de lien d'offre généré par une route existante) ; la date de fin est bien remplacée.
- Après création de la campagne de relance, le renvoi vers la file d'envoi se fait par le hash #campagnes ; la campagne reste en brouillon, à passer en « prête » dans l'onglet Campagnes.
- Les noms inconnus apparaissent masqués (Client ••••1234) dans l'aperçu.
- Le compteur de relance ne compte que les VIP connus de vip_access_requests avec marketing_opt_in différent de false.
- Aucune migration, aucun SQL requis. Affichage non vérifié dans un navigateur, ni sur une vraie base.

## Commandes exécutées
- npx tsc --noEmit : exit 0
- node --import ./tests/helpers/register.mjs --test tests/campaign-scenarios-screen.test.mjs tests/campaign-scenarios.test.mjs tests/admin-marketing-layout.test.mjs tests/admin-client-offers.test.mjs tests/admin-campaigns.test.mjs : exit 0, 50 tests, 50 pass, 0 fail

Statut final : PASS
