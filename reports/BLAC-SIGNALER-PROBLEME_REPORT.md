# BLAC-SIGNALER-PROBLEME — Rapport

Ticket : LIVREUR — Signaler un problème (côté livreur, table et API). Date du run : 19 novembre 2026.

## Checklist

- [x] (1) `supabase/migrations/20261119_bd_delivery_reports.sql` : écrite, idempotente (`if not exists`), RLS activée, aucune policy. **Non appliquée** (à exécuter par Martial).
- [x] (2) `lib/delivery-reports.ts` : types, 9 kinds avec libellés français, `isValidReportKind`, `validateReportNote` (500 caractères max).
- [x] (3) `app/api/driver/report-problem/route.ts` : POST `delivery_id`, `kind`, `note`. 401 non authentifié, 403 non livreur, 400 livraison / kind / note invalides, 403 course d'un autre livreur, 409 signalement ouvert déjà présent (contrôle préalable + index unique, code 23505), 503 propre si la table est absente, 500 sinon, le tout dans un try/catch global. Aucune écriture hors `insert` dans `delivery_reports` : ni statut de livraison, ni stock.
- [x] (4) `components/driver/DriverReportProblem.tsx` : bouton secondaire « Signaler un problème », feuille avec les 9 types, précisions facultatives, confirmation « Signalement envoyé », hauteurs tactiles ≥ 44 px (48 à 52 px), même charte que `DriverAcceptDelivery`.
- [x] (5) Affiché dans `DriverDeliveryDetail.tsx` sous « Accepter la course » (course non acceptée) et sous « Marquer comme livrée » (course acceptée). Le bouton Appeler du détail est conservé (`<CallButton href={telHref} />`).
- [x] (6) `tests/driver-report-problem.test.mjs` : 13 tests.
- [x] `node --test tests/driver-report-problem.test.mjs` : 13 passés, 0 échec.
- [x] `npm test` complet après modifications : 767 tests, 767 passés, 0 échec, 0 ignoré (durée mesurée 7 s).
- [ ] `npm test` complet AVANT : **non mesuré dans ce run** (voir écarts).

## Mesures de ce run

- Test ciblé : 13/13.
- `npm test` complet : `exit=0`, 767 passés / 0 échec.
- `tsc --noEmit` filtré sur les fichiers du ticket (route, composant, lib, détail) : aucune ligne d'erreur. Seul le filtre a été lu, pas le code de sortie global de `tsc`.

## Tests adaptés

Aucun test existant n'a été modifié, supprimé ou affaibli dans ce run. Un seul de mes propres tests a été corrigé en cours de route : l'assertion « pas de stock » lisait aussi le commentaire d'en-tête de la route ; elle ignore maintenant les lignes de commentaire et vérifie le code seul.

## Écarts (écrits tels quels)

1. **Pas de `npm test` « avant »** : le run initial a été interrompu (timeout 600000 ms) ; au moment de la reprise, `lib/delivery-reports.ts`, la migration et un squelette de test existaient déjà, et l'arbre contenait d'autres modifications non liées à ce ticket. Une mesure « avant » propre n'était plus possible ; seul l'état « après » est mesuré.
2. **Les tests de la route lisent le texte du fichier** (même méthode que `driver-accept-delivery.test.mjs`) ; la route n'a pas été exécutée contre une vraie base ni avec un client simulé. Les codes 400 / 403 / 409 / 503 sont vérifiés par la structure du code, pas par un appel réel.
3. **Migration non testée sur une base** : fichier écrit uniquement, comme demandé. Tant que Martial ne l'a pas exécutée, la route répond 503 par conception.
4. **Zones d'écriture** : la liste fournie par le ticket ne citait que `app/api/driver/report-problem/route.ts` et `test`, alors que le travail demandé inclut aussi la migration, la lib, le composant et le détail. Ces fichiers ont tous été créés ou modifiés, conformément au travail demandé.
5. **Arbre de travail non propre** : `git status` montre d'autres modifications et fichiers non suivis qui ne viennent pas de ce ticket (maquettes accueil / écran course, rapports VIP, `lib/driver-delivery-view.ts`, etc.). `DriverDeliveryDetail.tsx` contenait déjà les changements du ticket maquette (non commités) ; ce ticket n'y ajoute que l'import et deux lignes d'affichage. Rien n'a été poussé.
6. **Bouton Appeler de l'accueil** : non touché et non retesté en détail dans ce run ; la suite complète passe, et le bouton du détail est vérifié par un test.
7. **Rendu visuel** : le composant n'a pas été ouvert dans un navigateur dans ce run ; les hauteurs tactiles et les libellés sont vérifiés par lecture du code uniquement.

## SQL de la migration à exécuter par Martial

```sql
-- =====================================================================
-- BLAC-SIGNALER-PROBLEME : signalements de probleme par le livreur
-- Table public.delivery_reports : un signalement rattache a une livraison.
-- Recu par l'admin du portail (ecran de controle = ticket suivant) ; rien
-- n'est automatique cote course (ni statut, ni stock).
--
-- Idempotent (if not exists) : le rejouer ne change rien.
-- Aucune modification de donnees existantes.
-- RLS activee sans aucune regle : acces service role uniquement.
-- A executer manuellement par Martial (SQL Editor Supabase).
-- =====================================================================

create table if not exists public.delivery_reports (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.order_deliveries(id) on delete cascade,
  driver_id uuid references public.delivery_drivers(id) on delete set null,
  kind text not null check (kind in (
    'address_not_found',
    'customer_unreachable',
    'customer_refused',
    'amount_mismatch',
    'product_damaged',
    'breakdown_delay',
    'insufficient_stock',
    'cannot_continue',
    'other'
  )),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'handled', 'closed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by text,
  handled_decision text
);

create index if not exists delivery_reports_status_idx on public.delivery_reports (status);
create index if not exists delivery_reports_created_at_idx on public.delivery_reports (created_at desc);
create index if not exists delivery_reports_delivery_id_idx on public.delivery_reports (delivery_id);

-- Un seul signalement ouvert par livraison et par type (garde-fou contre les doubles envois)
create unique index if not exists delivery_reports_open_unique_idx
  on public.delivery_reports (delivery_id, kind) where status = 'open';

alter table public.delivery_reports enable row level security;
-- Volontairement aucune policy : seul le service role (serveur) y accede.
```
