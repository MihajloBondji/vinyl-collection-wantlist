# Deploy to Firebase

## Local Development

### Start Backend (Cloud Functions)

```bash
# Install dependencies (first time)
cd functions
npm install
cd ..

# Start emulator
firebase emulators:start --only functions
```

This runs on `http://localhost:5001`

### Start Frontend (in another terminal)

```bash
# Option 1: Simple HTTP server
npx http-server public --port 8080

# Option 2: Python
cd public
python -m http.server 8000

# Option 3: Node http-server
npm install -g http-server
http-server public --port 8080
```

Visit: `http://localhost:8080`

### Update firebase-config.js for local testing

For local emulator, point to localhost:
```javascript
const firebaseConfig = {
  apiKey: "test",
  authDomain: "localhost",
  projectId: "test",
  storageBucket: "test.appspot.com",
  messagingSenderId: "test",
  appId: "test"
};
```

---

## Setup (First Time Only)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase project (if not done)
firebase init functions

# Create .env.local file with your Discogs credentials
# Create file: .env.local
DISCOGS_CONSUMER_KEY=YOUR_CONSUMER_KEY
DISCOGS_CONSUMER_SECRET=YOUR_CONSUMER_SECRET

# Or set via Firebase Console for production:
# Project Settings → Functions → Environment variables
```

## Deploy

```bash
# Deploy everything
firebase deploy

# Or deploy separately
firebase deploy --only functions
firebase deploy --only hosting
```

## Update Discogs Settings

1. Go to: https://www.discogs.com/settings/developers
2. Click your app
3. Set Callback URL to: `https://YOUR_PROJECT_ID.web.app/`
   - Format: `https://[project-id].web.app/`

## Update Firebase Config

Edit `public/firebase-config.js` and add your Firebase config:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Get values from Firebase Console → Project Settings → Your apps

## Test

1. Visit: `https://YOUR_PROJECT_ID.web.app/`
2. Click "Login with Discogs"
3. Authorize on Discogs
4. Your collection should load
5. Check console for "OAuth: Authenticated as USERNAME"

## That's It

App is now live with secure OAuth. Cloud Functions keep your API secret safe.

### Local Testing Note

For full local testing with real Discogs OAuth, you need:
1. Discogs callback URL pointing to your local machine (use ngrok: `ngrok http 8080`)
2. Update Discogs app settings with ngrok URL
3. Update `.env.local` with your actual Discogs credentials
4. Run both emulator and frontend as described above
