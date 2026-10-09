import { requireAdmin } from '@/lib/admin-auth'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
export async function POST(req: NextRequest) {
  // Finition VIP : action reservee aux administrateurs (verifiee cote serveur)
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
  }
  if (adminCheck.role !== 'superadmin') {
    return NextResponse.json({ error: 'Acces reserve au superadmin' }, { status: 403 })
  }
  const { email, password } = await req.json()
  await resend.emails.send({
    from: 'Black Deew Admin <onboarding@resend.dev>',
    to: email,
    subject: 'Vos identifiants Black Deew Admin',
    html: '<div style="font-family:sans-serif;padding:24px"><h2>Vos identifiants</h2><p>Email: ' + email + '</p><p>Mot de passe: <code>' + password + '</code></p></div>',
  })
  return NextResponse.json({ success: true })
}