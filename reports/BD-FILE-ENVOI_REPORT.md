# BD-FILE-ENVOI - Rapport (BLAC-P2-026)

Statut final : PASS

Black Deew : file d'envoi WhatsApp d'une campagne, un clic par client, avec STOP et plafond d'un message par mois.

IMPORTANT : aucun controle sur une vraie base ; tests sur base simulee en memoire uniquement. Migration non appliquee, aucun envoi, WhatsApp non ouvert.

## Fichiers crees ou modifies
- supabase/migrations/20261103_bd_campaign_sends.sql (NON APPLIQUEE) : tables campaign_sends (unicite campaign_id + phone, statuts to_send/sent/refused) et marketing_refusals (phone cle primaire), securite par ligne activee sans politique, retour arriere en commentaire
- lib/campaign-sends.ts : destinataires eligibles (vip_allowed_phones + vip_individual_passwords, hors marketing_refusals, hors marketing_opt_in a false, hors envoi sent des 30 derniers jours), buildWhatsappLink, actions marquer envoye et STOP, unavailable true si table absente
- app/api/admin/campaign-sends/route.ts : requireAdmin, GET la file, PATCH envoye ou STOP, aucune donnee client dans les journaux
- components/admin/CampaignSendQueue.tsx : liste, Ouvrir WhatsApp (nouvel onglet, rel noopener noreferrer), Marquer envoye, A repondu STOP, compteur envoyes sur total, messages file vide et indisponible
- components/admin/CampaignsPanel.tsx : bouton d'ouverture de la file pour les campagnes au statut ready
- tests/admin-campaign-sends.test.mjs : 13 tests

## Commandes executees et resultats
- node --import ./tests/helpers/register.mjs --test tests/admin-campaign-sends.test.mjs : exit 0, 13 tests, 13 pass, 0 fail
- node --import ./tests/helpers/register.mjs --test tests/admin-campaigns.test.mjs tests/admin-client-offers.test.mjs tests/client-offers-migration.test.mjs : exit 0, 31 tests, 31 pass, 0 fail (fichiers non modifies)
- npx tsc --noEmit : exit 0, aucune erreur (aucune erreur deja presente)

## Limites
- Affichage non verifie dans un navigateur.
- Route non testee de bout en bout (tests sur lib/campaign-sends.ts).
- Comportement sur la vraie base non verifie (tables non creees).
- Le plafond d'un message par mois se base sur les lignes sent de campaign_sends ; un envoi fait hors de cette file n'est pas vu.
- Le compteur envoyes sur total porte sur les clients eligibles ou deja marques envoyes pour cette campagne.

## Interdits respectes
Aucune base modifiee, migration non appliquee, aucun commit, aucun push, aucun deploiement, aucun envoi a un client, WhatsApp non ouvert.
