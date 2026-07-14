// Custom notification sound.
//
// The Web Notifications API has no "custom sound file" option — it was in
// early spec drafts but no browser ever implemented it, and `showNotification()`
// only ever plays the OS/browser's own default alert sound (unless `silent`
// is set). So a website has exactly one way to play a *real* custom sound
// file for a notification: from live JS, while a tab or window for the app
// is open (foreground or backgrounded — this does NOT run if the app is
// fully closed/swiped away, since there's no JS execution context left to
// play audio from). That limit applies just as much to looping an alarm as
// it does to a single chime — with the app fully closed, an alarm push
// still shows and vibrates, but only the OS's own default sound plays, once.
//
// public/sw.js posts messages here for three cases: PLAY_NOTIFICATION_SOUND
// (one-shot — timeline reminders, Pomodoro complete), PLAY_NOTIFICATION_SOUND_LOOP
// (Alarms — repeats until stopped), and STOP_NOTIFICATION_SOUND (fired when
// the person dismisses the alarm notification, one way or another).

const SOUND_URL = '/sounds/tuturu_1.mp3';

// Alarms get looped for potentially minutes at a time before anyone
// dismisses them — cap it so a missed/failed dismissal (permission
// revoked mid-ring, notification silently cleared by the OS without
// firing notificationclose, etc.) can't loop forever in a background tab.
const MAX_LOOP_MS = 5 * 60 * 1000;

let primed = false;
let oneShotAudio: HTMLAudioElement | null = null;
let loopAudio: HTMLAudioElement | null = null;
let loopTag: string | null = null;
let loopSafetyTimer: ReturnType<typeof setTimeout> | null = null;

function getOneShotAudio(): HTMLAudioElement {
  if (!oneShotAudio) {
    oneShotAudio = new Audio(SOUND_URL);
    oneShotAudio.preload = 'auto';
  }
  return oneShotAudio;
}

function getLoopAudio(): HTMLAudioElement {
  if (!loopAudio) {
    loopAudio = new Audio(SOUND_URL);
    loopAudio.preload = 'auto';
    loopAudio.loop = true;
  }
  return loopAudio;
}

/**
 * Mobile browsers block audio playback that isn't triggered by a user
 * gesture. Call this once from any real tap/click early in the session
 * (e.g. when the person turns push notifications on) so both audio
 * elements are "unlocked" and can then be played programmatically later
 * when a push arrives, without needing another gesture at that moment.
 */
export function primeNotificationSound(): void {
  if (primed || typeof window === 'undefined') return;
  const unlock = (el: HTMLAudioElement) => {
    el.volume = 0;
    return el
      .play()
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.volume = 1;
      })
      .catch(() => {
        // Gesture wasn't enough (or autoplay is blocked) — we'll just try
        // again next time this is called from a tap.
      });
  };
  Promise.all([unlock(getOneShotAudio()), unlock(getLoopAudio())]).then(() => {
    primed = true;
  });
}

function playOneShot(): void {
  try {
    const el = getOneShotAudio();
    el.currentTime = 0;
    el.volume = 1;
    void el.play().catch(() => {
      // Autoplay blocked because this tab never had a user gesture yet —
      // nothing more we can do for this particular alert; the system
      // notification (with vibration + the OS's own default sound) still
      // shows regardless.
    });
  } catch {
    /* no-op — sound is a nice-to-have, never block on it */
  }
}

function playLoop(tag: string | undefined): void {
  try {
    loopTag = tag || 'alarm';
    const el = getLoopAudio();
    el.currentTime = 0;
    el.volume = 1;
    void el.play().catch(() => {
      // Same autoplay-blocked case as the one-shot above — the system
      // notification (vibration + OS default sound, and it stays on
      // screen with a Dismiss button either way) is still the fallback.
    });

    if (loopSafetyTimer) clearTimeout(loopSafetyTimer);
    loopSafetyTimer = setTimeout(() => stopLoop(loopTag ?? undefined), MAX_LOOP_MS);
  } catch {
    /* no-op */
  }
}

function stopLoop(tag: string | undefined): void {
  // If a tag was given, only stop when it matches the alarm currently
  // looping — avoids one alarm's dismissal cutting off a different one
  // that started ringing afterwards. No tag (or no active loop) just stops
  // whatever's playing.
  if (tag && loopTag && tag !== loopTag) return;
  if (loopSafetyTimer) {
    clearTimeout(loopSafetyTimer);
    loopSafetyTimer = null;
  }
  loopTag = null;
  if (loopAudio) {
    loopAudio.pause();
    loopAudio.currentTime = 0;
  }
}

let listening = false;

/** Starts listening for the service worker's sound signals. Safe to call multiple times. */
export function initNotificationSoundListener(): void {
  if (listening || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  listening = true;
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data as { type?: string; tag?: string } | undefined;
    if (data?.type === 'PLAY_NOTIFICATION_SOUND') playOneShot();
    if (data?.type === 'PLAY_NOTIFICATION_SOUND_LOOP') playLoop(data.tag);
    if (data?.type === 'STOP_NOTIFICATION_SOUND') stopLoop(data.tag);
  });
}