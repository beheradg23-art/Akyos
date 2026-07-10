// public/sw.js
//
// Two jobs:
//  1. Listen for real Web Push events from the push-scheduler Edge Function
//     and show them — this is what survives the tab/app being fully closed.
//  2. Listen for postMessage()s from the open app to show/update a "live"
//     Pomodoro notification (remaining time ticking down) while the app is
//     open in the background — this can't come from the server, since a
//     push every few seconds would blow through rate limits and battery.

self.addEventListener('install', () => {
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });
  
  self.addEventListener('push', (event) => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      payload = { title: 'Notification', body: event.data ? event.data.text() : '' };
    }
  
    const title = payload.title || 'Dream Command Center';
    const options = {
      body: payload.body || '',
      tag: payload.tag || 'dcc-notification',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      requireInteraction: !!payload.requireInteraction,
      data: { url: payload.url || '/' },
      renotify: true,
    };
  
    event.waitUntil(self.registration.showNotification(title, options));
  });
  
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(targetUrl);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
    );
  });
  
  // ---- Live Pomodoro notification, driven by the open app ----
  self.addEventListener('message', (event) => {
    const msg = event.data || {};
  
    if (msg.type === 'POMODORO_LIVE_UPDATE') {
      self.registration.showNotification(msg.title || 'Pomodoro running', {
        body: msg.body || '',
        tag: 'pomodoro-live',
        silent: true,
        icon: '/icon-192.png',
        data: { url: '/' },
      });
    }
  
    if (msg.type === 'POMODORO_LIVE_CLEAR') {
      self.registration.getNotifications({ tag: 'pomodoro-live' }).then((list) => {
        list.forEach((n) => n.close());
      });
    }
  
    if (msg.type === 'POMODORO_COMPLETE') {
      self.registration.getNotifications({ tag: 'pomodoro-live' }).then((list) => list.forEach((n) => n.close()));
      self.registration.showNotification(msg.title || 'Session complete', {
        body: msg.body || '',
        tag: 'pomodoro-complete',
        renotify: true,
        icon: '/icon-192.png',
        data: { url: '/' },
      });
    }
  });