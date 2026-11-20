// BLAC-SIGNALER-PROBLEME : le livreur signale un probleme sur SA course.
// L'identifiant livreur vient uniquement de la session (getAdminRole), jamais de la requete.
// Cette route ne modifie JAMAIS le statut de la livraison ni le stock : elle ne fait qu'enregistrer le signalement.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminRole } from '@/lib/admin-role-server'
import { isValidReportKind, validateReportNote } from '@/lib/delivery-reports'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type DbError = { code?: string; message?: string } | null | undefined

// Table absente (migration pas encore appliquee) : reponse 503 propre, jamais d'exception.
function isMissingTable(err: DbError): boolean {
  if (!err) return false
  if (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST204') return true
  return /does not exist|schema cache|could not find the table/i.test(err.message ?? '')
}

function unavailable() {
  return NextResponse.json(
    { error: "Le signalement n'est pas encore disponible. Préviens l'administrateur." },
    { status: 503, headers: NO_STORE }
  )
}

export async function POST(req: NextRequest) {
  try {
    const info = await getAdminRole()
    if (!info) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401, headers: NO_STORE })
    }
    if (info.role !== 'driver' || !info.driver?.id) {
      return NextResponse.json({ error: 'Acces reserve aux livreurs' }, { status: 403, headers: NO_STORE })
    }
    const driverId = info.driver.id

    let payload: { delivery_id?: unknown; kind?: unknown; note?: unknown } | null = null
    try {
      payload = (await req.json()) as { delivery_id?: unknown; kind?: unknown; note?: unknown }
    } catch {
      payload = null
    }

    const deliveryId = typeof payload?.delivery_id === 'string' ? payload.delivery_id : ''
    if (!UUID_RE.test(deliveryId)) {
      return NextResponse.json({ error: 'Livraison invalide' }, { status: 400, headers: NO_STORE })
    }
    if (!isValidReportKind(payload?.kind)) {
      return NextResponse.json({ error: 'Type de probleme invalide' }, { status: 400, headers: NO_STORE })
    }
    const kind = payload.kind
    const noteCheck = validateReportNote(payload?.note)
    if (!noteCheck.ok) {
      return NextResponse.json({ error: noteCheck.error }, { status: 400, headers: NO_STORE })
    }

    // La livraison doit etre assignee au livreur de la session, sinon 403
    const { data: delivery, error: delErr } = await supabase
      .from('order_deliveries')
      .select('id')
      .eq('id', deliveryId)
      .eq('driver_id', driverId)
      .maybeSingle()
    if (delErr) {
      return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
    }
    if (!delivery) {
      return NextResponse.json({ error: "Cette course ne t'est pas assignee" }, { status: 403, headers: NO_STORE })
    }

    // Signalement ouvert deja present pour cette livraison et ce type => 409
    const { data: existing, error: existErr } = await supabase
      .from('delivery_reports')
      .select('id')
      .eq('delivery_id', deliveryId)
      .eq('kind', kind)
      .eq('status', 'open')
      .limit(1)
    if (existErr) {
      if (isMissingTable(existErr)) return unavailable()
      return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
    }
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Ce probleme a deja ete signale' }, { status: 409, headers: NO_STORE })
    }

    const { error: insErr } = await supabase
      .from('delivery_reports')
      .insert({ delivery_id: deliveryId, driver_id: driverId, kind, note: noteCheck.note })
    if (insErr) {
      if (isMissingTable(insErr)) return unavailable()
      if (insErr.code === '23505') {
        return NextResponse.json({ error: 'Ce probleme a deja ete signale' }, { status: 409, headers: NO_STORE })
      }
      return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ ok: true }, { status: 201, headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500, headers: NO_STORE })
  }
}
