import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyPasscodeServerSide, hashPasscodeServerSide, isPlausiblePasscode } from './_passcodeCrypto.js';
import { isRateLimited, getClientIp } from './_rateLimit.js';

// --- Per-IP rate limiting -------------------------------------------------
// Backed by the same Postgres table + RPC as api/delete-account.ts (see
// _rateLimit.ts) — shared across every serverless instance/region.
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 10;

// Changes the signed-in caller's 6-digit app passcode, requiring proof of
// the CURRENT passcode server-side before the new one is written.
//
// Previously (see PasscodeChangeCard.tsx), "change passcode" only checked
// the current passcode in the browser, then wrote the new hash straight to
// Supabase using the client's already-persisted session token. That token
// alone was enough to call setPasscodeHash(userId, arbitraryHash) directly
// (browser console, a malicious extension, XSS) and overwrite the passcode
// without ever going through the passcode UI — the passcode wasn't really
// an independent factor, just a UI speed bump sitting on top of the
// session. This endpoint closes that gap the same way api/delete-account.ts
// closes it for account deletion:
//
// 1. Client-side (PasscodeChangeCard.tsx): the person re-enters their
//    current passcode and chooses a new one before this endpoint is called.
// 2. Server-side session check (this file): the request must carry a valid
//    Supabase access token, verified against Supabase itself — the only
//    source of truth for "who is this".
// 3. Server-side passcode check (this file): the request must ALSO include
//    the correct CURRENT passcode, independently verified here against the
//    stored hash. Only then is the new hash computed (server-side, from
//    scratch — never trusting a pre-hashed value from the client) and
//    written. A stolen session token alone can no longer change the
//    passcode without also knowing it.
// 4. Server-side passcode lockout (this file): wrong-guess attempts here
//    count against the same server-authoritative lockout as the unlock
//    screen and api/delete-account.ts (see api/passcode-lockout.ts and the
//    register_passcode_failure/get_passcode_lockout RPCs) — clearing
//    localStorage client-side no longer resets the strike count.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as { currentPasscode?: unknown; newPasscode?: unknown } | undefined;
  const currentPasscode = body?.currentPasscode;
  const newPasscode = body?.newPasscode;
  if (!isPlausiblePasscode(currentPasscode) || !isPlausiblePasscode(newPasscode)) {
    return res.status(400).json({ error: 'Missing or invalid passcode.' });
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY as string;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    // Same SUPABASE_SERVICE_ROLE_KEY requirement as api/delete-account.ts —
    // server-side only env var, never VITE_-prefixed. See that file's
    // comment for details on where to get it.
    return res.status(500).json({ error: 'Server misconfigured — missing Supabase env vars' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // SECURITY FIX: failClosed here too, for the same reason as
  // delete-account.ts — this endpoint gates changing the account's
  // passcode, so an RPC/infra error must block the request rather than
  // silently allow unlimited guesses against the current passcode for the
  // duration of any outage.
  const clientIp = getClientIp(req);
  if (await isRateLimited(adminClient, `change-passcode:${clientIp}`, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_REQUESTS, { failClosed: true })) {
    return res.status(429).json({ error: 'Too many requests — please try again later.' });
  }

  // Step 1: verify the token belongs to a real, currently-valid session.
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const userId = userData.user.id;

  // Step 2: server-authoritative passcode lockout, checked before looking
  // at the guess at all.
  const { data: lockoutRow, error: lockoutReadError } = await adminClient.rpc('get_passcode_lockout', { p_user_id: userId });
  if (lockoutReadError) {
    console.error('[change-passcode] Failed to read passcode lockout state', { userId, error: lockoutReadError });
    return res.status(500).json({ error: 'Could not verify your passcode. Please try again.' });
  }
  const lockedUntil = lockoutRow?.[0]?.locked_until ? new Date(lockoutRow[0].locked_until).getTime() : 0;
  if (lockedUntil > Date.now()) {
    return res.status(429).json({ error: 'Too many attempts — try again later.', lockedUntil });
  }

  // Step 3: independently verify the CURRENT passcode against the stored
  // hash before allowing any change.
  const { data: userRow, error: userRowError } = await adminClient
    .from('user_data')
    .select('passcode_hash')
    .eq('user_id', userId)
    .maybeSingle();
  if (userRowError) {
    console.error('[change-passcode] Failed to load passcode hash', { userId, error: userRowError });
    return res.status(500).json({ error: 'Could not verify your passcode. Please try again.' });
  }
  const currentOk = verifyPasscodeServerSide(currentPasscode, userId, userRow?.passcode_hash ?? null);
  if (!currentOk) {
    const { data: failRow, error: failError } = await adminClient.rpc('register_passcode_failure', { p_user_id: userId });
    if (failError) console.error('[change-passcode] Failed to register passcode failure', { userId, error: failError });
    const newLockedUntil = failRow?.[0]?.locked_until ? new Date(failRow[0].locked_until).getTime() : 0;
    return res.status(401).json({ error: 'Incorrect passcode.', lockedUntil: newLockedUntil || undefined });
  }

  // Step 4: only now compute and store the new hash, and clear the strike
  // count since the current passcode just checked out.
  const newHash = hashPasscodeServerSide(newPasscode, userId);
  const { error: updateError } = await adminClient
    .from('user_data')
    .upsert({ user_id: userId, passcode_hash: newHash }, { onConflict: 'user_id' });
  if (updateError) {
    console.error('[change-passcode] Failed to store new passcode hash', { userId, error: updateError });
    return res.status(500).json({ error: 'Could not update your passcode. Please try again.' });
  }
  const { error: clearError } = await adminClient.rpc('clear_passcode_lockout', { p_user_id: userId });
  if (clearError) console.error('[change-passcode] Failed to clear passcode lockout', { userId, error: clearError });

  // SECURITY FIX: this used to also return `passcodeHash: newHash` here so
  // the client could cache it locally for offline unlock. That meant the
  // full PBKDF2 hash (salt + digest) round-tripped through this response —
  // if it were ever logged (proxy/CDN access logs, error tracking, browser
  // extensions inspecting fetch responses) or read via an XSS bug, it would
  // be an offline-crackable artifact with no live rate limit slowing down a
  // guesser. The client already knows both `newPasscode` and `userId` and
  // uses the exact same PBKDF2 construction (see hashPasscode() in
  // src/lib/cloudSync.ts, kept in lock-step with _passcodeCrypto.ts on
  // purpose) — so it can derive the identical local cache value itself
  // instead of receiving it from the server. Nothing sensitive needs to
  // cross the wire in either direction here.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ success: true });
}