import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  await resend.emails.send({
    from: 'Black Deew Admin <onboarding@resend.dev>',
    to: email,
    subject: 'Vos identifiants Black Deew Admin',
    html: '<div style="font-family:sans-serif;padding:24px"><h2>Vos identifiants</h2><p>Email: ' + email + '</p><p>Mot de passe: <code>' + password + '</code></p></div>',
  })
  return NextResponse.json({ success: true })
}