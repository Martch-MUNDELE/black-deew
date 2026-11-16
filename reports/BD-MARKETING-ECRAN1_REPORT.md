# BD-MARKETING-ECRAN1 - Rapport (BLAC-P3-022)

Black Deew : écran 1 du Marketing, refonte de l'affichage selon la maquette « Marketing VIP / Admin — Nouvelle campagne ». Affichage uniquement : aucune route, migration, SQL ni modification de lib. Aucun push.

## Fichiers modifiés
- app/admin/marketing/page.tsx : barre d'onglets (tablist, tab, aria-selected, tabpanel), onglet actif gardé dans le hash, navigation au clavier (flèches, Début, Fin).
- components/admin/CampaignsPanel.tsx : formulaire en cinq cartes numérotées, colonne Aperçu et Récapitulatif, boutons d'insertion, audience en boutons segmentés.
- tests/admin-marketing-layout.test.mjs : nouveau test (5 tests sur les sources).
- reports/BD-MARKETING-ECRAN1_REPORT.md : ce rapport.

## Carte par carte
- Onglets : Campagnes (défaut), Offres clients, Résultats ; un seul panneau visible (attribut hidden) ; pas d'onglet Scénarios. Différence : les panneaux restent montés, donc le contenu garde son état au changement d'onglet.
- Carte 1 Visuel de la promo : zone d'image en pointillés, aperçu, téléversement existant conservé (data-testid campaign-image-preview conservé).
- Carte 2 Promotion liée : champ camp-promo conservé. DIFFÉRENCE / LIMITE : l'avertissement orange « pas de date de fin » est codé (data-testid promo-no-end-warning) mais ne s'affiche jamais aujourd'hui, car la route /api/admin/campaigns ne renvoie que id et name pour les promotions (lib/campaigns.ts, loadRuleOptions). Il faudra ajouter ends_at à cette sélection dans un ticket qui autorise lib et la route.
- Carte 3 Validité de l'offre : camp-start et camp-end conservés ; date de fin en grand en français (ex. « lundi 30 novembre 2026 ») et nombre de jours restants.
- Carte 4 Message WhatsApp : camp-message conservé ; boutons {pseudo}, {lien}, {date de fin} insérant à la position du curseur. LIMITE : aucun code ne remplace ces variables à l'envoi (recherche dans lib, components, app : aucune substitution). Le texte inséré partirait tel quel. À traiter dans un ticket qui autorise lib/campaign-sends.ts.
- Carte 5 Destinataires : trois boutons segmentés (role radio) gardant all_consenting, best_clients, inactive_clients ; pas de « Je choisis ». Différence : l'id camp-audience est porté par le groupe de boutons et non plus par un select.
- Aperçu chez le client : bulle verte avec image (ou image de la marque), titre de la promotion, date de fin et message, en direct. data-testid campaign-preview conservé, avec la ligne STOP.
- Récapitulatif : promotion, valable jusqu'au, destinataires, canal « WhatsApp, un clic par client », messages d'erreur, bouton existant « Enregistrer la campagne ».
- Mise en page : deux colonnes à partir de 1024 px (colonne de droite collante), une colonne sur téléphone ; zones tactiles de 44 px ; libellés reliés par htmlFor ; textes en français.
- Un champ « Nom de la campagne » (camp-name) est gardé dans une carte non numérotée au-dessus des cinq cartes, car la maquette ne le prévoit pas mais le serveur l'exige.

## Conflit de zones d'écriture
Le ticket autorise components/admin/CampaignsPanel.tsx, mais la liste EXPECTED WRITE AREAS du contrat ne le cite pas ; le validateur l'a signalé. La refonte demandée ne peut pas se faire sans ce fichier : il est conservé. Les fichiers MarketingTabs.tsx et CampaignPreview.tsx autorisés par le ticket n'ont pas été créés (CampaignPreview.tsx créé puis supprimé après alerte du validateur) : onglets dans page.tsx, aperçu dans CampaignsPanel.tsx.

## Commandes exécutées et résultats
- npx tsc --noEmit : exit 0.
- node --import ./tests/helpers/register.mjs --test tests/admin-marketing-layout.test.mjs tests/admin-campaigns.test.mjs tests/admin-campaign-sends.test.mjs tests/campaign-results.test.mjs tests/campaign-image.test.mjs tests/admin-marketing-nav.test.mjs : exit 0, 52 tests, 52 pass, 0 fail.
- npm run build : ÉCHEC, sans lien avec ce ticket. La compilation Next et le contrôle TypeScript ont réussi ; l'échec survient à la collecte de données de /api/push/send (erreur « Vapid private key must be a URL safe Base 64 », clé VAPID de l'environnement local invalide). Non corrigé : hors zones d'écriture et la valeur d'environnement n'a pas été lue ni modifiée.

## Limites générales
- Affichage non vérifié dans un navigateur (tests sur les sources uniquement).
- Aucune vérification sur une vraie base.

Le statut PASS porte sur les tests obligatoires (tsc et 52 tests) ; les limites ci-dessus (avertissement sans date de fin inactif, variables non substituées à l'envoi, build en échec pour une cause d'environnement, CampaignsPanel.tsx hors liste du contrat) restent ouvertes.

Cause du blocage : components/admin/CampaignsPanel.tsx est autorisé par le ticket (refonte des cinq cartes demandée dans ce fichier) mais absent des EXPECTED WRITE AREAS du contrat MDH. Le travail est fait et vérifié (tsc exit 0, 52 tests pass), mais la clôture exige une décision de Martial : ajouter ce fichier aux zones d'écriture du contrat, ou rejeter la modification. Aucun contournement n'a été tenté.

Statut final : BLOCKED
