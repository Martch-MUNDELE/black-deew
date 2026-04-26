import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
export async function POST(req: NextRequest) {
  const { adminId, newPassword, performedBy } = await req.json()
  const { data } = await supabase.from('admins').select('email').eq('id', adminId).single()
  await supabase.auth.admin.updateUserById(adminId, { password: newPassword })
  await supabase.from('admin_credentials').upsert({ admin_id: adminId, temp_password: newPassword, must_change: true })
  await supabase.from('admin_logs').insert({ action: 'RESET_PASSWORD', performed_by: performedBy, target_email: data?.email })
  return NextResponse.json({ success: true })
}