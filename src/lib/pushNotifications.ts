import { supabase } from './supabaseClient';

// From your .env — the *public* VAPID key only. Generate the pair with
// `npx web-push generate-vapid-keys` (see SETUP_INSTRUCTIONS.md). Only the
// public half goes in client code; the private half is a Supabase Edge
// Function secret and must never appear here.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  if (swRegistration) return swRegistration;
  swRegistration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return swRegistration;
}

export type PushStatus = 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed';

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registerServiceWorker();
  if (!reg) return 'unsupported';
  const existing = await reg.pushManager.getSubscription();
  return existing ? 'subscribed' : 'unsubscribed';
}

/** Requests permission, subscribes this device to push, and saves the subscription for `userId`. */
export async function subscribeToPush(userId: string): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) {
    console.error('[pushNotifications] Missing VITE_VAPID_PUBLIC_KEY — see SETUP_INSTRUCTIONS.md');
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unsubscribed';

  const reg = await registerServiceWorker();
  if (!reg) return 'unsupported';

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
      timezone,
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    console.error('[pushNotifications] failed to save subscription', error);
    return 'unsubscribed';
  }

  return 'subscribed';
}

/** Unsubscribes this device from push and removes its row from Supabase. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await registerServiceWorker();
  if (!reg) return;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

/** Fire-and-forget message to the service worker (for the live Pomodoro notification). */
export async function messageServiceWorker(message: Record<string, unknown>): Promise<void> {
  if (!pushSupported()) return;
  const reg = await registerServiceWorker();
  reg?.active?.postMessage(message);
}