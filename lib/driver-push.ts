// BLAC-P3-050 : notifications push livreur (serveur uniquement).
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { formatLongDate } from '@/lib/driver-space'

export type DriverPushPayload = {
  title: string
  body: string
  tag?: string
  url?: string
  icon?: string
}

export type AssignmentSlot = {
  date?: string | null
  time_start?: string | null
  time_end?: string | null
}

function hhmm(value: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''))
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

/** Message d'assignation : AUCUNE donnee client (ni nom, ni telephone, ni adresse). */
export function buildAssignmentPush(slot: AssignmentSlot | null | undefined): DriverPushPayload {
  const day = formatLongDate(slot?.date)
  const start = hhmm(slot?.time_start)
  const end = hhmm(slot?.time_end)
  const hours = start && end ? `${start}-${end}` : start
  const when = [day, hours].filter(Boolean).join(', ')
  return {
    title: 'Nouvelle livraison',
    body: when || 'Une livraison vous a été assignée',
    tag: 'driver-assignment',
    url: '/admin/driver',
  }
}

/** Envoie un push aux abonnements de CE livreur uniquement. Ne lance jamais d'exception. */
export async function sendDriverPush(
  driverId: string,
  payload: DriverPushPayload
): Promise<{ sent: number; failed: number }> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
      console.warn('[driver-push] configuration serveur absente')
      return { sent: 0, failed: 0 }
    }
    webpush.setVapidDetails('mailto:admin@black-deew.app', vapidPublic, vapidPrivate)

    const supabase = createClient(url, serviceKey)
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('driver_id', driverId)
    if (error) {
      console.error('[driver-push] lecture des abonnements impossible', error.message)
      return { sent: 0, failed: 0 }
    }
    if (!subscriptions || subscriptions.length === 0) return { sent: 0, failed: 0 }

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag || 'notification',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: payload.url || '/admin/driver' },
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            message
          )
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
          throw err
        }
      })
    )
    return {
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    }
  } catch (err) {
    console.error('[driver-push] erreur inattendue', err)
    return { sent: 0, failed: 0 }
  }
}
