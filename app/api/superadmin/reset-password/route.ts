import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
export async function POST(req: NextRequest) {
  const { adminId, newPassword, performedBy } = await req.json()
  const { data } = await supabase.from('admins').select('email, auth_user_id').eq('id', adminId).single()
  if (!data?.auth_user_id) return NextResponse.json({ error: 'auth_user_id manquant' }, { status: 400 })
  await supabase.auth.admin.updateUserById(data.auth_user_id, { password: newPassword })
  await supabase.from('admin_credentials').upsert({ email: data.email, temp_password: newPassword }, { onConflict: 'email' })
  await supabase.from('admin_logs').insert({ action: 'RESET_PASSWORD', performed_by: performedBy, target_email: data?.email })
  return NextResponse.json({ success: true })
}