// OAuth Authentication Manager for Discogs API (Cloud Functions Version)
// Uses Firebase Cloud Functions to securely handle OAuth flow
// Consumer Secret is never exposed to the browser

class DiscogsOAuth {
    constructor() {
        this.AUTHORIZE_URL = 'https://www.discogs.com/oauth/authorize';
        
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
        
        // Firebase functions (will be set when available)
        this.functions = null;
        
        this.init();
    }
    
    init() {
        // Wait for Firebase to be initialized
        setTimeout(() => {
            if (typeof firebase !== 'undefined' && firebase.functions) {
                const functions = firebase.functions();

                // Ensure emulator is used for local/private IP hosts
                const host = location.hostname;
                const isLocalHost = host === 'localhost' || host === '127.0.0.1';
                const isPrivateIP = host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');

                if (isLocalHost || isPrivateIP) {
                    functions.useEmulator('localhost', 5001);
                    console.log('OAuth: Using local emulator');
                }

                this.functions = functions;
                console.log('OAuth: Firebase functions initialized');
            } else {
                console.warn('OAuth: Firebase functions not available');
            }
        }, 100);
        
        // Check if we have stored credentials
        this.loadStoredCredentials();
        
        // Check if we're returning from OAuth callback
        this.handleOAuthCallback();
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
                // Exchange for access token via Cloud Function
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
        if (!this.functions) {
            this.showError('Firebase is not ready. Please try again in a moment.');
            return;
        }
        
        try {
            console.log('OAuth: Starting authentication flow...');
            
            // Get callback URL
            const callbackUrl = window.location.origin + window.location.pathname;
            
            // Call Cloud Function to get request token
            const getRequestToken = this.functions.httpsCallable('getOAuthRequestToken');
            const result = await getRequestToken({ callbackUrl });
            
            const requestTokenData = result.data;
            
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
        if (!this.functions) {
            throw new Error('Firebase functions not available');
        }
        
        const exchangeToken = this.functions.httpsCallable('exchangeOAuthToken');
        const result = await exchangeToken({
            oauth_token: oauthToken,
            oauth_token_secret: oauthTokenSecret,
            oauth_verifier: oauthVerifier
        });
        
        const tokenData = result.data;
        
        // Store access token credentials
        this.accessToken = tokenData.oauth_token;
        this.accessTokenSecret = tokenData.oauth_token_secret;
        
        localStorage.setItem(this.STORAGE_KEYS.accessToken, this.accessToken);
        localStorage.setItem(this.STORAGE_KEYS.accessTokenSecret, this.accessTokenSecret);
        
        this.isAuthenticated = true;
        
        console.log('OAuth: Access token obtained successfully');
    }
    
    async verifyAuthentication() {
        if (!this.isAuthenticated || !this.functions) {
            return false;
        }
        
        try {
            const verifyToken = this.functions.httpsCallable('verifyOAuthToken');
            const result = await verifyToken({
                oauth_token: this.accessToken,
                oauth_token_secret: this.accessTokenSecret
            });
            
            const identityData = result.data;
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
        if (!this.isAuthenticated || !this.functions) {
            throw new Error('Not authenticated');
        }
        
        try {
            const makeRequest = this.functions.httpsCallable('makeAuthenticatedRequest');
            const result = await makeRequest({
                url: url,
                method: options.method || 'GET',
                body: options.body,
                oauth_token: this.accessToken,
                oauth_token_secret: this.accessTokenSecret
            });
            
            return result.data;
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
        
        // Reset state
        this.isAuthenticated = false;
        this.username = null;
        this.accessToken = null;
        this.accessTokenSecret = null;
        
        console.log('OAuth: Logged out');
        
        // Trigger custom event for app to update UI
        window.dispatchEvent(new CustomEvent('oauth-logout'));
        
        // Reload page to reset app state
        window.location.href = window.location.pathname;
    }
    
    showError(message) {
        // This will be handled by the main app's error display
        window.dispatchEvent(new CustomEvent('oauth-error', {
            detail: { message }
        }));
    }
    
    getAuthData() {
        return {
            isAuthenticated: this.isAuthenticated,
            username: this.username,
            token: this.accessToken,
            tokenSecret: this.accessTokenSecret
        };
    }
}

// Create global instance
window.discogsOAuth = new DiscogsOAuth();
