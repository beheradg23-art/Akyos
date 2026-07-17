import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyPasscodeServerSide, isPlausiblePasscode } from './_passcodeCrypto';
import { isRateLimited, getClientIp } from './_rateLimit';

// --- Per-IP rate limiting -------------------------------------------------
// Backed by a Postgres table + RPC (see _rateLimit.ts and
// supabase/migrations/0001_server_side_rate_limiting.sql) — shared across
// every serverless instance/region, unlike an in-memory Map (what this used
// to be), which reset on every cold start and let a distributed caller
// exceed the limit just by hitting different cold-started instances.
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 5;

// Deletes the signed-in caller's account entirely: their `user_data` cloud
// row (config, logs, passcode hash) and the Supabase Auth user itself.
//
// This has to run server-side. Deleting a Supabase Auth user requires the
// project's *service role* key — a secret with full admin rights that must
// never ship to the browser. The anon key the client already uses (see
// src/lib/supabaseClient.ts) deliberately has no permission to do this.
//
// Required auth, FOUR layers (see DeleteAccountCard in
// src/components/account/AccountPage.tsx for the client-side half):
// 1. Client-side: the person must re-enter their current 6-digit app
//    passcode and type a literal "DELETE" confirmation before this
//    endpoint is ever called.
// 2. Server-side session check (this file): the request must carry a valid
//    Supabase access token (the caller's own session JWT) in the
//    Authorization header. That token is verified against Supabase itself
//    using the low-privilege anon key — never trusting any user id the
//    client might send — and only the EXACT user id that token resolves to
//    is ever deleted. A caller can never pass an arbitrary id and delete
//    someone else's account.
// 3. Server-side passcode check (this file): the request must ALSO include
//    the correct current passcode, which this endpoint independently
//    verifies against the stored hash before deleting anything. This is
//    what makes layer 1 a real second factor rather than just a UI speed
//    bump — a bare stolen/leaked session token (e.g. via an XSS payload
//    reading localStorage) is no longer sufficient on its own to delete the
//    account; the caller also has to actually know the passcode.
// 4. Server-side passcode lockout (this file): wrong-passcode guesses
//    against this endpoint count against the SAME server-authoritative
//    lockout as the app's unlock screen and change-passcode.ts (see
//    _passcodeCrypto's sibling, api/passcode-lockout.ts, and the
//    register_passcode_failure/get_passcode_lockout RPCs) — clearing
//    localStorage client-side no longer resets the strike count.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const passcode = (req.body as { passcode?: unknown } | undefined)?.passcode;
  if (!isPlausiblePasscode(passcode)) {
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
    // SUPABASE_SERVICE_ROLE_KEY is new — it did not exist anywhere in this
    // project before this endpoint. It must be added to your host's env
    // vars (Vercel/Netlify/etc), server-side only, NEVER prefixed with
    // VITE_ (that prefix is what makes Vite ship a var to the browser —
    // this key must never end up in client code). Get it from Supabase
    // dashboard -> Project Settings -> API -> service_role secret.
    return res.status(500).json({ error: 'Server misconfigured — missing Supabase env vars' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // IP-based rate limiting stays first (cheapest check, and it protects the
  // session-verification call below too from being hammered).
  // SECURITY FIX: failClosed here — this endpoint permanently destroys
  // data, so an RPC/infra error must block the request (503) rather than
  // silently degrade to "no rate limiting", which would otherwise hand an
  // attacker unlimited passcode-guessing attempts for the duration of any
  // outage or forced error.
  const clientIp = getClientIp(req);
  if (await isRateLimited(adminClient, `delete-account:${clientIp}`, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_REQUESTS, { failClosed: true })) {
    return res.status(429).json({ error: 'Too many requests — please try again later.' });
  }

  // Step 1: verify the token belongs to a real, currently-valid session,
  // using the same low-privilege anon client the app already uses. This
  // is the only source of truth for "who is this" — nothing from the
  // request body is ever trusted for identity.
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const userId = userData.user.id;

  // Step 2: server-authoritative passcode lockout — bound to this exact
  // user id, so it can't be reset by clearing localStorage. Checked before
  // even looking at the passcode guess.
  const { data: lockoutRow, error: lockoutReadError } = await adminClient.rpc('get_passcode_lockout', { p_user_id: userId });
  if (lockoutReadError) {
    console.error('[delete-account] Failed to read passcode lockout state', { userId, error: lockoutReadError });
    return res.status(500).json({ error: 'Could not verify your passcode. Please try again.' });
  }
  const lockedUntil = lockoutRow?.[0]?.locked_until ? new Date(lockoutRow[0].locked_until).getTime() : 0;
  if (lockedUntil > Date.now()) {
    return res.status(429).json({ error: 'Too many attempts — try again later.', lockedUntil });
  }

  // Step 3: independently verify the passcode server-side, against the
  // stored hash — not just trusting that the client-side UI already did
  // this. See _passcodeCrypto.ts.
  const { data: userRow, error: userRowError } = await adminClient
    .from('user_data')
    .select('passcode_hash')
    .eq('user_id', userId)
    .maybeSingle();
  if (userRowError) {
    console.error('[delete-account] Failed to load passcode hash', { userId, error: userRowError });
    return res.status(500).json({ error: 'Could not verify your passcode. Please try again.' });
  }
  const passcodeOk = verifyPasscodeServerSide(passcode, userId, userRow?.passcode_hash ?? null);
  if (!passcodeOk) {
    const { data: failRow, error: failError } = await adminClient.rpc('register_passcode_failure', { p_user_id: userId });
    if (failError) console.error('[delete-account] Failed to register passcode failure', { userId, error: failError });
    const newLockedUntil = failRow?.[0]?.locked_until ? new Date(failRow[0].locked_until).getTime() : 0;
    return res.status(401).json({ error: 'Incorrect passcode.', lockedUntil: newLockedUntil || undefined });
  }
  // Correct passcode — clear the strike count so a later legitimate retry
  // (e.g. after cancelling the DELETE confirmation) isn't still counted
  // against a stale streak of earlier wrong guesses.
  const { error: clearError } = await adminClient.rpc('clear_passcode_lockout', { p_user_id: userId });
  if (clearError) console.error('[delete-account] Failed to clear passcode lockout', { userId, error: clearError });

  // Delete the cloud data row first (config, logs, passcode hash — see
  // cloudSync.ts's `user_data` table). If this fails, bail out before
  // touching the Auth user, so a partial failure doesn't leave a deleted
  // login with orphaned data still sitting in the table.
  const { error: dataDeleteError } = await adminClient
    .from('user_data')
    .delete()
    .eq('user_id', userId);
  if (dataDeleteError) {
    // Log full details server-side only — never echo Supabase's raw error
    // message back to the client, since it can leak internal schema/config
    // details. The client just gets a generic, safe message.
    console.error('[delete-account] Failed to delete user_data row', { userId, error: dataDeleteError });
    return res.status(500).json({ error: 'Failed to delete account data. Please try again or contact support.' });
  }

  // Delete the Auth user itself — this is the step that actually requires
  // the service role key; nothing else in this endpoint does.
  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    // Same rationale as above: log the real error server-side only, keep
    // the client-facing message generic.
    console.error('[delete-account] Failed to delete auth user', { userId, error: authDeleteError });
    return res.status(500).json({ error: 'Failed to delete account. Please try again or contact support.' });
  }

  // Also clean up this user's lockout row now that the account is gone —
  // not strictly necessary (it's keyed by a user id that no longer exists
  // and will never collide with a real future user), but tidy.
  try {
    await adminClient.rpc('clear_passcode_lockout', { p_user_id: userId });
  } catch {
    // best-effort cleanup only; failure here shouldn't affect the response
  }

  return res.status(200).json({ success: true });
}