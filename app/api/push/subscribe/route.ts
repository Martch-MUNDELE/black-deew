import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminRole } from '@/lib/admin-role-server'

// Utiliser service_role pour bypasser RLS
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const subscription = await req.json()

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Subscription invalide' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // BLAC-P3-050 : le livreur vient de la session, jamais du corps de la requete
    const info = await getAdminRole()
    const driverId = info?.role === 'driver' && info.driver ? info.driver.id : null

    // Vérifier si déjà abonné
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()

    if (existing) {
      // Telephone qui change de compte : mise a jour du driver_id
      const { error: updError } = await supabase
        .from('push_subscriptions')
        .update({ driver_id: driverId })
        .eq('endpoint', subscription.endpoint)
      if (updError) console.error('[Push Subscribe] mise a jour driver_id', updError.message)
      return NextResponse.json({ message: 'Déjà abonné' }, { status: 200 })
    }

    // Enregistrer l'abonnement
    const row: Record<string, unknown> = {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth,
      created_at: new Date().toISOString()
    }
    if (driverId) row.driver_id = driverId
    const { error } = await supabase.from('push_subscriptions').insert(row)

    if (error) throw error

    return NextResponse.json({ message: 'Abonnement enregistré' }, { status: 201 })
  } catch (err) {
    console.error('[Push Subscribe]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json()
    const supabase = createServiceClient()

    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)

    return NextResponse.json({ message: 'Désabonnement effectué' })
  } catch (err) {
    console.error('[Push Unsubscribe]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
