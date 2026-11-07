// BLAC-P3-047 : un administrateur cree (ou reinitialise) le compte de connexion d'un livreur.
// Le mot de passe n'est jamais journalise, jamais renvoye et jamais ecrit dans la base.
import { requireAdmin } from '@/lib/admin-auth'
import { validateDriverAccountInput } from '@/lib/driver-account'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type DriverAccountBody = {
  driver_id?: unknown
  email?: unknown
  password?: unknown
}

function isEmailAlreadyUsed(error: { code?: string; status?: number; message?: string }): boolean {
  if (error.code === 'email_exists' || error.code === 'user_already_exists') return true
  return /already|registered|exists/i.test(error.message ?? '')
}

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
  }

  let body: DriverAccountBody
  try {
    body = (await req.json()) as DriverAccountBody
  } catch {
    return NextResponse.json({ error: 'Requete invalide' }, { status: 400 })
  }

  const driverId = typeof body.driver_id === 'string' ? body.driver_id.trim() : ''
  if (!driverId) return NextResponse.json({ error: 'Livreur manquant' }, { status: 400 })

  const validation = validateDriverAccountInput({ email: body.email, password: body.password })
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
  const email = validation.email
  const password = body.password as string

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: driver, error: driverError } = await service
    .from('delivery_drivers')
    .select('id, user_id, email')
    .eq('id', driverId)
    .maybeSingle()
  if (driverError) return NextResponse.json({ error: 'Lecture du livreur impossible' }, { status: 500 })
  if (!driver) return NextResponse.json({ error: 'Livreur introuvable' }, { status: 404 })

  // Un email d'administrateur ne devient jamais un compte livreur.
  const { data: adminRow, error: adminError } = await service
    .from('admins')
    .select('email')
    .eq('email', email)
    .maybeSingle()
  if (adminError) return NextResponse.json({ error: 'Verification des administrateurs impossible' }, { status: 500 })
  if (adminRow) {
    return NextResponse.json({ error: 'Cet email est deja celui d\'un administrateur' }, { status: 409 })
  }

  // Email deja lie a un autre livreur.
  const { data: otherDriver, error: otherError } = await service
    .from('delivery_drivers')
    .select('id')
    .eq('email', email)
    .neq('id', driverId)
    .limit(1)
  if (otherError) return NextResponse.json({ error: 'Verification des livreurs impossible' }, { status: 500 })
  if (otherDriver && otherDriver.length > 0) {
    return NextResponse.json({ error: 'Cet email est deja lie a un autre livreur' }, { status: 409 })
  }

  // Compte existant : reinitialisation du mot de passe, l'email ne change pas.
  if (driver.user_id) {
    const { data: updated, error: updateError } = await service.auth.admin.updateUserById(
      driver.user_id as string,
      { password }
    )
    if (updateError) {
      return NextResponse.json({ error: 'Reinitialisation du mot de passe impossible' }, { status: 500 })
    }
    const keptEmail = updated?.user?.email ?? (driver.email as string | null) ?? email
    return NextResponse.json({ ok: true, email: keptEmail, created: false })
  }

  // Nouveau compte : jamais de reutilisation d'un compte auth deja present pour cet email.
  const { data: createdData, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !createdData?.user) {
    if (createError && isEmailAlreadyUsed(createError)) {
      return NextResponse.json({ error: 'Un compte existe deja avec cet email' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Creation du compte impossible' }, { status: 500 })
  }
  const newUserId = createdData.user.id

  const { data: linked, error: linkError } = await service
    .from('delivery_drivers')
    .update({ user_id: newUserId, email })
    .eq('id', driverId)
    .select('id')
  if (linkError || !linked || linked.length === 0) {
    // Pas de compte orphelin : on supprime l'utilisateur qui vient d'etre cree.
    await service.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: 'Liaison du compte au livreur impossible' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email, created: true })
}
