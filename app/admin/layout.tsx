'use client'
import AdminNav from '@/components/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0804' }}>
      <AdminNav />
      <main style={{ marginTop: 56, padding: '32px 24px 80px' }}>
        {children}
      </main>
    </div>
  )
}
