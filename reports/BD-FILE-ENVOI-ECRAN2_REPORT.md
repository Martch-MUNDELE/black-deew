# BD-FILE-ENVOI-ECRAN2 - Rapport

Black Deew : écran 2 du Marketing, file d'envoi à un clic (progression, liste filtrable, panneau Prochain message).

IMPORTANT : tests sur base simulée en mémoire uniquement. Aucun contrôle sur une vraie base, aucun contrôle dans un navigateur.

## Fichiers modifiés
- lib/campaign-sends.ts : chaque élément de la file porte désormais `pseudo` (ou null) et `message` (texte exact du message envoyé à ce client, identique au texte encodé dans le lien WhatsApp). Champs existants (phone, status, whatsapp_url) inchangés.
- components/admin/CampaignSendQueue.tsx : refonte de l'affichage.
- tests/campaign-queue-screen.test.mjs : nouveau, 9 tests.
- reports/BD-FILE-ENVOI-ECRAN2_REPORT.md : ce rapport.

## Correspond à la maquette
- Carte Progression : « N / total messages envoyés » en grand, barre avec role="progressbar" et aria-valuenow.
- Liste : pseudo en gras (sinon le numéro), numéro en dessous quand il y a un pseudo, badge de statut coloré (Prochain, À envoyer, Envoyé), premier client à envoyer mis en évidence avec le badge Prochain.
- Trois filtres en boutons : Tous, À envoyer, Envoyés, avec compteurs.
- Panneau « Prochain : pseudo » à droite sur grand écran, en dessous sur téléphone (mise en page flex avec retour à la ligne) : message dans une bulle verte, boutons Ouvrir WhatsApp, Marquer comme envoyé, Passer ce client, et A répondu STOP conservé.
- Passer ce client : déplace le client en fin de liste pour la session en cours, sans appel réseau ni écriture en base.
- Zones tactiles de 44 pixels, libellés en français, couleur or E8A020 et fonds sombres.
- data-testid d'origine conservés (campaign-send-queue, queue-counter, queue-scenario) ; actions sent et stop de l'API inchangées.

## Diffère de la maquette
- Statuts « lien ouvert » et « a commandé » NON faits : ils exigent un suivi des ouvertures de lien qui n'existe pas et demanderait une migration SQL, hors périmètre de ce ticket. Seuls les statuts réellement connus sont affichés (À envoyer, Prochain, Envoyé).
- Statut « Refusé si STOP » : un client refusé est exclu de la file par le calcul existant (computeQueue), il n'apparaît donc pas dans la liste et n'a pas de badge.
- Le bouton Passer ce client est désactivé quand il reste un seul client à envoyer.
- L'ordre « passé » est local à la session : il est perdu au rechargement de la page.
- Rendu visuel et disposition (grand écran / téléphone) non vérifiés dans un navigateur.

## Commandes exécutées et résultats
- npx tsc --noEmit : exit 0, aucune erreur
- node --import ./tests/helpers/register.mjs --test tests/campaign-queue-screen.test.mjs tests/admin-campaign-sends.test.mjs tests/campaign-variables.test.mjs tests/admin-campaigns.test.mjs : exit 0, 45 tests, 45 pass, 0 fail (avertissements Node MODULE_TYPELESS_PACKAGE_JSON et DEP0205 sans lien avec le ticket)

## Interdits respectés
Aucune base modifiée, aucune migration, aucun commit, aucun push, aucun déploiement, aucun envoi à un client, WhatsApp non ouvert.

Statut final : PASS
