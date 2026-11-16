# BD-VARIABLES-MESSAGE - Rapport (BLAC-P3-023)

Black Deew : remplacement de {pseudo}, {lien} et {date de fin} dans le message WhatsApp de chaque client a l'envoi.

IMPORTANT : tests sur base simulee en memoire uniquement. Aucun controle sur une vraie base, aucun controle dans un navigateur.

## Fichiers modifies
- lib/campaign-sends.ts (modifie)
- tests/campaign-variables.test.mjs (cree)
- reports/BD-VARIABLES-MESSAGE_REPORT.md (cree)
- app/api/admin/campaign-sends/route.ts : NON modifie. La route appelle deja runCampaignSendsAction ; la construction de la file (lecture des pseudos, passage de la date de fin a buildWhatsappLink) est dans lib/campaign-sends.ts, qui fait partie des zones autorisees.

## Changements
- applyCampaignVariables (fonction pure) : remplace {pseudo}, {lien}, {date de fin} en un seul passage ; une valeur inseree n'est jamais reinterpretee.
- formatFrenchDate : date en francais (ex. lundi 30 novembre 2026), chaine vide si absente ou invalide.
- buildCampaignMessageWithOffer : si le texte contient deja {lien}, la ligne « Voir l'offre » n'est pas ajoutee ; sinon comportement inchange. STOP exactement une fois.
- buildWhatsappLink : accepte pseudo et date de fin (parametre optionnel, appels existants inchanges).
- loadPseudos : lecture seule de vip_access_requests (phone, pseudo, status), pseudos des demandes approuvees prioritaires. Echec de lecture : liste vide, la file n'est pas bloquee, message avec « toi ».
- loadReadyCampaign lit aussi ends_at.

## Exemples avant / apres
Campagne c1, pseudo Kevin, fin 2026-11-30.
- Avant : « Salut {pseudo}, fin : {date de fin}. » + ligne offre + STOP, avec les accolades envoyees telles quelles.
- Apres : « Salut Kevin, fin : lundi 30 novembre 2026. » + ligne offre + STOP.
- Pseudo inconnu : « Salut toi, ... ».
- Sans date de fin : « Offre valable {date de fin}. » devient « Offre valable. ».
- Message « Clique ici : {lien} » : le lien apparait une seule fois, pas de ligne « Voir l'offre » ajoutee.
- Message sans variable : inchange.

## Commandes executees et resultats
- npx tsc --noEmit : exit 0, aucune erreur
- node --import ./tests/helpers/register.mjs --test tests/campaign-variables.test.mjs tests/admin-campaign-sends.test.mjs tests/admin-campaigns.test.mjs : exit 0, 36 tests, 36 pass, 0 fail

## Limites
- Pseudo lu dans vip_access_requests ; un numero present seulement via mot de passe individuel n'a pas de pseudo connu : « toi ».
- Comportement sur la vraie base non verifie.
- Date calculee en UTC.

## Interdits respectes
Aucune ecriture en base, aucune migration, aucun composant d'affichage touche, aucun commit, aucun push, aucun deploiement.

Statut final : PASS
