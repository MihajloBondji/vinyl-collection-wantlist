# Vercel Deployment - Quick Start

Your app is ready for Vercel! Here's what was changed:

## Changes Made:
1. ✅ Created `/api/` folder with serverless functions for Vercel
2. ✅ Converted Express backend to Vercel API functions
3. ✅ Updated `oauth.js` to work with Vercel's relative API paths
4. ✅ Created `vercel.json` configuration
5. ✅ Created root `package.json` for Vercel

## To Deploy to Vercel:

### Option A: Via GitHub (Easiest - Recommended)
```bash
# 1. Commit and push your changes
git add .
git commit -m "Setup Vercel deployment"
git push

# 2. Go to https://vercel.com/new
# 3. Import your GitHub repository
# 4. Add environment variables:
#    - DISCOGS_CONSUMER_KEY (from https://www.discogs.com/settings/developers)
#    - DISCOGS_CONSUMER_SECRET
# 5. Click Deploy
```

### Option B: Via Vercel CLI
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel

# 3. Follow the prompts
# 4. Add environment variables when prompted
```

## After Deployment:

1. Note your Vercel URL (e.g., https://vinyl-collection-wantlist.vercel.app)

2. Update Discogs OAuth settings:
   - Go to https://www.discogs.com/settings/developers
   - Edit your app
   - Set Callback URL to: `https://your-vercel-url/`

3. Test the app:
   - Visit your Vercel URL
   - Click "Connect with Discogs"
   - Should work!

## Local Testing (Before Deployment):

```bash
# Install dependencies
npm install

# Start local server
npm run dev

# Visit http://localhost:3000
```

For local OAuth testing:
- Use Discogs Callback URL: `http://localhost:3000/`
- Backend auto-detects localhost and uses `http://localhost:3000`

## File Structure:
```
/api/
  ├── utils.js                 # Shared OAuth utilities
  ├── request.js               # General Discogs API proxy
  └── oauth/
      ├── request-token.js     # Start OAuth flow
      ├── access-token.js      # Exchange verifier for token
      └── verify.js            # Verify OAuth identity
/public/
  ├── app.js                   # Main app (unchanged)
  ├── oauth.js                 # Updated for Vercel paths
  ├── styles.css
  └── index.html
package.json                    # Root package.json for Vercel
vercel.json                     # Vercel configuration
```

## Questions?

- Vercel Docs: https://vercel.com/docs
- Discogs API: https://www.discogs.com/developers/
- Environment Variables: https://vercel.com/docs/projects/environment-variables
