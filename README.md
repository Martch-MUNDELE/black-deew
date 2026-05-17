```markdown
# black-deew

Application de livraison food — Marché cible : Kinshasa, RDC

Projet Next.js bootstrapped avec [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
- `variant_name` et `variant_price` insérés depuis le payload panier via l'API route commandes
- Le front (panier) transmet `variant_name` et `variant_price` dans le body POST envoyé à `/api/commandes`

---

## Changelog de session

### v2.5 — 15 mai 2026 — Session 15 mai (1)
**Commit :** 3441d76
**Fichiers modifiés :** 4 — 79 insertions / 132 suppressions (net : -53 lignes)

Propagation complète des champs `variant_name` et `variant_price` dans le flux de commande : table `order_items` → API route → front panier. Refactoring de la page admin nouveau produit (-33 lignes effectives). Mise à jour README.

**Travaux validés :**

1. **`app/api/commandes/route.ts`** — Ajout des champs `variant_name` et `variant_price` dans l'insert `order_items`. L'API route propage désormais les données de variante sélectionnée au moment de la commande.

2. **`app/(public)/panier/page.tsx`** — Transmission de `variant_name` et `variant_price` depuis le store Zustand vers le payload de commande envoyé à l'API route. Les items du panier portent maintenant l'information de variante.

3. **`app/admin/produits/nouveau/page.tsx`** — Refactoring layout : ~111 lignes → ~75 lignes effectives (-33 lignes). Fonctionnalités conservées : bloc discount/promo, champ `is_vip`, module variantes (`variant_name` / `variant_price`). Parité fonctionnelle avec `/modifier` maintenue.

4. **`README.md`** — Version bumped v2.4 → v2.5. Section `order_items — Variantes` ajoutée. Note refactoring page nouveau produit documentée. Changelog de session ajouté.

**Bugs corrigés :** Aucun bug explicitement corrigé dans cette session. Les modifications sont des ajouts de fonctionnalité (propagation variantes) et du refactoring.

---

## Dette technique

| Dette | Priorité | Statut |
|---|---|---|
| GPS shop Kinshasa — `delivery_shop_lat/lng` encore sur Agadir (valeurs test) | Haute | ⚠️ En attente Tiana Care |
| Pas de composant partagé entre `/nouveau` et `/modifier` — tout nouveau champ doit être ajouté manuellement aux deux pages | Moyenne | Toujours présente — non traitée |
| Template email notifications style basique | Basse | Non traité |
| Bug VIP visible home prod — à confirmer/investiguer |