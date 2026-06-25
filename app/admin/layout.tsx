import AdminNav from '@/components/admin/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bd-admin-shell">
      <AdminNav />
      <main className="bd-admin-main">
        {children}
      </main>
    </div>
  )
}
