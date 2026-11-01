# MART-BD-PROMO-OVERLAY — Rapport

Statut final : PASS

## Tests de la logique pure (tests/promo-overlay.test.mjs)
| Point | Description | Résultat |
|---|---|---|
| (a) | classic visible sur classic, absente sur vip | PASS |
| (b) | vip visible sur vip, absente sur classic | PASS |
| (c) | portée all et mixed sur les deux surfaces | PASS |
| (d) | priorité puis avantage, un seul résultat | PASS |
| (e) | promotion fermée ignorée, nouvelle affichée | PASS |
| (f) | liste vide ou données invalides : aucune promotion, aucune erreur | PASS |
| (g) | expirée, future, inactive, brouillon ou à code jamais choisie | PASS |
| + | surface selon le chemin (accueil = classic, /vip = vip, reste = aucune) | PASS |
| + | texte du badge (pourcentage, montant, livraison, cadeau) | PASS |

## Liste de contrôle du design (point 3)
| Exigence | État | Raison |
|---|---|---|
| Fond assombri avec léger flou | Respectée | rgba(5,3,1,0.72) et backdrop-filter blur(6px) |
| Carte centrée, feuille ancrée en bas sur mobile | Respectée | flex centré ; sous 520 px, ancrée en bas, coins hauts arrondis |
| Couleurs du site, bordure et dégradé or | Respectée | fond sombre, bordure en dégradé or |
| Titre Playfair Display, texte DM Sans | Respectée | polices déjà chargées par globals.css |
| Bandeau "PROMOTION" en capitales dorées | Respectée | pastille en majuscules espacées, couleur or |
| Grand badge pourcentage ou montant | Respectée | Playfair 900, taille fluide jusqu'à 84 px ; textes de repli pour livraison, cadeau |
| Message client en évidence | Respectée | paragraphe sous le badge ; texte par défaut si absent |
| Personnage PNG hors cadre, coin bas droit, halo chaud | Respectée (non vérifiée visuellement) | image en position absolue, right -14 px, bottom -22 px ; halo radial orangé |
| Sans image, la carte reste belle | Respectée | image et marge masquées si absente ou en erreur de chargement |
| Bouton "J'en profite" qui ferme et mène au catalogue | Partielle | ferme et remonte en haut de page ; aucune ancre de catalogue dans le code |
| Bouton "Plus tard" et croix de fermeture | Respectée | croix de 44 px, bouton discret |
| Clic hors carte et Échap ferment | Respectée | clic sur le fond, écouteur clavier |
| Animations sobres, désactivées si mouvement réduit | Respectée | entrée, flottement, compte du pourcentage ; prefers-reduced-motion coupe tout |
| role dialog, aria-modal, piège du focus, retour du focus | Respectée | focus initial sur le bouton principal, Tab et Maj+Tab bouclés, focus rendu à la fermeture |
| Aucun texte coupé de 320 à 1440 px | Non vérifiée | tailles fluides (clamp) et retour à la ligne forcé, mais aucun test navigateur |
| Apparition douce après environ 1 s | Respectée | délai de 1000 ms puis animation d'entrée |
| Une fois par promotion et par session, try/catch | Respectée | sessionStorage protégé, mémoire du composant en secours |
| Réapparition si nouvelle promotion active | Respectée au rechargement | prise en compte à la visite ou au rechargement, pas en direct |
| Accueil classic, VIP vip, jamais panier, confirmation, admin | Respectée | surface déduite du chemin : "/" et "/vip" uniquement |
| Chargement non bloquant | Respectée | données chargées après rendu dans un effet |

## Commandes exécutées et résultats réels
- node --import ./tests/helpers/register.mjs --test tests/promo-overlay.test.mjs : 9 tests, 9 pass, 0 fail
- npx tsc --noEmit : exit 0
- npm test : exit 0, 204 tests, 204 pass, 0 fail

## Limites connues
- Le rendu visuel n'est pas vérifié dans un navigateur.
- Sur mobile, le personnage dépasse de 22 px sous la carte ancrée en bas : il peut être rogné par le bord de l'écran.
- La priorité n'étant pas exposée par la route publique, le tri repose sur l'ordre de la route.
- Un montant fixe n'est pas exposé par la route publique : le badge affiche alors "OFFRE SPECIALE".
- Aucune modification de la base, du panier, de la route de commande ni du moteur de promotions.
