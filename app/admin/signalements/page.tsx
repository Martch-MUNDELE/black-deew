// BLAC-ADMIN-SIGNALEMENTS : ecran de controle des signalements livreurs (admin et super admin uniquement).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getAdminRole } from '@/lib/admin-role-server'
import { ACCESS_DENIED_REDIRECT, DRIVER_HOME } from '@/lib/admin-role'
import { reportKindLabel, type DeliveryReport } from '@/lib/delivery-reports'
import {
  canAccessReports,
  countOpenReports,
  filterReports,
  parseReportFilter,
  reportStatusLabel,
  sortReports,
  type AdminReportRow,
} from '@/lib/delivery-reports-admin'
import SignalementsPanel from '@/components/admin/SignalementsPanel'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ filter?: string | string[] }>

async function loadRows(): Promise<{ rows: AdminReportRow[]; error: string | null }> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await db.from('delivery_reports').select('*').order('created_at', { ascending: false })
  if (error) {
    return { rows: [], error: "Les signalements ne sont pas disponibles (la migration delivery_reports est-elle appliquee ?)." }
  }
  const reports = (data ?? []) as DeliveryReport[]
  if (reports.length === 0) return { rows: [], error: null }

  const deliveryIds = Array.from(new Set(reports.map(r => r.delivery_id)))
  const driverIds = Array.from(new Set(reports.map(r => r.driver_id).filter((v): v is string => !!v)))

  const { data: deliveries } = await db.from('order_deliveries').select('id, order_id, delivery_address').in('id', deliveryIds)
  const deliveryMap = new Map<string, { order_id: string; delivery_address: string | null }>()
  for (const d of (deliveries ?? []) as { id: string; order_id: string; delivery_address: string | null }[]) deliveryMap.set(d.id, d)

  const orderIds = Array.from(new Set(Array.from(deliveryMap.values()).map(d => d.order_id)))
  const orderMap = new Map<string, { customer_name: string | null; customer_address: string | null }>()
  if (orderIds.length > 0) {
    const { data: orders } = await db.from('orders').select('id, customer_name, customer_address').in('id', orderIds)
    for (const o of (orders ?? []) as { id: string; customer_name: string | null; customer_address: string | null }[]) orderMap.set(o.id, o)
  }

  const driverMap = new Map<string, string | null>()
  if (driverIds.length > 0) {
    const { data: drivers } = await db.from('delivery_drivers').select('id, full_name').in('id', driverIds)
    for (const d of (drivers ?? []) as { id: string; full_name: string | null }[]) driverMap.set(d.id, d.full_name)
  }

  const rows: AdminReportRow[] = reports.map(r => {
    const delivery = deliveryMap.get(r.delivery_id)
    const order = delivery ? orderMap.get(delivery.order_id) : undefined
    return {
      id: r.id,
      created_at: r.created_at,
      driver_name: r.driver_id ? driverMap.get(r.driver_id) ?? null : null,
      customer_name: order?.customer_name ?? null,
      address: delivery?.delivery_address ?? order?.customer_address ?? null,
      kind: r.kind,
      kind_label: reportKindLabel(r.kind),
      note: r.note,
      status: r.status,
      status_label: reportStatusLabel(r.status),
      handled_at: r.handled_at,
      handled_by: r.handled_by,
      handled_decision: r.handled_decision,
    }
  })
  return { rows, error: null }
}

export default async function SignalementsPage({ searchParams }: { searchParams: SearchParams }) {
  const info = await getAdminRole()
  if (!info) redirect('/admin/login')
  if (!canAccessReports(info.role)) {
    redirect(info.role === 'driver' ? DRIVER_HOME : ACCESS_DENIED_REDIRECT)
  }

  const sp = await searchParams
  const filter = parseReportFilter(Array.isArray(sp.filter) ? sp.filter[0] : sp.filter)
  const { rows, error } = await loadRows()
  const sorted = sortReports(rows.map(r => ({ ...r })))
  const visible = filterReports(sorted, filter)
  const openCount = countOpenReports(rows)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid rgba(245,240,230,0.2)',
    background: active ? 'rgba(245,240,230,0.14)' : 'transparent',
    color: '#F5F0E6',
    textDecoration: 'none',
    fontSize: 14,
  })

  return (
    <div style={{ color: '#F5F0E6' }}>
      <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>Signalements livreurs</h1>
      <p style={{ margin: '0 0 16px', opacity: 0.75, fontSize: 14 }}>
        {openCount} signalement{openCount > 1 ? 's' : ''} ouvert{openCount > 1 ? 's' : ''}. Tu décides de la suite ; aucune action ne modifie le stock ni l&apos;argent.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Link href="/admin/signalements" style={tabStyle(filter === 'open')}>Ouverts</Link>
        <Link href="/admin/signalements?filter=all" style={tabStyle(filter === 'all')}>Tous</Link>
      </div>
      {error ? <p role="alert" style={{ color: '#E8A0A0' }}>{error}</p> : <SignalementsPanel rows={visible} />}
    </div>
  )
}
