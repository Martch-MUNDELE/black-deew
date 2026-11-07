import { redirect } from 'next/navigation'
import DriverDeliveryDetail from '@/components/driver/DriverDeliveryDetail'
import { getAdminRole } from '@/lib/admin-role-server'
import { getDriverDelivery } from '@/lib/driver-space-server'
import type { DriverDeliveryDetail as DriverDeliveryDetailData } from '@/lib/driver-space'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// BLAC-P3-049 : detail d'une livraison, lecture serveur uniquement, limitee au livreur de la session.
export default async function DriverDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const info = await getAdminRole()
  const driver = info?.role === 'driver' ? info.driver : null
  if (!driver?.id) redirect('/admin/driver')

  const { id } = await params
  let delivery: DriverDeliveryDetailData | null = null
  let error: string | null = null
  if (UUID_RE.test(id)) {
    try {
      delivery = await getDriverDelivery(driver.id, id)
    } catch {
      error = 'Impossible de lire cette livraison pour le moment.'
    }
  }

  return <DriverDeliveryDetail delivery={delivery} error={error} />
}
