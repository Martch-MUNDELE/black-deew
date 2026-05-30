import type React from 'react'

type TaxSummary = {
  ttc: number
  ht: number
  tax: number
  taxableTtc?: number
}

type CartInvoiceSummaryProps = {
  mode: 'cart' | 'delivery'
  currency: string
  totalProductsTtc: number
  deliveryFee: number
  deliveryLabel: string
  deliveryTextColor?: string
  grandTotal: number
  showTaxBreakdown: boolean
  taxRate: number
  taxSummary: TaxSummary
  invoiceableProductsTtc: number
  invoiceableDeliveryFee: number
  showNonInvoiceableTotal?: boolean
  nonInvoiceableProductsTotal?: number
  showVipBreakdown?: boolean
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '11px 0',
  borderBottom: '1px solid rgba(232,160,32,0.06)',
  fontSize: 13,
  color: '#C8B99A',
}

const amountStyle: React.CSSProperties = {
  color: '#F5EDD6',
  fontWeight: 600,
}

export default function CartInvoiceSummary({
  mode,
  currency,
  totalProductsTtc,
  deliveryFee,
  deliveryLabel,
  deliveryTextColor = '#C8B99A',
  grandTotal,
  showTaxBreakdown,
  taxRate,
  taxSummary,
  invoiceableProductsTtc,
  invoiceableDeliveryFee,
  showNonInvoiceableTotal = false,
  nonInvoiceableProductsTotal = 0,
  showVipBreakdown = false,
}: CartInvoiceSummaryProps) {
  const isCart = mode === 'cart'
  const deliveryText = isCart ? deliveryLabel : `${deliveryFee.toFixed(2)} ${currency}`
  const totalLabel = isCart ? 'Total provisoire' : 'Total final à payer'
  const totalAmount = isCart ? totalProductsTtc : grandTotal

  return (
    <div style={{ marginTop: 4 }}>
      <div style={rowStyle}>
        <span>Sous-total produits</span>
        <span style={amountStyle}>{totalProductsTtc.toFixed(2)} {currency}</span>
      </div>

      <div style={rowStyle}>
        <span>Frais de livraison</span>
        <span style={{ color: isCart ? deliveryTextColor : amountStyle.color, fontWeight: 600 }}>{deliveryText}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', fontSize: 15, fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>
        <span style={{ color: '#C8B99A' }}>{totalLabel}</span>
        <span style={{ color: '#F5C842' }}>{totalAmount.toFixed(2)} {currency}</span>
      </div>

      {!isCart && showTaxBreakdown && (
        <div style={{ marginTop: 8, padding: '12px 14px', marginBottom: 14, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))', border: '1px solid rgba(232,160,32,0.14)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#F5C842', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>Détail facture</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A89880' }}>
            <span style={{ fontWeight: 700 }}>Produits taxables</span>
            <span style={{ color: '#F5EDD6', fontWeight: 700 }}>{invoiceableProductsTtc.toFixed(2)} {currency}</span>
          </div>

          {invoiceableDeliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A89880' }}>
              <span>Livraison facturable</span>
              <span style={{ color: '#C8B99A', fontWeight: 600 }}>{invoiceableDeliveryFee.toFixed(2)} {currency}</span>
            </div>
          )}

          {invoiceableDeliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A89880', paddingTop: 7, marginTop: 3, borderTop: '1px solid rgba(232,160,32,0.08)' }}>
              <span style={{ fontWeight: 700 }}>Total taxable TTC</span>
              <span style={{ color: '#F5EDD6', fontWeight: 700 }}>{(taxSummary.taxableTtc ?? taxSummary.ttc).toFixed(2)} {currency}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A89880' }}>
            <span>Dont HT</span>
            <span style={{ color: '#C8B99A', fontWeight: 600 }}>{taxSummary.ht.toFixed(2)} {currency}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A89880' }}>
            <span>TVA ({taxRate}%)</span>
            <span style={{ color: '#C8B99A', fontWeight: 600 }}>{taxSummary.tax.toFixed(2)} {currency}</span>
          </div>

          {showVipBreakdown && showNonInvoiceableTotal && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 12, color: '#A89880', paddingTop: 7, marginTop: 3, borderTop: '1px solid rgba(232,160,32,0.08)' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 700 }}>Produits VIP non taxables</span>
                <span style={{ fontSize: 10, color: '#7A6E58' }}>TVA 0 %</span>
              </span>
              <span style={{ color: '#C8B99A', fontWeight: 600 }}>{nonInvoiceableProductsTotal.toFixed(2)} {currency}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
