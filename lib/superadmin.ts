import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getAdminByEmail(email: string) {
  const { data } = await supabase.from('admins').select('*').eq('email', email).single()
  return data
}

export async function isSuperAdmin(email: string) {
  const admin = await getAdminByEmail(email)
  return admin?.role === 'superadmin' && admin?.status === 'active'
}

export async function logAction(action: string, performedBy: string, targetEmail?: string, details?: string) {
  await supabase.from('admin_logs').insert({ action, performed_by: performedBy, target_email: targetEmail || null, details: details || null })
}

export async function getAllAdmins() {
  const { data } = await supabase.from('admins').select('*').order('created_at', { ascending: false })
  return data || []
}

export async function createAdmin(email: string, password: string, createdBy: string) {
  // Créer dans Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) throw new Error(authError.message)

  // Insérer dans la table admins
  const { data: adminData, error } = await supabase.from('admins').insert({
    email,
    role: 'admin',
    status: 'active',
  }).select().single()
  if (error) throw new Error(error.message)

  // Stocker le mot de passe temporaire
  await supabase.from('admin_credentials').insert({
    admin_id: adminData.id,
    temp_password: password,
    must_change: true,
  })

  await logAction('CREATE_ADMIN', createdBy, email, 'Nouvel admin créé')
  return adminData
}

export async function blockAdmin(adminId: string, performedBy: string) {
  const { data } = await supabase.from('admins').select('email').eq('id', adminId).single()
  await supabase.from('admins').update({ status: 'blocked' }).eq('id', adminId)
  await supabase.auth.admin.updateUserById(adminId, { ban_duration: '876600h' })
  await logAction('BLOCK_ADMIN', performedBy, data?.email, 'Admin bloqué')
}

export async function unblockAdmin(adminId: string, performedBy: string) {
  const { data } = await supabase.from('admins').select('email').eq('id', adminId).single()
  await supabase.from('admins').update({ status: 'active' }).eq('id', adminId)
  await supabase.auth.admin.updateUserById(adminId, { ban_duration: 'none' })
  await logAction('UNBLOCK_ADMIN', performedBy, data?.email, 'Admin débloqué')
}

export async function resetAdminPassword(adminId: string, newPassword: string, performedBy: string) {
  const { data } = await supabase.from('admins').select('email').eq('id', adminId).single()
  await supabase.auth.admin.updateUserById(adminId, { password: newPassword })
  await supabase.from('admin_credentials').upsert({ admin_id: adminId, temp_password: newPassword, must_change: true })
  await logAction('RESET_PASSWORD', performedBy, data?.email, 'Mot de passe réinitialisé')
}

export async function deleteAdmin(adminId: string, performedBy: string) {
  const { data } = await supabase.from('admins').select('email').eq('id', adminId).single()
  await supabase.from('admins').update({ status: 'deleted' }).eq('id', adminId)
  await supabase.auth.admin.deleteUser(adminId)
  await logAction('DELETE_ADMIN', performedBy, data?.email, 'Admin supprimé')
}

export function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
