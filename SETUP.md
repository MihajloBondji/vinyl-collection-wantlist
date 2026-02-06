# Setup & Deployment Guide

## Local Testing (5 minutes)

### 1. Install dependencies
```bash
cd functions
npm install
```

### 2. Start backend (port 3000)
```bash
npm start
```

### 3. Start frontend (new terminal, port 8080)
```bash
npx http-server public --port 8080
```

### 4. Test
Visit `http://localhost:8080` → Click "Login with Discogs" → Should load your collection

**Credentials**: `.env.local` has your Discogs Consumer Key/Secret already set

---

## Deploy to Production

### 1. Install Fly.io CLI
```bash
iwr https://fly.io/install.ps1 -useb | iex
```
(Or use: `winget install flyctl`, then restart PowerShell)

### 2. Login & Deploy Backend
```bash
flyctl auth login
flyctl deploy -a vinyl-collection-backend
```
**Note**: Run from project root directory (not `functions/`)

### 3. Set Discogs Credentials on Fly.io
```bash
flyctl secrets set DISCOGS_CONSUMER_KEY=your_key -a vinyl-collection-backend
flyctl secrets set DISCOGS_CONSUMER_SECRET=your_secret -a vinyl-collection-backend
```

### 4. Update Discogs Settings
Go to: https://www.discogs.com/settings/developers
- Set Callback URL to: `https://vinyl-collection-backend.fly.dev/`

### 5. Update Frontend Backend URL
Edit `public/oauth.js` line 14:
```javascript
return 'https://vinyl-collection-backend.fly.dev';
```

### 6. Deploy Frontend
```bash
firebase deploy --only hosting
```

Visit: `https://vinyl-collection-wantlist.web.app/`

---

## Backend Endpoints

- `POST /oauth/request-token` - Start OAuth flow
- `POST /oauth/access-token` - Get access token  
- `POST /oauth/verify` - Get username
- `POST /api/request` - Make authenticated Discogs requests
- `GET /health` - Health check

---

## Troubleshooting

**Backend won't start**: `cd functions && npm install`

**"Not authenticated"**: Check `.env.local` has real Discogs credentials

**CORS errors**: Verify backend URL in `public/oauth.js` matches your setup

**Fly.io deploy fails**: `flyctl logs -a vinyl-collection-backend`

---

Done! That's all you need. 🎵
