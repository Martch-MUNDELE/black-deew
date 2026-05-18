```markdown
# black-deew

Application de livraison food — Marché cible : Kinshasa, RDC

Projet Next.js bootstrapped avec [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

> v2.8 — 18 mai 2026 — Session 18 mai (2) : vérification patch aria_agent.py (WATCH_TIMEOUT=600, MAX_RETRIES=2, polling 1s) — non confirmée. Aucun push git documenté cette session.
> v2.7 — 18 mai 2026 — Session 18 mai : KpiCardCA (total CA + badges Classique/VIP) + fonctions isVipOrder/vipCATotal/classicCATotal + graphe double barres + badge VIP pipeline + refactor admin/page.tsx −253 lignes (1d03ecb).
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

### Dashboard admin (`app/admin/page.tsx`) — mis à jour session 18 mai
- **`KpiCardCA`** : composant KPI dédié affichant le CA total en grand format (Playfair Display 26px, `#F5C842`) avec sous-ligne séparée Classique / VIP (badges colorés distincts)
- **`isVipOrder(order)`** : retourne `true` si au moins un item de la commande est marqué VIP
- **`vipCATotal(orders)`** : somme du CA des commandes VIP uniquement
- **`classicCATotal(orders)`** : somme du CA des commandes classiques uniquement
- **`timeAgo(date)`** : formatage relatif des dates commandes
- **`STATUS`** : mapping statut → label / couleur / fond pour les 6 états du pipeline
- **`PIPELINE`** : séquence ordonnée des 4 états actifs
- **`OrderWithItems`** : type local pour le typage des items enrichis
- Refactoring session 18 mai : 469 → 216 lignes nettes (−253 lignes)
- **⚠️ Note** : diff tronqué observé en session — valider visuellement en local avant push

---

## Dette technique

| Dette | Priorité | Statut |
|---|---|---|
| Patch timeout `aria_agent.py` (WATCH_TIMEOUT=600, MAX_RETRIES=2, polling 1s) | **Haute** | **Non vérifié / Non confirmé — priorité absolue prochaine session** |
| GPS shop Kinshasa (`delivery_shop_lat/lng` encore sur Agadir) | Haute | Toujours en attente — Tiana Care |
| Test cron `check-payment` | Haute | Début juin 2026 |
| Email Resend domaine custom | Moyenne | En attente |
| Infinite scroll >50 commandes en prod | Moyenne | À vérifier |
| `app/admin/page.tsx` diff partiel visible — composant `KpiCardCA` tronqué dans le diff | Moyenne | À valider visuellement en local avant push |
| Template email notifications (style basique) | Basse | En attente |
| Bug VIP visible home prod | Basse | À confirmer/investiguer |
| Slug `menu_categories` non synchronisé avec subcategory products | Basse | Connu |

---

## Prochaines étapes

1. **Vérifier manuellement `aria_agent.py`** — confirmer la présence de `WATCH_TIMEOUT=600`, `MAX_RETRIES=2`, polling 1 s avant tout push :
   ```bash
   grep -n "WATCH_TIMEOUT\