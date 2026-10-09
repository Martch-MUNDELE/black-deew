import { headers } from 'next/headers'
import AdminNav from '@/components/admin/AdminNav'
import PushNotificationManager from '@/components/pwa/PushNotificationManager'
import { isAdminLoginPath } from '@/lib/supabase/proxy'
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get('x-pathname') ?? ''
  // Page de connexion : ni menu lateral ni gestionnaire de notifications.
  if (isAdminLoginPath(path)) {
    return <>{children}</>
  }
  return (
    <div className="bd-admin-shell">
      <AdminNav />
      <PushNotificationManager />
      <main className="bd-admin-main">
        {children}
      </main>
    </div>
  )
}
