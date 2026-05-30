// =============================================
// TYPES TVA GÉNÉRIQUE — Base food (BF-P1-001)
// =============================================
//
// Modèle générique, sans règle client codée en dur.
// La logique repose uniquement sur deux notions par ligne :
//   - facturable (invoiceable) : la ligne apparaît sur la facture
//   - taxable                  : la ligne supporte de la TVA
//
// Par défaut, une ligne est facturable ET taxable (comportement
// historique de Base food). Un projet client (ex : Black Deew, plus
// tard) pourra marquer certaines lignes comme non facturables /
// non taxables sans toucher à cette logique.

/** Réglages TVA globaux du site, stockés dans la table settings. */
export interface TaxSettings {
  /** TVA activée pour le site. */
  taxEnabled: boolean
  /** Taux de TVA global en pourcentage (ex : 20 pour 20%). */
  taxRate: number
}

/**
 * Ligne de commande minimale comprise par le module TVA.
 * Les champs `invoiceable` / `taxable` sont optionnels : absents,
 * la ligne est considérée facturable et taxable.
 */
export interface TaxLine {
  quantity: number
  unit_price: number
  /** false => ligne non facturable (absente de la facture). Défaut : true. */
  invoiceable?: boolean
  /** false => ligne non taxable (pas de TVA dessus). Défaut : true. */
  taxable?: boolean
}

/** Décomposition HT / TVA / TTC d'un montant. */
export interface TaxBreakdown {
  /** Montant hors taxe. */
  ht: number
  /** Montant de TVA. */
  tax: number
  /** Montant toutes taxes comprises. */
  ttc: number
}

/** Récapitulatif TVA d'une commande complète. */
export interface OrderTaxSummary {
  /** Réglages TVA appliqués. */
  taxEnabled: boolean
  taxRate: number
  /** Total réellement payé par le client (toutes lignes + livraison). */
  totalPaidTtc: number
  /** Total TTC des lignes facturables (base de la facture, livraison incluse). */
  invoiceableTtc: number
  /** Total TTC des lignes taxables (base de calcul de la TVA). */
  taxableTtc: number
  /** Part HT de la facture. */
  ht: number
  /** Montant de TVA de la facture. */
  tax: number
  /** Total TTC de la facture (= invoiceableTtc). */
  ttc: number
  /** Au moins une ligne facturable est présente. */
  hasInvoiceable: boolean
}
