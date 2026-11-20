// BLAC-ECRAN-COURSE-MAQUETTE : soldes de stock VIP du livreur, lecture serveur (cle service_role).
// Meme lecture que getDriverHome (listVipProducts, loadLedgers, vipStockBalance), limitee au livreur recu.
// Ne leve jamais d'exception : renvoie [] sans session ouverte ou en cas d'erreur.
import { createClient } from '@supabase/supabase-js'
import { vipStockBalance } from '@/lib/driver-ledger'
import { listVipProducts, loadLedgers, type LedgerClient } from '@/lib/driver-ledger-data'

export type DriverStockBalance = { name: string; onHand: number }

export async function getDriverStockBalances(driverId: string): Promise<DriverStockBalance[]> {
  try {
    if (!driverId) return []
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return []
    const db = createClient(url, key)
    const ledgerDb = db as unknown as LedgerClient

    const { data: openRows, error } = await db
      .from('driver_sessions')
      .select('id')
      .eq('driver_id', driverId)
      .eq('session_status', 'open')
      .order('started_at', { ascending: false })
      .limit(1)
    if (error) return []
    const open = openRows?.[0]
    if (!open) return []

    const ledger = (await loadLedgers(ledgerDb, [open.id]))[open.id]
    const products = await listVipProducts(ledgerDb)
    const nameById = new Map(products.map((p) => [p.id, p.name]))
    return vipStockBalance(ledger?.stock ?? [])
      .filter((b) => nameById.has(b.product_id))
      .map((b) => ({ name: nameById.get(b.product_id) ?? b.product_id, onHand: b.onHand }))
  } catch {
    return []
  }
}
