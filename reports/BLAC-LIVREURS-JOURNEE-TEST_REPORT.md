# BLAC-LIVREURS-JOURNEE — Simulation d'une journée de livreur

Rapport généré automatiquement par `tests/driver-day-simulation.test.mjs` (faux client de base de données en mémoire, aucun réseau, aucune vraie base).
Livreur simulé : Karim. Produits VIP : Cuvée Or, Réserve Noire (+ Eau minérale, non VIP, pour le refus). Seuil de stock bas : 3.
Limite : les mouvements de stock « livré » sont écrits par le test avec `addStockMovement` (comme le ferait la livraison), sans passer par la route `mark-livree`.
Statut final : PASS

Résultat des contrôles du scénario : tous les contrôles précédents ont réussi.

## Étape 1 — Journée 1 : ouverture (fonds 100, 6 × Cuvée Or, 4 × Réserve Noire)

Le chargement de « Eau minérale » (produit non VIP) est refusé (message « Produit non VIP refusé ») et n'écrit rien, à l'ouverture comme en cours de session.

| Indicateur | Valeur |
|---|---|
| Monnaie d'ouverture | 100.00 USD |
| Compléments de monnaie | 0.00 USD |
| Monnaie donnée au total | 100.00 USD |
| Argent encaissé (livraisons livrées) | 0.00 USD |
| Frais livreur | 0.00 USD |
| Net à remettre | 100.00 USD |
| Argent sur le livreur (monnaie en main) | 100.00 USD |
| Monnaie rendue | 0.00 USD |
| Monnaie gardée | 0.00 USD |

| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |
|---|---|---|---|---|---|
| Cuvée Or | 6 | 0 | 0 | 0 | 6 |
| Réserve Noire | 4 | 0 | 0 | 0 | 4 |

Alertes de stock : aucune

## Étape 2 — Journée 1 : livraison n°1 (o1)

Livraison o1 : encaissé 45, frais 5, 2 × Cuvée Or. Ignorées par le calcul : une course « assigned » de 99 et une livraison d'un autre livreur de 500.

| Indicateur | Valeur |
|---|---|
| Monnaie d'ouverture | 100.00 USD |
| Compléments de monnaie | 0.00 USD |
| Monnaie donnée au total | 100.00 USD |
| Argent encaissé (livraisons livrées) | 45.00 USD |
| Frais livreur | 5.00 USD |
| Net à remettre | 140.00 USD |
| Argent sur le livreur (monnaie en main) | 100.00 USD |
| Monnaie rendue | 0.00 USD |
| Monnaie gardée | 0.00 USD |

| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |
|---|---|---|---|---|---|
| Cuvée Or | 6 | 2 | 0 | 0 | 4 |
| Réserve Noire | 4 | 0 | 0 | 0 | 4 |

Alertes de stock : aucune

## Étape 3 — Journée 1 : livraison n°2 (o2), Cuvée Or au seuil

Cuvée Or tombe à 3 = seuil : alerte « stock bas ». À 4 il n'y en avait pas.

| Indicateur | Valeur |
|---|---|
| Monnaie d'ouverture | 100.00 USD |
| Compléments de monnaie | 0.00 USD |
| Monnaie donnée au total | 100.00 USD |
| Argent encaissé (livraisons livrées) | 75.00 USD |
| Frais livreur | 10.00 USD |
| Net à remettre | 165.00 USD |
| Argent sur le livreur (monnaie en main) | 100.00 USD |
| Monnaie rendue | 0.00 USD |
| Monnaie gardée | 0.00 USD |

| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |
|---|---|---|---|---|---|
| Cuvée Or | 6 | 3 | 0 | 0 | 3 |
| Réserve Noire | 4 | 0 | 0 | 0 | 4 |

Alertes de stock : Livreur Karim : stock bas de Cuvée Or : 3 restant

## Étape 4 — Journée 1 : livraison n°3 (o3), Réserve Noire épuisée

| Indicateur | Valeur |
|---|---|
| Monnaie d'ouverture | 100.00 USD |
| Compléments de monnaie | 0.00 USD |
| Monnaie donnée au total | 100.00 USD |
| Argent encaissé (livraisons livrées) | 135.00 USD |
| Frais livreur | 20.00 USD |
| Net à remettre | 215.00 USD |
| Argent sur le livreur (monnaie en main) | 100.00 USD |
| Monnaie rendue | 0.00 USD |
| Monnaie gardée | 0.00 USD |

| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |
|---|---|---|---|---|---|
| Cuvée Or | 6 | 3 | 0 | 0 | 3 |
| Réserve Noire | 4 | 4 | 0 | 0 | 0 |

Alertes de stock : Livreur Karim : plus de produit Réserve Noire ; Livreur Karim : stock bas de Cuvée Or : 3 restant

## Étape 5 — Journée 1 : compléments de monnaie (+50) et de stock (+5 Réserve Noire)

Réserve Noire remonte à 5 : l'alerte « vide » disparaît.

| Indicateur | Valeur |
|---|---|
| Monnaie d'ouverture | 100.00 USD |
| Compléments de monnaie | 50.00 USD |
| Monnaie donnée au total | 150.00 USD |
| Argent encaissé (livraisons livrées) | 135.00 USD |
| Frais livreur | 20.00 USD |
| Net à remettre | 265.00 USD |
| Argent sur le livreur (monnaie en main) | 150.00 USD |
| Monnaie rendue | 0.00 USD |
| Monnaie gardée | 0.00 USD |

| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |
|---|---|---|---|---|---|
| Cuvée Or | 6 | 3 | 0 | 0 | 3 |
| Réserve Noire | 9 | 4 | 0 | 0 | 5 |

Alertes de stock : Livreur Karim : stock bas de Cuvée Or : 3 restant

## Étape 6 — Journée 1 : livraison n°4 (o4), contexte de clôture

Calcul à la main : net à remettre = 150 (fonds + compléments) + 160 (encaissé) − 25 (frais) = 285.

| Indicateur | Valeur |
|---|---|
| Monnaie d'ouverture | 100.00 USD |
| Compléments de monnaie | 50.00 USD |
| Monnaie donnée au total | 150.00 USD |
| Argent encaissé (livraisons livrées) | 160.00 USD |
| Frais livreur | 25.00 USD |
| Net à remettre | 285.00 USD |
| Argent sur le livreur (monnaie en main) | 150.00 USD |
| Monnaie rendue | 0.00 USD |
| Monnaie gardée | 0.00 USD |

| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |
|---|---|---|---|---|---|
| Cuvée Or | 6 | 4 | 0 | 0 | 2 |
| Réserve Noire | 9 | 5 | 0 | 0 | 4 |

Alertes de stock : Livreur Karim : stock bas de Cuvée Or : 2 restant

## Étape 7 — Fin de journée 1 : clôtures avec écart (toutes refusées, rien d'écrit)

| Cas refusé | Message du système |
|---|---|
| Monnaie rendue 100 + gardée 40 ≠ 150 en main | Monnaie : rendu (100) + gardé (40) doit être égal à la monnaie en main (150). |
| Cuvée Or rendu 1 + gardé 0 ≠ 2 en main | Produit p1 : rendu (1) + gardé (0) doit être égal à la quantité en main (2). |
| Réserve Noire rendu 5 + gardé 0 ≠ 4 en main | Produit p2 : rendu (5) + gardé (0) doit être égal à la quantité en main (4). |
| Aucune décision pour Réserve Noire (4 en main) | Produit p2 : aucune décision de clôture (en main : 4). |
| Décision pour un produit inconnu | Décision de clôture pour un produit inconnu : p9. |

## Étape 8 — Fin de journée 1 : clôture correcte (rendu 100 + gardé 50 = 150 en main)

Stock rendu / gardé : Cuvée Or 1 / 1 (= 2 en main), Réserve Noire 1 / 3 (= 4 en main). Session fermée, collecté 160, net remis 285, livreur passé en inactif.

Historique affiché : Rendu 100 USD · Gardé 50 USD · Cuvée Or : rendu 1 / gardé 1 · Réserve Noire : rendu 1 / gardé 3

| Indicateur | Valeur |
|---|---|
| Monnaie d'ouverture | 100.00 USD |
| Compléments de monnaie | 50.00 USD |
| Monnaie donnée au total | 150.00 USD |
| Argent encaissé (livraisons livrées) | 160.00 USD |
| Frais livreur | 25.00 USD |
| Net à remettre | 285.00 USD |
| Argent sur le livreur (monnaie en main) | 0.00 USD |
| Monnaie rendue | 100.00 USD |
| Monnaie gardée | 50.00 USD |

| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |
|---|---|---|---|---|---|
| Cuvée Or | 6 | 4 | 1 | 1 | 0 |
| Réserve Noire | 9 | 5 | 1 | 3 | 0 |

Alertes de stock : aucune

## Étape 9 — Journée 2 : ouverture avec le report (50 de monnaie, 1 × Cuvée Or, 3 × Réserve Noire)

Report lu par prepareOpening : monnaie 50, Cuvée Or 1, Réserve Noire 3 = exactement ce qui avait été gardé le soir de la journée 1.

| Indicateur | Valeur |
|---|---|
| Monnaie d'ouverture | 50.00 USD |
| Compléments de monnaie | 0.00 USD |
| Monnaie donnée au total | 50.00 USD |
| Argent encaissé (livraisons livrées) | 0.00 USD |
| Frais livreur | 0.00 USD |
| Net à remettre | 50.00 USD |
| Argent sur le livreur (monnaie en main) | 50.00 USD |
| Monnaie rendue | 0.00 USD |
| Monnaie gardée | 0.00 USD |

| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |
|---|---|---|---|---|---|
| Cuvée Or | 1 | 0 | 0 | 0 | 1 |
| Réserve Noire | 3 | 0 | 0 | 0 | 3 |

Alertes de stock : Livreur Karim : stock bas de Cuvée Or : 1 restant ; Livreur Karim : stock bas de Réserve Noire : 3 restant

## Étape 10 — Journée 2 : livraison o5 (encaissé 20, frais 5, 1 × Réserve Noire)

Calcul à la main : net à remettre = 50 (report) + 20 (encaissé) − 5 (frais) = 65. La journée 1 reste à 160 encaissés / 285 net.

| Indicateur | Valeur |
|---|---|
| Monnaie d'ouverture | 50.00 USD |
| Compléments de monnaie | 0.00 USD |
| Monnaie donnée au total | 50.00 USD |
| Argent encaissé (livraisons livrées) | 20.00 USD |
| Frais livreur | 5.00 USD |
| Net à remettre | 65.00 USD |
| Argent sur le livreur (monnaie en main) | 50.00 USD |
| Monnaie rendue | 0.00 USD |
| Monnaie gardée | 0.00 USD |

| Produit VIP | Chargé (dont compléments) | Livré | Rendu | Gardé | En main |
|---|---|---|---|---|---|
| Cuvée Or | 1 | 0 | 0 | 0 | 1 |
| Réserve Noire | 3 | 1 | 0 | 0 | 2 |

Alertes de stock : Livreur Karim : stock bas de Cuvée Or : 1 restant ; Livreur Karim : stock bas de Réserve Noire : 2 restant

## Récapitulatif à comparer avec l'écran

| Mesure | Journée 1 | Journée 2 |
|---|---|---|
| Monnaie d'ouverture | 100.00 USD | 50.00 USD |
| Compléments de monnaie | 50.00 USD | 0.00 USD |
| Argent encaissé | 160.00 USD | 20.00 USD |
| Frais livreur | 25.00 USD | 5.00 USD |
| Net à remettre | 285.00 USD | 65.00 USD |
| Monnaie rendue / gardée | 100.00 USD / 50.00 USD | pas encore clôturée |
| Report vers le lendemain | monnaie 50.00 USD ; Cuvée Or 1 ; Réserve Noire 3 | — |

Formule : net à remettre = monnaie donnée + encaissé − frais. Journée 1 : 150 + 160 − 25 = 285. Journée 2 : 50 + 20 − 5 = 65.

## Défauts constatés dans le code des livreurs

Aucun défaut révélé par ce scénario (aucune correction du code applicatif faite).
