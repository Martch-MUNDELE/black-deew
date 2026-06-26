import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

webpush.setVapidDetails(
  'mailto:admin@basefood.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
  icon?: string
}

export async function POST(req: NextRequest) {
  try {
    const payload: PushPayload = await req.json()

    if (!payload?.title || !payload?.body) {
      return NextResponse.json({ error: 'title et body requis' }, { status: 400 })
    }

    const supabase = await createClient()

    // Récupérer tous les abonnements actifs
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')

    if (error) throw error
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'Aucun abonné', sent: 0 })
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag || 'notification',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: payload.url || '/admin' }
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            },
            pushPayload
          )
        } catch (err: unknown) {
          // Supprimer les abonnements expirés (410 Gone)
          if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint)
          }
          throw err
        }
      })
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({ message: 'Push envoyé', sent, failed })
  } catch (err) {
    console.error('[Push Send]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
