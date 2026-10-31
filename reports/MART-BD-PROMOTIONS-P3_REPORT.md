# MART-BD-PROMOTIONS-P3 (BLAC-P3-006) — Rapport

Statut final : PASS

## Correction (app/api/commandes/route.ts)
- Ligne ordinaire sans promotion : insertion avec exactement les colonnes d'origine (order_id, product_id, product_name, quantity, unit_price, is_vip, selected_variants, variant_price_extra, variant_name, variant_price).
- Ligne avec promotion reelle (cadeau, promotion_rule_id, remise en pourcentage ou en montant > 0) : colonnes de promotion ajoutees (line_type, original_unit_price, discount_percent, discount_amount, is_promotion_gift, promotion_rule_id, promotion_label, can_trigger_promotion).
- Si l'insertion echoue pour colonne inconnue (code 42703, PGRST204, ou message column / schema cache) et qu'au moins une ligne portait des colonnes de promotion : un seul nouvel essai avec les colonnes d'origine pour toutes les lignes, et journal console.error avec uniquement le code d'erreur (aucune donnee client).
- Calcul des prix, regles de promotion et reste de la route : inchanges.

## Tests (tests/promotions-compat.test.mjs)
1. Commande sans promotion : colonnes d'origine uniquement.
2. Commande avec promotion : colonnes de promotion presentes.
3. Base simulee sans les colonnes : la commande aboutit au second essai (2 appels exactement, commande et lignes conservees, journal sans nom, telephone ni adresse).

## Verifications executees
- node --test tests/promotions-compat.test.mjs : 3/3
- npx tsc --noEmit : aucune erreur
- npm test : 150/150, 0 echec

## Limites connues
- Le faux client de base n'a pas de rpc : le test en fournit un localement (get_next_invoice_seq) via Object.prototype, retire en fin de test (hook after). Les helpers n'ont pas ete modifies (hors zone d'ecriture).
- L'erreur de colonne inconnue est simulee en surchargeant temporairement la methode interne du faux client ; le comportement reel de PostgREST/Supabase n'a pas ete teste contre une vraie base (interdit par le ticket).
- Le test 1 et 2 affichent un bruit "[Push commande] fetch failed" (appel reseau vers un hote factice) : sans effet sur le resultat.
- Un code d'erreur autre que colonne inconnue (ex. contrainte) n'est pas rejoue : la commande est supprimee comme avant (comportement existant conserve).
- Rien applique a une base, aucun push, .env.local non lu.
