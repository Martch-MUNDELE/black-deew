'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

export default function PushNotificationManager() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported'>('idle')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }

    // Enregistrer le Service Worker
    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      console.log('[PWA] Service Worker enregistré')

      // Vérifier si déjà abonné
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        setStatus('subscribed')
        return
      }

      // Demander permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }

      setStatus('loading')

      // Récupérer la clé VAPID publique
      const res = await fetch('/api/push/vapid-public-key')
      const { key } = await res.json()

      // S'abonner
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      })

      // Envoyer l'abonnement au serveur
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      })

      setStatus('subscribed')
      console.log('[PWA] Abonnement push enregistré')
    }).catch((err) => {
      console.error('[PWA] Erreur SW:', err)
    })
  }, [])

  // Composant invisible — gère uniquement la logique en arrière-plan
  if (status === 'unsupported') return null
  if (status === 'denied') return null
  return null
}
