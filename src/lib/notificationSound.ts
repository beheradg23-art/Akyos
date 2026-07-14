// Custom notification sound.
//
// The Web Notifications API has no "custom sound file" option — it was in
// early spec drafts but no browser ever implemented it, and `showNotification()`
// only ever plays the OS/browser's own default alert sound (unless `silent`
// is set). So a website has exactly one way to play a *real* custom sound
// file for a notification: from live JS, while a tab or window for the app
// is open (foreground or backgrounded — this does NOT run if the app is
// fully closed/swiped away, since there's no JS execution context left to
// play audio from).
//
// public/sw.js posts a PLAY_NOTIFICATION_SOUND message to every open
// client whenever it shows a push notification or the Pomodoro-complete
// notification; this file just listens for that and plays the chime.

const SOUND_URL = '/sounds/akyos-chime.wav';

let primed = false;
let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.preload = 'auto';
  }
  return audio;
}

/**
 * Mobile browsers block audio playback that isn't triggered by a user
 * gesture. Call this once from any real tap/click early in the session
 * (e.g. when the person turns push notifications on) so the audio element
 * is "unlocked" and can then be played programmatically later when a push
 * arrives, without needing another gesture at that moment.
 */
export function primeNotificationSound(): void {
  if (primed || typeof window === 'undefined') return;
  const el = getAudio();
  el.volume = 0;
  el
    .play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.volume = 1;
      primed = true;
    })
    .catch(() => {
      // Gesture wasn't enough (or autoplay is blocked) — we'll just try
      // again next time this is called from a tap.
    });
}

function playChime(): void {
  try {
    const el = getAudio();
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

let listening = false;

/** Starts listening for the service worker's "play this sound" signal. Safe to call multiple times. */
export function initNotificationSoundListener(): void {
  if (listening || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  listening = true;
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data as { type?: string } | undefined;
    if (data?.type === 'PLAY_NOTIFICATION_SOUND') playChime();
  });
}