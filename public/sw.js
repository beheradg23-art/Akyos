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
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    // Reminders default to sticking on screen until the person deals with
    // them, instead of the OS auto-dismissing after a few seconds — that
    // auto-dismiss is a big part of why these were easy to miss. A payload
    // can still opt out with `requireInteraction: false`.
    requireInteraction: payload.requireInteraction !== false,
    // Explicit (not just relying on the default) — `silent: true` is what
    // suppresses the OS notification sound/vibration entirely, and we only
    // ever want that for the live ticking Pomodoro update below.
    silent: false,
    // Standard Web Notifications have no "custom sound file" option — no
    // browser implements one — so this vibration pattern is the one thing
    // we control that makes the alert physically noticeable on a phone,
    // on top of whatever the OS's own default notification sound is.
    vibrate: payload.vibrate || [200, 100, 200, 100, 300],
    data: { url: payload.url || '/', soundKey: payload.soundKey || 'default' },
    renotify: true,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Best-effort: if a tab/window is open (foreground OR background —
      // this does NOT fire if the app is fully closed), tell it to play
      // our actual custom sound clip. The system notification above is
      // what appears when the app is fully closed; the browser doesn't
      // give a website any way to attach a custom sound file to that one,
      // only to a sound played from live page/JS context.
      messageClients({ type: 'PLAY_NOTIFICATION_SOUND', soundKey: payload.soundKey || 'default' }),
    ])
  );
});

function messageClients(message) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => client.postMessage(message));
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const targetUrl = (event.notification.data && event.notification.data.url) || '/';
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })()
  );
});

// ---- Live Pomodoro notification, driven by the open app ----
self.addEventListener('message', (event) => {
  const msg = event.data || {};

  if (msg.type === 'POMODORO_LIVE_UPDATE') {
    // The app flags exactly one of these per session — the very first
    // call, right as the session starts — with playSound:true. Every
    // recurring call after that (the 20s countdown ticks) omits it, since
    // showNotification() firing every 20 seconds with an alert would mean
    // a chime for the whole length of the session instead of once at the
    // start. Every other notification in this app already alerts by
    // default (see the `push` handler above); this is the one deliberate,
    // narrowly-scoped exception.
    const isStart = !!msg.playSound;
    self.registration.showNotification(msg.title || 'Pomodoro running', {
      body: msg.body || '',
      tag: 'pomodoro-live',
      silent: !isStart,
      renotify: isStart,
      vibrate: isStart ? [200, 100, 200, 100, 300] : undefined,
      icon: '/icons/icon-192.png',
      data: { url: '/' },
    });
    if (isStart) {
      messageClients({ type: 'PLAY_NOTIFICATION_SOUND', soundKey: 'pomodoro-start' });
    }
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
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200, 100, 300],
      icon: '/icons/icon-192.png',
      data: { url: '/' },
    });
    messageClients({ type: 'PLAY_NOTIFICATION_SOUND', soundKey: 'pomodoro-complete' });
  }
});