# BLAC-PUSH-LIVREUR — Rapport (BLAC-P3-050)

Notifications push pour le livreur : quand l'admin assigne une commande, CE livreur est notifie ; les alertes admin n'atteignent plus les livreurs.

## Fichiers modifies / crees
- supabase/migrations/20261108_bd_push_driver_id.sql (nouveau, seulement ECRIT, non execute)
- app/api/push/subscribe/route.ts (driver_id lu depuis la session via getAdminRole ; endpoint existant => mise a jour du driver_id)
- app/api/push/send/route.ts (n'envoie qu'aux abonnes dont driver_id est null)
- lib/driver-push.ts (nouveau : buildAssignmentPush, sendDriverPush)
- app/api/driver/notify-assignment/route.ts (nouveau : POST { order_id }, admin seulement)
- app/admin/commandes/page.tsx (handleConfirm : appel fire-and-forget apres l'insert order_deliveries, rien d'autre)
- components/pwa/PushNotificationManager.tsx (texte livreur sur /admin/driver)
- tests/driver-push.test.mjs (nouveau)

## Comportement avant / apres
- Avant : push_subscriptions sans lien livreur ; /api/push/send envoyait a tous les abonnes (un livreur abonne recevait les alertes « nouvelle commande » admin) ; aucune notification a l'assignation.
- Apres : un abonnement pris depuis une session livreur porte driver_id = id du livreur de la session (jamais une valeur du corps) ; sans session ou en admin, driver_id reste null. Un endpoint deja connu voit son driver_id mis a jour. /api/push/send ne cible que driver_id null. A l'assignation, le serveur relit orders.driver_id et le creneau, puis envoie « Nouvelle livraison » + creneau (ex. « Samedi 7 novembre, 18:00-19:00 ») au seul livreur assigne, sans nom, telephone ni adresse client, url /admin/driver. 401 sans session, 403 pour un livreur, 200 { sent: 0 } sans livreur, jamais de 500 sur erreur d'envoi (journalise). L'echec de la notification n'affecte pas l'assignation.

## Tests lances (mesures reelles)
- node --test tests/driver-push.test.mjs : 8 tests, 8 pass, 0 fail.
- npm test (black-deew) : 607 tests, 607 pass, 0 fail, 0 cancelled, 0 skipped. L'echec connu de tests/BLAC-P3-038.test.mjs (non suivi, hors ticket) n'est pas apparu dans cette execution.
- npx tsc --noEmit : code de sortie 0.
- npx eslint sur les six fichiers de code : 0 erreur, 1 avertissement (react-hooks/exhaustive-deps sur un useEffect existant de PushNotificationManager, dependance isLocalMdh, non lie au changement).

## Commande SQL a executer par Martial
IMPORTANT : executer ce SQL AVANT de deployer le code. Sans la colonne, /api/push/send (filtre sur driver_id) renvoie une erreur et les alertes admin s'arretent.
- Les abonnements deja enregistres par un livreur avant la migration ont driver_id null et continueront a recevoir les alertes admin tant que le livreur ne se reabonne pas.
- /api/push/send reste sans authentification (existant, hors ticket).
Reception reelle de la notification (iOS/Android, PWA installee), ouverture de /admin/driver au toucher, texte affiche par PushNotificationManager sur mobile, abonnement reel depuis une session livreur, mise a jour du driver_id quand un telephone change de compte, execution du SQL sur la vraie base. Aucun navigateur, aucune base, aucun envoi push reel utilises.
