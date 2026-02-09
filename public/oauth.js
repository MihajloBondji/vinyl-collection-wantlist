// OAuth Authentication Manager for Discogs API (Express Backend Version)
// Uses Express backend to securely handle OAuth flow
// Consumer Secret is never exposed to the browser

class DiscogsOAuth {
    constructor() {
        this.AUTHORIZE_URL = 'https://www.discogs.com/oauth/authorize';
        this.BACKEND_URL = this.getBackendUrl();
        
        // Storage keys
        this.STORAGE_KEYS = {
            accessToken: 'discogs_oauth_access_token',
            accessTokenSecret: 'discogs_oauth_access_token_secret',
            username: 'discogs_oauth_username',
            requestToken: 'discogs_oauth_request_token',
            requestTokenSecret: 'discogs_oauth_request_token_secret'
        };
        
        this.isAuthenticated = false;
        this.username = null;
        this.accessToken = null;
        this.accessTokenSecret = null;
        
        this.init();
    }
    
    getBackendUrl() {
        // For production, Vercel uses relative paths for API
        // For local dev, use localhost:3000
        if (typeof window !== 'undefined' && window.BACKEND_URL) {
            return window.BACKEND_URL;
        }
        const host = location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        // Production: Vercel uses relative paths
        return '';
    }
    
    init() {
        // Check if we have stored credentials
        this.loadStoredCredentials();
        
        // Check if we're returning from OAuth callback
        this.handleOAuthCallback();
        
        console.log('OAuth: Initialized, backend:', this.BACKEND_URL);
    }
    
    loadStoredCredentials() {
        const token = localStorage.getItem(this.STORAGE_KEYS.accessToken);
        const secret = localStorage.getItem(this.STORAGE_KEYS.accessTokenSecret);
        const username = localStorage.getItem(this.STORAGE_KEYS.username);
        
        if (token && secret && username) {
            this.accessToken = token;
            this.accessTokenSecret = secret;
            this.username = username;
            this.isAuthenticated = true;
            console.log('OAuth: Loaded stored credentials for', username);
        }
    }
    
    async handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const oauthToken = urlParams.get('oauth_token');
        const oauthVerifier = urlParams.get('oauth_verifier');
        
        if (oauthToken && oauthVerifier) {
            console.log('OAuth: Handling callback...');
            
            // Get stored request token secret
            const requestTokenSecret = localStorage.getItem(this.STORAGE_KEYS.requestTokenSecret);
            
            if (!requestTokenSecret) {
                console.error('OAuth: Request token secret not found');
                this.showError('OAuth error: Session expired. Please try again.');
                this.cleanupOAuthParams();
                return;
            }
            
            try {
                // Exchange for access token via backend
                await this.getAccessToken(oauthToken, requestTokenSecret, oauthVerifier);
                
                // Clean up URL parameters
                this.cleanupOAuthParams();
                
                // Verify authentication
                await this.verifyAuthentication();
                
            } catch (error) {
                console.error('OAuth: Callback error:', error);
                this.showError('Authentication failed: ' + error.message);
                this.cleanupOAuthParams();
            }
        }
    }
    
    cleanupOAuthParams() {
        // Remove OAuth parameters from URL without reloading
        const url = new URL(window.location);
        url.searchParams.delete('oauth_token');
        url.searchParams.delete('oauth_verifier');
        window.history.replaceState({}, document.title, url.toString());
        
        // Clean up temporary storage
        localStorage.removeItem(this.STORAGE_KEYS.requestToken);
        localStorage.removeItem(this.STORAGE_KEYS.requestTokenSecret);
    }
    
    async startOAuthFlow() {
        try {
            console.log('OAuth: Starting authentication flow...');
            
            // Get callback URL
            const callbackUrl = window.location.origin + window.location.pathname;
            
            // Call backend to get request token
            const response = await fetch(`${this.BACKEND_URL}/api/oauth/request-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callbackUrl })
            });
            
            if (!response.ok) {
                throw new Error('Failed to get request token');
            }
            
            const requestTokenData = await response.json();
            
            // Store request token and secret
            localStorage.setItem(this.STORAGE_KEYS.requestToken, requestTokenData.oauth_token);
            localStorage.setItem(this.STORAGE_KEYS.requestTokenSecret, requestTokenData.oauth_token_secret);
            
            // Redirect to Discogs authorization page
            window.location.href = requestTokenData.authorize_url;
            
        } catch (error) {
            console.error('OAuth: Start flow error:', error);
            this.showError('Failed to start authentication: ' + error.message);
        }
    }
    
    async getAccessToken(oauthToken, oauthTokenSecret, oauthVerifier) {
        const response = await fetch(`${this.BACKEND_URL}/api/oauth/access-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                oauth_token: oauthToken,
                oauth_token_secret: oauthTokenSecret,
                oauth_verifier: oauthVerifier
            })
        });
        
        if (!response.ok) {
            throw new Error('Token exchange failed');
        }
        
        const tokenData = await response.json();
        
        // Store access token credentials
        this.accessToken = tokenData.oauth_token;
        this.accessTokenSecret = tokenData.oauth_token_secret;
        
        localStorage.setItem(this.STORAGE_KEYS.accessToken, this.accessToken);
        localStorage.setItem(this.STORAGE_KEYS.accessTokenSecret, this.accessTokenSecret);
        
        this.isAuthenticated = true;
        
        console.log('OAuth: Access token obtained successfully');
    }
    
    async verifyAuthentication() {
        if (!this.isAuthenticated) {
            return false;
        }
        
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/oauth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oauth_token: this.accessToken,
                    oauth_token_secret: this.accessTokenSecret
                })
            });
            
            if (!response.ok) {
                throw new Error('Verification failed');
            }
            
            const identityData = await response.json();
            this.username = identityData.username;
            localStorage.setItem(this.STORAGE_KEYS.username, this.username);
            
            console.log('OAuth: Authenticated as', this.username);
            
            // Trigger custom event for app to update UI
            window.dispatchEvent(new CustomEvent('oauth-authenticated', {
                detail: { username: this.username }
            }));
            
            return true;
        } catch (error) {
            console.error('OAuth: Verification failed:', error);
            this.logout();
            return false;
        }
    }
    
    async makeAuthenticatedRequest(url, options = {}) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }
        
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url,
                    method: options.method || 'GET',
                    body: options.body,
                    oauth_token: this.accessToken,
                    oauth_token_secret: this.accessTokenSecret
                })
            });
            
            if (!response.ok) {
                throw new Error('Request failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('OAuth: Request error:', error);
            throw error;
        }
    }
    
    logout() {
        // Clear stored credentials
        localStorage.removeItem(this.STORAGE_KEYS.accessToken);
        localStorage.removeItem(this.STORAGE_KEYS.accessTokenSecret);
        localStorage.removeItem(this.STORAGE_KEYS.username);
        
        this.isAuthenticated = false;
        this.username = null;
        this.accessToken = null;
        this.accessTokenSecret = null;
        
        console.log('OAuth: Logged out');
        
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('oauth-logout'));
    }
    
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }
}

// Create global instance
window.discogsOAuth = new DiscogsOAuth();
