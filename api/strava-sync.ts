import type { VercelRequest, VercelResponse } from '@vercel/node';

// This endpoint lets the frontend say "give me my latest activities"
// at any time, using only the long-lived refresh_token — no popup,
// no re-authorization, no user interaction required.
//
// Strava access tokens expire every 6 hours, but the refresh_token
// can be exchanged for a brand new access_token indefinitely (until
// the user revokes access on Strava's side). So on every sync we
// just always refresh first, then fetch activities with the fresh
// token, and hand back both the activities and the (possibly
// rotated) tokens for the client to store.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refresh_token } = req.body ?? {};

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  try {
    // 1. Exchange the refresh token for a fresh access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.errors) {
      // Refresh token is invalid/expired/revoked — the frontend should
      // treat this as "disconnected" rather than retrying forever.
      return res.status(401).json({
        error: 'Strava refresh failed — account needs to be reconnected',
        details: tokenData,
      });
    }

    // 2. Pull the latest activities with the fresh access token
    const activitiesResponse = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=15',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    if (!activitiesResponse.ok) {
      return res.status(activitiesResponse.status).json({
        error: 'Failed to fetch activities from Strava',
      });
    }

    const activities = await activitiesResponse.json();

    return res.status(200).json({
      activities,
      tokens: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}