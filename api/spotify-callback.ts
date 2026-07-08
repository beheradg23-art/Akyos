import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mirrors strava-callback.ts exactly, adapted for Spotify's OAuth flow.
//
// Spotify's token endpoint wants client credentials in a Basic auth header
// (not the JSON body Strava accepts) and an application/x-www-form-urlencoded
// body, so that's the one real structural difference here.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided from Spotify' });
  }

  try {
    const isLive = (req.headers.host || '').includes('vercel.app');
    const targetOrigin = isLive
      ? 'https://ashutoshbehera.vercel.app'
      : `https://${req.headers.host}`;
    const redirectUri = `${targetOrigin}/api/spotify-callback`;

    const basicAuth = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    // 1. Exchange the temporary authorization code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      return res.status(400).json({ error: 'Spotify token exchange failed', details: tokenData });
    }

    const authHeader = { Authorization: `Bearer ${tokenData.access_token}` };

    // 2. Fetch the account profile and recent listening history in parallel
    const [profileResponse, recentResponse] = await Promise.all([
      fetch('https://api.spotify.com/v1/me', { headers: authHeader }),
      fetch('https://api.spotify.com/v1/me/player/recently-played?limit=15', { headers: authHeader }),
    ]);

    const profile = await profileResponse.json();
    const recentData = await recentResponse.json();
    const recentlyPlayed = recentData.items || [];

    // Spotify tokens expire in `expires_in` seconds from now — normalize
    // this to an absolute unix timestamp so it matches the Strava shape
    // the frontend already knows how to store and refresh.
    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
    };

    // 3. Send data back to the opener window and close the popup safely
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'SPOTIFY_DATA',
              profile: ${JSON.stringify(profile)},
              recentlyPlayed: ${JSON.stringify(recentlyPlayed)},
              tokens: ${JSON.stringify(tokens)}
            }, '*');
            window.close();
          </script>
          <p>Spotify linked! You can close this window now.</p>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}