import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
export async function POST(req: NextRequest) {
  const { adminId, performedBy } = await req.json()
  const { data } = await supabase.from('admins').select('email').eq('id', adminId).single()
  await supabase.from('admins').update({ status: 'active' }).eq('id', adminId)
  await supabase.auth.admin.updateUserById(adminId, { ban_duration: 'none' })
  await supabase.from('admin_logs').insert({ action: 'UNBLOCK_ADMIN', performed_by: performedBy, target_email: data?.email })
  return NextResponse.json({ success: true })
}