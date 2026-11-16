# BD-PAGE-OFFRE-ECRAN7 - Rapport

Black Deew : écran 7 du site, page publique de l'offre (lien WhatsApp) selon la maquette « Marketing VIP » (PagePromo).

IMPORTANT : vérification par tests sur le source ; aucun contrôle dans un navigateur ni sur une vraie base.

## Fichiers modifiés
- app/offre/page.tsx (seul fichier applicatif modifié ; ajout de l'import isValidCampaignImageUrl, de styles, du composant ClockIcon et refonte du rendu d'une offre valide)
- tests/campaign-offer-page-layout.test.mjs (nouveau)
- reports/BD-PAGE-OFFRE-ECRAN7_REPORT.md (ce rapport)

## Correspond à la maquette
- En-tête « Black Deew » avec badge « Offre VIP ».
- Visuel de la campagne en grand, affiché seulement si imageUrl passe isValidCampaignImageUrl (même contrôle que pour Open Graph), avec texte alternatif ; sinon aucune image (pas d'image de remplacement).
- Titre de l'offre, nom de la promotion en phrase simple (« Profite de la promotion « … ». »), message de la campagne.
- Ligne de validité avec icône d'horloge, texte issu de describeDates.
- Encadré « Ton offre est déjà dans ton compte : elle s'ajoutera à ton panier. ».
- Bouton « Commander avec l'offre » vers /panier (page existante : app/(public)/panier/page.tsx).
- Mention « Connexion VIP demandée si tu n'es pas déjà connecté. ».
- Téléphone d'abord : colonne de 480 px maximum centrée, zones tactiles d'au moins 44 px, couleurs actuelles de la page.
- Cas offre introuvable ou terminée : titre « Cette offre n'est plus disponible », texte et bouton « Voir la carte » inchangés.
- generateMetadata, Open Graph, loadPublicCampaign et les données lues : non modifiés.

## Diffère de la maquette
- Phrase de gain « Tu as gagné −X % » non faite : la page publique ne reçoit pas le pourcentage de la promotion (PublicCampaign ne contient que name, message, promotionName, imageUrl, dates). L'afficher exigerait de modifier la lecture des données (loadPublicCampaign), hors périmètre de ce ticket (affichage uniquement).
- Le bouton mène au panier sans vérifier côté page que l'offre est bien présente dans le compte du client : la page publique ne lit aucune donnée client, par règle du ticket.

## Commandes réellement exécutées
- npx tsc --noEmit : exit 0, aucune erreur
- node --import ./tests/helpers/register.mjs --test tests/campaign-offer-page-layout.test.mjs tests/campaign-public-page.test.mjs : exit 0, 19 tests, 19 pass, 0 fail (8 nouveaux + 11 existants)
- ls "app/(public)/panier/page.tsx" : fichier présent

## Limites
- Affichage et disposition responsive non vérifiés dans un navigateur.
- Comportement sur la vraie base non vérifié.

## Interdits respectés
Aucune base modifiée, aucune migration, aucun SQL, aucune nouvelle route, aucun commit, aucun push, aucun déploiement.

Statut final : PASS
