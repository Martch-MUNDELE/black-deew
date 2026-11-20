'use client'
// BLAC-ADMIN-SIGNALEMENTS : liste des signalements et boutons de decision.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { canApply, decisionLabel, REPORT_ACTIONS, type AdminReportRow, type ReportAction } from '@/lib/delivery-reports-admin'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const card: React.CSSProperties = {
  border: '1px solid rgba(245,240,230,0.18)',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  background: 'rgba(245,240,230,0.04)',
}

export default function SignalementsPanel({ rows }: { rows: AdminReportRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(id: string, action: ReportAction) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/delivery-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Enregistrement impossible')
      } else {
        router.refresh()
      }
    } catch {
      setError('Enregistrement impossible')
    } finally {
      setBusyId(null)
    }
  }

  if (rows.length === 0) return <p style={{ opacity: 0.75 }}>Aucun signalement à afficher.</p>

  return (
    <div>
      {error && <p role="alert" style={{ color: '#E8A0A0' }}>{error}</p>}
      {rows.map(r => (
        <article key={r.id} style={card} data-status={r.status}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong>{r.kind_label}</strong>
            <span style={{ fontSize: 13, opacity: 0.85 }}>{r.status_label}</span>
          </div>
          <dl style={{ margin: '8px 0', fontSize: 14, lineHeight: 1.6 }}>
            <div><dt style={{ display: 'inline', opacity: 0.7 }}>Date : </dt><dd style={{ display: 'inline', margin: 0 }}>{formatDate(r.created_at)}</dd></div>
            <div><dt style={{ display: 'inline', opacity: 0.7 }}>Livreur : </dt><dd style={{ display: 'inline', margin: 0 }}>{r.driver_name ?? 'Livreur inconnu'}</dd></div>
            <div><dt style={{ display: 'inline', opacity: 0.7 }}>Client : </dt><dd style={{ display: 'inline', margin: 0 }}>{r.customer_name ?? 'Client inconnu'}</dd></div>
            <div><dt style={{ display: 'inline', opacity: 0.7 }}>Adresse : </dt><dd style={{ display: 'inline', margin: 0 }}>{r.address ?? 'Adresse inconnue'}</dd></div>
            {r.note && <div><dt style={{ display: 'inline', opacity: 0.7 }}>Précisions : </dt><dd style={{ display: 'inline', margin: 0 }}>{r.note}</dd></div>}
            {r.handled_at && (
              <div style={{ opacity: 0.8 }}>
                {decisionLabel(r.handled_decision)} le {formatDate(r.handled_at)}{r.handled_by ? ` par ${r.handled_by}` : ''}
              </div>
            )}
          </dl>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REPORT_ACTIONS.filter(a => canApply(a.value, r.status)).map(a => (
              <button
                key={a.value}
                type="button"
                disabled={busyId === r.id}
                onClick={() => decide(r.id, a.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(245,240,230,0.3)',
                  background: 'transparent',
                  color: '#F5F0E6',
                  cursor: busyId === r.id ? 'wait' : 'pointer',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}
