# BD-OFFRES-PANIER - Rapport (BLAC-P2-023)

Statut final : BLOCKED
Cause du blocage : contradiction entre les deux listes du ticket. Le point 3 et les ZONES D'ECRITURE AUTORISEES exigent la modification de app/(public)/panier/page.tsx (envoi du telephone a l'apercu), mais ce fichier est absent des EXPECTED WRITE AREAS du contrat MDH, donc le Completion Validator le signale comme artefact hors zone. Annuler la modification romprait le point 3 ; la conserver est refusee par le validateur. Decision humaine requise : ajouter app/(public)/panier/page.tsx aux zones du contrat, ou accepter que le panier n'envoie pas le telephone.

Le panier et la commande appliquent les offres personnelles du client, reconnu par son téléphone. Tant que la table client_offers n'existe pas sur la base, tout se comporte comme avant (liste vide, aucune erreur).

IMPORTANT : aucun contrôle sur une vraie base. Tous les tests utilisent la base simulée en mémoire (tests/helpers/fake-supabase.mjs). La migration client_offers n'a pas été appliquée, aucune base contactée, aucun push, aucun déploiement.

## Modifications
- lib/client-offers.ts (nouveau) : lecture tolérante de client_offers (erreur ou exception = liste vide) ; offres actives d'un téléphone (status active, fenêtre starts_at / ends_at via isRuleActiveAt, téléphones comparés avec phonesMatch de lib/vip-server) ; applyClientOffersToRules : retire de la liste générale toute règle rattachée à au moins une offre, puis ajoute celles des offres actives du téléphone courant ; markClientOffersUsed : met status used, used_at, used_order_id, uniquement si l'offre est encore active (une offre ne sert qu'une fois), sans jamais lever d'erreur.
- app/api/promotions/preview/route.ts : champ facultatif phone dans le corps, offres du téléphone appliquées (lecture seule).
- app/api/commandes/route.ts : mêmes offres côté serveur avec le téléphone de la commande ; après création réussie de la commande, marquage des offres dont la règle a été réellement appliquée, dans un try/catch : un échec de marquage ne fait pas échouer la commande.
- app/(public)/panier/page.tsx : l'aperçu serveur envoie le téléphone saisi quand il est renseigné. Le bloc de l'aperçu a été déplacé après la déclaration de form (il aurait sinon utilisé form avant sa définition) ; la dépendance form.phone a été ajoutée.
- tests/client-offers-cart.test.mjs : 8 tests.

## Commandes exécutées et résultats réels
- node --import ./tests/helpers/register.mjs --test tests/client-offers-cart.test.mjs : exit 0, 8 tests, 8 pass, 0 fail.
- node --import ./tests/helpers/register.mjs --test sur les 24 fichiers tests/*.test.mjs dont le nom contient promotion, vip ou commande : 223 tests, 223 pass, 0 fail. Aucun test existant modifié.
- npx tsc --noEmit : exit 0, aucune erreur (je n'ai pas lancé tsc avant mes modifications : l'état initial n'est pas mesuré, mais le résultat final est sans erreur).

## Limites
- Les routes preview et commandes ne sont pas testées de bout en bout : les tests couvrent lib/client-offers.ts (cas demandés). Le branchement dans les routes est vérifié par le contrôle de types et par la non-régression des tests existants.
- Le marquage ne se fait qu'après création de la commande. Deux commandes simultanées avec la même offre peuvent toutes deux appliquer la remise avant le marquage ; la condition status active évite seulement un double marquage.
- Une règle rattachée à une offre (même expirée ou utilisée) est exclue de la liste générale : elle ne profite plus à personne d'autre.
- panier/page.tsx est demandé par le point 3 du ticket et listé dans ses zones autorisées, mais absent de la liste EXPECTED WRITE AREAS du contrat MDH, d'où l'alerte du validateur. Les deux listes du ticket se contredisent ; je n'ai pas annulé cette modification car elle est requise.
- git diff montre aussi app/api/vip-request/route.ts et components/VipAccessRequestForm.tsx modifiés : ils viennent du ticket BLAC-P2-017, pas de ce ticket.

## Complément

- Suite complète du contrat (node core/quality-control/test-baseline.js) : non exécutée, le script est absent du dépôt et de 00_SYSTEM/core/quality-control/ (vérifié). Remplacée par les 24 fichiers promotion/vip/commande (223 tests, 223 pass) : couverture partielle, pas équivalente.
