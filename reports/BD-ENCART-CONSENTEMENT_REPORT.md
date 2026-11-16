# BD-ENCART-CONSENTEMENT - Rapport (BLAC-P3-028)

Black Deew : écran 6 du site, encart « Des offres rien que pour toi ? » pour les VIP approuvés qui n'ont jamais répondu.

IMPORTANT : vérification par tests sur base simulée en mémoire et lecture du source ; aucun contrôle dans un navigateur ni sur une vraie base.

## Fichiers modifiés
- app/api/vip/marketing-consent/route.ts (nouveau) : GET (401 sans session ; renvoie state unknown/accepted/refused et available ; colonnes absentes ou lecture en échec : unknown + available false) ; POST { opt_in: boolean } (401 sans session, 400 si non booléen, 404 si aucune ligne, 503 si colonnes absentes ; met à jour uniquement marketing_opt_in, marketing_opt_in_at, marketing_opt_in_source = encart ; téléphone lu uniquement dans le cookie de session).
- components/VipMarketingConsentSheet.tsx (nouveau) : feuille accessible (dialog, aria-modal, aria-labelledby, interrupteur role switch Oui/Non, zones d'au moins 44 px, focus sur la feuille à l'ouverture), ouverte seulement si available vrai et state unknown, report de 7 jours en localStorage avec try/catch, message d'erreur en français et feuille laissée ouverte en cas d'échec.
- app/(public)/vip/page.tsx : import et montage de la feuille quand la session VIP est obtenue (2 lignes ajoutées).
- tests/vip-marketing-consent-sheet.test.mjs : 13 tests.
- app/api/vip-request/route.ts : non modifié (lignes modifiées selon git diff : 0 fichier).

## Correspond à la maquette
Titre, texte, interrupteur « Recevoir les offres VIP » (Oui par défaut), bouton « Confirmer mon choix », lien « Me le redemander plus tard », phrase « Tu peux changer ce choix à tout moment depuis ton compte VIP. », texte d'aide Non « Tu ne recevras aucune offre. Tu garderas ton accès VIP. », palette de la page VIP.

## Différences
- Texte d'aide quand l'interrupteur est sur Oui : « Tu recevras nos offres réservées aux VIP. » écrit sans accès au fichier de maquette (ConsentEncart.dc.html non consulté) ; à comparer avec la maquette.
- Source enregistrée : encart (valeur autorisée par la contrainte de la migration).
- Le POST met à jour toutes les lignes dont les 9 derniers chiffres du téléphone correspondent, pour rester cohérent avec la lecture.
- Animation d'entrée et fond assombri : choix d'implémentation, non vérifiés visuellement.
- Aucune migration ni écriture de schéma n'a été nécessaire.

## Commandes exécutées et résultats
- npx tsc --noEmit : exit 0
- node --import ./tests/helpers/register.mjs --test tests/vip-marketing-consent-sheet.test.mjs : exit 0 ; ℹ tests 13 ℹ pass 13 ℹ fail 0 
- node --import ./tests/helpers/register.mjs --test tests/vip-request-marketing-consent.test.mjs tests/vip-marketing-consent-migration.test.mjs tests/vip-routes.test.mjs tests/vip-session.test.mjs : exit 0 ; ℹ tests 48 ℹ pass 48 ℹ fail 0 

## Limites
- Affichage, focus et disposition responsive non vérifiés dans un navigateur.
- Comportement sur la vraie base non vérifié.
- Le lien « depuis ton compte VIP » mentionné dans la phrase n'existe pas dans ce ticket.

## Interdits respectés
Aucune migration, aucune base modifiée, aucun commit, aucun push, aucun déploiement.

Statut final : PASS
