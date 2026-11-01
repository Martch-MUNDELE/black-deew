# MART-BD-PROMOTIONS-PANIER — Rapport (BLAC-P3-009)

Statut final : PASS

## Réalisé
- `app/api/promotions/preview/route.ts` : route POST en lecture seule. Elle relit produits et prix en base (les prix envoyés par le client sont ignorés), reconstruit les lignes comme la route de commande, applique `applyPromotions` avec les mêmes règles actives et le même contrôle VIP (cookie signé, `products.is_vip`). Elle renvoie `discount_total`, `gifts`, `labels`, `free_delivery`. Aucune écriture, aucun compteur d'usage modifié. Réponse vide sans erreur si les clés serveur sont absentes ou en cas d'échec.
- `app/(public)/panier/page.tsx` : appel de la route à chaque changement du panier ou du code promo (délai de 400 ms, requête annulée si le panier change). Affichage du sous-total avant remise, d'une ligne « Promotion » en vert, du total provisoire après remise, des produits offerts, et du total à payer après remise (étapes suivantes). Si la route échoue ou tarde, l'affichage reste sans remise, sans message d'erreur. L'ancien aperçu public n'annonce plus une remise gagnée si le serveur ne l'a pas appliquée.
- `app/api/commandes/route.ts` : non modifiée. Le prix final reste calculé par le serveur.

## Points (a) à (h) — tests/promotions-cart-preview.test.mjs
| Point | Résultat | Preuve |
|---|---|---|
| (a) promo VIP, client sans produit VIP | PASS | remise 0 et aucun libellé |
| (b) promo VIP avec produit VIP | PASS | remise de l'aperçu = (prix - prix de ligne enregistré) x quantité par la route de commande |
| (c) seuil de montant | PASS | 0 avec 1 article, 20 avec 2 articles |
| (d) produit offert | PASS | cadeau g1 renvoyé |
| (e) produit déjà remis exclu | PASS | remise 0 |
| (f) prix falsifié | PASS | remise 20, identique au prix réel |
| (g) aucune écriture | PASS | aucune opération non-select dans le journal, `usage_count` inchangé, aucune commande créée |
| (h) clés absentes | PASS | HTTP 200, remise 0, listes vides |

## Commandes exécutées (résultats réels)
- `node --import ./tests/helpers/register.mjs --test tests/promotions-cart-preview.test.mjs` : exit 0, 8 tests, 8 pass, 0 fail
- `npm test` : exit 0, 195 tests, 195 pass, 0 fail
- `npx tsc --noEmit` : exit 0
- Premier passage du test : (b) échouait (`supabase.rpc is not a function`) car le stub `rpc` du parcours existant manquait dans mon test ; corrigé puis revérifié.

## Limites connues
- L'affichage de la page du panier (délai, rendu des lignes) est vérifié par `tsc` uniquement, pas par un test de rendu ni dans un navigateur.
- Le filtrage de l'ancien aperçu compare le nom de la promotion aux libellés renvoyés par le serveur.

## Interdits respectés
Aucune modification de base, aucun SQL, aucun fichier de secrets lu, aucun push.
