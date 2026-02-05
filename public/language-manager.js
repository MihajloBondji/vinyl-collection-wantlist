// Language management - separate module for all i18n functionality

let CURRENT_LANGUAGE = 'en';

async function loadLanguages() {
    // Language data should be loaded from languages.js global
    // Wait for it to be available
    let attempts = 0;
    while (!window.LANGUAGES_DATA && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 10));
        attempts++;
    }
    
    if (!window.LANGUAGES_DATA) {
        console.error('Failed to load LANGUAGES_DATA from languages.js');
        return;
    }
    
    // Populate language dropdown dynamically
    populateLanguageDropdown();
    
    // Load saved language preference for this user
    if (typeof DISCOGS_USERNAME !== 'undefined' && DISCOGS_USERNAME && window.LANGUAGES_DATA) {
        const savedLanguage = localStorage.getItem(`language_preference_${DISCOGS_USERNAME}`);
        if (savedLanguage && window.LANGUAGES_DATA[savedLanguage]) {
            CURRENT_LANGUAGE = savedLanguage;
            console.log('Loaded saved language preference:', CURRENT_LANGUAGE);
        }
    }
}

function populateLanguageDropdown() {
    const languageDropdown = document.getElementById('languageDropdown');
    if (!languageDropdown || !window.LANGUAGES_DATA) return;
    
    languageDropdown.innerHTML = '';
    
    Object.keys(window.LANGUAGES_DATA).forEach(langCode => {
        const langData = window.LANGUAGES_DATA[langCode];
        const option = document.createElement('option');
        option.setAttribute('data-lang', langCode);
        option.setAttribute('onclick', `setLanguage('${langCode}')`);
        option.textContent = langData.language_name || langCode;
        languageDropdown.appendChild(option);
    });
}

function t(key) {
    if (!window.LANGUAGES_DATA) return key;
    return window.LANGUAGES_DATA[CURRENT_LANGUAGE]?.[key] || window.LANGUAGES_DATA['en']?.[key] || key;
}

function updateUIText() {
    if (!window.LANGUAGES_DATA) return; // Guard against missing language data
    
    // Update all elements with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) {
            element.textContent = t(key);
        }
    });
    
    // Update button texts (with safe selectors)
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.textContent = t('refresh');
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.placeholder = t('search');
    
    // Update sort label
    const sortLabelElement = document.getElementById('sortLabel');
    if (sortLabelElement) {
        switch(typeof currentSort !== 'undefined' ? currentSort : 'artist-asc') {
            case 'artist-asc': sortLabelElement.textContent = t('artist_asc'); break;
            case 'title-asc': sortLabelElement.textContent = t('title_asc'); break;
            case 'title-desc': sortLabelElement.textContent = t('title_desc'); break;
            case 'date-desc': sortLabelElement.textContent = t('newest_first'); break;
            case 'date-asc': sortLabelElement.textContent = t('oldest_first'); break;
        }
    }
    
    // Update sort options
    document.querySelectorAll('.sort-dropdown option').forEach(option => {
        const key = option.getAttribute('data-i18n');
        if (key) {
            option.textContent = t(key);
        }
    });
    
    // Update nav tabs
    const collectionTab = document.getElementById('collectionTab');
    if (collectionTab) collectionTab.textContent = t('collection');
    
    const wantlistTab = document.getElementById('wantlistTab');
    if (wantlistTab) wantlistTab.textContent = t('wantlist');
    
    // Update language label
    const languageLabel = document.getElementById('languageLabel');
    if (languageLabel && window.LANGUAGES_DATA[CURRENT_LANGUAGE]) {
        languageLabel.textContent = window.LANGUAGES_DATA[CURRENT_LANGUAGE].language_name || CURRENT_LANGUAGE;
    }
}

function setLanguage(lang) {
    console.log('setLanguage called with:', lang);
    console.log('window.LANGUAGES_DATA exists:', !!window.LANGUAGES_DATA);
    
    if (!window.LANGUAGES_DATA) {
        console.error('LANGUAGES_DATA not available');
        return;
    }
    
    if (!window.LANGUAGES_DATA[lang]) {
        console.error('Language not found:', lang);
        return;
    }
    
    CURRENT_LANGUAGE = lang;
    console.log('Language changed to:', CURRENT_LANGUAGE);
    
    if (typeof DISCOGS_USERNAME !== 'undefined' && DISCOGS_USERNAME) {
        localStorage.setItem(`language_preference_${DISCOGS_USERNAME}`, lang);
        console.log('Saved language preference to localStorage');
    }
    
    // Reset collection sections so they get recreated with new language
    if (typeof collectionSections !== 'undefined') {
        collectionSections = null;
    }
    
    // Update language label and close dropdown
    const languageLabel = document.getElementById('languageLabel');
    const languageDropdown = document.getElementById('languageDropdown');
    const languageBtn = document.getElementById('languageBtn');
    
    if (languageLabel && window.LANGUAGES_DATA[lang]) {
        languageLabel.textContent = window.LANGUAGES_DATA[lang].language_name || lang;
    }
    if (languageDropdown) {
        languageDropdown.classList.add('hidden');
    }
    if (languageBtn) {
        languageBtn.classList.remove('active');
    }
    
    updateUIText();
    
    // Update userInfo with translated text
    const userInfo = document.getElementById('userInfo');
    if (typeof allItems !== 'undefined' && allItems.length > 0 && userInfo) {
        const viewType = typeof currentPath !== 'undefined' && currentPath === '/wantlist' ? t('wantlist') : t('collection');
        userInfo.textContent = `${DISCOGS_USERNAME} • ${viewType} • ${allItems.length} ${t('items')}`;
    }
    
    if (typeof renderWantlist === 'function') {
        renderWantlist();
    }
}
