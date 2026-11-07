import Link from 'next/link'
import AdminLogoutButton from '@/components/admin/AdminLogoutButton'
import DriverHome from '@/components/driver/DriverHome'
import { getAdminRole } from '@/lib/admin-role-server'
import { getDriverHome } from '@/lib/driver-space-server'
import type { DriverHomeData } from '@/lib/driver-space'

export const dynamic = 'force-dynamic'

// BLAC-P3-048 : accueil du livreur. Lecture cote serveur uniquement (cle service_role), limitee a SON identifiant.
export default async function DriverSpacePage() {
  const info = await getAdminRole()
  const driver = info?.driver ?? null

  if (!driver) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#C8B99A', letterSpacing: '2px', textTransform: 'uppercase' }}>Black Deew</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#D4AF37', margin: '4px 0 0' }}>Espace livreur</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 15, color: '#C8B99A', margin: 0 }}>Aucun profil livreur lié à ce compte</p>
          <Link href="/admin" style={{ color: '#D4AF37', fontSize: 14 }}>
            Retour à l&apos;administration
          </Link>
        </div>
        <div>
          <AdminLogoutButton />
        </div>
      </section>
    )
  }

  let initial: DriverHomeData | null = null
  let initialError: string | null = null
  try {
    initial = await getDriverHome(driver.id, driver.full_name)
  } catch {
    initialError = 'Impossible de lire tes données pour le moment.'
  }

  return <DriverHome initial={initial} initialError={initialError} driverName={driver.full_name} />
}
