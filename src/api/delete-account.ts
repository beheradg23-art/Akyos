import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Deletes the signed-in caller's account entirely: their `user_data` cloud
// row (config, logs, passcode hash) and the Supabase Auth user itself.
//
// This has to run server-side. Deleting a Supabase Auth user requires the
// project's *service role* key — a secret with full admin rights that must
// never ship to the browser. The anon key the client already uses (see
// src/lib/supabaseClient.ts) deliberately has no permission to do this.
//
// Required auth, two layers (see DeleteAccountCard in
// src/components/account/AccountPage.tsx for the client-side half):
// 1. Client-side: the person must re-enter their current 6-digit app
//    passcode and type a literal "DELETE" confirmation before this
//    endpoint is ever called.
// 2. Server-side (this file): the request must carry a valid Supabase
//    access token (the caller's own session JWT) in the Authorization
//    header. That token is verified against Supabase itself using the
//    low-privilege anon key — never trusting any user id the client might
//    send — and only the EXACT user id that token resolves to is ever
//    deleted. A caller can never pass an arbitrary id and delete someone
//    else's account.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  // Step 2: only now, bound to a verified session's own user id, use the
  // service-role client (full admin rights) to actually delete things.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Delete the cloud data row first (config, logs, passcode hash — see
  // cloudSync.ts's `user_data` table). If this fails, bail out before
  // touching the Auth user, so a partial failure doesn't leave a deleted
  // login with orphaned data still sitting in the table.
  const { error: dataDeleteError } = await adminClient
    .from('user_data')
    .delete()
    .eq('user_id', userId);
  if (dataDeleteError) {
    return res.status(500).json({ error: 'Failed to delete account data', details: dataDeleteError.message });
  }

  // Delete the Auth user itself — this is the step that actually requires
  // the service role key; nothing else in this endpoint does.
  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    return res.status(500).json({ error: 'Failed to delete account', details: authDeleteError.message });
  }

  return res.status(200).json({ success: true });
}