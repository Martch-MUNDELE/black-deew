import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function GET() {
  // Chercher périodes facturées depuis plus de 5 jours non payées
  const fiveDaysAgo = new Date()
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
  const fiveDaysAgoISO = fiveDaysAgo.toISOString()

  const { data: overdue } = await supabase
    .from('billing_periods')
    .select('id, client_id, total_due, total_paid, updated_at')
    .eq('status', 'facture')
    .lt('updated_at', fiveDaysAgoISO)

  if (!overdue || overdue.length === 0) {
    return NextResponse.json({ message: 'Aucune période en retard', closed: false })
  }

  // Vérifier si total_paid < total_due (pas encore payé)
  const unpaid = overdue.filter(p => (p.total_paid ?? 0) < p.total_due)

  if (unpaid.length === 0) {
    return NextResponse.json({ message: 'Toutes les périodes facturées sont payées', closed: false })
  }

  // Fermer la plateforme
  await supabase
    .from('settings')
    .update({ value: 'closed' })
    .eq('key', 'status')

  // Logger la fermeture
  await supabase.from('admin_logs').insert({
    action: 'AUTO_CLOSE_PLATFORM',
    performed_by: 'cron',
    admin_email: 'system',
    details: { reason: 'Paiement en retard de plus de 5 jours', periods: unpaid.map(p => p.id) }
  })

  return NextResponse.json({ message: 'Plateforme fermée automatiquement', closed: true, periods: unpaid.length })
}
