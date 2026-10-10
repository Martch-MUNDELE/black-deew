'use client'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { isAdminLoginPath } from '@/lib/supabase/proxy'
import VipPendingBanner from '@/components/admin/VipPendingBanner'
/**
 * Coquille de l'admin : masque menu et notifications sur les pages de connexion.
 * Le choix se fait cote navigateur (usePathname) : il suit la navigation client,
 * donc le menu apparait apres connexion sans rechargement.
 * Le menu (AdminNav) et le gestionnaire de notifications sont fournis par le layout serveur.
 */
export default function AdminShell({
  nav,
  push,
  children,
}: {
  nav: ReactNode
  push: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname() ?? ''
  if (isAdminLoginPath(pathname)) {
    return <>{children}</>
  }
  return (
    <div className="bd-admin-shell">
      {nav}
      {push}
      <main className="bd-admin-main">
        <VipPendingBanner />
        {children}
      </main>
    </div>
  )
}
