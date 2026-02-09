const fetch = require('node-fetch');
const { generateNonce, buildAuthHeader } = require('./utils');

const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { url, method, oauth_token, oauth_token_secret, body } = req.body;

        if (!url || !oauth_token || !oauth_token_secret) {
            return res.status(400).json({ error: 'Missing required fields: url, oauth_token, oauth_token_secret' });
        }

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

        const fetchOptions = {
            method: method || 'GET',
            headers: {
                'Authorization': authHeader,
                'User-Agent': 'VinylCollection/1.0'
            }
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            fetchOptions.body = JSON.stringify(body);
            fetchOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, fetchOptions);
        
        // For DELETE requests, Discogs returns 204 No Content on success
        if (response.status === 204) {
            return res.json({ success: true });
        }
        
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Request failed', data });
        }

        return res.json(data);
    } catch (error) {
        console.error('API request error:', error);
        res.status(500).json({ error: error.message });
    }
}
