// Regression tests for the Phase 1 account-isolation fix.
//
// The bug these guard against: localStorage is shared by the whole browser,
// not scoped per Supabase account. Before Phase 1, a new account (or a
// different account signing in on a device someone else had used) would
// silently inherit whatever account was last active on that browser —
// config, routine, weight/diet logs, the onboarding-done flag, even the
// passcode hash.
//
// Run with: npm test  (or: npx vitest run src/lib/cloudSync.test.ts)
import { describe, it, expect, beforeEach, vi } from 'vitest';

// cloudSync.ts imports the real supabase client at module scope, which
// needs real env vars and constructs a real network-capable client just by
// being imported. These tests only exercise the pure-localStorage isolation
// helpers (resetLocalAccountState / ensureAccountIsolation), which never
// touch supabase at all, so the client is stubbed out entirely rather than
// hit for real.
vi.mock('./supabaseClient', () => ({
  supabase: {
    from: () => ({
      upsert: async () => ({ error: null }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
    auth: {
      getUser: async () => ({ data: { user: null } }),
    },
  },
}));

// Minimal localStorage polyfill. These tests run under vitest's 'node'
// environment (see vite.config.ts), which has no `localStorage` global.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

const {
  SYNC_KEYS,
  LAST_ACTIVE_USER_KEY,
  PASSCODE_HASH_KEY,
  resetLocalAccountState,
  ensureAccountIsolation,
} = await import('./cloudSync');

describe('resetLocalAccountState', () => {
  it('clears every key in SYNC_KEYS', () => {
    SYNC_KEYS.forEach((k) => localStorage.setItem(k, 'some-value'));
    resetLocalAccountState();
    SYNC_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
  });

  it('clears the passcode hash', () => {
    localStorage.setItem(PASSCODE_HASH_KEY, 'abc123');
    resetLocalAccountState();
    expect(localStorage.getItem(PASSCODE_HASH_KEY)).toBeNull();
  });

  it('does not touch LAST_ACTIVE_USER_KEY (callers decide that separately)', () => {
    localStorage.setItem(LAST_ACTIVE_USER_KEY, 'user-a');
    resetLocalAccountState();
    expect(localStorage.getItem(LAST_ACTIVE_USER_KEY)).toBe('user-a');
  });

  it('does not throw when keys were never set', () => {
    expect(() => resetLocalAccountState()).not.toThrow();
  });
});

describe('ensureAccountIsolation — the core account-leak fix', () => {
  it('wipes local data and records the user id on a fresh device (no marker yet)', () => {
    localStorage.setItem('app_config_v1', 'leftover-from-nowhere');

    const wasReset = ensureAccountIsolation('user-a');

    expect(wasReset).toBe(true);
    expect(localStorage.getItem('app_config_v1')).toBeNull();
    expect(localStorage.getItem(LAST_ACTIVE_USER_KEY)).toBe('user-a');
  });

  it('reproduces and fixes the reported bug: a new account no longer inherits the previous account\'s data', () => {
    // Account A used this browser and left its data behind — name, config,
    // performance-calendar-backed history, onboarding already completed.
    ensureAccountIsolation('user-a');
    localStorage.setItem('app_config_v1', JSON.stringify({ name: 'Account A', wake: '05:30' }));
    localStorage.setItem('akyos_onboarding_completed_v1', 'true');
    localStorage.setItem('jee_command_history_v2', JSON.stringify(['2026-07-01', '2026-07-02']));
    localStorage.setItem(PASSCODE_HASH_KEY, 'hash-for-account-a');

    // Account B signs up on the same browser.
    const wasReset = ensureAccountIsolation('user-b');

    expect(wasReset).toBe(true);
    // None of Account A's data survives into Account B's session.
    expect(localStorage.getItem('app_config_v1')).toBeNull();
    expect(localStorage.getItem('akyos_onboarding_completed_v1')).toBeNull();
    expect(localStorage.getItem('jee_command_history_v2')).toBeNull();
    expect(localStorage.getItem(PASSCODE_HASH_KEY)).toBeNull();
    // The device now belongs to B.
    expect(localStorage.getItem(LAST_ACTIVE_USER_KEY)).toBe('user-b');
  });

  it('does NOT wipe data when the same account continues on the same device', () => {
    ensureAccountIsolation('user-a');
    localStorage.setItem('app_config_v1', 'A-config');

    const wasReset = ensureAccountIsolation('user-a');

    expect(wasReset).toBe(false);
    expect(localStorage.getItem('app_config_v1')).toBe('A-config');
  });

  it('is idempotent across repeated calls for the same account', () => {
    ensureAccountIsolation('user-a');
    localStorage.setItem('diet_log_v1', 'some-diet-data');

    ensureAccountIsolation('user-a');
    ensureAccountIsolation('user-a');

    expect(localStorage.getItem('diet_log_v1')).toBe('some-diet-data');
  });

  it('switching back and forth between two real accounts never leaks either direction', () => {
    ensureAccountIsolation('user-a');
    localStorage.setItem('app_config_v1', 'A-config');

    ensureAccountIsolation('user-b');
    expect(localStorage.getItem('app_config_v1')).toBeNull(); // A didn't leak into B
    localStorage.setItem('app_config_v1', 'B-config');

    ensureAccountIsolation('user-a');
    // B didn't leak into A either. (A's own data isn't restored here because
    // that's pullFromCloud's job, called separately right after this in
    // AuthGate.tsx — this test only covers the isolation boundary itself.)
    expect(localStorage.getItem('app_config_v1')).toBeNull();
  });
});
