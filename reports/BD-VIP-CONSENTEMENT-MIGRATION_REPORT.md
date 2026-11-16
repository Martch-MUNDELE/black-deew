# BD-VIP-CONSENTEMENT-MIGRATION — Rapport de validation

Ticket : BLAC-P2-020 — BLACK DEEW : migration SQL du consentement aux offres VIP (fichier préparé, non appliqué)

Statut final : BLOCKED
Raison du blocage : le validateur du Hub classe le ticket en sql_test et exige une preuve d execution en base, alors que le ticket interdit toute execution SQL et toute connexion a une base ; la migration, le test (8/8) et npm test (264/264) sont OK.

Portée des contrôles : le fichier de migration est écrit et contrôlé uniquement comme texte (test de lecture du fichier). Le SQL n'a PAS été exécuté, aucune base n'a été contactée, aucune exécution en base n'est revendiquée. Aucun secret lu, aucun push, aucun déploiement.

## Contenu du SQL (résumé)

Fichier : supabase/migrations/20261103_bd_vip_marketing_consent.sql

- En-tête « NON APPLIQUÉE : ne pas exécuter sans validation humaine », comme les autres migrations préparées.
- Sur public.vip_access_requests, trois ajouts idempotents (add column if not exists) :
  - marketing_opt_in boolean, nullable, sans valeur par défaut.
  - marketing_opt_in_at timestamptz, nullable.
  - marketing_opt_in_source text, nullable, avec la contrainte nommée vip_access_requests_marketing_opt_in_source_check limitant les valeurs à demande, encart, admin.
- Commentaires de colonne en français expliquant les trois états.
- Aucune règle d'accès, aucun droit, aucune instruction destructrice hors commentaire.
- Retour arrière en commentaire de fin, non exécuté.

## États de la colonne marketing_opt_in

- NULL : accord non confirmé (les 64 VIP déjà approuvés). Exclus des envois tant qu'ils n'ont pas choisi.
- true : le client a accepté de recevoir des offres (interrupteur actif par défaut à la demande).
- false : le client a refusé.

marketing_opt_in_at et marketing_opt_in_source restent NULL tant que le client n'a pas choisi.

## Ordre conseillé à Martial

1. Relire et valider explicitement le fichier SQL.
2. Appliquer la migration à la base de black-deew (action humaine, non faite par ce ticket).
3. Seulement ensuite, publier le formulaire avec l'interrupteur (la migration passe avant la sortie du formulaire).
4. Puis le module Marketing, qui n'enverra qu'aux VIP dont marketing_opt_in vaut true.

L'application de la migration attend la confirmation explicite de Martial.

## Retour arrière (non exécuté)

- Test du ticket (lecture du fichier SQL comme texte) :
  - Premier passage : 7 tests conformes, 1 en échec (regex du test trop stricte sur la dernière ligne du retour arrière ; le SQL n'était pas en cause).
  - Après correction de la regex : tests de lecture du fichier SQL comme texte (aucune base, aucun moteur SQL) : 8 sur 8 conformes.
- npm test :
  - Premier passage : en échec (même cause).
  - Après correction : suite JavaScript du dépôt, sans base : 264 tests sur 264 conformes.
- Contrôles grep sur le texte du SQL : 0 occurrence de « polic », aucun « default » en code, trois « add column if not exists ».
- migration : supabase/migrations/20261103_bd_vip_marketing_consent.sql
- test : tests/vip-marketing-consent-migration.test.mjs
- rapport : reports/BD-VIP-CONSENTEMENT-MIGRATION_REPORT.md
- Aucune exécution SQL ni validation par un moteur PostgreSQL : la syntaxe est vérifiée par lecture de texte seulement.
- Le dossier de travail du Hub n'a pas de dépôt Git : rien n'a été commité.

## Blocage du validateur de complétion

Le travail demandé par le ticket est réalisé : migration écrite et non appliquée, test du ticket 8/8, npm test 264/264, rapport complet. Le statut est BLOCKED car le validateur du Hub classe le ticket en sql_test et réclame ce que le ticket interdit :

- « mutation de schéma » : le fichier contient des alter table, c'est la migration demandée.
- « sans instruction SQL exécutable » : un fichier de test SQL est attendu, alors que le ticket demande une migration non appliquée.
- « exécution runtime sans preuve base » : aucune exécution en base n'a eu lieu, le ticket l'interdit ; aucune preuve n'est inventée.

Sorties possibles : reclasser le ticket en artifact_type=migration, ou autoriser explicitement une exécution sur une base de test jetable. L'application en production attend la confirmation explicite de Martial.
