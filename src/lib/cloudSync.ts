import { useEffect } from 'react';
import { supabase } from './supabaseClient';

// Same list of keys your existing "Data Backup & Restore" card (DataBackupCard,
// in App__11_.tsx) already exports to a JSON file. Kept in sync intentionally —
// if you ever add a new localStorage key to the app, add it here too and it
// will be included in both the manual backup file AND the cloud sync.
export const SYNC_KEYS = [
  'jee_command_history_v2',
  'mock_test_log',
  'topic_revision_log',
  'diet_log_v1',
  'weight_log_v1',
  'ash_clock_focus_min',
  'ash_clock_break_min',
  'ash_clock_hunter_level',
  'ash_clock_quests_cleared',
  'pomodoro_subject_log',
  'ash_clock_last_subject',
  'app_config_v1',
  'timeline_notifications_enabled',
  'dcc_content_cache_v1',
  'akyos_onboarding_completed_v1',
] as const;

export type CloudSnapshot = Record<string, string | null>;

// ---------- Account isolation ----------
// PHASE 1 FIX (see PHASE_1_HANDOFF.md): localStorage is shared by the whole
// browser, not scoped per Supabase account. Previously, nothing ever cleared
// it between accounts, so a brand-new signup (or a sign-in on a device that
// was last used by someone else) would inherit whatever the *previous*
// account left behind — config, routine, weight/diet logs, onboarding-done
// flag, even the passcode hash. `ensureAccountIsolation` is the single choke
// point that stops that: it remembers which user id last "owned" this
// browser's local storage, and wipes every account-scoped key the instant it
// detects a different (or no previous) user id, before anything gets pulled
// from or pushed to the cloud for the incoming session.
//
// LAST_ACTIVE_USER_KEY intentionally lives OUTSIDE SYNC_KEYS — it must never
// be synced to the cloud or copied between accounts; it's purely a local
// "whose data is currently sitting in this browser" marker.
export const LAST_ACTIVE_USER_KEY = 'dcc_last_active_user_id';

/** Wipes every account-scoped key from localStorage (all of SYNC_KEYS, plus
 * the passcode hash, which is deliberately kept out of SYNC_KEYS/the cloud
 * snapshot since it's derived per-device). Does NOT touch
 * LAST_ACTIVE_USER_KEY — callers decide separately whether to update that.
 */
export function resetLocalAccountState(): void {
  SYNC_KEYS.forEach((key) => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  });
  try { localStorage.removeItem(PASSCODE_HASH_KEY); } catch { /* ignore */ }
}

/**
 * Call this with the id of the account that's about to become active
 * (right after signup succeeds with a session, and at the top of the
 * sign-in sync flow) BEFORE any pull/push happens.
 *
 * If the browser's local data currently belongs to a different account (or
 * no account is on record at all), every account-scoped key is wiped first
 * — so a new account always starts from a genuinely empty/default state,
 * and a returning account only ever ends up with ITS OWN cloud data, never
 * leftovers from whoever used this browser before.
 *
 * Returns true if a reset happened (useful for logging/debugging), false if
 * this device was already known to belong to this exact account.
 */
export function ensureAccountIsolation(userId: string): boolean {
  let lastUserId: string | null = null;
  try { lastUserId = localStorage.getItem(LAST_ACTIVE_USER_KEY); } catch { /* ignore */ }

  if (lastUserId === userId) return false;

  resetLocalAccountState();
  try { localStorage.setItem(LAST_ACTIVE_USER_KEY, userId); } catch { /* ignore */ }
  return true;
}

export function collectLocalSnapshot(): CloudSnapshot {
  const snapshot: CloudSnapshot = {};
  SYNC_KEYS.forEach((key) => {
    snapshot[key] = localStorage.getItem(key);
  });
  return snapshot;
}

export function applySnapshotToLocalStorage(snapshot: CloudSnapshot) {
  if (!snapshot) return;
  Object.entries(snapshot).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      localStorage.setItem(key, value);
    }
  });
}

/** Push the current local data up to this user's row in Supabase. */
export async function pushToCloud(userId: string): Promise<void> {
  const snapshot = collectLocalSnapshot();
  const { error } = await supabase
    .from('user_data')
    .upsert(
      { user_id: userId, data: snapshot, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

/**
 * Pull this user's cloud data down into localStorage.
 * Returns true if cloud data existed and was applied, false if this is a
 * brand new account with nothing saved yet.
 */
export async function pullFromCloud(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data?.data) {
    applySnapshotToLocalStorage(data.data as CloudSnapshot);
    return true;
  }
  return false;
}

// ---------- Per-account passcode ----------
// The passcode is never stored in plain text. It's hashed together with
// the user's own account id as a salt (so the same passcode picked by two
// different people produces two different hashes), and only the hash ever
// leaves the device.

export const PASSCODE_HASH_KEY = 'dcc_passcode_hash';

export async function hashPasscode(passcode: string, userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${passcode}:${userId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function setPasscodeHash(userId: string, hash: string): Promise<void> {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, passcode_hash: hash }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function getPasscodeHash(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_data')
    .select('passcode_hash')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.passcode_hash ?? null;
}

/**
 * Auto-syncs local data to the cloud every `intervalMs` while `enabled` is
 * true, plus once whenever the tab is hidden/closed. Drop this in near the
 * top of JEEDashboard: `useCloudAutoSync(unlocked)`.
 */
export function useCloudAutoSync(enabled: boolean, intervalMs = 45000) {
  useEffect(() => {
    if (!enabled) return;

    let userId: string | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) userId = data.user?.id ?? null;
    });

    const doPush = () => {
      if (userId) pushToCloud(userId).catch((e) => console.error('[cloudSync] push failed', e));
    };

    const interval = setInterval(doPush, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') doPush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', doPush);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', doPush);
    };
  }, [enabled, intervalMs]);
}