import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/admin/AdminNav'
import AdminShell from '@/components/admin/AdminShell'
import PushNotificationManager from '@/components/pwa/PushNotificationManager'
import { decideRoleRedirect, isDriverAllowedPath } from '@/lib/admin-role'
import { getAdminRole } from '@/lib/admin-role-server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // BLAC-P3-046 : le proxy pose x-admin-path ; le role decide de la redirection (la page de connexion n'est jamais redirigee).
  const path = (await headers()).get('x-admin-path') ?? ''
  const info = path ? await getAdminRole() : null

  if (info) {
    const target = decideRoleRedirect({ role: info.role, path })
    if (target) redirect(target)
    if (info.role === 'driver' && isDriverAllowedPath(path)) {
      // Livreur : uniquement son espace, sans menu admin ni notifications admin.
      return (
        <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#F5F0E6' }}>
          <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>{children}</main>
        </div>
      )
    }
  }

  return (
    <AdminShell nav={<AdminNav />} push={<PushNotificationManager />}>
      {children}
    </AdminShell>
  )
}
