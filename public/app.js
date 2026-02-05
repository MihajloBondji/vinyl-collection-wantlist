// Configuration
// Load from config.local.js if available (local development with token)
// Otherwise use defaults (public version without token)
let DISCOGS_USERNAME = null;
let DISCOGS_TOKEN = null;

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const tokenParam = urlParams.get('token');
const usernameParam = urlParams.get('username');

if (usernameParam) {
    DISCOGS_USERNAME = usernameParam;
} else if (typeof CONFIG !== 'undefined') {
    DISCOGS_USERNAME = CONFIG.DISCOGS_USERNAME || DISCOGS_USERNAME;
}

if (tokenParam) {
    DISCOGS_TOKEN = tokenParam;
} else if (typeof CONFIG !== 'undefined') {
    DISCOGS_TOKEN = CONFIG.DISCOGS_TOKEN || null;
}

const DISCOGS_API_BASE = 'https://api.discogs.com';
const ITEMS_PER_PAGE = 250; // Discogs API limit

let divider = 6;
switch(true) {
    case (window.innerWidth > 1390):
        divider = 6;
        break;
    case (window.innerWidth > 1160):
        divider = 5;
        break;
    case (window.innerWidth > 930):
        divider = 4;
        break;
    case (window.innerWidth > 770):
        divider = 3;
        break;
    case (window.innerWidth > 680):
        divider = 4;
        break;
    case (window.innerWidth > 514):
        divider = 3;
        break;
    default:
        divider = 2;
}

// State management
let allItems = [];
let filteredItems = [];
let currentSort = 'artist-asc';
let currentPath = '/collection';
let searchTimeout;

// Vinyl shops - add your shops here
const VINYL_SHOPS = [
     { text: 'Metropolis Music', url: 'https://www.metropolismusic.rs/prodavnica-ploca/albums.html', tag: 'domestic' },
     { text: 'Ammonite', url: 'https://www.ammonite.rs/vinil.html', tag: 'domestic' },
     { text: 'Antishop', url: 'https://antishop.rs/shop/', tag: 'domestic' },
     { text: 'Mascom', url: 'https://www.mascom.rs/sr/muzika.1.90.html?pack[]=4', tag: 'domestic' },
     { text: 'Gramofonik', url: 'https://prodavnicaploca.rs/collections/all', tag: 'domestic' },
     { text: 'Menart', url: 'https://www.menart.rs/online-shop/', tag: 'domestic' },
     { text: 'Black screen records', url: 'https://blackscreenrecords.com/collections/vinyl', tag: 'foreign', starred: true },
     { text: 'Rarewaves', url: 'https://www.rarewaves.com/pages/vinyl', tag: 'foreign', starred: true },
     { text: 'Fidbox', url: 'https://fidbox.rs/izdanja/', tag: 'domestic', starred: true },
     { text: 'Delfi', url: 'https://delfi.rs/Muzika/zanr/Gramofonske%20plo%C4%8De?limit=50&page=1&isAvailable=true', tag: 'domestic', starred: true },
     { text: 'Gigatron', url: 'https://gigatron.rs/tv-audio-video/gramofonske-ploce', tag: 'domestic' },
     { text: 'KupujemProdajem', url: 'https://www.kupujemprodajem.com/antikvarnica-stepa/svi-oglasi/2020719/1?categoryId=1176', tag: 'domestic' },
     { text: 'Discogs', url: 'https://www.discogs.com/sell/list?format=Vinyl&ships_from=Serbia', tag: 'foreign' },
     { text: 'Dirty Old Empire', url: 'https://www.dirtyoldempire.com/kategorija-proizvoda/vinyl-2/', tag: 'foreign' },
     { text: 'Jugoton', url: 'https://jugoton.net/product-category/lp/', tag: 'domestic' },
     { text: 'Yugovinyl', url: 'https://www.google.com/maps/place/Yugovinyl/@44.8179221,20.4632067,17z/data=!3m1!4b1!4m6!3m5!1s0x475a7a9b40ab658b:0xefe9ee21b36dd60a!8m2!3d44.8179221!4d20.4657816!16s%2Fg%2F11_qycdyq?entry=ttu&g_ep=EgoyMDI2MDEyMS4wIKXMDSoASAFQAw%3D%3D', tag: 'domestic' },
].sort((a, b) => a.text.localeCompare(b.text)).sort((a, b) => b.tag.localeCompare(a.tag));

// Cache keys - made per-username to prevent mixing lists
function getCacheKeys(username) {
    return {
        wantlist: `discogs_wantlist_cache_${username}`,
        collection: `discogs_collection_cache_${username}`
    };
}

// Helper functions for localStorage
function getCache(key) {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
}

function setCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing old caches');
            clearCache(CACHE_KEYS.wantlist);
            clearCache(CACHE_KEYS.collection);
            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e2) {
                console.error('Still cannot save to localStorage:', e2);
            }
        }
    }
}

function clearCache(key) {
    localStorage.removeItem(key);
}

// DOM Elements
const wantlistContainer = document.getElementById('wantlistContainer');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const userInfo = document.getElementById('userInfo');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');
const sortBtn = document.getElementById('sortBtn');
const sortDropdown = document.getElementById('sortDropdown');
const sortLabel = document.getElementById('sortLabel');
const shopsContainer = document.getElementById('shopsContainer');
const shopsList = document.getElementById('shopsList');
let collectionSections = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load languages first
    await loadLanguages();
    updateUIText();
    
    // Check for query parameter to determine which view to load
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    
    if (viewParam === 'wantlist') {
        currentPath = '/wantlist';
        document.getElementById('wantlistTab').classList.add('active');
        document.getElementById('collectionTab').classList.remove('active');
    } else if (viewParam === 'collection') {
        currentPath = '/collection';
        document.getElementById('collectionTab').classList.add('active');
        document.getElementById('wantlistTab').classList.remove('active');
    } else {
        // Default to collection
        currentPath = '/collection';
        document.getElementById('collectionTab').classList.add('active');
        document.getElementById('wantlistTab').classList.remove('active');
    }
    
    refreshBtn.addEventListener('click', () => {
        // Clear cache on refresh
        const CACHE_KEYS = getCacheKeys(DISCOGS_USERNAME);
        clearCache(CACHE_KEYS.wantlist);
        clearCache(CACHE_KEYS.collection);
        fetchData();
    });
    
    // Search input with debounce
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            handleSearch(e);
        }, 1000);
    });
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            handleSearch(e);
        }
    });
    
    // Custom select functionality - Sort dropdown
    sortBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortDropdown.classList.toggle('hidden');
        sortBtn.classList.toggle('active');
        
        // Close language dropdown when opening sort
        const languageDropdown = document.getElementById('languageDropdown');
        const languageBtn = document.getElementById('languageBtn');
        if (languageDropdown && !languageDropdown.classList.contains('hidden')) {
            languageDropdown.classList.add('hidden');
            languageBtn.classList.remove('active');
        }
    });
    
    // Language dropdown
    const languageBtn = document.getElementById('languageBtn');
    const languageDropdown = document.getElementById('languageDropdown');
    
    if (languageBtn) {
        languageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            languageDropdown.classList.toggle('hidden');
            languageBtn.classList.toggle('active');
            
            // Close sort dropdown when opening language
            if (!sortDropdown.classList.contains('hidden')) {
                sortDropdown.classList.add('hidden');
                sortBtn.classList.remove('active');
            }
        });
    }
    
    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        // Close sort dropdown if clicking outside
        if (!e.target.closest('#sortBtn') && !e.target.closest('#sortDropdown')) {
            sortDropdown.classList.add('hidden');
            sortBtn.classList.remove('active');
        }
        
        // Close language dropdown if clicking outside
        if (!e.target.closest('#languageBtn') && !e.target.closest('#languageDropdown')) {
            languageDropdown.classList.add('hidden');
            languageBtn?.classList.remove('active');
        }
    });
    
    // Sort options
    document.querySelectorAll('#sortDropdown option').forEach(option => {
        option.addEventListener('click', (e) => {
            const value = e.target.getAttribute('data-value');
            currentSort = value;
            sortLabel.textContent = e.target.textContent;
            
            // Update active state
            document.querySelectorAll('#sortDropdown option').forEach(opt => {
                opt.classList.remove('active');
            });
            e.target.classList.add('active');
            
            applySort();
            renderWantlist();
            toggleSortDropdown();
        });
    });
    
    // Tab navigation
    document.getElementById('wantlistTab').addEventListener('click', (e) => {
        currentPath = '/wantlist';
        updateActiveTab(e.target);
        fetchData();
    });
    
    document.getElementById('collectionTab').addEventListener('click', (e) => {
        currentPath = '/collection';
        updateActiveTab(e.target);
        fetchData();
    });
    
    // Load wantlist on page load
    fetchData();

    document.getElementById('overlay').addEventListener('click', () => {
        document.querySelectorAll('.wantlist-item.item-selected').forEach(item => {
            item.classList.remove('item-selected');
        });
        document.getElementById('overlay').classList.add('hidden');
    });
    
    // Help popup functionality
    const helpLink = document.getElementById('helpLink');
    const helpPopup = document.getElementById('helpPopup');
    const helpClose = document.getElementById('helpClose');
    
    if (helpLink) {
        helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            showHelp();
        });
    }
    
    if (helpClose) {
        helpClose.addEventListener('click', () => {
            helpPopup.classList.add('hidden');
        });
    }
    
    if (helpPopup) {
        helpPopup.addEventListener('click', (e) => {
            if (e.target === helpPopup) {
                helpPopup.classList.add('hidden');
            }
        });
    }
});

function renderShops() {
    if (VINYL_SHOPS.length === 0 || currentPath !== '/wantlist') {
        shopsContainer.classList.add('hidden');
        return;
    }
    
    shopsList.innerHTML = '';
    VINYL_SHOPS.forEach(shop => {
        const link = document.createElement('a');
        link.href = shop.url;
        link.target = '_blank';
        link.textContent = shop.text;
        link.className = `shop-link ${shop.tag} ${shop.starred ? 'starred' : ''}`;
        shopsList.appendChild(link);
    });
    
    shopsContainer.classList.remove('hidden');
}

function toggleSortDropdown() {
    sortDropdown.classList.toggle('hidden');
    sortBtn.classList.toggle('active');
}

function closeSortDropdown(e) {
    const customSelect = document.querySelector('.custom-select');
    if (!customSelect.contains(e.target)) {
        sortDropdown.classList.add('hidden');
        sortBtn.classList.remove('active');
    }
}

function updateActiveTab(activeBtn) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    activeBtn.classList.add('active');
}

async function fetchData() {
    if (currentPath === '/wantlist') {
        fetchWantlist();
    } else if (currentPath === '/collection') {
        fetchCollection();
    }
    
    renderShops();
}

async function fetchWantlist() {
    try {
        // Check cache first
        const CACHE_KEYS = getCacheKeys(DISCOGS_USERNAME);
        const cached = getCache(CACHE_KEYS.wantlist);
        if (cached) {
            allItems = [...cached];
            userInfo.textContent = `${DISCOGS_USERNAME} • ${t('wantlist')} • ${allItems.length} ${t('items')}`;
            filteredItems = [...allItems];
            applySort();
            renderWantlist();
            return;
        }

        showLoading(true);
        hideError();
        allItems = [];

        // Fetch items from the dedicated wantlist endpoint
        const wantlistUrl = `${DISCOGS_API_BASE}/users/${DISCOGS_USERNAME}/wants`;
        await fetchItems(wantlistUrl);

        // Cache the results
        setCache(CACHE_KEYS.wantlist, allItems);

        // Update user info
        userInfo.textContent = `${DISCOGS_USERNAME} • ${t('wantlist')} • ${allItems.length} ${t('items')}`;

        // Apply initial sort and render
        filteredItems = [...allItems];
        applySort();
        renderWantlist();

    } catch (error) {
        console.error('Error:', error);
        showError(`${t('error_loading_wantlist')} ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function fetchCollection() {
    try {
        // Check cache first
        const CACHE_KEYS = getCacheKeys(DISCOGS_USERNAME);
        const cached = getCache(CACHE_KEYS.collection);
        if (cached) {
            allItems = [...cached];
            userInfo.textContent = `${DISCOGS_USERNAME} • ${t('collection')} • ${allItems.length} ${t('items')}`;
            filteredItems = [...allItems];
            applySort();
            renderWantlist();
            return;
        }

        showLoading(true);
        hideError();
        allItems = [];

        // Fetch items from the collection endpoint
        const collectionUrl = `${DISCOGS_API_BASE}/users/${DISCOGS_USERNAME}/collection/folders/0/releases`;
        await fetchItems(collectionUrl);

        // Cache the results
        setCache(CACHE_KEYS.collection, allItems);

        // Update user info
        userInfo.textContent = `${DISCOGS_USERNAME} • ${t('collection')} • ${allItems.length} ${t('items')}`;

        // Apply initial sort and render
        filteredItems = [...allItems];
        applySort();
        renderWantlist();

    } catch (error) {
        console.error('Error:', error);
        showError(`${t('error_loading_collection')} ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function parseNotesTag(rawNotes) {
    if (!rawNotes) {
        return { notes: '', tag: '' };
    }

    const trimmed = String(rawNotes).trim();
    const tagMatch = trimmed.match(/^([FDU])-/i);
    if (!tagMatch) {
        return { notes: trimmed, tag: '' };
    }

    const tag = tagMatch[1].toUpperCase();
    const notes = trimmed.slice(2).trim();
    return { notes, tag };
}

async function fetchItems(apiUrl) {
    try {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            let url = `${apiUrl}?page=${page}&per_page=${ITEMS_PER_PAGE}`;
            if (DISCOGS_TOKEN) {
                url += `&token=${DISCOGS_TOKEN}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch wantlist items: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('API Response:', data);
            
            // Handle both wantlist and collection responses
            const items = data.wants || data.releases || data;
            
            if (Array.isArray(items)) {
                items.forEach(item => {
                    const basicInfo = item.basic_information || item;
                    const rawNotes = (Array.isArray(item.notes) && item.notes.find(n => n.field_id === 3)?.value) || '';
                    const parsedNotes = parseNotesTag(rawNotes);

                    allItems.push({
                        id: item.id,
                        title: basicInfo.title,
                        artist: basicInfo.artists?.[0]?.name || 'Unknown',
                        year: basicInfo.year,
                        thumb: basicInfo.thumb,
                        uri: item.uri || '',
                        resourceUrl: item.resource_url,
                        dateAdded: item.date_added || new Date().toISOString(),
                        format: basicInfo.formats?.[0]?.name || 'Unknown',
                        notes: parsedNotes.notes,
                        tag: parsedNotes.tag
                    });
                });
            }

            // Check if there are more pages
            hasMore = data.pagination?.page < data.pagination?.pages;
            page++;
        }
    } catch (error) {
        console.error('Error fetching items:', error);
        throw error;
    }
}

async function fetchImageAsBase64(imageUrl) {
    // Removed - no image caching
}

function renderWantlist() {
    wantlistContainer.innerHTML = '';

    currentPath === '/wantlist' ? wantlistContainer.classList.add('wantlist-view') : wantlistContainer.classList.remove('wantlist-view');

    if (filteredItems.length === 0) {
        wantlistContainer.innerHTML = `<div class="empty-state"><p>${t('no_items_found')}</p></div>`;
        return;
    }

    ensureCollectionSections();

    if (currentPath === '/collection') {
        const domesticItems = [];
        const foreignItems = [];
        const uncategorizedItems = [];

        filteredItems.forEach(item => {
            const tag = (item.tag || '').toUpperCase();
            if (tag === 'D') {
                domesticItems.push(item);
            } else if (tag === 'F') {
                foreignItems.push(item);
            } else {
                uncategorizedItems.push(item);
            }
        });

        wantlistContainer.style.display = 'none';
        setCollectionSectionsVisibility(true);

        renderCollectionSection(collectionSections.foreign, foreignItems);
        renderCollectionSection(collectionSections.domestic, domesticItems);
        renderCollectionSection(collectionSections.uncategorized, uncategorizedItems);
        return;
    }

    wantlistContainer.style.display = '';
    setCollectionSectionsVisibility(false);

    filteredItems.forEach((item, index) => {
        const itemElement = createItemElement(item);
        const indexElement = index % divider;
        itemElement.style.setProperty('--i', indexElement);
        itemElement.onclick = () => {
            itemElement.classList.add('item-selected');
            overlay.classList.remove('hidden');
            itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        wantlistContainer.appendChild(itemElement);
    });
}

function ensureCollectionSections() {
    if (collectionSections) {
        return;
    }

    // Remove old collection sections if they exist
    document.querySelectorAll('.collection-section-title, .collection-grid').forEach(el => {
        el.remove();
    });

    const insertAfter = (node, newNode) => {
        node.insertAdjacentElement('afterend', newNode);
        return newNode;
    };

    let anchor = wantlistContainer;

    const foreign = createCollectionSection(t('foreign'));
    anchor = insertAfter(anchor, foreign.title);
    anchor = insertAfter(anchor, foreign.grid);
    
    const domestic = createCollectionSection(t('domestic'));
    anchor = insertAfter(anchor, domestic.title);
    anchor = insertAfter(anchor, domestic.grid);

    const uncategorized = createCollectionSection(t('uncategorized'));
    anchor = insertAfter(anchor, uncategorized.title);
    insertAfter(anchor, uncategorized.grid);

    collectionSections = {
        domestic,
        foreign,
        uncategorized
    };
}

function createCollectionSection(titleText) {
    const title = document.createElement('h2');
    title.className = 'collection-section-title';
    title.textContent = titleText;

    const grid = document.createElement('div');
    grid.className = 'list-grid collection-grid';

    return { title, grid };
}

function setCollectionSectionsVisibility(visible) {
    if (!collectionSections) {
        return;
    }

    const displayValue = visible ? '' : 'none';
    Object.values(collectionSections).forEach(section => {
        section.title.style.display = displayValue;
        section.grid.style.display = displayValue;
    });
}

function renderCollectionSection(section, items) {
    section.grid.innerHTML = '';

    if (items.length === 0) {
        section.grid.classList.add('hidden');
        section.title.classList.add('hidden');
        return;
    }

    section.grid.classList.remove('hidden');
    section.title.classList.remove('hidden');


    items.forEach((item, index) => {
        const itemElement = createItemElement(item);
        const indexElement = index % divider;
        itemElement.style.setProperty('--i', indexElement);
        itemElement.onclick = () => {
            itemElement.classList.add('item-selected');
            overlay.classList.remove('hidden');
            itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        section.grid.appendChild(itemElement);
    });
}

// SVG placeholder as data URI - no external dependencies
const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="150" height="150" fill="%23404040"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%23b3b3b3" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';

function createItemElement(item) {
    const div = document.createElement('div');
    div.className = 'wantlist-item';
    
    const discogsUrl = `https://www.discogs.com/release/${item.id}`;
    
    let imageHtml = '';
    if (item.thumb) {
        imageHtml = `
        <div class="item-image">
            <img src="${item.thumb}" alt="${item.title}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22150%22%3E%3Crect width=%22150%22 height=%22150%22 fill=%22%23404040%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%23b3b3b3%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3ENo Image%3C/text%3E%3C/svg%3E'">
        </div>`;
    }
    
    div.innerHTML = `
        ${imageHtml}
        <div class="item-details">
            <h3 class="item-title">${escapeHtml(item.title)}</h3>
            <p class="item-artist">${escapeHtml(item.artist)}${item.year>0 ? ' • ' + item.year : ''}</p>
            <p class="item-notes">${escapeHtml(item.notes)}</p>
            <a href="${discogsUrl}" target="_blank" class="item-link">${t('view_on_discogs')}</a>
        </div>
    `;
    
    return div;
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    
    filteredItems = allItems.filter(item => {
        return item.title.toLowerCase().includes(query) ||
               item.artist.toLowerCase().includes(query) ||
               item.format.toLowerCase().includes(query);
    });
    
    applySort();
    renderWantlist();
}

function applySort() {
    // Sort items
    switch(currentSort) {
        case 'date-desc':
            filteredItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            break;
        case 'date-asc':
            filteredItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
            break;
        case 'title-asc':
            filteredItems.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'title-desc':
            filteredItems.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'artist-asc':
            filteredItems.sort((a, b) => a.artist.localeCompare(b.artist));
            break;
    }
}

function showLoading(show) {
    if (show) {
        loadingSpinner.classList.remove('hidden');
    } else {
        loadingSpinner.classList.add('hidden');
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showHelp() {
    const helpPopup = document.getElementById('helpPopup');
    const helpContent = document.getElementById('helpContent');
    
    if (!window.LANGUAGES_DATA || !window.LANGUAGES_DATA[CURRENT_LANGUAGE]) {
        console.error('Language data not available');
        return;
    }
    
    const helpSections = window.LANGUAGES_DATA[CURRENT_LANGUAGE].help_sections;
    
    if (!helpSections) {
        console.error('Help sections not found for language:', CURRENT_LANGUAGE);
        return;
    }
    
    helpContent.innerHTML = '';
    
    helpSections.forEach(section => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'help-section';
        
        const title = document.createElement('h3');
        title.className = 'help-section-title';
        title.textContent = section.title;
        
        const content = document.createElement('div');
        content.className = 'help-section-content';
        content.innerHTML = section.content;
        
        sectionDiv.appendChild(title);
        sectionDiv.appendChild(content);
        helpContent.appendChild(sectionDiv);
    });
    
    helpPopup.classList.remove('hidden');
}
