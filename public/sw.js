// public/sw.js
//
// Two jobs:
//  1. Listen for real Web Push events from the push-scheduler Edge Function
//     and show them — this is what survives the tab/app being fully closed.
//  2. Listen for postMessage()s from the open app to show/update a "live"
//     Pomodoro notification (remaining time ticking down) while the app is
//     open in the background — this can't come from the server, since a
//     push every few seconds would blow through rate limits and battery.
//
// Alarm payload contract: for an Alarm (as opposed to a Timeline reminder
// or any other push), the push-scheduler Edge Function's payload needs one
// of `kind: 'alarm'`, `soundKey: 'alarm'`, or a `tag` starting with
// "alarm" — whichever's easiest on that side. That's what tells this file
// to loop the sound instead of playing it once, and to add a Dismiss
// button. That Edge Function lives outside this repo, so this is the
// contract it needs to speak; nothing here can reach out and change it.

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

  const isAlarm =
    payload.kind === 'alarm' ||
    payload.soundKey === 'alarm' ||
    (typeof payload.tag === 'string' && payload.tag.startsWith('alarm'));

  const title = payload.title || 'Dream Command Center';
  const options = {
    body: payload.body || '',
    tag: payload.tag || 'dcc-notification',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    // Alarms/reminders default to sticking on screen until the person deals
    // with them, instead of the OS auto-dismissing after a few seconds —
    // that auto-dismiss is a big part of why these were easy to miss.
    // A payload can still opt out with `requireInteraction: false`.
    requireInteraction: payload.requireInteraction !== false,
    // Explicit (not just relying on the default) — `silent: true` is what
    // suppresses the OS notification sound/vibration entirely, and we only
    // ever want that for the live ticking Pomodoro update below.
    silent: false,
    // Standard Web Notifications have no "custom sound file" option — no
    // browser implements one — so this vibration pattern is the one thing
    // we control that makes the alert physically noticeable on a phone,
    // on top of whatever the OS's own default notification sound is. An
    // alarm repeats its vibration instead of buzzing once.
    vibrate: payload.vibrate || (isAlarm ? [300, 150, 300, 150, 300, 150, 300] : [200, 100, 200, 100, 300]),
    data: { url: payload.url || '/', soundKey: payload.soundKey || 'default', isAlarm },
    renotify: true,
    // A real alarm gets an explicit Dismiss button — that's the "until the
    // user dismisses it" the looping sound waits for. Only shown for
    // alarms; a plain reminder just clears on tap like before.
    ...(isAlarm ? { actions: [{ action: 'dismiss', title: 'Dismiss' }] } : {}),
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Best-effort: if a tab/window is open (foreground OR background —
      // this does NOT fire if the app is fully closed), tell it to play
      // our actual custom sound clip. The system notification above is
      // what appears when the app is fully closed; the browser doesn't
      // give a website any way to attach a custom sound file to that one,
      // only to a sound played from live page/JS context — so on a fully
      // closed app, an alarm can't loop either, same limitation as before.
      isAlarm
        ? messageClients({ type: 'PLAY_NOTIFICATION_SOUND_LOOP', soundKey: payload.soundKey || 'alarm', tag: options.tag })
        : messageClients({ type: 'PLAY_NOTIFICATION_SOUND', soundKey: payload.soundKey || 'default' }),
    ])
  );
});

function messageClients(message) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => client.postMessage(message));
  });
}

self.addEventListener('notificationclick', (event) => {
  const wasAlarm = !!(event.notification.data && event.notification.data.isAlarm);
  const tag = event.notification.tag;
  event.notification.close();

  // Whether they tapped the explicit "Dismiss" button or just tapped the
  // notification body, either one counts as "dismissed" — the loop stops
  // either way. Only a body tap (not the Dismiss button) also opens/
  // focuses the app.
  event.waitUntil(
    (async () => {
      if (wasAlarm) await messageClients({ type: 'STOP_NOTIFICATION_SOUND', tag });
      if (event.action === 'dismiss') return;

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

// Fallback for when an alarm notification goes away some other way (swiped
// off, cleared from the OS notification shade, etc.) without ever passing
// through notificationclick above — makes sure the loop can't keep playing
// in an open tab after the notification itself is gone. Not every platform
// fires this event for every kind of dismissal, hence still also stopping
// on notificationclick, and the timed safety-net inside notificationSound.ts.
self.addEventListener('notificationclose', (event) => {
  const wasAlarm = !!(event.notification.data && event.notification.data.isAlarm);
  if (!wasAlarm) return;
  event.waitUntil(messageClients({ type: 'STOP_NOTIFICATION_SOUND', tag: event.notification.tag }));
});

// ---- Live Pomodoro notification, driven by the open app ----
self.addEventListener('message', (event) => {
  const msg = event.data || {};

  if (msg.type === 'POMODORO_LIVE_UPDATE') {
    self.registration.showNotification(msg.title || 'Pomodoro running', {
      body: msg.body || '',
      tag: 'pomodoro-live',
      silent: true,
      icon: '/icons/icon-192.png',
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
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200, 100, 300],
      icon: '/icons/icon-192.png',
      data: { url: '/' },
    });
    messageClients({ type: 'PLAY_NOTIFICATION_SOUND', soundKey: 'pomodoro-complete' });
  }
});