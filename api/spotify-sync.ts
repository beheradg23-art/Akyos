import type { VercelRequest, VercelResponse } from '@vercel/node';

// This endpoint lets the frontend say "refresh my session and give me my
// latest listening data" at any time, using only the long-lived
// refresh_token — no popup, no re-authorization, no user interaction.
//
// Spotify access tokens expire in 1 hour, but the refresh_token can be
// exchanged for a brand new access_token indefinitely (until the user
// revokes access from their Spotify account settings). So on every sync we
// refresh first, then pull the profile + recently-played with the fresh
// token, and hand back everything (plus the possibly-rotated tokens) for
// the client to store.
//
// Note: Spotify does not always issue a new refresh_token on refresh — if
// it omits one, we keep reusing the original.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refresh_token } = req.body ?? {};

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  try {
    const basicAuth = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    // 1. Exchange the refresh token for a fresh access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      // Refresh token is invalid/expired/revoked — the frontend should
      // treat this as "disconnected" rather than retrying forever.
      return res.status(401).json({
        error: 'Spotify refresh failed — account needs to be reconnected',
        details: tokenData,
      });
    }

    const authHeader = { Authorization: `Bearer ${tokenData.access_token}` };

    // 2. Pull the current profile and recent listening history with the
    // fresh access token, in parallel.
    const [profileResponse, recentResponse] = await Promise.all([
      fetch('https://api.spotify.com/v1/me', { headers: authHeader }),
      fetch('https://api.spotify.com/v1/me/player/recently-played?limit=15', { headers: authHeader }),
    ]);

    if (!profileResponse.ok) {
      return res.status(profileResponse.status).json({
        error: 'Failed to fetch profile from Spotify',
      });
    }

    const profile = await profileResponse.json();
    const recentData = recentResponse.ok ? await recentResponse.json() : { items: [] };
    const recentlyPlayed = recentData.items || [];

    return res.status(200).json({
      profile,
      recentlyPlayed,
      tokens: {
        access_token: tokenData.access_token,
        // Spotify may omit refresh_token on a refresh call — fall back to
        // the one the client already has so it never silently disconnects.
        refresh_token: tokenData.refresh_token || refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}