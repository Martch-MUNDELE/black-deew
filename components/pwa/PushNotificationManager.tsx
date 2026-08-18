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
  /*
    BD LOCAL MDH PWA DISABLE V1
  */
  const isLocalMdh =
    typeof window !== 'undefined' &&
    (
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === 'localhost'
    )

  const [status, setStatus] = useState<'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported' | 'ready'>('idle')
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null)

  async function doSubscribe(registration: ServiceWorkerRegistration) {
    try {
      setStatus('loading')
      const res = await fetch('/api/push/vapid-public-key')
      const { key } = await res.json()

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      })

      setStatus('subscribed')
    } catch {
      setStatus('idle')
    }
  }

  useEffect(() => {
    if (!isLocalMdh) return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister()
        })
      })
    }
  }, [isLocalMdh])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setTimeout(() => setStatus('unsupported'), 0)
      return
    }

    if (isLocalMdh) {
      return
    }

    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      setSwReg(registration)

      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        setStatus('subscribed')
        return
      }

      if (Notification.permission === 'granted') {
        await doSubscribe(registration)
        return
      }

      if (Notification.permission === 'denied') {
        setStatus('denied')
        return
      }

      setStatus('ready')
    }).catch(() => setStatus('unsupported'))
  }, [])

  async function handleEnable() {
    if (!swReg) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setStatus('denied')
      return
    }
    await doSubscribe(swReg)
  }

  if (status === 'unsupported' || status === 'subscribed' || status === 'idle') return null

  if (status === 'denied') return (
    <div style={{
      position: 'fixed', bottom: 70, left: 12, right: 12, zIndex: 999,
      background: '#1a1208', border: '1px solid rgba(245,200,66,0.2)',
      borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#7A6E58'
    }}>
      🔕 Notifications bloquées — activez-les dans les réglages Safari
    </div>
  )

  if (status === 'ready') return (
    <div style={{
      position: 'fixed', bottom: 70, left: 12, right: 12, zIndex: 999,
      background: '#0D0B07', border: '1px solid rgba(245,200,66,0.3)',
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
    }}>
      <span style={{ fontSize: 12, color: '#E8D5A3', flex: 1 }}>
        🔔 Recevoir les alertes nouvelles commandes ?
      </span>
      <button onClick={handleEnable} style={{
        background: '#F5C842', color: '#000', border: 'none',
        borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700,
        cursor: 'pointer', flexShrink: 0
      }}>
        Activer
      </button>
    </div>
  )

  if (status === 'loading') return (
    <div style={{
      position: 'fixed', bottom: 70, left: 12, right: 12, zIndex: 999,
      background: '#0D0B07', border: '1px solid rgba(245,200,66,0.3)',
      borderRadius: 12, padding: '12px 14px', fontSize: 12, color: '#E8D5A3'
    }}>
      ⏳ Activation des notifications...
    </div>
  )

  return null
}
