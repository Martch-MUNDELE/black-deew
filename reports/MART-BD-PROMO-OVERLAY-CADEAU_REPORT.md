# MART-BD-PROMO-OVERLAY-CADEAU — Rapport (ticket BLAC-P3-011)

Statut final : PASS

Overlay promotionnel avec la photo du produit offert pour les promotions de type cadeau. Aucune base modifiée, aucun SQL, aucun fichier de secrets lu, aucun push. Panier, route de commande et moteur de promotions non modifiés.

## Fichiers modifiés
- app/api/promotions/route.ts : ajoute les cadeaux aux promotions publiques (même clé serveur que l'existant).
- lib/promotion-rules.ts : type public `PublicGift`, champ `gifts?` sur `PublicPromotion`, fonction `attachPublicGifts`.
- lib/promo-overlay.ts : type `OverlayGift`, `getOverlayGifts`, `selectOverlayPresentation`.
- components/PromoOverlay.tsx : présentation « cadeau » (photo héros, badge OFFERT, ligne « 1 x nom », « + N autres »).
- tests/promo-overlay-gift.test.mjs : nouveau, 7 tests avec le faux client de base strict.

## Tableau des points (a) à (h)
| Point | Vérification | Résultat |
|---|---|---|
| (a) | Règle cadeau : la route renvoie product_id, nom, photo, quantité ; aucun prix de revient, stock, description ni note admin | PASS |
| (b) | Cadeau par identifiants de la règle et cadeau par avantage lié (quantité 2 lue sur l'avantage) | PASS |
| (c) | Produit inactif ou introuvable : promotion renvoyée avec `gifts: []` | PASS |
| (d) | Produit VIP : absent en portée « tous », présent en portée VIP | PASS |
| (e) | Règle pourcentage : aucune clé `gifts` dans la réponse | PASS |
| (f) | Présentation cadeau seulement si un cadeau a une photo (sans photo, liste vide, absente, autre type, null : présentation actuelle) | PASS |
| (g) | Plusieurs cadeaux : premier avec photo choisi, compteur des autres correct, libellé « 2 x Premier » | PASS |
| (h) | Tests existants de l'overlay et de la route publique toujours verts (20 sur 20) ; suite complète 211 sur 211 | PASS |

## Liste de contrôle du design (point 3)
| Exigence | État | Raison |
|---|---|---|
| Photo héros de la carte | Respectée | Photo centrée en tête de carte, au-dessus du badge, sans personnage. |
| Carré arrondi dans un cadre doré avec halo chaud | Respectée | Cadre dégradé doré, coins arrondis, ombre dorée et halo orangé en arrière-plan. |
| Grande, environ 40 % de la largeur de la carte | Respectée avec bornes | Largeur 40 % avec minimum 112 px et maximum 168 px ; sur une carte de 420 px, 168 px soit 40 %. |
| Dépasse légèrement du cadre | Respectée | Marge haute négative : la photo déborde d'environ 38 px au-dessus de la carte. |
| Léger flottement | Respectée | Animation de 7 px sur 4 s, désactivée si mouvement réduit. |
| Badge « OFFERT » en très grands caractères dorés à la place du pourcentage | Respectée | Même dégradé doré, jusqu'à 72 px, espacement des lettres. |
| Ligne « 1 x nom du produit » sous le badge | Respectée | Quantité et nom issus de la route publique. |
| Message client et boutons comme aujourd'hui | Respectée | Blocs inchangés. |
| Personnage non affiché | Respectée | Le personnage est masqué en présentation cadeau. |
| Plusieurs cadeaux : premier en grand et « + N autres » en petit | Respectée | Petit texte « + N autre(s) » sous la ligne du produit. |
| Photo en échec : retour à la présentation actuelle, sans trou ni image cassée | Respectée dans le code | `onError` bascule sur la présentation actuelle (non observé dans un navigateur). |
| Rebonds, masquage après cinq secondes, annulation au contact, 3 s après connexion VIP, une fois par session | Respectée | Logique et styles existants non modifiés. |
| Mouvement réduit et accessibilité | Respectée | Flottement ajouté à la règle de mouvement réduit ; photo décorative masquée aux lecteurs d'écran ; le badge porte un libellé « Offert : 1 x nom ». |
| Texte jamais coupé de 320 à 1440 px | Non vérifiée | Tailles fluides et retour à la ligne forcé prévus, mais aucun test navigateur. |

## Commandes exécutées et résultats réels
- `npx tsc --noEmit` : premier passage en échec (2 erreurs : variable `giftMode` utilisée avant sa déclaration dans le composant), corrigé en déplaçant le bloc ; second passage exit 0.
- `node --import ./tests/helpers/register.mjs --test tests/promo-overlay-gift.test.mjs` : 7 tests, 7 pass, 0 fail.
- `node --import ./tests/helpers/register.mjs --test tests/promo-overlay.test.mjs tests/promotions-fixes-p3-008.test.mjs tests/promotions-phase2.test.mjs` : 20 tests, 20 pass, 0 fail.
- `npm test` : exit 0, 211 tests, 211 pass, 0 fail, 0 todo (204 avant le ticket plus 7 nouveaux).

## Limites connues
- Le rendu visuel n'est pas vérifié dans un navigateur : taille de la photo, débordement, halo, flottement, retour en cas d'échec de la photo et largeurs de 320 à 1440 px ne sont vérifiés que par tsc et la lecture du code.
- Les noms de colonnes de la table des produits (id, name, image_url, is_vip, active) sont ceux déjà utilisés par la route de commande et le catalogue ; le test utilise un faux client, pas la vraie base.
- Le compteur « + N autres » compte aussi les cadeaux sans photo.
