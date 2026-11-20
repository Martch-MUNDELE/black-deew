// BLAC-ADMIN-SIGNALEMENTS : decision de l'admin sur un signalement livreur.
// Reservee aux administrateurs et super administrateurs (requireAdmin).
// Ne modifie QUE la table delivery_reports : jamais le stock, jamais l'argent, jamais la course.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { buildDecisionUpdate, canApply, isReportAction } from '@/lib/delivery-reports-admin'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Ctx = { params: Promise<{ id: string }> }
type DbError = { code?: string; message?: string } | null | undefined

function isMissingTable(err: DbError): boolean {
  if (!err) return false
  if (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST204') return true
  return /does not exist|schema cache|could not find the table/i.test(err.message ?? '')
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/admin/delivery-reports/open-count : nombre de signalements ouverts (pastille de la navigation).
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const check = await requireAdmin()
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status, headers: NO_STORE })
    const { id } = await ctx.params
    if (id !== 'open-count') return NextResponse.json({ error: 'Introuvable' }, { status: 404, headers: NO_STORE })

    const { count, error } = await serviceClient()
      .from('delivery_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ count: 0 }, { headers: NO_STORE })
      return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
    }
    return NextResponse.json({ count: count ?? 0 }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
  }
}

// PATCH : { action: 'acknowledge' | 'close' }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const check = await requireAdmin()
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status, headers: NO_STORE })

    const { id } = await ctx.params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Signalement invalide' }, { status: 400, headers: NO_STORE })
    }

    let body: { action?: unknown } | null = null
    try {
      body = (await req.json()) as { action?: unknown }
    } catch {
      body = null
    }
    if (!isReportAction(body?.action)) {
      return NextResponse.json({ error: 'Action non disponible' }, { status: 400, headers: NO_STORE })
    }
    const action = body.action

    const db = serviceClient()
    const { data: current, error: readErr } = await db
      .from('delivery_reports')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()
    if (readErr) {
      if (isMissingTable(readErr)) {
        return NextResponse.json({ error: "Les signalements ne sont pas encore disponibles." }, { status: 503, headers: NO_STORE })
      }
      return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: NO_STORE })
    }
    if (!current) return NextResponse.json({ error: 'Signalement introuvable' }, { status: 404, headers: NO_STORE })

    const currentStatus = current.status as 'open' | 'handled' | 'closed'
    if (!canApply(action, currentStatus)) {
      return NextResponse.json({ error: 'Ce signalement est deja traite' }, { status: 409, headers: NO_STORE })
    }

    const update = buildDecisionUpdate(action, check.email)
    const { data: updated, error: updErr } = await db
      .from('delivery_reports')
      .update(update)
      .eq('id', id)
      .eq('status', currentStatus)
      .select('id')
    if (updErr) return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500, headers: NO_STORE })
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Ce signalement vient d etre modifie' }, { status: 409, headers: NO_STORE })
    }
    return NextResponse.json({ ok: true, status: update.status }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500, headers: NO_STORE })
  }
}
