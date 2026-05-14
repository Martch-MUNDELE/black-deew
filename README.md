```markdown
# black-deew

Application de livraison food — Marché cible : Kinshasa, RDC

Projet Next.js bootstrapped avec [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

---

## Fonctionnalités

- Module stock V1 opérationnel ✅
- Système VIP complet ✅
- Infinite scroll commandes 20/page ✅
- Footer éditable depuis admin ✅
- PhoneInput 49 pays, RD Congo en position 1 ✅
- Variantes produits (selected_variants + badges + key composite) ✅

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

1. **Retrouver la couleur hex des titres** — Inspecter `globals.css`, `tailwind.config`, composants produits et fichiers de style inline pour localiser les couleurs utilisées sur les noms de produits, titres principaux et prix
2. **Vérifier build local** : `cd ~/PROJECTS_APPLI/clients/black-deew/site && npm run dev -- -p 3001` — confirmer que PhoneInput affiche bien 49 pays avec RDC en 1er après les 3 lignes modifiées
3. **Push PhoneInput.tsx** uniquement après build vert et accord Martial
4. **Traiter bugs ARIA** : `aria.py --status` cassé et `aria_watch.py` — non résolus
5. **Tiana Care** : se géolocaliser depuis `/admin/livraison` sur mobile pour corriger `delivery_shop_lat/lng` (Kinshasa)
6. **Début juin 2026** : tester le cron `check-payment` (fermeture auto commandes non payées après 5j)
7. Investiguer bug VIP visible sur home en production
8. Configurer domaine custom Resend pour les emails
9. Moderniser template email notifications (style basique vert actuel)
10. Vérifier comportement infinite scroll au-delà de 50 commandes en prod

---

## Contraintes absolues

- Bash terminal uniquement
- `cat` avant `sed` ou `python3`
- Jamais pusher sans accord Martial
- Ne jamais toucher Abou Joudia sans accord explicite
- Ne jamais afficher les valeurs de secrets
- Clés Supabase : Legacy JWT (`eyJ...`) uniquement

---

## Changelog

### v2.3 — 14 mai 2026
- chore: modification mineure PhoneInput.tsx — 3 lignes modifiées (3 insertions, 3 suppressions) dans la liste des pays
- recherche: couleur hex typographie titres (noms produits, titres principaux, prix) — **non résolue**

### v2.2 — 14 mai 2026
- fix: PhoneInput RD Congo (+243) placé en position 1, Congo (+242) en position 2
- feat: PhoneInput étendu à 49 pays avec indicatifs internationaux

### v2.1 — 14 mai 2026
- feat: module variantes produits (selected_variants + badges + key composite)

### v2.0 — 10 mai 2026
- feat: auth_user_id lors de la création admin
- fix: notification_email clé unifiée
- feat: onglets Notifications + Footer dans l'admin
- feat: FooterHero dynamique
- fix: template base-food mis à jour

---

## Prompt de reprise

```
Projet : black-deew
Doc maître : v2.3 — 14 mai 2026
Dernière session : recherche couleur hex typographie titres (non résolue) + modification mineure PhoneInput.tsx (3 lignes)

CONTEXTE :
- PhoneInput.tsx modifié (3 lignes) — build local non encore validé
- La couleur hex des titres (noms produits, titres principaux, prix) n'a PAS été trouvée

TÂCHES PRIORITAIRES :
1. Trouver la couleur hex typographie titres — inspecter globals.css, composants produits, fichiers de style inline
2. Valider build local après modification PhoneInput (npm run dev -- -p 3001)
3. GPS shop : coordonnées encore sur Agadir — Tiana Care doit corriger depuis /admin/livraison

CONTRAINTES :
- Bash terminal uniquement
- cat avant sed ou python3
- Ne pas pusher sans accord Martial
- Build 