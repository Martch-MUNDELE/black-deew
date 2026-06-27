import AdminNav from '@/components/admin/AdminNav'
import PushNotificationManager from '@/components/pwa/PushNotificationManager'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
