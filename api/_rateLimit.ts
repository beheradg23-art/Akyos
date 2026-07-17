import type { SupabaseClient } from '@supabase/supabase-js';

// Server-authoritative, cross-instance rate limiting backed by a Postgres
// table + RPC (see supabase/migrations/0001_server_side_rate_limiting.sql).
// Replaces the old in-memory `Map`-based limiter that used to live directly
// in api/delete-account.ts: that reset on every cold start and wasn't
// shared across serverless instances/regions, so a distributed caller could
// exceed the intended limit by hitting different cold-started instances.
// Postgres is the one thing every instance already talks to, so it's the
// natural shared store here — no new infra (Redis/Vercel KV) required.
//
// `client` must be a SERVICE-ROLE Supabase client — `rate_limit_hit` is
// locked down to the `service_role` Postgres role only (see the migration).

/**
 * Records one "hit" against `key` within a `windowSeconds`-wide fixed
 * window and returns whether that hit pushed the bucket over `max`.
 *
 * By default fails OPEN (returns false / "not limited") on any infra
 * error, so a transient DB hiccup — or the migration not having been
 * applied yet — degrades to "no rate limiting" rather than locking every
 * caller out. The failure is logged either way so a persistent problem is
 * visible.
 *
 * SECURITY FIX: for genuinely sensitive endpoints (account deletion,
 * passcode change) an attacker who can force/observe an infra error — or
 * who simply attacks during a real outage — would otherwise get
 * *unlimited* attempts for the duration of that error, not just "no rate
 * limiting for this one request". Pass `failClosed: true` for those
 * endpoints so an RPC error blocks the request (503) instead of letting it
 * through. Left `false` (the old default) for low-stakes/advisory callers
 * (e.g. the lockout-status endpoint) where availability matters more than
 * strict enforcement.
 */
export async function isRateLimited(
  client: SupabaseClient,
  key: string,
  windowSeconds: number,
  max: number,
  options?: { failClosed?: boolean }
): Promise<boolean> {
  const { data, error } = await client.rpc('rate_limit_hit', {
    p_key: key,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[rateLimit] rate_limit_hit RPC failed — did you run supabase/migrations/0001_server_side_rate_limiting.sql?', {
      key,
      error,
    });
    return options?.failClosed === true;
  }
  return (data as number) > max;
}

// SECURITY FIX: `x-forwarded-for` is set by whatever HTTP client makes the
// request unless the edge/proxy in front of this function overwrites it —
// on some hosts a caller can simply send their own `x-forwarded-for` header
// and get a fresh rate-limit bucket per request. On Vercel specifically,
// `x-vercel-forwarded-for` is the one header Vercel's own edge network sets
// itself from the real TCP connection, appended AFTER any incoming header
// of the same name — so it can't be spoofed by the caller the way a bare
// `x-forwarded-for` can (see https://vercel.com/docs/edge-network/headers).
//
// Previously this fell back to the caller-controlled `x-forwarded-for`
// whenever `x-vercel-forwarded-for` was absent. That fallback is only safe
// when we can be sure Vercel's edge is actually in front of this function
// (local dev, or `vercel dev`, where Vercel's own header genuinely won't be
// set). If this ever runs behind a *different* host/proxy that doesn't set
// `x-vercel-forwarded-for` — a misconfiguration, a migration to another
// platform, someone forgetting to update this file — the old code would
// silently start trusting an attacker-controlled header again, and every
// "per-IP" limit in this file would become trivially bypassable by
// rotating a fake header per request.
//
// Fix: only trust `x-forwarded-for` when other Vercel-only infrastructure
// signals confirm we're actually behind Vercel's edge (it always sets
// `x-vercel-id` on every request it proxies, even when the forwarded-for
// header itself is missing for some reason; `VERCEL_ENV` is a real
// Vercel-set env var, a reliable "yes, we're on Vercel" signal too).
// Otherwise, fall back to the raw socket address — which can't be spoofed
// via headers — rather than an attacker-controlled one.
export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  const vercelFirst = Array.isArray(vercelIp) ? vercelIp[0] : vercelIp;
  if (vercelFirst) return vercelFirst.split(',')[0].trim();

  const onVercel = Boolean(req.headers['x-vercel-id']) || Boolean(process.env.VERCEL_ENV);
  if (onVercel) {
    // Confirmed to be behind Vercel's edge but it didn't set
    // x-vercel-forwarded-for for some reason — trust x-forwarded-for since
    // Vercel's edge still owns/overwrites that header in this environment.
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = first ? first.split(',')[0].trim() : req.socket?.remoteAddress;
    return ip || 'unknown';
  }

  // Not confirmed to be behind Vercel's edge (local dev, unknown host, or a
  // future platform migration): don't trust any forwarded-for header, since
  // we can't tell whether it was set by a trusted proxy or by the caller
  // themselves. Fall back to the raw socket address only.
  return req.socket?.remoteAddress || 'unknown';
}