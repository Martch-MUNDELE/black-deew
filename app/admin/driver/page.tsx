import Link from 'next/link'
import AdminLogoutButton from '@/components/admin/AdminLogoutButton'
import { getAdminRole } from '@/lib/admin-role-server'

export const dynamic = 'force-dynamic'

// BLAC-P3-046 : socle de l'espace livreur (les ecrans viendront dans d'autres tickets).
export default async function DriverSpacePage() {
  const info = await getAdminRole()
  const driver = info?.driver ?? null

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, color: '#C8B99A', letterSpacing: '2px', textTransform: 'uppercase' }}>Black Deew</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#D4AF37', margin: '4px 0 0' }}>Espace livreur</h1>
      </div>
      {driver ? (
        <p style={{ fontSize: 16, color: '#F5F0E6', margin: 0 }}>{driver.full_name ?? 'Livreur'}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 15, color: '#C8B99A', margin: 0 }}>Aucun profil livreur lié à ce compte</p>
          <Link href="/admin" style={{ color: '#D4AF37', fontSize: 14 }}>
            Retour à l&apos;administration
          </Link>
        </div>
      )}
      <div>
        <AdminLogoutButton />
      </div>
    </section>
  )
}
