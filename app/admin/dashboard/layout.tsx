import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F0' }}>
      <AdminNav />
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '24px 16px' }}>{children}</div>
    </div>
  )
}
