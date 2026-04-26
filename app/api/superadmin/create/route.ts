import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: NextRequest) {
  const { email, password, performedBy } = await req.json()
  if (password.length < 8) return NextResponse.json({ error: 'Mot de passe trop court' }, { status: 400 })
  const { data: existing } = await supabase.from('admins').select('id').eq('email', email).neq('status', 'deleted').single()
  if (existing) return NextResponse.json({ error: 'Cet email existe deja' }, { status: 400 })
  const { error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
  const { data: adminData, error } = await supabase.from('admins').insert({ email, role: 'admin', status: 'active' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('admin_credentials').insert({ admin_id: adminData.id, temp_password: password, must_change: true })
  await supabase.from('admin_logs').insert({ action: 'CREATE_ADMIN', performed_by: performedBy, target_email: email, details: 'Nouvel admin cree' })
  return NextResponse.json({ success: true, admin: adminData })
}