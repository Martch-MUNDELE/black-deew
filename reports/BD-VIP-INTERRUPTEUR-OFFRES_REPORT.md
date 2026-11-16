# BD-VIP-INTERRUPTEUR-OFFRES — Rapport (BLAC-P2-017)

Statut final : PASS

BLACK DEEW : interrupteur « Recevoir les nouvelles offres » à la demande d'accès VIP. Le code envoie le choix avec la demande et la route l'ajoute à l'insertion, avec un repli si les colonnes de la migration n'existent pas encore.

IMPORTANT : aucune exécution sur une vraie base. Tous les contrôles d'insertion ci-dessous ont été faits sur une base simulée en mémoire (tests/helpers/fake-supabase.mjs et strict-fake-db.mjs), sans réseau et sans Supabase. Ce rapport ne prouve pas le comportement sur la base réelle.

## Modifications
- app/api/vip-request/route.ts : lecture de marketing_opt_in (booléen uniquement ; toute autre valeur traitée comme absente, sans erreur). Ajout à l'insertion de marketing_opt_in, marketing_opt_in_at (date courante) et marketing_opt_in_source = demande. Si l'insertion échoue parce qu'une des trois colonnes est inconnue (codes 42703 ou PGRST204 citant l'une d'elles), une seule nouvelle insertion sans ces colonnes, avec avertissement journalisé. Toute autre erreur garde le comportement actuel. Pré-vérification, doublons, notification et validations inchangés.
- components/VipAccessRequestForm.tsx : état marketingOptIn initial vrai ; carte avec bouton role="switch", aria-checked et libellé associé ; deux phrases d'aide selon l'état ; Oui (fond or) / Non (grisé) ; hauteur minimale 44 px ; ligne « Tu peux changer ce choix à tout moment depuis ton compte VIP. » sous le bouton d'envoi ; marketing_opt_in dans le corps JSON.
- tests/vip-request-marketing-consent.test.mjs : 17 tests.

## Commandes exécutées et résultats réels
- node --import ./tests/helpers/register.mjs --test tests/vip-request-marketing-consent.test.mjs : exit 0, 17 tests, 17 pass, 0 fail (base simulée). Couvre : vrai avec booléen, date et source demande ; faux ; champ absent et 7 valeurs non booléennes sans colonnes d'accord ; base simulée refusant les colonnes inconnues (2 insertions, la seconde sans elles, réponse 201) ; autre erreur d'insertion (500, une seule tentative) ; 400 champs manquants ; 409 doublon ; lecture du texte du formulaire.
- npx tsc --noEmit : exit 0.
- npm test, premier passage : exit 1, un échec dans tests/vip-marketing-consent-migration.test.mjs (autre ticket, fichier supabase/migrations/20261103_bd_vip_marketing_consent.sql). Cause non établie avec certitude : le fichier SQL a été modifié à 00:28, pendant ce passage, ce qui est probable mais non vérifié.
- npm test, second passage : exit 0, 264 tests, 264 pass, 0 fail.
- Aucune assertion existante supprimée ou affaiblie.

## Limites
- Aucune preuve d'exécution sur une vraie base : base simulée uniquement.
- Affichage non vérifié dans un navigateur (lecture du texte du formulaire et tsc seulement).
- Les colonnes marketing_opt_in, marketing_opt_in_at et marketing_opt_in_source sont à appliquer par la migration préparée par un autre ticket, non appliquée ici ; d'ici là, la demande est enregistrée sans le choix.
- Le contrat annonce artifact_type=sql_test, alors que le ticket interdit tout script SQL et demande un test node, et que seules quatre zones d'écriture sont autorisées : aucun fichier SQL de test n'a été créé.

## Interdits respectés
Aucune base modifiée, aucun SQL exécuté, aucun secret lu, aucun push, aucun déploiement.

## Points non levables signalés par le validateur MDH
- « Preuve d'exécution base » : impossible dans ce ticket (allowSupabase=false, remote_database_write et schema_mutation interdits, aucun SQL exécuté). Les contrôles d'insertion ont tourné uniquement sur base simulée, comme demandé par le ticket. La vérification sur la vraie base reste à faire après application de la migration préparée par l'autre ticket.
- « sql_test sans fichier SQL » : le contrat annonce artifact_type=sql_test, alors que le ticket demande un test node, interdit tout SQL et limite l'écriture à quatre fichiers. Le livrable de test est tests/vip-request-marketing-consent.test.mjs. Le type du ticket devrait être corrigé en test.
