# BD-PROMOTION-DATES (BLAC-P2-015) — Rapport

Dates de début et de fin dans le formulaire des promotions. Aucune base modifiée, aucun SQL, aucun secret lu, aucun push. Moteur et `lib/promotion-rules.ts` non modifiés par ce ticket.

## Points vérifiés
- `lib/promotion-dates.ts` créé : logique pure sans dépendance. `PROMOTION_TIMEZONE_OFFSET` = +01:00 (heure de Kinshasa, propre au site, commenté). Fonctions : dateToStartIso, dateToEndIso, isoToDateInput, addDays, endOfMonth, daysBetween, durationLabel, formatEndDateFr.
- Durée en jours inclus : du 3 au 30 novembre = 28 jours, soit « Active pendant 28 jours ».
- `app/admin/promotions/page.tsx` : section « Période de validité » avec champs Début et Fin (type date natif), vides pour une nouvelle promotion et chargés en édition via isoToDateInput.
- Payload : `starts_at: dateToStartIso(...)` et `ends_at: dateToEndIso(...)`, null si vide.
- Boutons : 7 jours, 30 jours, Jusqu'à fin de mois (depuis le début, ou aujourd'hui si vide), Sans date de fin (vide le champ Fin).
- Phrase de synthèse : durée et date exacte d'arrêt (« Dans le panier, elle cesse de s'appliquer le 30 novembre 2026 à 23 h 59 »), ou « Sans date de fin : elle reste active tant qu'elle est active ».
- Fin antérieure à Début : erreur en français affichée et enregistrement bloqué.
- `tests/promotion-dates.test.mjs` : 9 tests (valeurs exactes avec décalage, aller-retour, addDays, endOfMonth dont fin février bissextile 2028, daysBetween, libellés, lecture du texte de page.tsx). Aucune assertion existante supprimée ou affaiblie.

## Commandes exécutées et résultats réels
- node --import ./tests/helpers/register.mjs --test tests/promotion-dates.test.mjs : exit 0, 9 tests, 9 pass, 0 fail (deux passages).
- npm test, premier passage : exit 1, 239 tests, 229 pass, 10 fail. Les 10 échecs venaient tous de tests/promotion-date-bounds.test.mjs (ticket BLAC-P2-016) : `isRuleActiveAt is not a function`, car lib/promotion-rules.ts n'exportait pas encore cette fonction. Ce fichier a été modifié par un autre run (horodatage 00:25), hors périmètre de ce ticket.
- Contrôle de cause : tests/promotion-date-bounds.test.mjs relancé seul : exit 0, 10 pass, 0 fail.
- npm test, second passage : exit 0, 239 tests, 239 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo.
- npx tsc --noEmit : exit 0 (deux passages).

## Limites
- L'affichage de la page d'administration n'est pas vérifié dans un navigateur (tests de texte et tsc seulement).
- La suite complète dépend de l'état de lib/promotion-rules.ts, modifié en parallèle par le ticket BLAC-P2-016 : le premier passage a échoué pour cette raison, le second passe.
- Le décalage +01:00 est fixe (Kinshasa, sans heure d'été) et n'est pas lu depuis la configuration.

## Livrables
- /Users/martch/PROJECTS_APPLI/black-deew/lib/promotion-dates.ts
- /Users/martch/PROJECTS_APPLI/black-deew/app/admin/promotions/page.tsx
- /Users/martch/PROJECTS_APPLI/black-deew/tests/promotion-dates.test.mjs
- /Users/martch/PROJECTS_APPLI/black-deew/reports/BD-PROMOTION-DATES_REPORT.md

Statut final : PASS
