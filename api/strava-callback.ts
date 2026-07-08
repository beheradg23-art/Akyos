import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided from Strava' });
  }

  try {
    // Exchange temporary code for access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.errors) {
      return res.status(400).json({ error: 'Strava token exchange failed', details: tokenData.errors });
    }

    // Fetch recent fitness activities
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=10`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const activities = await activitiesResponse.json();

    // Send data back to frontend window and close popup safely
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'STRAVA_DATA', data: ${JSON.stringify(activities)} }, '*');
            window.close();
          </script>
          <p>Sync complete! You can close this window now.</p>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: error });
  }
}