# BD-OFFRE-PUBLIQUE - Rapport

Statut final : PASS

Page publique d'une offre de campagne (offre?c=<id>) avec apercu WhatsApp (titre, description, image) via Open Graph.

## Ce qui a ete fait
- lib/campaign-public.ts : buildCampaignPublicUrl(campaignId) produit <site>/offre?c=<id> (base NEXT_PUBLIC_SITE_URL, meme regle que app/actions/facture.ts) ; loadPublicCampaign(db, campaignId, now) renvoie uniquement name, message (sans ligne STOP), promotionName, startsAt, endsAt pour une campagne au statut ready dans ses dates, sinon null ; null aussi si la table est absente ou en erreur, jamais d'exception.
- app/offre/page.tsx : composant serveur lisant searchParams.c ; generateMetadata avec title, description et openGraph (plus twitter) ; page lisible sur telephone (nom de l'offre, message, dates en francais, bouton Commander vers l'accueil) ; etat neutre « Cette offre n'est plus disponible » avec noindex quand loadPublicCampaign renvoie null. Aucune donnee client lue ni affichee.
- lib/campaign-sends.ts : le message WhatsApp contient une ligne « Voir l'offre : <adresse> » avant la ligne STOP, une seule fois (une ancienne ligne de ce type est remplacee) ; buildWhatsappLink accepte en 3e argument l'identifiant de la campagne et construit l'adresse via buildCampaignPublicUrl ; sans 3e argument, comportement precedent (STOP seul).
- components/admin/CampaignsPanel.tsx : pour les campagnes ready, affichage de l'adresse publique et bouton pour la copier.
- tests/campaign-public-page.test.mjs : campagne valide, ligne STOP retiree, brouillon refuse, annulee refusee, hors dates refuse, identifiant inconnu ou vide, table absente, adresse, message avec lien avant STOP et STOP une seule fois, sans identifiant pas de lien, aucune donnee client dans le code de la page, openGraph present.

## Commandes executees et resultats
- node --import ./tests/helpers/register.mjs --test tests/campaign-public-page.test.mjs : 11 tests, 11 pass, 0 fail (un test du message WhatsApp avait d'abord echoue car il ne correspondait pas a la signature de buildWhatsappLink, modifiee entre-temps dans lib/campaign-sends.ts ; test aligne sur l'identifiant de campagne)
- node --import ./tests/helpers/register.mjs --test tests/admin-campaign-sends.test.mjs tests/admin-campaigns.test.mjs : 24 tests, 24 pass, 0 fail, ces tests n'ont pas ete modifies
- npx tsc --noEmit : exit 0, aucune erreur

## Limites
- L'apercu reel dans WhatsApp ne se valide qu'apres mise en ligne par Martial.
- Page et panneau non verifies dans un navigateur.
- La table campaigns n'existe pas encore sur la base (migration non appliquee) : en attendant, la page affiche l'etat neutre.
- L'image d'apercu est l'image generique du site (og-image.png).
- Le dossier app/layout.tsx n'a pas ete modifie.

## Interdits respectes
Aucune base modifiee, aucune migration appliquee, aucun commit, aucun push, aucun deploiement, aucun envoi.
