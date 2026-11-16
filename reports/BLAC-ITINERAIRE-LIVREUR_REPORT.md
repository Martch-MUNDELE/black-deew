# BLAC-P3-063 — Itinéraire livreur (Google Maps, Waze, Plans, Android)

## Fichiers
- `lib/driver-navigation.ts` (nouveau) : `buildNavigationLinks({address, lat, lng})` pure ; renvoie `null` sans coordonnées valides ni adresse non vide, sinon `{google, waze, apple, android, hasCoords}`. Coordonnées finies, lat dans [-90, 90], lng dans [-180, 180], nombres ou chaînes numériques ; sinon repli sur l'adresse encodée.
- `components/driver/DriverNavigationLinks.tsx` (nouveau) : bloc « Itinéraire », gros bouton « Lancer l'itinéraire » (Google Maps) et quatre boutons Google Maps, Waze, Plans, Android ; `target="_blank"` et `rel="noopener noreferrer"` ; style sombre et doré ; renvoie `null` si `buildNavigationLinks` renvoie `null`.
- `components/driver/DriverDeliveryDetail.tsx` (modifié, zone du ticket) : bloc affiché sous l'adresse pour toute course ni livrée ni annulée (`navigable`). Le lien « Itinéraire » existant (`buildMapsUrl`, barre d'actions) est conservé, `lib/driver-space.ts` n'est pas modifié.
- `tests/driver-navigation.test.mjs` (nouveau).

## Résultats du fichier de test ciblé
Commande : `node --disable-warning=DEP0205 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register.mjs --test tests/driver-navigation.test.mjs`

- tests 7, pass 7, fail 0, cancelled 0, skipped 0, todo 0
- coordonnees numeriques : les quatre liens contiennent les coordonnees exactes : OK
- coordonnees en chaines numeriques : meme resultat : OK
- coordonnees invalides avec adresse : liens sur adresse encodee, hasCoords faux : OK
- ni coordonnees ni adresse : null : OK
- adresse avec espaces et accents correctement encodee : OK
- le composant n affiche rien quand le resultat est null (lecture du code) : OK
- le detail n affiche pas le bloc pour delivered et cancelled (lecture du code) : OK

`npx tsc --noEmit` : code de sortie 0, aucune erreur.

## Limites
L'ouverture réelle des applications (Google Maps, Waze, Plans, navigation Android) n'a pas été vérifiée sur téléphone : seuls les liens générés et le code ont été testés.
