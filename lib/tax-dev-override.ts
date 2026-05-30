// =============================================
// OVERRIDE TVA — TEST LOCAL UNIQUEMENT (BF-P1-001 pilote Black Deew)
// =============================================
//
// ⚠️ FICHIER TEMPORAIRE DE TEST — À RETIRER AVANT MISE EN PRODUCTION.
//
// Black Deew local pointe vers le Supabase de PRODUCTION : on ne doit donc
// écrire AUCUN réglage (tax_enabled / tax_rate) en base. Or sans ces lignes
// en base, la TVA reste invisible au runtime, ce qui empêche le test visuel.
//
// Ce module permet de FORCER l'affichage TVA en local sans rien écrire en
// Supabase, via deux variables d'environnement :
//   NEXT_PUBLIC_TAX_OVERRIDE=true
//   NEXT_PUBLIC_TAX_RATE=16
//
// Double garde-fou : l'override est ignoré dès que NODE_ENV === 'production'
// (donc inactif sur un build/déploiement prod, même si la variable traîne).

import { getTaxSettingsFromRows, parseTaxRate } from '@/lib/tax'
import type { TaxSettings } from '@/lib/types/tax'

type SettingRow = { key: string; value: string | number | boolean | null }

export function resolveTaxSettings(rows: SettingRow[] | null | undefined): TaxSettings {
  const fromDb = getTaxSettingsFromRows(rows)

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_TAX_OVERRIDE === 'true'
  ) {
    return {
      taxEnabled: true,
      taxRate: parseTaxRate(process.env.NEXT_PUBLIC_TAX_RATE ?? '16'),
    }
  }

  return fromDb
}
