# BD-EN-TETES-MIGRATIONS - Rapport

Ticket : BLAC-P3-030 - Black Deew : corriger les en-têtes périmés « NON APPLIQUÉE » des cinq migrations du Marketing et les tests qui les vérifient.

IMPORTANT : ce ticket ne modifie que des commentaires SQL et des assertions de tests. Aucune base n'a été contactée, aucune instruction SQL n'a été changée, aucun commit, aucun push, aucun déploiement. Les trois migrations du 31 octobre (promotion_rules, promotion_benefits, order_items_promotion_fields) n'ont pas été touchées.

## Tableau avant / après des en-têtes SQL

| Fichier | Ligne | Avant | Après |
|---|---|---|---|
| 20261103_bd_vip_marketing_consent.sql | 2 | `-- NON APPLIQUÉE : ne pas exécuter sans validation humaine` | `-- APPLIQUÉE en production le 3 novembre 2026 (version Supabase 20261103202757) : ne pas réexécuter` |
| 20261103_bd_client_offers.sql | 1 | `-- BLAC-P2-022 : table des offres clients (campagnes Marketing). NON APPLIQUÉE : ne pas exécuter sans validation humaine` | `-- BLAC-P2-022 : table des offres clients (campagnes Marketing). APPLIQUÉE en production le 3 novembre 2026 (version Supabase 20261103202806) : ne pas réexécuter` |
| 20261103_bd_campaigns.sql | 1 | `-- BLAC-P2-025 : table des campagnes Marketing. NON APPLIQUÉE : ne pas exécuter sans validation humaine` | `-- BLAC-P2-025 : table des campagnes Marketing. APPLIQUÉE en production le 3 novembre 2026 (version Supabase 20261103202812) : ne pas réexécuter` |
| 20261103_bd_campaign_sends.sql | 1 | `-- BLAC-P2-026 : file d'envoi WhatsApp des campagnes. NON APPLIQUÉE : ne pas exécuter sans validation humaine` | `-- BLAC-P2-026 : file d'envoi WhatsApp des campagnes. APPLIQUÉE en production le 3 novembre 2026 (version Supabase 20261103202850) : ne pas réexécuter` |
| 20261104_bd_campaign_image.sql | 2 | `-- NON APPLIQUÉE : ne pas exécuter sans validation humaine.` | `-- APPLIQUÉE en production le 3 novembre 2026 (version Supabase 20261103211243) : ne pas réexécuter.` |

## Tests adaptés (assertions d'en-tête uniquement)

| Fichier | Modification |
|---|---|
| tests/vip-marketing-consent-migration.test.mjs | titre et expression régulière de l'en-tête : nouvelle mention APPLIQUÉE avec la version 20261103202757 |
| tests/client-offers-migration.test.mjs | titre et expression régulière : version 20261103202806 |
| tests/admin-campaigns.test.mjs | titre et expression régulière : version 20261103202812 |
| tests/admin-campaign-sends.test.mjs | titre, et l'assertion `/NON APPLIQUÉE/` sur tout le fichier devient la nouvelle mention vérifiée dans les 4 premières lignes (version 20261103202850) |

Toutes les autres assertions (RLS activée, aucune politique, aucun accès public, retour arrière, etc.) sont inchangées. Aucun test ne dépend de git ou de l'historique.

La migration d'image de campagne (20261104_bd_campaign_image.sql) n'a pas de test d'en-tête dédié dans les quatre fichiers demandés : seul son fichier SQL a été modifié.

## Preuve par git diff : seuls des commentaires SQL ont changé

- `git diff --stat` sur les cinq fichiers SQL : 5 files changed, 5 insertions(+), 5 deletions(-), une seule ligne par fichier.
- Filtre sur les lignes ajoutées ou supprimées qui ne commencent pas par `--` : résultat vide, donc aucune instruction SQL modifiée.
- Après modification, plus aucune occurrence de « NON APPLIQU » dans les cinq fichiers SQL ni dans les quatre tests.
- Les sauvegardes .bak créées par sed ont été supprimées (vérifié : aucun .bak restant).

## Commandes de test réellement exécutées

| Commande | Résultat |
|---|---|
| `node --import ./tests/helpers/register.mjs --test tests/vip-marketing-consent-migration.test.mjs tests/client-offers-migration.test.mjs tests/admin-campaigns.test.mjs tests/admin-campaign-sends.test.mjs` | exit 0, 42 tests, 42 pass, 0 fail |
| `npm test` (complet) | exit 0, 430 tests, 430 pass, 0 fail |
| `npx tsc --noEmit` | exit 0 |

## Limites

- Les versions Supabase viennent de la liste des migrations enregistrées citée dans le ticket ; elles n'ont pas été relues de nouveau en base pendant ce run (lecture seule interdite aux runs de réalisation ici).
- Aucun contrôle sur une vraie base ni dans un navigateur.
- Le dossier de travail n'était pas signalé comme dépôt Git par le Hub, mais git diff a bien fonctionné dans black-deew.

Statut final : PASS
