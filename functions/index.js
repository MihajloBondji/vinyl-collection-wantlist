const functions = require('firebase-functions');
const fetch = require('node-fetch');

// Load .env.local for local development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
}

// Firebase Admin setup
const admin = require('firebase-admin');
admin.initializeApp();

// Get configuration from environment
const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;

const OAUTH_REQUEST_TOKEN_URL = 'https://api.discogs.com/oauth/request_token';
const OAUTH_ACCESS_TOKEN_URL = 'https://api.discogs.com/oauth/access_token';
const IDENTITY_URL = 'https://api.discogs.com/oauth/identity';

// Helper: Generate nonce
function generateNonce() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

// Helper: Build OAuth header
function buildAuthHeader(params) {
    const paramString = Object.keys(params)
        .sort()
        .map(key => `${key}="${encodeURIComponent(params[key])}"`)
        .join(', ');
    
    return `OAuth ${paramString}`;
}

// Helper: Parse OAuth response
function parseOAuthResponse(responseText) {
    const params = {};
    responseText.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(value);
    });
    return params;
}

/**
 * Cloud Function: Get OAuth Request Token
 * Called by frontend to initiate OAuth flow
 */
exports.getOAuthRequestToken = functions.https.onCall(async (data, context) => {
    try {
        const callbackUrl = data.callbackUrl;
        
        if (!callbackUrl) {
            throw new Error('Callback URL is required');
        }
        
        if (!CONSUMER_KEY || !CONSUMER_SECRET) {
            throw new Error('OAuth credentials not configured on Firebase');
        }
        
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = generateNonce();
        
        const oauthParams = {
            oauth_consumer_key: CONSUMER_KEY,
            oauth_nonce: nonce,
            oauth_signature: CONSUMER_SECRET + '&',
            oauth_signature_method: 'PLAINTEXT',
            oauth_timestamp: timestamp,
            oauth_callback: callbackUrl
        };
        
        const authHeader = buildAuthHeader(oauthParams);
        
        const response = await fetch(OAUTH_REQUEST_TOKEN_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader,
                'User-Agent': 'VinylCollectionWantlist/2.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Discogs API error: ${response.statusText}`);
        }
        
        const responseText = await response.text();
        const tokenData = parseOAuthResponse(responseText);
        
        if (!tokenData.oauth_token || !tokenData.oauth_token_secret) {
            throw new Error('Invalid response from Discogs');
        }
        
        return {
            oauth_token: tokenData.oauth_token,
            oauth_token_secret: tokenData.oauth_token_secret,
            authorize_url: `https://www.discogs.com/oauth/authorize?oauth_token=${tokenData.oauth_token}`
        };
    } catch (error) {
        console.error('OAuth Request Token Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Cloud Function: Exchange OAuth Verifier for Access Token
 * Called by frontend after user authorizes on Discogs
 */
exports.exchangeOAuthToken = functions.https.onCall(async (data, context) => {
    try {
        const { oauth_token, oauth_token_secret, oauth_verifier } = data;
        
        if (!oauth_token || !oauth_token_secret || !oauth_verifier) {
            throw new Error('Missing OAuth parameters');
        }
        
        if (!CONSUMER_KEY || !CONSUMER_SECRET) {
            throw new Error('OAuth credentials not configured on Firebase');
        }
        
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = generateNonce();
        
        const oauthParams = {
            oauth_consumer_key: CONSUMER_KEY,
            oauth_nonce: nonce,
            oauth_token: oauth_token,
            oauth_signature: CONSUMER_SECRET + '&' + oauth_token_secret,
            oauth_signature_method: 'PLAINTEXT',
            oauth_timestamp: timestamp,
            oauth_verifier: oauth_verifier
        };
        
        const authHeader = buildAuthHeader(oauthParams);
        
        const response = await fetch(OAUTH_ACCESS_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader,
                'User-Agent': 'VinylCollectionWantlist/2.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Discogs API error: ${response.statusText}`);
        }
        
        const responseText = await response.text();
        const tokenData = parseOAuthResponse(responseText);
        
        if (!tokenData.oauth_token || !tokenData.oauth_token_secret) {
            throw new Error('Invalid response from Discogs');
        }
        
        return {
            oauth_token: tokenData.oauth_token,
            oauth_token_secret: tokenData.oauth_token_secret
        };
    } catch (error) {
        console.error('OAuth Token Exchange Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Cloud Function: Verify OAuth Token and Get User Identity
 * Called by frontend to verify authentication and get username
 */
exports.verifyOAuthToken = functions.https.onCall(async (data, context) => {
    try {
        const { oauth_token, oauth_token_secret } = data;
        
        if (!oauth_token || !oauth_token_secret) {
            throw new Error('Missing OAuth credentials');
        }
        
        if (!CONSUMER_KEY || !CONSUMER_SECRET) {
            throw new Error('OAuth credentials not configured on Firebase');
        }
        
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = generateNonce();
        
        const oauthParams = {
            oauth_consumer_key: CONSUMER_KEY,
            oauth_nonce: nonce,
            oauth_token: oauth_token,
            oauth_signature: CONSUMER_SECRET + '&' + oauth_token_secret,
            oauth_signature_method: 'PLAINTEXT',
            oauth_timestamp: timestamp
        };
        
        const authHeader = buildAuthHeader(oauthParams);
        
        const response = await fetch(IDENTITY_URL, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'User-Agent': 'VinylCollectionWantlist/2.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Discogs API error: ${response.statusText}`);
        }
        
        const identityData = await response.json();
        
        return {
            username: identityData.username,
            id: identityData.id
        };
    } catch (error) {
        console.error('OAuth Verification Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Cloud Function: Make Authenticated Discogs API Request
 * Called by frontend for API requests requiring OAuth
 */
exports.makeAuthenticatedRequest = functions.https.onCall(async (data, context) => {
    try {
        const { url, method = 'GET', body, oauth_token, oauth_token_secret } = data;
        
        if (!url) {
            throw new Error('URL is required');
        }
        
        if (!oauth_token || !oauth_token_secret) {
            throw new Error('Missing OAuth credentials');
        }
        
        if (!CONSUMER_KEY || !CONSUMER_SECRET) {
            throw new Error('OAuth credentials not configured on Firebase');
        }
        
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = generateNonce();
        
        const oauthParams = {
            oauth_consumer_key: CONSUMER_KEY,
            oauth_nonce: nonce,
            oauth_token: oauth_token,
            oauth_signature: CONSUMER_SECRET + '&' + oauth_token_secret,
            oauth_signature_method: 'PLAINTEXT',
            oauth_timestamp: timestamp
        };
        
        const authHeader = buildAuthHeader(oauthParams);
        
        const options = {
            method: method,
            headers: {
                'Authorization': authHeader,
                'User-Agent': 'VinylCollectionWantlist/2.0',
                'Content-Type': 'application/json'
            }
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication expired');
            }
            throw new Error(`Discogs API error: ${response.statusText}`);
        }
        
        // Handle empty responses (204 No Content)
        if (response.status === 204) {
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error('Authenticated Request Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
