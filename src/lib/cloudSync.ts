import { useEffect, useState } from 'react';
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
  'jee_command_todos_v1',
  'app_config_v1',
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
// The passcode is never stored in plain text. It's stretched through
// PBKDF2 (150,000 rounds of HMAC-SHA-256, random per-hash salt) before it
// ever leaves the device. A 6-digit passcode only has 1,000,000 possible
// values, so the thing standing between a leaked hash and the actual
// passcode is entirely how expensive each guess is to check — a single
// fast SHA-256 round (the old scheme) makes the whole keyspace brute-
// forceable in a fraction of a second; 150,000 PBKDF2 rounds makes it take
// meaningfully longer per guess instead, at a cost (well under a second)
// that's imperceptible for the one real guess a person types in.
//
// Hash format: `pbkdf2:<iterations>:<saltHex>:<hashHex>`. Accounts created
// before this existed still have a bare 64-char hex SHA-256 digest stored
// (`sha256(passcode:userId)`, no salt, no stretching) — verifyPasscode()
// below still recognizes that legacy format so nobody already using the
// app gets locked out, and transparently re-hashes + upgrades it to the
// new format the instant that person next enters their passcode correctly.

export const PASSCODE_HASH_KEY = 'dcc_passcode_hash';
const PBKDF2_ITERATIONS = 150_000;

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

async function pbkdf2Hex(input: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(input), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
  return bufferToHex(bits);
}

// Old (pre-hardening) scheme — a single unsalted-beyond-userId SHA-256
// round. Kept only so verifyPasscode can still recognize a hash created
// before PBKDF2 stretching was added; never used to produce new hashes.
async function legacyHashPasscode(passcode: string, userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${passcode}:${userId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bufferToHex(digest);
}

/** Hashes a passcode for STORAGE — always produces the current, stretched
 * `pbkdf2:...` format. Call this whenever setting or changing a passcode.
 * To check a guess against an already-stored hash, use `verifyPasscode`
 * below instead — that's the one that also still understands old hashes.
 */
export async function hashPasscode(passcode: string, userId: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await pbkdf2Hex(`${passcode}:${userId}`, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bufferToHex(salt)}:${hashHex}`;
}

/**
 * Checks a passcode guess against a stored hash, transparently supporting
 * both the current PBKDF2 format and the old bare-SHA-256 format. Returns
 * `upgradedHash` (non-null) the moment a legacy hash successfully matches,
 * so the caller can silently re-save it in the new, stretched format right
 * then — every successful legacy check IS the migration point, no separate
 * migration pass needed, and the person never sees anything different.
 */
export async function verifyPasscode(
  passcode: string,
  userId: string,
  storedHash: string | null
): Promise<{ valid: boolean; upgradedHash: string | null }> {
  if (!storedHash) return { valid: false, upgradedHash: null };

  if (storedHash.startsWith('pbkdf2:')) {
    const [, iterationsStr, saltHex, expectedHex] = storedHash.split(':');
    const iterations = parseInt(iterationsStr, 10);
    if (!iterations || !saltHex || !expectedHex) return { valid: false, upgradedHash: null };
    const candidateHex = await pbkdf2Hex(`${passcode}:${userId}`, hexToBytes(saltHex), iterations);
    return { valid: candidateHex === expectedHex, upgradedHash: null };
  }

  // Legacy bare-SHA-256 hash — no version prefix.
  const legacyHash = await legacyHashPasscode(passcode, userId);
  if (legacyHash !== storedHash) return { valid: false, upgradedHash: null };
  return { valid: true, upgradedHash: await hashPasscode(passcode, userId) };
}

export async function setPasscodeHash(userId: string, hash: string): Promise<void> {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, passcode_hash: hash }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Wipes the stored passcode hash (cloud only — caller is responsible for
 * also clearing the local `PASSCODE_HASH_KEY` cache and any lockout state).
 * Used by the "forgot passcode" recovery flow once identity has been
 * re-proven some other way (current account password, or an emailed
 * recovery link) — after this, `decidePostSyncStage` in AuthGate finds no
 * hash and routes straight to "choose a new passcode" instead of "enter
 * your passcode", the same screen a brand-new account sees.
 */
export async function clearPasscodeHash(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, passcode_hash: null }, { onConflict: 'user_id' });
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

// Persisted (not sessionStorage — an emailed recovery link often opens in a
// brand-new tab, which wouldn't share a sessionStorage value) marker that
// AuthGate sets right before sending a recovery email FROM the "forgot
// passcode" flow specifically, so that once that emailed link is clicked
// and a new account password is saved, the passcode also gets wiped in the
// same step — one recovery email covers both "forgot my password" and
// "forgot my passcode" when they're the same underlying event. Cleared the
// moment it's consumed, and defensively on any *ordinary* "forgot password"
// entry too, so a stale flag from an abandoned attempt can never wipe a
// passcode the person never actually asked to reset.
export const PASSCODE_RECOVERY_PENDING_KEY = 'dcc_passcode_recovery_pending';

// ---------- Passcode attempt lockout ----------
// Purely a client-side speed bump against rapid repeated guessing typed
// straight into the passcode screen itself — the PBKDF2 stretching above
// is the real defense against someone brute-forcing a *leaked* hash
// offline. This can't stop that (anyone with the hash and unlimited local
// compute can ignore any UI-level cooldown), only someone trying guess
// after guess through the app. Escalates: the first few misses cost
// nothing extra (typos happen), then a growing cooldown kicks in, capped
// so a genuine mistake never turns into an effectively permanent lock.
// Shared (one localStorage key) across every place a passcode gets
// checked — AuthGate's unlock screen, PasscodeChangeCard, and
// DeleteAccountCard — since they all guess against the same hash, the
// strike count should be too.
const PASSCODE_ATTEMPTS_KEY = 'dcc_passcode_attempts';
const LOCKOUT_FREE_ATTEMPTS = 5; // wrong guesses allowed before any cooldown starts
const LOCKOUT_BASE_MS = 15_000; // first cooldown once the free attempts run out
const LOCKOUT_MAX_MS = 5 * 60_000; // cooldown never grows past this

function readAttemptState(): { failCount: number; lockedUntil: number } {
  try {
    const raw = localStorage.getItem(PASSCODE_ATTEMPTS_KEY);
    if (!raw) return { failCount: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    return { failCount: parsed.failCount || 0, lockedUntil: parsed.lockedUntil || 0 };
  } catch {
    return { failCount: 0, lockedUntil: 0 };
  }
}

function writeAttemptState(state: { failCount: number; lockedUntil: number }) {
  try {
    localStorage.setItem(PASSCODE_ATTEMPTS_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — lockout just won't persist across reloads, not fatal */
  }
}

/** Milliseconds remaining before another guess is allowed (0 if not locked out right now). */
export function getPasscodeLockoutRemainingMs(): number {
  return Math.max(0, readAttemptState().lockedUntil - Date.now());
}

/** Call after a WRONG passcode guess. Returns the lockout duration (ms) now in effect — 0 if still within the free-attempt allowance. */
export function registerFailedPasscodeAttempt(): number {
  const state = readAttemptState();
  const failCount = state.failCount + 1;
  let lockoutMs = 0;
  if (failCount > LOCKOUT_FREE_ATTEMPTS) {
    const exponent = failCount - LOCKOUT_FREE_ATTEMPTS - 1;
    lockoutMs = Math.min(LOCKOUT_BASE_MS * 2 ** exponent, LOCKOUT_MAX_MS);
  }
  writeAttemptState({ failCount, lockedUntil: lockoutMs ? Date.now() + lockoutMs : 0 });
  return lockoutMs;
}

/** Call after a CORRECT passcode guess — clears the strike count entirely. */
export function clearPasscodeAttempts(): void {
  try { localStorage.removeItem(PASSCODE_ATTEMPTS_KEY); } catch { /* ignore */ }
}

/** Live-updating ms-remaining-locked-out value, ticking down on its own. 0 whenever not locked out. */
export function usePasscodeLockoutMs(): number {
  const [remaining, setRemaining] = useState(() => getPasscodeLockoutRemainingMs());
  useEffect(() => {
    const interval = setInterval(() => setRemaining(getPasscodeLockoutRemainingMs()), 500);
    return () => clearInterval(interval);
  }, []);
  return remaining;
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