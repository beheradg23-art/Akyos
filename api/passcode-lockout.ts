import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { isRateLimited, getClientIp } from './_rateLimit.js';

// Exposes the server-authoritative passcode-lockout state (see
// supabase/migrations/0001_server_side_rate_limiting.sql) to the client, so
// src/lib/cloudSync.ts's lockout functions can be backed by something that
// survives `localStorage.removeItem('dcc_passcode_attempts')` in devtools —
// previously the ENTIRE lockout lived in that one key, so clearing it reset
// the strike count instantly with zero server-side memory of prior guesses.
//
// This does NOT verify the passcode itself — it only tracks/reports
// wrong-guess counts and the resulting cooldown. The client still checks
// the guess locally (against the cached hash) for the base "unlock the app"
// screen, since that flow is intentionally offline-capable; this endpoint
// just makes the RATE LIMITING on top of that check authoritative rather
// than purely local. api/delete-account.ts and api/change-passcode.ts,
// which already do server-side passcode verification, register their own
// failures directly against the same RPCs (see those files) rather than
// going through this endpoint.
//
// action: 'status' — read current lockout, no side effect.
// action: 'fail'   — record one more wrong guess, returns the new lockout.
// action: 'clear'  — reset the strike count after a correct guess.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = (req.body as { action?: unknown } | undefined)?.action;
  if (action !== 'status' && action !== 'fail' && action !== 'clear') {
    return res.status(400).json({ error: 'Invalid action.' });
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
    return res.status(500).json({ error: 'Server misconfigured — missing Supabase env vars' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Generous IP-based cap on the endpoint itself — this isn't the thing
  // enforcing the passcode lockout (the RPCs below are), just a guard
  // against the status/fail/clear endpoint itself being hammered directly.
  const clientIp = getClientIp(req);
  if (await isRateLimited(adminClient, `passcode-lockout:${clientIp}`, 60, 120)) {
    return res.status(429).json({ error: 'Too many requests — please try again later.' });
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const userId = userData.user.id;

  if (action === 'status') {
    const { data, error } = await adminClient.rpc('get_passcode_lockout', { p_user_id: userId });
    if (error) {
      console.error('[passcode-lockout] status failed', { userId, error });
      return res.status(500).json({ error: 'Could not read lockout state.' });
    }
    const lockedUntil = data?.[0]?.locked_until ? new Date(data[0].locked_until).getTime() : null;
    return res.status(200).json({ lockedUntil });
  }

  if (action === 'fail') {
    const { data, error } = await adminClient.rpc('register_passcode_failure', { p_user_id: userId });
    if (error) {
      console.error('[passcode-lockout] fail failed', { userId, error });
      return res.status(500).json({ error: 'Could not record failed attempt.' });
    }
    const lockedUntil = data?.[0]?.locked_until ? new Date(data[0].locked_until).getTime() : null;
    return res.status(200).json({ lockedUntil });
  }

  // action === 'clear'
  const { error } = await adminClient.rpc('clear_passcode_lockout', { p_user_id: userId });
  if (error) {
    console.error('[passcode-lockout] clear failed', { userId, error });
    return res.status(500).json({ error: 'Could not clear lockout state.' });
  }
  return res.status(200).json({ lockedUntil: null });
}