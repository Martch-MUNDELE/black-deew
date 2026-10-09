import AdminNav from '@/components/admin/AdminNav'
import AdminShell from '@/components/admin/AdminShell'
import PushNotificationManager from '@/components/pwa/PushNotificationManager'
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell nav={<AdminNav />} push={<PushNotificationManager />}>
      {children}
    </AdminShell>
  )
}
