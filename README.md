```markdown
# black-deew

Application de livraison food — Marché cible : Kinshasa, RDC

Projet Next.js bootstrapped avec [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

> v3.2 — 18 mai 2026 — Session 18 mai (6) : statut livreur dynamique basé sur session ouverte (4477892) · menu visibility toggle icône œil admin + filtre vitrine + navbar (b6d8319) · fixes catégories : reset activeGroupe si groupe absent (c8a1511), masquage catégories vides si tous produits inactifs (7866ec2), debug catégories vides BD (c8a1511) · PhoneInput utilisé dans formulaire livreurs · README mis à jour.
> v3.1 — 18 mai 2026 — Session 18 mai (5) : module livreurs `/admin/livreurs` en cours — type `Driver` défini (id, started_at, opening_cash, collected_cash, expected_cash, net_to_remit), intégration PhoneInput (49 pays, RDC en tête), connexion Supabase client + hook `useCurrency`. Page incomplète, diff tronqué, aucun commit enregistré.
> v3.0 — 18 mai 2026 — Session 18 mai (4) : formulaire livreur simplifié — suppression champs Vehicule (select) et Zone (input) dans Nouveau livreur et Modifier livreur. Placeholder nom mis à jour ("Ex: James Brown"). Commit : 7c36b0a.
> v2.9 — 18 mai 2026 — Session 18 mai (3) : analytics historiques CA semaine (4 semaines glissantes, barres gold #F5C842, décomposition Classique/VIP) + commandes par jour dans admin/page.tsx (+74 lignes). Affichage variant_name dans admin/commandes. import type Product corrigé. Commits : 007f575, 9dc0b2a, 367f7b1, 0a949dc.
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
- Utilisé dans : formulaire livreurs (`/admin/livreurs`), autres formulaires admin
- Dernière modification : session 14 mai (3) — 3 lignes modifiées (3 insertions, 3 suppressions)

---

## Module Livreurs (`/admin/livreurs`)

- **Type `Driver`** : id, started_at, opening_cash, collected_cash, expected_cash, net_to_remit
- **Statut dynamique** : basé sur session ouverte (commit `4477892`)
- **Formulaire simplifié** : sans champs Vehicule ni Zone (commit `7c36b0a`)
- **Intégrations** : PhoneInput, Supabase client, hook `useCurrency`
- ⚠️ Page incomplète — diff tronqué, état instable à surveiller

---

## Menu Visibility Toggle

- Icône œil dans l'interface admin pour activer/désactiver la visibilité d'un item
- Filtre appliqué côté vitrine + navbar
- Commit : `b6d8319`

---

## Fixes Catégories (session 18 mai 6)

- Reset `activeGroupe` si groupe absent : commit `c8a1511`
- Masquage catégories vides si tous les produits sont inactifs : commit `7866ec2`
- Debug catégories vides BD : commit `c8a1511`

---

## Dette technique

- Page `/admin/livreurs` incomplète — diff tronqué, aucun commit enregistré pour la page complète, état instable
- Aucun composant partagé entre `/produits/nouveau` et `/produits/modifier` — tout nouveau champ doit être dupliqué manuellement
- Patch `aria_agent.py` (WATCH_TIMEOUT=600, MAX_RETRIES=2, polling 1s) non confirmé, aucun push documenté
- GPS shop toujours sur Agadir — Tiana Care doit se géolocaliser depuis `/admin/