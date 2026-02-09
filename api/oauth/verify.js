const fetch = require('node-fetch');
const { generateNonce, buildAuthHeader } = require('../utils');

const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;
const IDENTITY_URL = 'https://api.discogs.com/oauth/identity';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { oauth_token, oauth_token_secret } = req.body;

        const nonce = generateNonce();
        const timestamp = Math.floor(Date.now() / 1000);

        const authParams = {
            oauth_consumer_key: CONSUMER_KEY,
            oauth_token: oauth_token,
            oauth_signature_method: 'PLAINTEXT',
            oauth_signature: `${CONSUMER_SECRET}&${oauth_token_secret}`,
            oauth_timestamp: timestamp,
            oauth_nonce: nonce,
            oauth_version: '1.0'
        };

        const authHeader = buildAuthHeader(authParams);

        const response = await fetch(IDENTITY_URL, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'User-Agent': 'VinylCollection/1.0'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Verify error:', data);
            return res.status(response.status).json({ error: 'Verification failed' });
        }

        return res.json({
            username: data.username,
            id: data.id
        });
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ error: error.message });
    }
}
