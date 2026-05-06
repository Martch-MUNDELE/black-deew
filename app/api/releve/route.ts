import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RelevePDF } from '@/lib/releve-pdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period_id = searchParams.get('period_id')
  if (!period_id) return NextResponse.json({ error: 'period_id requis' }, { status: 400 })

  // Charger la période
  const { data: period } = await supabase
    .from('billing_periods')
    .select('*')
    .eq('id', period_id)
    .single()
  if (!period) return NextResponse.json({ error: 'Période introuvable' }, { status: 404 })

  // Charger le contrat actif du client
  const { data: contract } = await supabase
    .from('client_contracts')
    .select('*')
    .eq('client_id', period.client_id)
    .eq('is_active', true)
    .single()

  // Charger email du client
  const { data: admin } = await supabase
    .from('admins')
    .select('email')
    .eq('auth_user_id', period.client_id)
    .single()

  // Charger settings (siteName, siteBaseline, currency)
  const { data: settings } = await supabase.from('settings').select('*')
  const siteName = settings?.find((s: any) => s.key === 'site_name')?.value || 'Plateforme'
  const siteBaseline = settings?.find((s: any) => s.key === 'site_baseline')?.value || 'Relevé de facturation'
  const currency = settings?.find((s: any) => s.key === 'currency')?.value || 'DH'

  const pdfBuffer = await renderToBuffer(
    RelevePDF({
      period,
      contract,
      siteName,
      siteBaseline,
      clientEmail: admin?.email || '',
      currency,
    }) as any
  )

  const start = period.period_start.replace(/-/g, '')
  const end = period.period_end.replace(/-/g, '')
  const filename = `releve-${start}-${end}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
