// ---------------------------------------------------------------------------
// Client-side half of the under-18 parental-consent flow. Server half lives
// in api/parental-consent.ts (single serverless function, action-routed —
// same shape as api/delete-account.ts / api/change-passcode.ts).
//
// Why this exists at all: AuthGate's "setPasscode" stage is the one place
// every genuinely new account passes through exactly once (see the big
// comment above the Terms/Privacy consent gate in AuthGate.tsx). This adds
// an age check right before that gate. Anyone 18+ sails straight through.
// Anyone under 18 can't complete signup until a parent/guardian approves —
// approval happens OUT OF BAND, via a one-time link only the parent
// receives (email, when configured — see api/parental-consent.ts for the
// RESEND_API_KEY fallback behavior), never via anything the child's
// browser could self-approve with.
// ---------------------------------------------------------------------------

export type ParentalConsentStatus = 'none' | 'pending' | 'approved' | 'denied';

export interface ConsentRequestResult {
  ok: boolean;
  status: ParentalConsentStatus;
  emailSent: boolean;
  // Only ever populated when emailSent is false (i.e. the deploy has no
  // RESEND_API_KEY configured yet) — a same-origin link the child can hand
  // to their parent directly so the feature still works end-to-end before
  // real email delivery is wired up. See api/parental-consent.ts.
  fallbackLink?: string;
  error?: string;
}

export interface ConsentStatusResult {
  ok: boolean;
  status: ParentalConsentStatus;
  parentEmailMasked?: string;
  error?: string;
}

export interface ConsentLookupResult {
  ok: boolean;
  valid: boolean;
  status?: ParentalConsentStatus;
  parentEmailMasked?: string;
  error?: string;
}

export interface ConsentDecideResult {
  ok: boolean;
  status?: ParentalConsentStatus;
  error?: string;
}

async function callApi<T>(body: Record<string, unknown>, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch('/api/parental-consent', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // fall through — json stays null, handled below
  }
  if (!res.ok) {
    return { ok: false, error: json?.error || `Request failed (${res.status})` } as T;
  }
  return { ok: true, ...json } as T;
}

/** Called once the age screen determines the person is under 18 and they've
 * entered a parent/guardian email. `accessToken` is the signed-in child
 * account's own Supabase session token (they DO have one at this point —
 * this stage only ever fires after account creation, before the account is
 * otherwise usable). */
export function requestParentalConsent(params: {
  birthdate: string;
  parentEmail: string;
  accessToken: string;
}): Promise<ConsentRequestResult> {
  return callApi<ConsentRequestResult>(
    {
      action: 'request',
      birthdate: params.birthdate,
      parentEmail: params.parentEmail,
      // The server needs to know which origin to build the parent's
      // decision link against (${appOrigin}/?parentalConsent=<token>) — it
      // has no other reliable way to know that (Vercel preview
      // deployments, custom domains, local dev all differ), so the
      // client's own window.location.origin is the source of truth here.
      // The server independently validates this is a well-formed
      // http(s) origin before using it (see isSafeOrigin in
      // api/parental-consent.ts) — it's never trusted blindly.
      appOrigin: window.location.origin,
    },
    params.accessToken
  );
}

/** Polled while waiting on the parent's decision, and checked once up front
 * whenever the age-gate stage mounts (so re-opening the app, or logging
 * back in on the same or a different device, resumes wherever the last
 * request actually got to server-side, instead of asking again). */
export function getParentalConsentStatus(accessToken: string): Promise<ConsentStatusResult> {
  return callApi<ConsentStatusResult>({ action: 'status' }, accessToken);
}

/** Used by the parent-facing decision page (ParentalConsentDecisionPage) —
 * no child session involved at all; the token from the emailed link IS the
 * credential. */
export function lookupParentalConsentToken(token: string): Promise<ConsentLookupResult> {
  return callApi<ConsentLookupResult>({ action: 'lookup', token });
}

export function decideParentalConsent(
  token: string,
  decision: 'approve' | 'deny'
): Promise<ConsentDecideResult> {
  return callApi<ConsentDecideResult>({ action: 'decide', token, decision });
}

// Simple client-side sanity check before ever hitting the network — the
// server independently re-validates everything (never trust the client for
// something this consequential), but this catches obvious typos instantly
// without a round trip.
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Masks a parent's email for display back to the child (e.g. while a
// request is pending) — enough to confirm "yes, that's the address I
// typed", not enough to be very sensitive if it ever ended up in a
// screenshot/screen-share.
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(user.length - visible.length, 3))}@${domain}`;
}
