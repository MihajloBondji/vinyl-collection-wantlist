const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;

const OAUTH_REQUEST_TOKEN_URL = 'https://api.discogs.com/oauth/request_token';
const OAUTH_ACCESS_TOKEN_URL = 'https://api.discogs.com/oauth/access_token';
const IDENTITY_URL = 'https://api.discogs.com/oauth/identity';

function generateNonce() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

function buildAuthHeader(params) {
    const paramString = Object.keys(params)
        .sort()
        .map(key => `${key}="${encodeURIComponent(params[key])}"`)
        .join(', ');
    return `OAuth ${paramString}`;
}

function parseOAuthResponse(body) {
    const params = new URLSearchParams(body);
    return {
        oauth_token: params.get('oauth_token'),
        oauth_token_secret: params.get('oauth_token_secret'),
        oauth_callback_confirmed: params.get('oauth_callback_confirmed')
    };
}

// GET /oauth/request-token
app.post('/oauth/request-token', async (req, res) => {
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
});

// POST /oauth/access-token
app.post('/oauth/access-token', async (req, res) => {
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
});

// POST /oauth/verify
app.post('/oauth/verify', async (req, res) => {
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
});

// POST /api/request
app.post('/api/request', async (req, res) => {
    try {
        const { url, method, oauth_token, oauth_token_secret, body } = req.body;

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
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`OAuth server running on port ${PORT}`);
});
