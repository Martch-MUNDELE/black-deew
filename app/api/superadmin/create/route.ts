import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: NextRequest) {
  const { email, password, performedBy } = await req.json()
  if (password.length < 8) return NextResponse.json({ error: 'Mot de passe trop court' }, { status: 400 })

  // Reject if an active admin already exists with this email
  const { data: activeAdmin } = await supabase.from('admins').select('id').eq('email', email).neq('status', 'deleted').single()
  if (activeAdmin) return NextResponse.json({ error: 'Cet email existe deja' }, { status: 400 })

  // Check for a previously deleted admin entry to reactivate instead of inserting a duplicate
  const { data: deletedAdmin } = await supabase.from('admins').select('id').eq('email', email).eq('status', 'deleted').single()

  // Resolve auth user: create new or reuse existing (left over from a soft-delete)
  let authUserId: string
  const { data: newAuthData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })

  if (authError) {
    // Auth user still exists from a previous cycle — find it and reset the password
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const existingAuthUser = listData?.users?.find(u => u.email === email)
    if (!existingAuthUser) return NextResponse.json({ error: authError.message }, { status: 500 })

    const { error: updateError } = await supabase.auth.admin.updateUserById(existingAuthUser.id, { password, email_confirm: true })
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    authUserId = existingAuthUser.id
  } else {
    authUserId = newAuthData.user.id
  }

  // Reactivate deleted row or insert a fresh one
  let adminData
  if (deletedAdmin) {
    const { data, error } = await supabase.from('admins').update({ status: 'active', role: 'admin' }).eq('id', deletedAdmin.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    adminData = data

    await supabase.from('admin_credentials').upsert({ admin_id: adminData.id, temp_password: password, must_change: true }, { onConflict: 'admin_id' })
  } else {
    const { data, error } = await supabase.from('admins').insert({ email, role: 'admin', status: 'active' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    adminData = data

    await supabase.from('admin_credentials').insert({ admin_id: adminData.id, temp_password: password, must_change: true })
  }

  await supabase.from('admin_logs').insert({ action: 'CREATE_ADMIN', performed_by: performedBy, target_email: email, details: deletedAdmin ? 'Admin réactivé' : 'Nouvel admin créé' })
  return NextResponse.json({ success: true, admin: adminData })
}
