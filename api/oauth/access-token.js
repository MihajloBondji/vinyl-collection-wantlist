const fetch = require('node-fetch');
const { generateNonce, buildAuthHeader, parseOAuthResponse } = require('../utils');

const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;
const OAUTH_ACCESS_TOKEN_URL = 'https://api.discogs.com/oauth/access_token';

module.exports = async function handler(req, res) {
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
        const { oauth_token, oauth_token_secret, oauth_verifier } = req.body;

        const nonce = generateNonce();
        const timestamp = Math.floor(Date.now() / 1000);

        const authParams = {
            oauth_consumer_key: CONSUMER_KEY,
            oauth_token: oauth_token,
            oauth_signature_method: 'PLAINTEXT',
            oauth_signature: `${CONSUMER_SECRET}&${oauth_token_secret}`,
            oauth_timestamp: timestamp,
            oauth_nonce: nonce,
            oauth_verifier: oauth_verifier,
            oauth_version: '1.0'
        };

        const authHeader = buildAuthHeader(authParams);

        const response = await fetch(OAUTH_ACCESS_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'User-Agent': 'VinylCollection/1.0'
            }
        });

        const body = await response.text();

        if (!response.ok) {
            console.error('Access token error:', body);
            return res.status(response.status).json({ error: 'Token exchange failed' });
        }

        const tokenData = parseOAuthResponse(body);

        return res.json({
            oauth_token: tokenData.oauth_token,
            oauth_token_secret: tokenData.oauth_token_secret
        });
    } catch (error) {
        console.error('Access token error:', error);
        res.status(500).json({ error: error.message });
    }
}
