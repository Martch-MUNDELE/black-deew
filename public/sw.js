// Service Worker — Black Deew PWA
// const CACHE_NAME = 'black-deew-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Nouvelle notification',
    body: 'Une mise à jour est disponible',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'notification',
    data: { url: '/admin' }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        vibrate: [200, 100, 200],
        data: data.data,
        actions: [
          { action: 'open', title: 'Voir' },
          { action: 'close', title: 'Fermer' }
        ]
      }),
      // Incrémenter le badge sur l'icône
      self.navigator?.setAppBadge?.(1).catch(() => {})
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Effacer le badge quand on clique
  self.navigator?.clearAppBadge?.().catch(() => {});

  const urlToOpen = event.notification.data?.url || '/admin';

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
