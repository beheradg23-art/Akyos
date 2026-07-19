import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { isRateLimited, getClientIp } from './_rateLimit.js';

// ---------------------------------------------------------------------------
// One endpoint, four actions (mirrors delete-account.ts / change-passcode.ts
// for the "auth'd, service-role-backed" shape, but adds two PUBLIC actions —
// lookup/decide — for the parent, who never has an account or session in
// this app at all):
//
//   request  (auth'd)   — child submits their birthdate + a parent email.
//                          Creates/refreshes the consent row, emails the
//                          parent a one-time decision link.
//   status   (auth'd)   — child's client polls this while waiting.
//   lookup   (PUBLIC)   — the parent's decision page calls this first, to
//                          show "you're deciding for [masked email]" before
//                          they commit to anything.
//   decide   (PUBLIC)   — the parent approves or denies. The token IS the
//                          credential here; there is no parent login.
//
// SECURITY: the child's own browser NEVER learns the token (and therefore
// can never call `decide` itself) except in one explicit fallback — see the
// emailSent handling below — for deploys that haven't configured an email
// provider yet. When RESEND_API_KEY is set, the token only ever leaves this
// server inside the email sent to the parent's address, which is the
// entire point of the flow.
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const REQUEST_MAX_PER_IP = 8;
const REQUEST_MAX_PER_USER = 5; // resends included
const DECIDE_MAX_PER_IP = 20; // generous — the token itself is the real gate
const LOOKUP_MAX_PER_IP = 30;
const STATUS_MAX_PER_IP = 60;

const MIN_AGE_FOR_UNRESTRICTED_SIGNUP = 18;

function calculateAgeServerSide(birthdate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return null;
  const birth = new Date(birthdate + 'T00:00:00Z');
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  if (birth.getTime() > today.getTime()) return null; // future birthdate — invalid
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

function isPlausibleEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 320;
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(user.length - visible.length, 3))}@${domain}`;
}

function isSafeOrigin(origin: unknown): origin is string {
  if (typeof origin !== 'string') return false;
  try {
    const u = new URL(origin);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

async function sendParentEmail(opts: { to: string; approveUrl: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[parental-consent] RESEND_API_KEY not set — skipping real email send. See src/lib/parentalConsent.ts fallbackLink.');
    return false;
  }
  const from = process.env.PARENTAL_CONSENT_FROM_EMAIL || 'Akyos <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: 'Permission requested for your child to use Akyos',
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
            <h2 style="margin-bottom: 8px;">A permission request from Akyos</h2>
            <p>Someone using this email as their parent/guardian contact has asked to create an Akyos account, and told us they're under 18.</p>
            <p>Akyos requires a parent or guardian's permission before anyone under 18 can use the app. Nothing has been activated yet — the account stays on hold until you respond.</p>
            <p style="margin: 24px 0;">
              <a href="${opts.approveUrl}" style="background:#7c3aed;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Review this request</a>
            </p>
            <p style="font-size: 13px; color: #71717a;">That link opens a page where you can approve or decline — no account or sign-in needed on your end. If you didn't expect this, you can safely ignore this email or choose "Decline" on that page.</p>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      console.error('[parental-consent] Resend API call failed', { status: res.status, body: await res.text().catch(() => '') });
      return false;
    }
    return true;
  } catch (e) {
    console.error('[parental-consent] Resend API call threw', e);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY as string;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfigured — missing Supabase env vars' });
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const clientIp = getClientIp(req);

  const body = (req.body || {}) as Record<string, unknown>;
  const action = body.action;

  // --- helper: resolve the caller's session -> user id, for the two
  // auth'd actions (request/status). Never trust a client-sent user id.
  async function requireUser(): Promise<{ userId: string } | { error: string; status: number }> {
    const authHeader = (req.headers.authorization as string) || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!accessToken) return { error: 'Missing access token', status: 401 };
    const authClient = createClient(supabaseUrl, anonKey);
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (error || !data?.user) return { error: 'Invalid or expired session', status: 401 };
    return { userId: data.user.id };
  }

  if (action === 'request') {
    if (await isRateLimited(adminClient, `parental-consent:request:ip:${clientIp}`, RATE_LIMIT_WINDOW_SECONDS, REQUEST_MAX_PER_IP)) {
      return res.status(429).json({ error: 'Too many requests — please try again later.' });
    }
    const auth = await requireUser();
    if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
    const { userId } = auth;

    if (await isRateLimited(adminClient, `parental-consent:request:user:${userId}`, RATE_LIMIT_WINDOW_SECONDS, REQUEST_MAX_PER_USER)) {
      return res.status(429).json({ error: 'Too many requests for this account — please try again later.' });
    }

    const birthdate = body.birthdate;
    const parentEmail = body.parentEmail;
    const appOrigin = isSafeOrigin(body.appOrigin) ? body.appOrigin : null;
    if (typeof birthdate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
      return res.status(400).json({ error: 'Missing or invalid birthdate.' });
    }
    const age = calculateAgeServerSide(birthdate);
    if (age === null) {
      return res.status(400).json({ error: 'That birthdate doesn\u2019t look valid.' });
    }
    if (age >= MIN_AGE_FOR_UNRESTRICTED_SIGNUP) {
      // Nothing to do — the client shouldn't normally call this for an
      // adult, but if it does, just say so rather than creating a
      // meaningless consent row.
      return res.status(200).json({ ok: true, status: 'not_required', emailSent: false });
    }
    if (!isPlausibleEmail(parentEmail)) {
      return res.status(400).json({ error: 'Enter a valid parent/guardian email.' });
    }
    if (!appOrigin) {
      return res.status(400).json({ error: 'Missing request origin.' });
    }

    const token = randomBytes(24).toString('hex');

    const { data: existing } = await adminClient
      .from('parental_consents')
      .select('resend_count')
      .eq('user_id', userId)
      .maybeSingle();

    const { error: upsertError } = await adminClient
      .from('parental_consents')
      .upsert(
        {
          user_id: userId,
          parent_email: (parentEmail as string).trim(),
          birthdate,
          token,
          status: 'pending',
          decided_at: null,
          resend_count: (existing?.resend_count ?? -1) + 1,
        },
        { onConflict: 'user_id' }
      );
    if (upsertError) {
      console.error('[parental-consent] upsert failed', { userId, error: upsertError });
      return res.status(500).json({ error: 'Could not submit your request. Please try again.' });
    }

    const approveUrl = `${appOrigin}/?parentalConsent=${token}`;
    const emailSent = await sendParentEmail({ to: (parentEmail as string).trim(), approveUrl });

    return res.status(200).json({
      ok: true,
      status: 'pending',
      emailSent,
      // Only handed to the child's own browser when we couldn't actually
      // email it anywhere — see sendParentEmail's RESEND_API_KEY check and
      // the big comment at the top of this file.
      fallbackLink: emailSent ? undefined : approveUrl,
    });
  }

  if (action === 'status') {
    if (await isRateLimited(adminClient, `parental-consent:status:ip:${clientIp}`, RATE_LIMIT_WINDOW_SECONDS, STATUS_MAX_PER_IP)) {
      return res.status(429).json({ error: 'Too many requests — please try again later.' });
    }
    const auth = await requireUser();
    if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
    const { data, error } = await adminClient
      .from('parental_consents')
      .select('status, parent_email')
      .eq('user_id', auth.userId)
      .maybeSingle();
    if (error) {
      console.error('[parental-consent] status lookup failed', { userId: auth.userId, error });
      return res.status(500).json({ error: 'Could not check status. Please try again.' });
    }
    if (!data) return res.status(200).json({ ok: true, status: 'none' });
    return res.status(200).json({ ok: true, status: data.status, parentEmailMasked: maskEmail(data.parent_email) });
  }

  if (action === 'lookup') {
    if (await isRateLimited(adminClient, `parental-consent:lookup:ip:${clientIp}`, RATE_LIMIT_WINDOW_SECONDS, LOOKUP_MAX_PER_IP)) {
      return res.status(429).json({ error: 'Too many requests — please try again later.' });
    }
    const token = body.token;
    if (typeof token !== 'string' || token.length < 10) {
      return res.status(200).json({ ok: true, valid: false });
    }
    const { data, error } = await adminClient
      .from('parental_consents')
      .select('status, parent_email')
      .eq('token', token)
      .maybeSingle();
    if (error) {
      console.error('[parental-consent] token lookup failed', { error });
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    if (!data) return res.status(200).json({ ok: true, valid: false });
    return res.status(200).json({ ok: true, valid: true, status: data.status, parentEmailMasked: maskEmail(data.parent_email) });
  }

  if (action === 'decide') {
    // failClosed: this action changes an irreversible-in-spirit real-world
    // decision — same posture as delete-account.ts.
    if (await isRateLimited(adminClient, `parental-consent:decide:ip:${clientIp}`, RATE_LIMIT_WINDOW_SECONDS, DECIDE_MAX_PER_IP, { failClosed: true })) {
      return res.status(429).json({ error: 'Too many requests — please try again later.' });
    }
    const token = body.token;
    const decision = body.decision;
    if (typeof token !== 'string' || token.length < 10) {
      return res.status(400).json({ error: 'Invalid or expired link.' });
    }
    if (decision !== 'approve' && decision !== 'deny') {
      return res.status(400).json({ error: 'Invalid decision.' });
    }
    const { data: row, error: readError } = await adminClient
      .from('parental_consents')
      .select('status')
      .eq('token', token)
      .maybeSingle();
    if (readError) {
      console.error('[parental-consent] decide lookup failed', { error: readError });
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    if (!row) return res.status(404).json({ error: 'This link is invalid or has expired.' });
    // Already decided — return the existing status instead of silently
    // flipping it again (a parent double-clicking, or a link opened twice,
    // shouldn't be able to overwrite an earlier decision).
    if (row.status !== 'pending') {
      return res.status(200).json({ ok: true, status: row.status });
    }
    const newStatus = decision === 'approve' ? 'approved' : 'denied';
    const { error: updateError } = await adminClient
      .from('parental_consents')
      .update({ status: newStatus, decided_at: new Date().toISOString() })
      .eq('token', token)
      .eq('status', 'pending'); // extra guard against a race between two concurrent decide calls
    if (updateError) {
      console.error('[parental-consent] decide update failed', { error: updateError });
      return res.status(500).json({ error: 'Could not record your decision. Please try again.' });
    }
    return res.status(200).json({ ok: true, status: newStatus });
  }

  return res.status(400).json({ error: 'Unknown action.' });
}
