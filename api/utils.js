const crypto = require('crypto');

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

module.exports = { generateNonce, buildAuthHeader, parseOAuthResponse };
