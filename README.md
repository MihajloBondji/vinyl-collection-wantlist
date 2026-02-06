# Vinyl Collection & Wantlist Viewer

A beautiful, responsive web application for viewing and managing your Discogs vinyl collection and wantlist. Features multi-language support, smart categorization, caching, and an elegant dark-themed interface.

## ✨ Features

- **� OAuth Authentication**: Secure login with your Discogs account
- **�📀 Dual View Modes**: Switch between Collection and Wantlist views
- **🌍 Multi-Language Support**: Available in 8 languages (English, Српски, Srpski, 日本語, Deutsch, Français, Español, Русский)
- **🏷️ Smart Categorization**: Organize your collection into Foreign, Domestic, and Uncategorized sections
- **🔍 Real-time Search**: Filter items by artist, title, or format with debounced search
- **↕️ Flexible Sorting**: Sort by artist, title, or date added (newest/oldest first)
- **💾 Intelligent Caching**: Per-user localStorage caching for faster load times
- **🎨 Dark Theme**: Modern, eye-friendly interface with custom scrollbars
- **📱 Fully Responsive**: Works beautifully on desktop, tablet, and mobile devices
- **🔗 Vinyl Shop Links**: Quick access to curated vinyl shops (customizable)
- **❓ Built-in Help**: Comprehensive help system in all supported languages

## 🚀 Quick Start

### Option 1: OAuth with Cloud Functions (Most Secure - Recommended)

1. **Setup Firebase Cloud Functions** (keeps your Consumer Secret safe):
   - Follow the [Cloud Functions Setup Guide](CLOUD_FUNCTIONS_SETUP.md)
   - Takes ~5-10 minutes
   - Your Consumer Secret never touches the browser

2. **Configure Firebase in your app**:
   - Update `public/firebase-config.js` with your Firebase project settings

3. **Deploy**:
   ```bash
   firebase deploy
   ```

**Why this is better:**
- ✅ Completely secure - Consumer Secret stays on Firebase
- ✅ Safe to push to public GitHub
- ✅ Professional OAuth implementation
- ✅ Free Firebase tier easily covers your needs

### Option 2: OAuth Login (Simpler, Less Secure)

For local testing or private projects - follow [OAuth Setup Guide](OAUTH_SETUP.md)

### Option 3: URL Parameters (Legacy Method)

Navigate to: `?username=YOUR_DISCOGS_USERNAME&token=YOUR_TOKEN`

## 🎯 Usage Guide

### URL Query Parameters

| Parameter     | Required  | Description                                                       |
|---------------|-----------|-------------------------------------------------------------------|
| `username`    | Yes       | Your Discogs username                                             |
| `token`       | No        | Discogs API token (for album covers and higher rate limits)       |
| `view`        | No        | Default view: `collection` or `wantlist` (default: `collection`)  |

**Examples:**
```
# Basic usage
?username=john

# With token
?username=john&token=abc123xyz

# Start with wantlist view
?username=john&view=wantlist
```

### Setting Up Categories

To organize your collection into categories, add a two-character prefix to your item notes in Discogs:

- **`F-`** - Foreign items
- **`D-`** - Domestic items  
- **`U-`** - Uncategorized items

**Example:**
```
D- Great condition, original pressing from 1985
```

This will mark the item as "Domestic" and display the note text without the prefix.

### Language Selection

Click the language dropdown in the header to choose from 8 supported languages. Your preference is saved per username.

### Search & Sort

- **Search**: Type in the search box (waits 1 second after you stop typing, or press Enter)
- **Sort Options**:
  - Artist (A-Z)
  - Title (A-Z)
  - Title (Z-A)
  - Newest First
  - Oldest First

## 🔧 Configuration

### Adding Vinyl Shops

Edit `public/app.js` and modify the `VINYL_SHOPS` array:

```javascript
const VINYL_SHOPS = [
    { 
        text: 'Shop Name',
        url: 'https://shop-url.com',
        tag: 'domestic', // or 'foreign'
        starred: true // optional: shows star icon
    },
    // ... more shops
];
```

### Adding Languages

1. **Add translations** in `public/languages.js`:
   ```javascript
   "lang_code": {
       "language_name": "Language Name",
       "collection": "Translation",
       // ... all translation keys
       "help_sections": [
           {
               "title": "Section Title",
               "content": "Section content with <strong>HTML</strong> support"
           }
       ]
   }
   ```

2. Language selector automatically populates from `languages.js`

## 🏗️ Project Structure

```
vinyl-collection-wantlist/
├── public/
│   ├── oauth.js               # OAuth authentication manager
│   ├── app.js                 # Main application logic
│   ├── language-manager.js    # i18n system
│   ├── languages.js           # Translation data
│   ├── styles.css             # All styles
│   ├── index.html             # Main HTML file
│   ├── config.local.js        # Local config (gitignored)
│   └── favicon/               # Favicon assets
├── firebase.json              # Firebase hosting config
└── README.md
```

## 💾 Caching System

The app uses localStorage for caching:

- **Cache Keys**: Per-username (`discogs_wantlist_cache_username`, `discogs_collection_cache_username`)
- **Refresh**: Click the refresh button to clear cache and fetch fresh data
- **Auto-clear**: Clears old cache if localStorage quota is exceeded

## 🎨 Customization

### Theming

Edit CSS variables in `public/styles.css`:

```css
:root {
    --primary-color: #DFCAA0;
    --primary-color-hover: #dfcaa077;
    --dark-bg: #191414;
    --light-bg: #282828;
    --text-primary: #ffffff;
    --text-secondary: #b3b3b3;
    --border-color: #404040;
}
```

### Grid Layout

The responsive grid automatically adjusts based on screen width. Edit the `divider` logic in `app.js` to customize breakpoints.

### For OAuth (Recommended)

1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Click "Create an Application"
3. Fill in your application details
4. Copy your Consumer Key and Secret
5. Add them to `public/oauth.js`

### For URL Token Method (Legacy)

1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Click "Generate new token"
3. Copy the token and use it in the URL or `config.local.js`

**Note**: OAuth is recommended for:
- Better security (no tokens in URLs)
- Access to private collections
- Session persistence
- Future write operations
- Professional user experience
- Viewing wantlist album cover images
- Higher API rate limits (60 requests/min vs 25 requests/min)

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### No items showing
- Check your Discogs username is correct
- Ensure your collection/wantlist is public
- Check browser console for errors
- Try clicking Refresh to clear cache

### Images not loading (wantlist)
- Add a Discogs API token to your URL
- Check token is valid in Discogs settings

### Language not changing
- Clear browser cache
- Check browser console for errors
- Ensure `languages.js` loaded correctly

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Data provided by [Discogs API](https://www.discogs.com/developers)
- Built with vanilla JavaScript (no frameworks!)
- Icons from inline SVG

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Add new language translations
- Improve the UI/UX
- Fix bugs
- Add new features

## 📞 Support

For issues or questions:
- Check the built-in Help section (? link in footer)
- Review this README
- Check browser console for errors

---

**Enjoy managing your vinyl collection! 🎵**
