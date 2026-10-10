'use client'
import Link from 'next/link'
import { useVipPendingDetail } from '@/lib/use-vip-pending-count'
export default function VipPendingBanner() {
  const { access, reset, total: count } = useVipPendingDetail('admin-vip-banner')
  if (count <= 0) return null
  const parts: string[] = []
  if (access > 0) parts.push(`${access} demande${access > 1 ? 's' : ''} d’accès`)
  if (reset > 0) parts.push(`${reset} réinitialisation${reset > 1 ? 's' : ''}`)
  const detail = parts.join(' et ')
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        margin: '0 0 16px',
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid rgba(245,200,66,0.35)',
        background: 'rgba(245,200,66,0.10)',
        color: '#F5C842',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      <span>
        {count} demande{count > 1 ? 's' : ''} VIP en attente
        {detail && <span style={{ marginLeft: 8, fontWeight: 500, opacity: 0.85 }}>({detail})</span>}
      </span>
      <Link
        href="/admin/settings?tab=vip#vip-requests"
        style={{
          padding: '6px 14px',
          borderRadius: 50,
          background: 'linear-gradient(135deg,#F5C842,#FF6B20)',
          color: '#0A0804',
          fontWeight: 800,
          fontSize: 12,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Voir
      </Link>
    </div>
  )
}
