```markdown
# black-deew

Application de livraison food — Marché cible : Kinshasa, RDC

Projet Next.js bootstrapped avec [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
- Dernière modification : session 14 mai (3) — 3 lignes modifiées (3 insertions, 3 suppressions)
- Utilisé dans : formulaire livreurs (`/admin/livreurs`)

### Page nouveau produit (`app/admin/produits/nouveau/page.tsx`)
- Bloc discount/promo : champs `discount` et `is_vip` présents dans le formulaire de création
- Module variantes : champs `variant_name` / `variant_price` transmis au panier
- Parité fonctionnelle avec la page modifier produit atteinte session 14 mai (4)

### Module livreurs (`app/admin/livreurs/`)
- **Statut :** en cours de développement — page incomplète, non commitée
- Type `Driver` défini avec les champs :
  - `id`, `started_at`, `opening_cash`
  - `collected_cash`, `expected_cash`, `net_to_remit` (logique de caisse)
- Intégration `PhoneInput` (49 pays, RDC en tête)
- Connexion Supabase client + hook `useCurrency` présents
- Champs `open_session` impliquent une logique de caisse livreur (remise de fonds)
- Formulaire simplifié : sans champs Véhicule ni Zone (supprimés en session 18 mai (4))

---

## Dette technique

- Page `/admin/livreurs` incomplète — diff tronqué, structure `open_session` non fermée, logique d'affichage et actions non visibles
- Aucun commit git enregistré pour la session 18 mai (5) — travail non versionné
- Champs `open_session` (collected_cash, expected_cash, net_to_remit) impliquent une logique de caisse livreur non documentée dans la doc maître
- Schéma table sessions livreurs à documenter (section 4 — Base de données)

---

## Prochaines étapes

1. Finaliser et valider la page `/admin/livreurs` (affichage liste, gestion sessions, remise caisse)
2. Documenter le schéma de la table sessions livreurs dans la doc maître (section 4 — Base de données)
3. Committer le travail en cours dès que la page est stable (`git add -A && git commit`)
4. Vérifier que les RLS Supabase couvrent les données de session livreur
5. Tester en local (port 3001) avant tout push
```