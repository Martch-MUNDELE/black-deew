'use client'
// BLAC-P3-033 : fenêtre de clôture d'une session livreur (rendu / gardé pour la monnaie et chaque produit VIP).
import { useState } from 'react'
import { LedgerError, buildClosingMovements, type ClosingDecisions } from '@/lib/driver-ledger'
import { writeClosingMovements, type LedgerClient } from '@/lib/driver-ledger-data'

export interface CloseStockLine {
  product_id: string
  name: string
  onHand: number
}

export interface CloseResult {
  cashReturned: number
  cashKept: number
  /** Net réellement remis : net à remettre calculé (computeSessionCash) moins la monnaie gardée. */
  netToRemit: number
}

interface Props {
  client: LedgerClient
  sessionId: string
  driverId: string
  driverName: string
  currency: string
  cashOnHand: number
  netToRemit: number
  stock: CloseStockLine[]
  onCancel: () => void
  onClosed: (result: CloseResult) => Promise<void> | void
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

function num(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

export default function DriverCloseDialog({
  client,
  sessionId,
  driverId,
  driverName,
  currency,
  cashOnHand,
  netToRemit,
  stock,
  onCancel,
  onClosed,
}: Props) {
  const [cashReturned, setCashReturned] = useState(String(cashOnHand))
  const [cashKept, setCashKept] = useState('0')
  const [lines, setLines] = useState<Record<string, { returned: string; kept: string }>>(
    () => Object.fromEntries(stock.map((s) => [s.product_id, { returned: String(s.onHand), kept: '0' }]))
  )
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const stockOnHand = Object.fromEntries(stock.map((s) => [s.product_id, s.onHand]))
  const decisions: ClosingDecisions = {
    cash: { returned: num(cashReturned), kept: num(cashKept) },
    stock: Object.fromEntries(
      stock.map((s) => [s.product_id, { returned: num(lines[s.product_id]?.returned ?? ''), kept: num(lines[s.product_id]?.kept ?? '') }])
    ),
  }

  let problem: string | null = null
  try {
    buildClosingMovements({ cashOnHand, stockOnHand, decisions })
  } catch (e) {
    problem = e instanceof LedgerError ? e.message : 'Décisions de clôture invalides.'
  }

  function setLine(productId: string, key: 'returned' | 'kept', value: string) {
    setLines((prev) => ({ ...prev, [productId]: { ...prev[productId], [key]: value } }))
  }

  async function confirm() {
    if (problem || loading) return
    setLoading(true)
    setSubmitError(null)
    try {
      const written = await writeClosingMovements(client, {
        session_id: sessionId,
        driver_id: driverId,
        cashOnHand,
        stockOnHand,
        decisions,
      })
      await onClosed({
        cashReturned: written.cashReturned,
        cashKept: written.cashKept,
        netToRemit: netToRemit - written.cashKept,
      })
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Clôture impossible.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div data-testid="driver-close-dialog" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#1A1610', border: '1px solid rgba(232,160,32,0.25)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: '#F5EDD6', margin: '0 0 6px' }}>Clôturer la session</h2>
        <div style={{ fontSize: 12, color: '#C8B99A', marginBottom: 16 }}>{driverName}</div>

        <div style={{ fontSize: 11, color: '#C8B99A', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Argent sur le livreur : {cashOnHand.toFixed(0)} {currency}</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={LBL}>Rendu</div>
            <input type="number" min="0" step="any" value={cashReturned} onChange={(e) => setCashReturned(e.target.value)} style={INP} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={LBL}>Gardé pour demain</div>
            <input type="number" min="0" step="any" value={cashKept} onChange={(e) => setCashKept(e.target.value)} style={INP} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#C8B99A', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Produits VIP restants</div>
        {stock.length === 0 && <div style={{ fontSize: 12, color: '#7A6E58', marginBottom: 16 }}>Aucun produit VIP embarqué.</div>}
        {stock.map((s) => (
          <div key={s.product_id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#F5EDD6', marginBottom: 4 }}>{s.name} <span style={{ color: '#7A6E58' }}>(en main : {s.onHand})</span></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={LBL}>Rendu</div>
                <input type="number" min="0" step="1" value={lines[s.product_id]?.returned ?? ''} onChange={(e) => setLine(s.product_id, 'returned', e.target.value)} style={INP} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={LBL}>Gardé</div>
                <input type="number" min="0" step="1" value={lines[s.product_id]?.kept ?? ''} onChange={(e) => setLine(s.product_id, 'kept', e.target.value)} style={INP} />
              </div>
            </div>
          </div>
        ))}

        <div style={{ fontSize: 12, color: '#F5C842', margin: '12px 0' }}>Net à remettre après clôture : {(netToRemit - (Number.isFinite(num(cashKept)) ? num(cashKept) : 0)).toFixed(0)} {currency}</div>

        {(problem || submitError) && <div role="alert" style={{ fontSize: 12, color: '#FF6B6B', marginBottom: 12 }}>{submitError ?? problem}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={loading} style={{ background: 'transparent', border: '1px solid rgba(122,110,88,0.4)', borderRadius: 8, padding: '10px 16px', color: '#C8B99A', cursor: 'pointer' }}>Annuler</button>
          <button type="button" onClick={confirm} disabled={loading || problem !== null} style={{ background: 'rgba(232,160,32,0.2)', border: '1px solid rgba(232,160,32,0.4)', borderRadius: 8, padding: '10px 16px', color: '#F5C842', fontWeight: 700, cursor: problem ? 'not-allowed' : 'pointer', opacity: problem ? 0.5 : 1 }}>
            {loading ? 'Clôture...' : 'Clôturer la session'}
          </button>
        </div>
      </div>
    </div>
  )
}
