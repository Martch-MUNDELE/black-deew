// BLAC-P3-048 : accueil livreur. L'identifiant livreur vient uniquement de la session (getAdminRole), jamais de la requete.
import { NextResponse } from 'next/server'
import { getAdminRole } from '@/lib/admin-role-server'
import { getDriverHome } from '@/lib/driver-space-server'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET() {
  const info = await getAdminRole()
  if (!info) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401, headers: NO_STORE })
  }
  if (info.role !== 'driver' || !info.driver?.id) {
    return NextResponse.json({ error: 'Acces reserve aux livreurs' }, { status: 403, headers: NO_STORE })
  }
  try {
    const data = await getDriverHome(info.driver.id, info.driver.full_name)
    return NextResponse.json(data, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
  }
}
