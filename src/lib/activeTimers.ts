import { supabase } from './supabaseClient';

/**
 * Upserts the single "active timer" row of a given kind for this user, so
 * the server-side scheduler can push a completion notification even if the
 * app gets closed before the countdown finishes. `fireAt` is a Date for
 * when it should complete; `meta` is small JSON shown in the push body.
 */
export async function startActiveTimer(
  userId: string,
  kind: string,
  fireAt: Date,
  meta: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from('active_timers')
    .upsert(
      { user_id: userId, kind, fire_at: fireAt.toISOString(), meta, notified: false },
      { onConflict: 'user_id,kind' }
    );
  if (error) console.error('[activeTimers] startActiveTimer failed', error);
}

/** Cancels a pending timer — call on pause/reset/skip/manual-complete so the server doesn't double-fire it. */
export async function clearActiveTimer(userId: string, kind: string): Promise<void> {
  const { error } = await supabase.from('active_timers').delete().eq('user_id', userId).eq('kind', kind);
  if (error) console.error('[activeTimers] clearActiveTimer failed', error);
}