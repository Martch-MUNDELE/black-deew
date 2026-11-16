# BD-SCENARIOS_REPORT (BLAC-P3-013)

Statut final : PASS

Portée : tests sur base simulée uniquement ; aucune validation sur base réelle.

Black Deew : la file d'envoi respecte le scenario de la campagne (all_consenting, best_clients, inactive_clients).

Perimetre : verification par tests automatises sur un faux client Supabase en memoire. Aucune base de donnees n'a ete interrogee, aucune preuve cote base n'est fournie. Le test SQL est ecrit mais non lance. Aucune migration appliquee.

## Realise
- lib/campaign-scenarios.ts (nouveau, logique pure, aucun journal) : selectBestClients (commandes non annulees des 180 derniers jours regroupees par numero via phonesMatch, top 20 au chiffre d'affaires, egalite : plus recent d'abord) et selectInactiveClients (au moins 2 commandes non annulees, derniere commande a plus de 60 jours et au plus 365 jours). Seuils exportes : BEST_CLIENTS_WINDOW_DAYS, BEST_CLIENTS_LIMIT, INACTIVE_MIN_ORDERS, INACTIVE_MIN_DAYS, INACTIVE_MAX_DAYS.
- lib/campaign-sends.ts : computeQueue lit audience_mode (absent ou inconnu = all_consenting) et restreint aux numeros du scenario ; refus, opt-out et plafond de 30 jours conserves. Table orders absente ou en erreur pour best_clients / inactive_clients : file vide + unavailable explicite (SCENARIO_UNAVAILABLE_MESSAGE), sans repli sur tous les clients. all_consenting ne lit pas orders. Le GET renvoie aussi le champ audience.
- components/admin/CampaignSendQueue.tsx : ligne "Scenario : <libelle> · N destinataires retenus".
- tests/campaign-scenarios.test.mjs (nouveau, 16 tests).
- supabase/tests/bd_scenarios_orders_columns.sql : test SQL de lecture des colonnes de public.orders, ecrit, non lance.

## Resultats des tests automatises (faux client en memoire)
- tests/campaign-scenarios.test.mjs : 16 tests, 16 reussis, 0 echec
- tests/admin-campaign-sends.test.mjs, tests/admin-campaigns.test.mjs, tests/campaign-public-page.test.mjs : 35 tests, 35 reussis, 0 echec, fichiers non modifies
- npx tsc --noEmit : aucune erreur (aucune erreur deja presente)

## Limites
- Affichage non verifie dans un navigateur.
- Route non testee de bout en bout (tests sur lib/campaign-sends.ts).
- Comportement sur la vraie base non verifie (tables marketing non creees) ; test SQL non lance.

## Interdits respectes
Aucune operation sur la base, aucune migration appliquee, aucun commit, aucun push, aucun deploiement, aucun envoi a un client, WhatsApp non ouvert.
