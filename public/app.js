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

// State management
let allItems = [];
let filteredItems = [];
let currentSort = 'date-desc';
let currentPath = '/collection';

// Titles to always place at the end
const PINNED_TO_END = ['Hydraulika', 'Liturgija'];

// Vinyl shops - add your shops here
const VINYL_SHOPS = [
     { text: 'Metropolis Music', url: 'https://www.metropolismusic.rs/prodavnica-ploca/albums.html' },
     { text: 'Ammonite', url: 'https://www.ammonite.rs/vinil.html' },
     { text: 'Antishop', url: 'https://antishop.rs/shop/' },
     { text: 'Mascom', url: 'https://www.mascom.rs/sr/muzika.1.90.html?pack[]=4' },
     { text: 'Gramofonik', url: 'https://prodavnicaploca.rs/collections/all' },
     { text: 'Menart', url: 'https://www.menart.rs/online-shop/' },
     { text: 'Fidbox', url: 'https://fidbox.rs/izdanja/' },
     { text: 'Delfi', url: 'https://delfi.rs/Muzika/zanr/Gramofonske%20plo%C4%8De?limit=50&page=1&isAvailable=true' },
     { text: 'Gigatron', url: 'https://gigatron.rs/tv-audio-video/gramofonske-ploce' },
     { text: 'KupujemProdajem', url: 'https://www.kupujemprodajem.com/antikvarnica-stepa/svi-oglasi/2020719/1?categoryId=1176' },
     { text: 'Discogs', url: 'https://www.discogs.com/sell/list?format=Vinyl&ships_from=Serbia' },
     { text: 'Dirty Old Empire', url: 'https://www.dirtyoldempire.com/kategorija-proizvoda/vinyl-2/' },
     { text: 'Yugovinyl', url: 'https://www.google.com/maps/place/Yugovinyl/@44.8179221,20.4632067,17z/data=!3m1!4b1!4m6!3m5!1s0x475a7a9b40ab658b:0xefe9ee21b36dd60a!8m2!3d44.8179221!4d20.4657816!16s%2Fg%2F11_qycdyq?entry=ttu&g_ep=EgoyMDI2MDEyMS4wIKXMDSoASAFQAw%3D%3D' },
];

// Cache keys
const CACHE_KEYS = {
    wantlist: 'discogs_wantlist_cache',
    collection: 'discogs_collection_cache'
};

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
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
        clearCache(CACHE_KEYS.wantlist);
        clearCache(CACHE_KEYS.collection);
        fetchData();
    });
    searchInput.addEventListener('input', handleSearch);
    
    // Custom select functionality
    sortBtn.addEventListener('click', toggleSortDropdown);
    document.addEventListener('click', closeSortDropdown);
    
    // Sort options
    document.querySelectorAll('.sort-dropdown option').forEach(option => {
        option.addEventListener('click', (e) => {
            const value = e.target.getAttribute('data-value');
            currentSort = value;
            sortLabel.textContent = e.target.textContent;
            
            // Update active state
            document.querySelectorAll('.sort-dropdown option').forEach(opt => {
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
        link.className = 'shop-link';
        link.textContent = shop.text;
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
        const cached = getCache(CACHE_KEYS.wantlist);
        if (cached) {
            allItems = [...cached];
            userInfo.textContent = `${DISCOGS_USERNAME} • Wantlist • ${allItems.length} items`;
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
        userInfo.textContent = `${DISCOGS_USERNAME} • Wantlist • ${allItems.length} items`;

        // Apply initial sort and render
        filteredItems = [...allItems];
        applySort();
        renderWantlist();

    } catch (error) {
        console.error('Error:', error);
        showError(`Error loading wantlist: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function fetchCollection() {
    try {
        // Check cache first
        const cached = getCache(CACHE_KEYS.collection);
        if (cached) {
            allItems = [...cached];
            userInfo.textContent = `${DISCOGS_USERNAME} • Collection • ${allItems.length} items`;
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
        userInfo.textContent = `${DISCOGS_USERNAME} • Collection • ${allItems.length} items`;

        // Apply initial sort and render
        filteredItems = [...allItems];
        applySort();
        renderWantlist();

    } catch (error) {
        console.error('Error:', error);
        showError(`Error loading collection: ${error.message}`);
    } finally {
        showLoading(false);
    }
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
                        notes: (Array.isArray(item.notes) && item.notes.find(n => n.field_id === 3)?.value) || ''
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
        wantlistContainer.innerHTML = '<div class="empty-state"><p>No items found</p></div>';
        return;
    }

    filteredItems.forEach(item => {
        const itemElement = createItemElement(item);
        itemElement.onclick = () => {
            itemElement.classList.add('item-selected');
            overlay.classList.remove('hidden');
            itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        wantlistContainer.appendChild(itemElement);
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
            <a href="${discogsUrl}" target="_blank" class="item-link">View on Discogs →</a>
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
    // Separate items into normal and pinned-to-end
    const normalItems = [];
    const pinnedItems = [];
    
    filteredItems.forEach(item => {
        if (PINNED_TO_END.includes(item.title)) {
            pinnedItems.push(item);
        } else {
            normalItems.push(item);
        }
    });
    
    // Sort normal items
    switch(currentSort) {
        case 'date-desc':
            normalItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            break;
        case 'date-asc':
            normalItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
            break;
        case 'title-asc':
            normalItems.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'title-desc':
            normalItems.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'artist-asc':
            normalItems.sort((a, b) => a.artist.localeCompare(b.artist));
            break;
    }
    
    // Also sort pinned items by same criteria
    switch(currentSort) {
        case 'date-desc':
            pinnedItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            break;
        case 'date-asc':
            pinnedItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
            break;
        case 'title-asc':
            pinnedItems.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'title-desc':
            pinnedItems.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'artist-asc':
            pinnedItems.sort((a, b) => a.artist.localeCompare(b.artist));
            break;
    }
    
    // Combine: normal items first, then pinned items
    filteredItems = [...normalItems, ...pinnedItems];
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
