// =============================================
// MODULE TVA GÉNÉRIQUE — Base food (BF-P1-001)
// =============================================
//
// Règles métier :
//   - Les prix manipulés sont des prix TTC.
//   - La TVA est EXTRAITE du TTC, elle ne s'ajoute jamais au prix.
//   - HT / TVA / TTC ne s'affichent que dans les récapitulatifs
//     (panier, facture PDF, lien facture, email).
//   - La logique est générique : aucune règle client codée en dur.
//     Une ligne est facturable/taxable par défaut ; un drapeau
//     optionnel peut la désactiver côté données.

import type {
  TaxSettings,
  TaxLine,
  TaxBreakdown,
  OrderTaxSummary,
} from '@/lib/types/tax'

type SettingRow = { key: string; value: string | number | boolean | null }

/** Arrondit un montant à 2 décimales (centimes). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Normalise un taux de TVA depuis settings (string ou number).
 * Accepte "20", "20%", "20,5". Renvoie 0 si invalide. Borné >= 0.
 */
export function parseTaxRate(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').replace(',', '.').trim()
    const parsed = parseFloat(cleaned)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }
  return 0
}

/** Normalise l'activation TVA depuis settings ("true"/true => activé). */
export function parseTaxEnabled(value: unknown): boolean {
  return value === true || value === 'true'
}

/** Extrait les réglages TVA depuis les lignes brutes de la table settings. */
export function getTaxSettingsFromRows(rows: SettingRow[] | null | undefined): TaxSettings {
  const enabledRow = rows?.find((r) => r.key === 'tax_enabled')?.value
  const rateRow = rows?.find((r) => r.key === 'tax_rate')?.value
  return {
    taxEnabled: parseTaxEnabled(enabledRow),
    taxRate: parseTaxRate(rateRow),
  }
}

/**
 * Décompose un montant TTC en HT / TVA / TTC.
 * Le TTC est inchangé ; la TVA est extraite : HT = TTC / (1 + taux).
 * Si la TVA est désactivée ou le taux nul, TVA = 0 et HT = TTC.
 */
export function calculateTaxFromTtc(ttc: number, rate: number): TaxBreakdown {
  const safeTtc = Number.isFinite(ttc) && ttc > 0 ? ttc : 0
  if (!(rate > 0)) {
    return { ht: roundMoney(safeTtc), tax: 0, ttc: roundMoney(safeTtc) }
  }
  const ht = safeTtc / (1 + rate / 100)
  const tax = safeTtc - ht
  return { ht: roundMoney(ht), tax: roundMoney(tax), ttc: roundMoney(safeTtc) }
}

/** Une ligne est facturable sauf si explicitement marquée `invoiceable: false`. */
export function isInvoiceableLine(line: TaxLine): boolean {
  return line.invoiceable !== false
}

/** Une ligne est taxable sauf si explicitement marquée `taxable: false`. */
export function isTaxableLine(line: TaxLine): boolean {
  return line.taxable !== false
}

/** Indique si au moins une ligne de la commande est facturable. */
export function hasInvoiceableItems(lines: TaxLine[] | null | undefined): boolean {
  return (lines ?? []).some(isInvoiceableLine)
}

/** Montant TTC d'une ligne. */
function lineTtc(line: TaxLine): number {
  const qty = Number(line.quantity) || 0
  const price = Number(line.unit_price) || 0
  return qty * price
}

/**
 * Calcule le récapitulatif TVA d'une commande.
 *
 * - totalPaidTtc : toutes les lignes + frais de livraison (ce que paie le client).
 * - invoiceableTtc : lignes facturables + frais de livraison (base de la facture).
 * - taxableTtc : lignes facturables ET taxables (base de calcul de la TVA).
 * - La TVA est extraite de la base taxable uniquement.
 * - Les frais de livraison sont payés par le client.
 * - Ils deviennent facturables et taxables selon les options passées par le projet.
 */
export function calculateOrderTaxSummary(
  lines: TaxLine[] | null | undefined,
  settings: TaxSettings,
  extras?: { deliveryFee?: number; deliveryInvoiceable?: boolean; deliveryTaxable?: boolean }
): OrderTaxSummary {
  const safeLines = lines ?? []
  const deliveryFee = Number(extras?.deliveryFee) || 0
  const hasInvoiceable = hasInvoiceableItems(safeLines)
  const deliveryInvoiceable = extras?.deliveryInvoiceable ?? true
  const deliveryTaxable = extras?.deliveryTaxable === true
  const rate = settings.taxEnabled ? settings.taxRate : 0

  let totalPaidTtc = 0
  let invoiceableTtc = 0
  let taxableTtc = 0

  for (const line of safeLines) {
    const amount = lineTtc(line)
    totalPaidTtc += amount
    if (isInvoiceableLine(line)) {
      invoiceableTtc += amount
      if (isTaxableLine(line)) taxableTtc += amount
    }
  }

  // Frais de livraison :
  // - toujours payé par le client quand il existe ;
  // - facturable seulement si le projet/appel le demande ;
  // - taxable seulement si la livraison est facturable et taxable.
  totalPaidTtc += deliveryFee
  if (deliveryInvoiceable) {
    invoiceableTtc += deliveryFee
    if (deliveryTaxable) taxableTtc += deliveryFee
  }

  const taxable = calculateTaxFromTtc(taxableTtc, rate)
  const tax = taxable.tax
  const ht = roundMoney(invoiceableTtc - tax)

  return {
    taxEnabled: settings.taxEnabled,
    taxRate: settings.taxRate,
    totalPaidTtc: roundMoney(totalPaidTtc),
    invoiceableTtc: roundMoney(invoiceableTtc),
    taxableTtc: roundMoney(taxableTtc),
    ht,
    tax,
    ttc: roundMoney(invoiceableTtc),
    hasInvoiceable,
  }
}
