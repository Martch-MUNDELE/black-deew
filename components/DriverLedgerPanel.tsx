'use client'
// BLAC-P3-033 : trésorerie (monnaie) et stock VIP embarqué d'une session ouverte.
import { useState } from 'react'
import {
  computeSessionCash,
  lowStockAlerts,
  vipStockBalance,
  type CashMovement,
  type SessionCash,
  type StockMovement,
} from '@/lib/driver-ledger'

export interface LedgerVipProduct {
  id: string
  name: string
}

interface Props {
  cashMovements: CashMovement[]
  stockMovements: StockMovement[]
  vipProducts: LedgerVipProduct[]
  currency: string
  busy?: boolean
  error?: string | null
  summary?: SessionCash | null
  onAddCash: (amount: number) => Promise<void> | void
  onRestock: (productId: string, quantity: number) => Promise<void> | void
}

const LBL = { fontSize: 9, color: '#7A6E58', textTransform: 'uppercase' as const, marginBottom: 2 }
const INP = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(232,160,32,0.2)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#F5EDD6',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box' as const,
}
const BTN = {
  background: 'rgba(232,160,32,0.12)',
  border: '1px solid rgba(232,160,32,0.3)',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#F5C842',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const CASH_LABELS: Record<string, string> = {
  opening: 'Fonds donné',
  topup: 'Complément',
  returned: 'Rendu',
  kept_for_next_day: 'Gardé pour le lendemain',
}

export default function DriverLedgerPanel({
  cashMovements,
  stockMovements,
  vipProducts,
  currency,
  busy = false,
  error = null,
  summary = null,
  onAddCash,
  onRestock,
}: Props) {
  const [cashOpen, setCashOpen] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [restockOpen, setRestockOpen] = useState(false)
  const [restockProduct, setRestockProduct] = useState('')
  const [restockQty, setRestockQty] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const cash = computeSessionCash({
    movements: cashMovements,
    deliveries: [],
    session: { driver_id: null, started_at: '' },
  })
  const balances = vipStockBalance(stockMovements)
  const alerts = new Map(lowStockAlerts(balances).map((a) => [a.product_id, a.level]))
  const nameOf = (id: string) => vipProducts.find((p) => p.id === id)?.name ?? id

  async function submitCash() {
    const amount = Number(cashAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError('Indique un montant de monnaie supérieur à zéro.')
      return
    }
    setLocalError(null)
    await onAddCash(amount)
    setCashAmount('')
    setCashOpen(false)
  }

  async function submitRestock() {
    const qty = Number(restockQty)
    if (!restockProduct) {
      setLocalError('Choisis un produit VIP à réapprovisionner.')
      return
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setLocalError('Indique une quantité entière supérieure à zéro.')
      return
    }
    setLocalError(null)
    await onRestock(restockProduct, qty)
    setRestockQty('')
    setRestockProduct('')
    setRestockOpen(false)
  }

  const shownError = localError ?? error

  return (
    <div data-testid="driver-ledger-panel" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#C8B99A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>💵 Monnaie du livreur</div>
      {cashMovements.length === 0 && <div style={{ fontSize: 12, color: '#7A6E58' }}>Aucune monnaie donnée.</div>}
      {cashMovements.map((m, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#F5EDD6', padding: '3px 0' }}>
          <span>{CASH_LABELS[m.kind] ?? m.kind}</span>
          <span>{Number(m.amount || 0).toFixed(0)} {currency}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#F5C842', fontWeight: 700, borderTop: '1px solid rgba(232,160,32,0.12)', marginTop: 6, paddingTop: 6 }}>
        <span>Argent sur le livreur</span>
        <span>{cash.cashOnHand.toFixed(0)} {currency}</span>
      </div>
      {summary && (
        <div data-testid="driver-ledger-summary" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(232,160,32,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#F5EDD6', padding: '2px 0' }}>
            <span>CA collecté</span><span>+ {summary.collected.toFixed(0)} {currency}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#F5EDD6', padding: '2px 0' }}>
            <span>Frais livreur</span><span>- {summary.driverFees.toFixed(0)} {currency}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#F5C842', fontWeight: 700, padding: '4px 0' }}>
            <span>Net à remettre</span><span>{summary.netToRemit.toFixed(0)} {currency}</span>
          </div>
        </div>
      )}
      {!cashOpen ? (
        <button type="button" style={{ ...BTN, marginTop: 10 }} onClick={() => setCashOpen(true)} disabled={busy}>Ajouter de la monnaie</button>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={LBL}>Montant à ajouter</div>
            <input type="number" min="0" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0" style={INP} />
          </div>
          <button type="button" style={BTN} onClick={submitCash} disabled={busy}>Valider</button>
          <button type="button" style={{ ...BTN, color: '#C8B99A' }} onClick={() => { setCashOpen(false); setLocalError(null) }}>Annuler</button>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#C8B99A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '16px 0 10px' }}>👑 Stock VIP embarqué</div>
      {balances.length === 0 && <div style={{ fontSize: 12, color: '#7A6E58' }}>Aucun produit VIP embarqué.</div>}
      {balances.map((b) => {
        const level = alerts.get(b.product_id)
        return (
          <div key={b.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#F5EDD6', padding: '4px 0', gap: 8 }}>
            <span style={{ flex: 1 }}>{nameOf(b.product_id)}</span>
            <span>En main : <strong>{b.onHand}</strong></span>
            <span style={{ color: '#C8B99A' }}>Livré : {b.delivered}</span>
            {level && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: level === 'empty' ? 'rgba(255,107,107,0.15)' : 'rgba(245,200,66,0.15)', color: level === 'empty' ? '#FF6B6B' : '#F5C842' }}>
                {level === 'empty' ? 'Épuisé' : 'Stock bas'}
              </span>
            )}
          </div>
        )
      })}
      {!restockOpen ? (
        <button type="button" style={{ ...BTN, marginTop: 10 }} onClick={() => setRestockOpen(true)} disabled={busy || vipProducts.length === 0}>Réapprovisionner</button>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 140 }}>
            <div style={LBL}>Produit VIP</div>
            <select value={restockProduct} onChange={(e) => setRestockProduct(e.target.value)} style={INP}>
              <option value="">Choisir…</option>
              {vipProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <div style={LBL}>Quantité</div>
            <input type="number" min="1" step="1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder="0" style={INP} />
          </div>
          <button type="button" style={BTN} onClick={submitRestock} disabled={busy}>Valider</button>
          <button type="button" style={{ ...BTN, color: '#C8B99A' }} onClick={() => { setRestockOpen(false); setLocalError(null) }}>Annuler</button>
        </div>
      )}
      {shownError && <div role="alert" style={{ marginTop: 10, fontSize: 12, color: '#FF6B6B' }}>{shownError}</div>}
    </div>
  )
}
