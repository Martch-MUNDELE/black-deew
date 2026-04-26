// =============================================
// TYPES BILLING PLATEFORME — Étape 1
// =============================================

export type BillingMode =
  | 'flat_only'
  | 'flat_percent'
  | 'flat_tiered'
  | 'flat_category'
  | 'flat_per_order'

export type BillingPeriodStatus =
  | 'en_cours'
  | 'cloture'
  | 'facture'
  | 'paye'

export type BillingAdjustmentType =
  | 'remise'
  | 'avoir'
  | 'correction'
  | 'frais'

export type CommissionRuleType =
  | 'tier'
  | 'category'
  | 'flat_percent'
  | 'per_order'

export interface ClientContract {
  id: string
  client_id: string
  started_at: string
  ended_at?: string
  billing_mode: BillingMode
  flat_fee_amount: number
  flat_fee_currency: string
  minimum_guarantee?: number
  maximum_cap?: number
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CommissionRule {
  id: string
  contract_id: string
  rule_type: CommissionRuleType
  tier_from?: number
  tier_to?: number
  category_slug?: string
  rate_percent?: number
  amount_per_order?: number
  effective_from: string
  effective_to?: string
  created_at: string
}

export interface BillingPeriod {
  id: string
  client_id: string
  period_start: string
  period_end: string
  status: BillingPeriodStatus
  flat_fee_amount: number
  commission_amount: number
  adjustments_total: number
  total_due: number
  total_paid: number
  orders_count: number
  orders_base_amount: number
  locked_at?: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export interface BillingAdjustment {
  id: string
  billing_period_id: string
  type: BillingAdjustmentType
  amount: number
  reason?: string
  created_by?: string
  created_at: string
}

export interface ContractHistory {
  id: string
  contract_id: string
  changed_at: string
  changed_by?: string
  old_snapshot: Partial<ClientContract>
  new_snapshot: Partial<ClientContract>
  reason?: string
}

export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
  flat_only:      'Abonnement fixe uniquement',
  flat_percent:   'Fixe + pourcentage simple',
  flat_tiered:    'Fixe + pourcentage par paliers',
  flat_category:  'Fixe + pourcentage par catégorie',
  flat_per_order: 'Fixe + montant fixe par commande',
}

export const BILLING_STATUS_LABELS: Record<BillingPeriodStatus, string> = {
  en_cours: 'En cours',
  cloture:  'Clôturé',
  facture:  'Facturé',
  paye:     'Payé',
}

export const ADJUSTMENT_TYPE_LABELS: Record<BillingAdjustmentType, string> = {
  remise:     'Remise',
  avoir:      'Avoir',
  correction: 'Correction',
  frais:      'Frais supplémentaire',
}
