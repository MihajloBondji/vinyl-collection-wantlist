const fetch = require('node-fetch');
const { generateNonce, buildAuthHeader, parseOAuthResponse } = require('./utils');

const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;
const OAUTH_REQUEST_TOKEN_URL = 'https://api.discogs.com/oauth/request_token';

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
        const { callbackUrl } = req.body;
        if (!callbackUrl) {
            return res.status(400).json({ error: 'callbackUrl required' });
        }

        const nonce = generateNonce();
        const timestamp = Math.floor(Date.now() / 1000);
        
        const authParams = {
            oauth_consumer_key: CONSUMER_KEY,
            oauth_nonce: nonce,
            oauth_signature_method: 'PLAINTEXT',
            oauth_signature: `${CONSUMER_SECRET}&`,
            oauth_timestamp: timestamp,
            oauth_callback: callbackUrl,
            oauth_version: '1.0'
        };

        const authHeader = buildAuthHeader(authParams);

        const response = await fetch(OAUTH_REQUEST_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'User-Agent': 'VinylCollection/1.0'
            }
        });

        const body = await response.text();

        if (!response.ok) {
            console.error('Discogs error:', body);
            return res.status(response.status).json({ error: 'Failed to get request token' });
        }

        const tokenData = parseOAuthResponse(body);
        
        const authorizeUrl = `https://www.discogs.com/oauth/authorize?oauth_token=${tokenData.oauth_token}`;

        return res.json({
            oauth_token: tokenData.oauth_token,
            oauth_token_secret: tokenData.oauth_token_secret,
            authorize_url: authorizeUrl
        });
    } catch (error) {
        console.error('Request token error:', error);
        res.status(500).json({ error: error.message });
    }
}
