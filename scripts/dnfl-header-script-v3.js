/**
 * ============================================================================
 * Duke Networking Fantasy League (DNFL) Framework Header Script
 * ============================================================================
 */
(function () {
    'use strict';

    // =========================================================================
    // ⚙️ 1. CONFIGURATION & SCRIPT MANIFEST (EDIT HERE TO CONTROL VERSIONS)
    // =========================================================================

    // 1. Framework Master Version (Bump to force cache refresh across all user browsers)
    const FRAMEWORK_VERSION = "3.23";
    window.DNFL_FRAMEWORK_VERSION = FRAMEWORK_VERSION;

    // 2. Base URL Path for DNFL Framework Scripts & Assets
    const BASE_URL = "https://dnfl.live/scripts/";
    const BASE_CSS_URL = "https://dnfl.live/css/";

    // 3. CSS Stylesheets to Load (Third-party full URLs or relative paths)
    const STYLES_TO_LOAD = [
        "dnfl-global-v6.css"
    ];

    // 4. JavaScript Modules & API Clients to Load (Relative filenames resolve against BASE_URL)
    const SCRIPTS_TO_LOAD = [
        "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js",
        "https://cdn.jsdelivr.net/npm/chart.js",
        "https://cdn.jsdelivr.net/npm/marked/marked.min.js",
        "dnfl-api-client-v4.js",
        "dnfl-standings-v5.js",
        "dnfl-rankings-v4.js",
        "dnfl-podcast-v2.js",
        "dnfl-rules-v3.js",
        "dnfl-lts-v7.js"
    ];

    // =========================================================================
    // 🚀 2. FRAMEWORK NAMESPACE & INITIALIZATION
    // =========================================================================
    window.DNFL = window.DNFL || {};
    window.DNFL.version = FRAMEWORK_VERSION;
    window.DNFL.baseUrl = BASE_URL;
    window.DNFL.modules = window.DNFL.modules || {};

    /**
     * Versioned Cache Invalidation
     * Checks stored framework version against active FRAMEWORK_VERSION.
     * Purges stale localStorage/IndexedDB API cache entries if version mismatch is detected.
     */
    (function syncCacheVersion() {
        try {
            const storedVersion = localStorage.getItem('dnfl_framework_version');
            if (storedVersion !== FRAMEWORK_VERSION) {
                console.log(`[DNFL Header] Version change detected (${storedVersion || 'None'} -> ${FRAMEWORK_VERSION}). Purging stale API cache...`);
                
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('dnfl_cache_') || key.startsWith('dnfl_api_'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));

                localStorage.setItem('dnfl_framework_version', FRAMEWORK_VERSION);
                console.log(`[DNFL Header] API cache cleared successfully for v${FRAMEWORK_VERSION}.`);
            }
        } catch (e) {
            console.warn('[DNFL Header] Storage sync error:', e);
        }
    })();

    /**
     * Asset Loader Helper
     * Resolves relative script/style names against BASE_URL and injects cache-busting query strings.
     * Sets script.async = false to guarantee sequential execution order.
     */
    window.DNFL.loadAsset = function (path, type = 'js') {
        if (!path) return;

        // Determine if path is already a full absolute URL
        const isFullUrl = path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//');
        const activeBaseUrl = (type === 'css' && typeof BASE_CSS_URL !== 'undefined') ? BASE_CSS_URL : BASE_URL;
        const fullUrl = isFullUrl 
            ? path 
            : (activeBaseUrl.endsWith('/') ? `${activeBaseUrl}${path}` : `${activeBaseUrl}/${path}`);

        // Append version query parameter for cache busting on DNFL domain/raw assets
        const isExternalThirdParty = fullUrl.includes('cdnjs.cloudflare.com') || fullUrl.includes('cdn.jsdelivr.net');
        const cacheBustUrl = isExternalThirdParty 
            ? fullUrl 
            : (fullUrl.includes('?') ? `${fullUrl}&v=${FRAMEWORK_VERSION}` : `${fullUrl}?v=${FRAMEWORK_VERSION}`);

        const targetParent = document.head || document.getElementsByTagName('head')[0] || document.documentElement;

        if (type === 'css') {
            const cleanPathName = path.split('/').pop().split('?')[0];
            if (!document.querySelector(`link[href*="${cleanPathName}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = cacheBustUrl;
                targetParent.appendChild(link);
            }
        } else if (type === 'js') {
            const cleanPathName = path.split('/').pop().split('?')[0];
            if (!document.querySelector(`script[src*="${cleanPathName}"]`)) {
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = cacheBustUrl;
                script.async = false;
                targetParent.appendChild(script);
            }
        }
    };

    /**
     * Core Framework Helper Utilities
     */
    window.DNFL.getHost = function () {
        return window.location.host || 'www48.myfantasyleague.com';
    };

    window.DNFL.getYear = function () {
        // Priority 1: MFL global variables
        if (window.current_year) return String(window.current_year);
        if (window.mflYear) return String(window.mflYear);
        if (window.year) return String(window.year);

        // Priority 2: URL Query string parameter (e.g., ?YEAR=2024 or ?Y=2024)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('YEAR')) return urlParams.get('YEAR');
            if (urlParams.has('Y')) return urlParams.get('Y');
        } catch (e) {}

        // Priority 3: URL pathname match (e.g., /2024/home/...)
        const match = window.location.pathname.match(/\/(\d{4})\//);
        if (match && match[1]) return match[1];

        // Priority 4: Default current year fallback
        return String(new Date().getFullYear());
    };

    window.DNFL.getLeagueId = function () {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('L')) return urlParams.get('L');
        if (window.mflLeagueId) return String(window.mflLeagueId);
        if (window.league_id) return String(window.league_id);
        return '00000';
    };

    window.DNFL.normFranchiseId = function (val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    };

    window.DNFL.norm = function (val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s) return '';
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    };

    window.DNFL.getLoggedInFranchiseId = function () {
        // Tier 1: MFL global variable
        if (window.mflFranchiseId && window.mflFranchiseId !== '0000') {
            return window.DNFL.normFranchiseId(window.mflFranchiseId);
        }
        // Tier 2: MFL_USER_ID cookie parsing
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, val] = cookie.trim().split('=');
                if (name === 'MFL_USER_ID' && val) {
                    const parts = decodeURIComponent(val).split('%2C') || val.split(',');
                    if (parts.length >= 2 && parts[1]) {
                        return window.DNFL.normFranchiseId(parts[1]);
                    }
                }
            }
        } catch (e) {}
        // Tier 3: Query string parameter F
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('F')) {
            return window.DNFL.normFranchiseId(urlParams.get('F'));
        }
        // Tier 4: Global franchise_id fallback
        if (window.franchise_id) {
            return window.DNFL.normFranchiseId(window.franchise_id);
        }
        // Tier 5: Default unauthenticated
        return '0000';
    };

    /**
     * Module Registration & Auto-Initialization Lifecycle
     */
    window.DNFL.registerModule = function (name, moduleObj) {
        window.DNFL.modules[name] = moduleObj;
        console.log(`[DNFL Header] Module registered: ${name}`);
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (moduleObj && typeof moduleObj.init === 'function') {
                    try { moduleObj.init(); } catch (e) { console.error(`[DNFL Header] Error initializing ${name}:`, e); }
                }
            }, 0);
        }
    };

    window.DNFL.initAll = function () {
        Object.keys(window.DNFL.modules).forEach(name => {
            const mod = window.DNFL.modules[name];
            if (mod && typeof mod.init === 'function' && !mod._initialized) {
                try {
                    mod.init();
                    mod._initialized = true;
                } catch (e) {
                    console.error(`[DNFL Header] Auto-init error for ${name}:`, e);
                }
            }
        });
    };

    // Load Manifest Assets
    STYLES_TO_LOAD.forEach(cssUrl => window.DNFL.loadAsset(cssUrl, 'css'));
    SCRIPTS_TO_LOAD.forEach(jsUrl => window.DNFL.loadAsset(jsUrl, 'js'));

    // Trigger auto-initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.DNFL.initAll);
    } else {
        window.DNFL.initAll();
    }

    console.log(`[DNFL Header] Framework v${FRAMEWORK_VERSION} initialized from ${BASE_URL}`);
})();
