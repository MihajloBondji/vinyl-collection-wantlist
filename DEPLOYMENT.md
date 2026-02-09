# Vercel Deployment Guide

Your Vinyl Collection app is now configured for Vercel deployment. Follow these steps to deploy:

## Prerequisites
- Vercel account (free): https://vercel.com
- Git repository with your code pushed to GitHub/GitLab/Bitbucket

## Step 1: Install Vercel CLI (Optional but Recommended)
```bash
npm install -g vercel
```

## Step 2: Set Environment Variables in Vercel
You need to add your Discogs OAuth credentials to Vercel:

1. Go to your Vercel project dashboard
2. Go to **Settings** → **Environment Variables**
3. Add these variables:
   - `DISCOGS_CONSUMER_KEY`: Your Discogs app's consumer key
   - `DISCOGS_CONSUMER_SECRET`: Your Discogs app's consumer secret

Get these from: https://www.discogs.com/settings/developers

## Step 3: Deploy via GitHub (Easiest)

1. Push your code to GitHub:
```bash
git add .
git commit -m "Setup Vercel deployment"
git push
```

2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Select the repository
5. Vercel will auto-detect the setup
6. Add environment variables (from Step 2)
7. Click **Deploy**

## Step 4: Configure OAuth Callback URL

After deployment, you'll have a production URL like `https://your-project.vercel.app`

1. Go to https://www.discogs.com/settings/developers
2. Edit your Discogs app
3. Set the **Callback URL** to: `https://your-project.vercel.app/`

## Step 5: Test the App

1. Visit your deployed URL
2. Click "Connect with Discogs"
3. You should be redirected to Discogs to authorize
4. After authorization, you should be logged in

## Project Structure
- `/public/` - Frontend files (HTML, CSS, JS)
- `/api/` - Serverless functions for OAuth and API proxy
  - `/api/oauth/request-token.js` - Start OAuth flow
  - `/api/oauth/access-token.js` - Exchange verifier for access token
  - `/api/oauth/verify.js` - Verify OAuth identity
  - `/api/request.js` - General Discogs API proxy
- `vercel.json` - Vercel configuration
- `package.json` - Project dependencies

## Local Development

To test locally before deployment:

```bash
npm install
npm run dev
```

This will start a local server at `http://localhost:3000`

For OAuth testing locally, use:
- Callback URL: `http://localhost:3000/`
- Backend URL: `http://localhost:3000` (auto-detected)

## Troubleshooting

### OAuth redirect not working
- Check that callback URL in Discogs settings matches your Vercel domain
- Verify environment variables are set in Vercel dashboard

### API errors after deployment
- Check Vercel logs: `vercel logs`
- Make sure `DISCOGS_CONSUMER_KEY` and `DISCOGS_CONSUMER_SECRET` are set

### Function errors
- Vercel logs: https://vercel.com/docs/concepts/observability/logging
- Local testing: `npm run dev` and check terminal output

## Scaling & Limits

Vercel free tier includes:
- Unlimited serverless functions
- 100GB bandwidth/month
- 1GB storage
- Sufficient for personal use

For production, consider upgrading to Vercel Pro for better analytics and support.

## Next Steps

1. Verify all tests pass
2. Monitor your Discogs collection from https://your-project.vercel.app
3. Celebrate! 🎉
