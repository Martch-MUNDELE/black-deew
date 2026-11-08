# BLAC-PARCOURS-LIVREUR-COMPLET — Rapport du parcours livreur

Statut final : PASS

Scénario joué avec un faux client en mémoire (aucun réseau, aucune vraie base, aucun code de production modifié).

| Étape | Résultat | Détail |
|---|---|---|
| 1. Admin actif ; livreur Martch inactif puis activé | OK | admin reconnu ; Martch 'inactive' -> 'active' |
| 2. Ouverture de session (fonds 20, 20 × produit VIP) | OK | mouvement d'ouverture 20 ; chargement 20 ; products.stock inchangé (50) ; en main 20 |
| 3. Livreur actif redirigé vers /admin/driver | OK | rôle 'driver' ; /admin/orders -> /admin/driver ; /admin/driver sans redirection ; jamais ?error=acces |
| 4. Course assignée et visible (adresse, montant, lignes) | OK | course assignée au livreur avec adresse, total 35 et 1 ligne (3 × produit VIP). Lecture via le faux client : getDriverHome utilise le vrai client serveur (non couvert) |
| 5. Le livreur marque la course livrée (markOrderDelivered) | OK | markOrderDelivered ok:true, driverSessionUpdated:true |
| 6. Commande livrée, livraison delivered + montant, stock VIP embarqué décrémenté | OK | commande 'livrée' ; livraison 'delivered', encaissé 35 ; stock embarqué 20 -> 17 ; products.stock 50 ; session collecté 35, net 55 |
| 7. buildDeliveryFeed : course terminée (livreur libéré) | OK | fil admin : 1 course terminée, livreur 'Martch', 35 encaissés |

Limites : pas de navigateur ni de vraie base ; l'étape « accepte » n'a pas de fonction dédiée dans les repères du ticket (non couverte) ; la notification d'assignation (lib/driver-push.ts) est couverte par tests/driver-push.test.mjs.
