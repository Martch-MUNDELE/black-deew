```markdown
# black-deew

Application de livraison food — Marché cible : Kinshasa, RDC

Projet Next.js bootstrapped avec [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

> v2.6 — 17 mai 2026 — Session 17 mai : uploadHeroImage timestamp + upsert immédiat + cache-buster (63c20f6) · favicon + apple-icon depuis logo Supabase (5854701) · site_description admin + generateMetadata dynamique + footer tab fix (9ddc62a) · OG image + Twitter card metadata (f95fb82) · toggle ON/OFF par argument dans admin settings (4319cca).
> v2.5 — 15 mai 2026 — Session 15 mai (1) : variant_name + variant_price dans order_items — propagation DB + API route commandes + front panier. Refactoring app/admin/produits/nouveau/page.tsx (-33 lignes). Commit : 3441d76.
> v2.4 — 14 mai 2026 — Session 14 mai (4) : ajout bloc discount/promo + is_vip sur page nouveau produit (parité avec modifier). 43 insertions / 29 suppressions sur `app/admin/produits/nouveau/page.tsx`.
> v2.3 — 14 mai 2026 — Session 14 mai (3) : recherche couleur hex typographie titres (non résolue) + modification mineure PhoneInput.tsx (3 lignes).
> v2.2 — 14 mai 2026 — Session 14 mai (2) : PhoneInput RD Congo en 1ère position.
> Session 14 mai (1) : module variantes produits, PhoneInput 49 pays.
> Session 10 mai : auth_user_id création admin, notification_email clé unifiée,
> onglets Notifications + Footer, FooterHero dynamique, template base-food mis à jour.

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

---

## Stack technique

- **Framework :** Next.js 16.2.3
- **Base de données :** Supabase (`ecljtkcoublqlgenpjlo`)
- **Déploiement :** Vercel
- **Emails :** Resend
- **État global :** Zustand

---

## Composants clés

### PhoneInput (`components/PhoneInput.tsx`)
- Liste de 49 pays avec indicatifs téléphoniques internationaux
- **Ordre prioritaire** : RD Congo (+243) en position 1, Congo (+242) en position 2
- Couvre : Afrique centrale, Afrique de l'Ouest, Maghreb, Europe, Amérique du Nord, Moyen-Orient
- Dropdown avec drapeau emoji + nom pays + indicatif
- Marché cible : Kinshasa, RDC → RD Congo toujours en tête de liste
- Dernière modification : session 14 mai (3) — 3 lignes modifiées (3 insertions, 3 suppressions)

### Page nouveau produit (`app/admin/produits/nouveau/page.tsx`)
- Bloc discount/promo : champs `discount` et `is_vip` présents dans le formulaire de création
- Module variantes : champs `variant_name` / `variant_price` transmis au panier
- Parité fonctionnelle avec la page modifier produit atteinte session 14 mai (4)
- Refactoring layout session 15 mai (1) : ~111 → ~75 lignes effectives (-33 lignes)
- **⚠️ Note** : pas de composant partagé avec `/modifier` — tout nouveau champ doit être ajouté manuellement aux deux pages

### FeaturesBar (`components/FeaturesBar.tsx`)
- 8 icônes SVG disponibles dans le switch : `chef`, `delivery`, `fresh`, `star`, `clock`, `heart`, `shield`, `fire`
- Dernière modification : session 17 mai — 6 lignes modifiées (ajout icônes star, clock, heart, shield, fire)

### order_items — Variantes (mis à jour session 15 mai)
- Les champs `variant_name` et `variant_price` sont insérés depuis le payload panier via `/api/commandes`
- Le front (`panier/page.tsx`) transmet ces valeurs dans le body POST
- Chaîne validée : sélection variante → panier → API → `order_items` en DB
- **⚠️ À vérifier** : présence physique des colonnes en base Supabase non confirmée en session
- Affichage côté admin commandes : non confirmé — à vérifier

---

## Base de données

### Table `order_items` — RLS OFF
- Colonne `is_vip` boolean
- Colonnes `variant_name` (text, nullable) et `variant_price` (numeric, nullable) — ajoutées session 15 mai (1)
  - `variant_name` : nom de la variante sélectionnée (ex: "Taille: L")
  - `variant_price` : prix de la variante au moment de la commande
- **⚠️ À vérifier** : présence physique en base Supabase non confirmée — si absentes : `ALTER TABLE order_items ADD COLUMN variant_name text, ADD COLUMN variant_price numeric;`
- Insert sécurisé : champs explicites uniquement (pas de spread `...item`)
- `variant_name` et `variant_price` insérés depuis le payload

### Table `settings` — Clés actives

| Clé | Valeur actuelle | Notes |
|---|---|---|
| `hero_image` | URL Supabase Storage | Upsert immédiat après upload — nom fichier avec timestamp (`hero-{Date.now()}.ext`) + cache-buster sur URL affichée |
| `site_description` | texte libre | Utilisé dans `generateMetadata` (description, OG, Twitter) — configurable depuis `/admin/settings` |
| `og_image` | URL | Balise `og:image` + `twitter:image` — dynamique depuis settings |

---

## Travaux valides — Session 17 mai 2026

- **Fix uploadHeroImage** (`63c20f6`) : remplacement du fileName fixe `hero.ext` par `hero-{timestamp}.ext` + upsert immédiat de la clé `hero_image` dans la table `settings` après upload + cache-buster appliqué sur l'URL affichée.
- **Favicon + apple-icon dynamiques** (`5854701`) : générés depuis le logo stocké dans Supabase Storage — plus de fichiers statiques hardcodés.
- **site_description admin** (`9ddc62a`) : nouveau champ `site_description` configurable depuis `/admin/settings` + `generateMetadata` dynamique qui lit la valeur en base + correction de l'onglet footer qui ne s'activait pas correctement.
- **OG image + Twitter card metadata** (`f95fb82`) : balises `og:image` et `twitter:card` générées dynamiquement depuis les settings Supabase.
- **Toggle ON/OFF par argument** (`4319cca`) : le bouton statut dans admin settings accepte désormais un argument explicite pour forcer l'état ON ou OFF sans dépendre d'un toggle CSS seul.
- **FeaturesBar.tsx** (`components/FeaturesBar.tsx`) : ajout de nouvelles icô