```markdown
# black-deew

Application de livraison food — Marché cible : Kinshasa, RDC

Projet Next.js bootstrapped avec [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
- Bloc discount/promo ajouté : champs `discount` et `is_vip` présents dans le formulaire de création
- Parité fonctionnelle avec la page modifier produit atteinte session 14 mai (4)
- 43 insertions / 29 suppressions — refactoring de layout inclus
- **Note** : tout nouveau champ ajouté à `/modifier` doit être ajouté manuellement à `/nouveau` — pas de composant partagé actuellement

---

## Fonctionnalités

- Module stock V1 opérationnel ✅
- Système VIP complet ✅
- Infinite scroll commandes 20/page ✅
- Footer éditable depuis admin ✅
- PhoneInput 49 pays, RD Congo en position 1 ✅
- Variantes produits (selected_variants + badges + key composite) ✅
- Bloc discount/promo + is_vip sur page nouveau produit (parité modifier) ✅

---

## Dette technique

| Dette | Priorité | Détail |
|---|---|---|
| GPS shop Kinshasa | Haute | `delivery_shop_lat/lng` toujours sur Agadir — action requise de Tiana Care depuis `/admin/livraison` mobile |
| Test cron `check-payment` | Haute | Prévu début juin 2026 |
| ARIA v2 avec Claude Code | Haute | Bugs `aria.py` (`--status` cassé) et `aria_watch.py` non résolus — à traiter en priorité |
| Bug VIP visible home prod | Haute | À confirmer/investiguer en prod |
| Couleur hex typographie titres | Moyenne | Couleur hex des noms de produits, titres principaux et prix non documentée — non résolue session 14 mai (3) |
| Email Resend domaine custom | Moyenne | Actuellement `onboarding@resend.dev` limité |
| Template email notifications | Basse | Style basique vert — à moderniser |
| Infinite scroll >50 commandes | Basse | À vérifier en prod |
| Slug `menu_categories` non synchronisé | Basse | Renommage catégorie ne cascade pas sur produits |

---

## Prochaines étapes

1. **Tester en prod** la création d'un produit avec discount et `is_vip` via `/admin/produits/nouveau` — vérifier que les valeurs sont bien persistées en base Supabase
2. **Investiguer bug VIP visible home** — reproduire en prod, inspecter le filtre `is_vip` sur la requête catalogue public
3. **GPS Kinshasa** — relancer Tiana Care pour se géolocaliser depuis `/admin/livraison` mobile
4. **Variantes** — valider le comportement collapse/expand + layout vertical + prix en conditions réelles (création + modification d'un produit avec variantes)
5. **Retrouver la couleur hex des titres** — Inspecter `globals.css`, `tailwind.config`, composants produits et fichiers de style inline
6. **Traiter bugs ARIA** : `aria.py --status` cassé et `aria_watch.py` — non résolus
7. **Début juin 2026** : tester le cron `check-payment` (fermeture auto commandes non payées après 5j)

---

## Prompt de reprise

```
Projet : black-deew
Doc maître : ARIA_DOC v2.2 (14 mai 2026)
Dernière session : ajout bloc discount/promo sur nouveau produit (parité avec modifier).
Variantes : collapse/expand + layout vertical + fix prix validés.

État à reprendre :
- Bug VIP visible home prod : NON investigué — priorité 1
- GPS shop : delivery_shop_lat/lng encore sur Agadir — Tiana Care n'a pas encore corrigé
- Page nouveau produit : parité modifier ✅ — tester en prod la persistance discount + is_vip

Contraintes rappel :
- Bash terminal uniquement
- cat avant sed ou python3
- Tester local avant push — build vert obligatoire
- Jamais pusher sans accord Martial
- Ne jamais toucher Abou Joudia sans accord explicite
- Ne jamais afficher les valeurs des secrets

Commence par lire la section 10 de la doc maître et confirme ce que tu vois avant toute action.
```

---

## Changelog

| Version | Date | Modifications |
|---|---|---|
| v2.4 | 14 mai 2026 | Bloc discount/promo + is_vip ajouté à `/admin/produits/nouveau` (parité modifier). 43 insertions / 29 suppressions. |
| v2.3 | 14 mai 2026 | Recherche couleur hex typographie titres (non résolue). Modification mineure PhoneInput.tsx (3 lignes). |
| v2.2 | 14 mai 2026 | Variantes : collapse/expand, layout vertical, no-spinner, suppression div vide. PhoneInput RD Congo en position 