/* ==========================================================================
   DNFL API Client Middleware
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Architectural Features:
   1. Standalone DNFL.Cache Engine (IndexedDB/LocalStorage/RAM + BroadcastChannel cross-tab sync).
   2. Zero-dependency footprint (completely decoupled from mflscripts).
   3. Parameter-aware caching key generation & in-flight request deduplication.
   4. Single-pass league metadata bootstrapping & franchise resolution.
   5. Multi-tier TTL presets & quota eviction safeguard.
   6. 100% Backwards compatibility alias (window.DNFLClient).
   ========================================================================== */

(function (window, document) {
    'use strict';

    // ----------------------------------------------------------------------
    // Global Namespace Setup
    // ----------------------------------------------------------------------
    window.DNFL = window.DNFL || {};
    const DNFL = window.DNFL;

    // Sub-namespaces
    DNFL.UI = DNFL.UI || {};
    DNFL.Utils = DNFL.Utils || {};
    DNFL.leagueMetadata = DNFL.leagueMetadata || null;
    DNFL.franchiseMap = DNFL.franchiseMap || {};
    DNFL.currentFranchiseId = DNFL.currentFranchiseId || null;

    // Prevents double initialization
    if (DNFL.Client && DNFL.Client._initialized) {
        console.warn("[DNFL.Client] API Client already initialized.");
        return;
    }

    // ----------------------------------------------------------------------
    // Standalone DNFL.Cache Engine (Cross-Tab Sync & Decoupled Storage)
    // ----------------------------------------------------------------------
    const CACHE_PREFIX = 'dnfl_';
    const RAM_CACHE = new Map();
    let cacheChannel = null;

    try {
        if ('BroadcastChannel' in window) {
            cacheChannel = new BroadcastChannel('dnfl_cache_sync');
            cacheChannel.onmessage = (event) => {
                if (event.data && event.data.type === 'INVALIDATE') {
                    RAM_CACHE.delete(event.data.key);
                } else if (event.data && event.data.type === 'CLEAR') {
                    RAM_CACHE.clear();
                }
            };
        }
    } catch (e) {
        console.warn("[DNFL.Cache] BroadcastChannel unavailable:", e.message);
    }

    DNFL.Cache = {
        /**
         * Get item from RAM or LocalStorage if not expired
         */
        get: function (key) {
            const prefixedKey = CACHE_PREFIX + key;

            // 1. Check RAM Cache
            if (RAM_CACHE.has(prefixedKey)) {
                const ramItem = RAM_CACHE.get(prefixedKey);
                if (Date.now() < ramItem.expiry) {
                    return ramItem.value;
                }
                RAM_CACHE.delete(prefixedKey);
            }

            // 2. Check LocalStorage
            try {
                const raw = localStorage.getItem(prefixedKey);
                if (!raw) return null;

                const parsed = JSON.parse(raw);
                if (parsed.expiry && Date.now() > parsed.expiry) {
                    localStorage.removeItem(prefixedKey);
                    return null;
                }

                // Populate RAM for faster subsequent reads
                RAM_CACHE.set(prefixedKey, { value: parsed.value, expiry: parsed.expiry });
                return parsed.value;
            } catch (err) {
                console.warn(`[DNFL.Cache] Error reading key "${prefixedKey}":`, err.message);
                return null;
            }
        },

        /**
         * Set item in RAM and LocalStorage with TTL
         */
        set: function (key, value, ttlMs) {
            const prefixedKey = CACHE_PREFIX + key;
            const expiry = ttlMs && ttlMs > 0 ? Date.now() + ttlMs : 0;
            const payload = { value, expiry, timestamp: Date.now() };

            RAM_CACHE.set(prefixedKey, { value, expiry });

            try {
                localStorage.setItem(prefixedKey, JSON.stringify(payload));
            } catch (err) {
                console.warn(`[DNFL.Cache] LocalStorage set failed for "${prefixedKey}", triggering eviction...`, err.message);
                this.evictStale();
                try {
                    localStorage.setItem(prefixedKey, JSON.stringify(payload));
                } catch (retryErr) {
                    console.error(`[DNFL.Cache] LocalStorage quota exhausted. Storing in RAM only.`, retryErr.message);
                }
            }
        },

        /**
         * Invalidate specific key across RAM, LocalStorage, and open tabs
         */
        invalidate: function (key) {
            const prefixedKey = CACHE_PREFIX + key;
            RAM_CACHE.delete(prefixedKey);
            try {
                localStorage.removeItem(prefixedKey);
            } catch (e) {}

            if (cacheChannel) {
                cacheChannel.postMessage({ type: 'INVALIDATE', key: prefixedKey });
            }
        },

        /**
         * Evict expired dnfl_ keys from LocalStorage
         */
        evictStale: function () {
            const now = Date.now();
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX)) {
                    try {
                        const parsed = JSON.parse(localStorage.getItem(key));
                        if (parsed && parsed.expiry && now > parsed.expiry) {
                            keysToRemove.push(key);
                        }
                    } catch (e) {
                        keysToRemove.push(key);
                    }
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        }
    };

    // ----------------------------------------------------------------------
    // API Configuration & TTL Presets
    // ----------------------------------------------------------------------
    const CONFIG = {
        BASE_DOMAIN: 'https://dnfl.live',
        MFL_EXPORT_URL: 'https://www.myfantasyleague.com',
        DEFAULT_LEAGUE_ID: '22883',
        TTL: {
            REALTIME: 30 * 1000,          // 30 Seconds
            FIVE_MIN: 5 * 60 * 1000,      // 5 Minutes
            HOURLY: 60 * 60 * 1000,       // 1 Hour
            DAILY: 24 * 60 * 60 * 1000,   // 24 Hours
            WEEKLY: 7 * 24 * 60 * 60 * 1000, // 7 Days
            NEVER: 365 * 24 * 60 * 60 * 1000 // 1 Year
        }
    };

    const ACTIVE_FETCHES = new Map();

    // ----------------------------------------------------------------------
    // Context Resolution (League ID & Season Year)
    // ----------------------------------------------------------------------
    function resolveContext() {
        const urlParams = new URLSearchParams(window.location.search);
        let leagueId = urlParams.get('L') || window.mflLeagueId || window.league_id || CONFIG.DEFAULT_LEAGUE_ID;
        
        let year = urlParams.get('YEAR') || window.mflYear || window.year;
        if (!year) {
            const pathMatch = window.location.pathname.match(/\/(\d{4})\//);
            year = pathMatch ? pathMatch[1] : new Date().getFullYear().toString();
        }

        let leagueSegment = "0";
        if (window.location.host.includes("mflscripts.com") || window.location.pathname.includes("/LSM/")) {
            leagueSegment = "LSM";
        }

        return { leagueId, year, leagueSegment };
    }

    // ----------------------------------------------------------------------
    // Parameter-Aware Cache Key Builder
    // ----------------------------------------------------------------------
    function buildCacheKey(mflRequestType, params, context) {
        let paramSlug = '';
        if (params && typeof params === 'object') {
            const sortedKeys = Object.keys(params).filter(k => k !== 'TYPE' && k !== 'L' && k !== 'JSON').sort();
            if (sortedKeys.length > 0) {
                paramSlug = '_' + sortedKeys.map(k => `${k}${params[k]}`).join('_');
            }
        }
        return `${mflRequestType}_${context.leagueSegment}_Y${context.year}${paramSlug}`;
    }

    // ----------------------------------------------------------------------
    // Core Fetch Engine with Request Deduplication
    // ----------------------------------------------------------------------
    async function executeFetch(mflRequestType, params = {}, options = {}) {
        const context = resolveContext();
        const cacheKey = buildCacheKey(mflRequestType, params, context);
        const ttl = options.ttl !== undefined ? options.ttl : CONFIG.TTL.HOURLY;

        // 1. Check Cache
        if (!options.forceRefresh) {
            const cachedData = DNFL.Cache.get(cacheKey);
            if (cachedData !== null) {
                return cachedData;
            }
        }

        // 2. Request Deduplication (In-flight tracking)
        if (ACTIVE_FETCHES.has(cacheKey)) {
            return ACTIVE_FETCHES.get(cacheKey);
        }

        // 3. Build API Request URL
        const requestParams = new URLSearchParams({
            TYPE: mflRequestType,
            L: context.leagueId,
            JSON: '1',
            ...params
        });

        const targetUrl = `${CONFIG.MFL_EXPORT_URL}/${context.year}/export?${requestParams.toString()}`;

        const fetchPromise = (async () => {
            try {
                const response = await fetch(targetUrl);
                if (!response.ok) {
                    throw new Error(`[DNFL.Client] HTTP error ${response.status} fetching ${mflRequestType}`);
                }
                const json = await response.json();
                
                // Save to Cache
                DNFL.Cache.set(cacheKey, json, ttl);
                return json;
            } catch (error) {
                console.error(`[DNFL.Client] Failed to fetch ${mflRequestType}:`, error);
                throw error;
            } finally {
                ACTIVE_FETCHES.delete(cacheKey);
            }
        })();

        ACTIVE_FETCHES.set(cacheKey, fetchPromise);
        return fetchPromise;
    }

    // ----------------------------------------------------------------------
    // Single-Pass Metadata Bootstrapping
    // ----------------------------------------------------------------------
    async function bootstrapMetadata() {
        try {
            const data = await executeFetch('league', {}, { ttl: CONFIG.TTL.DAILY });
            if (data && data.league) {
                DNFL.leagueMetadata = data.league;
                const franchiseMap = {};
                
                if (data.league.franchises && data.league.franchises.franchise) {
                    const franchises = Array.isArray(data.league.franchises.franchise)
                        ? data.league.franchises.franchise
                        : [data.league.franchises.franchise];

                    franchises.forEach(f => {
                        franchiseMap[f.id] = {
                            id: f.id,
                            name: f.name || `Franchise ${f.id}`,
                            owner: f.owner_name || '',
                            icon: f.icon || '',
                            logo: f.logo || '',
                            division: f.division || '',
                            conference: f.conference || ''
                        };
                    });
                }
                DNFL.franchiseMap = franchiseMap;
                resolveUserSession();

                // Dispatch Custom Event
                window.dispatchEvent(new CustomEvent('dnfl:leagueLoaded', {
                    detail: { metadata: DNFL.leagueMetadata, franchiseMap: DNFL.franchiseMap }
                }));
            }
        } catch (err) {
            console.warn('[DNFL.Client] Metadata bootstrapping failed:', err.message);
        }
    }

    // ----------------------------------------------------------------------
    // User Session Resolution & DOM Highlighting
    // ----------------------------------------------------------------------
    function resolveUserSession() {
        let fId = window.franchise_id || null;
        if (!fId) {
            const urlParams = new URLSearchParams(window.location.search);
            fId = urlParams.get('FRANCHISE_ID') || urlParams.get('F');
        }
        if (!fId) {
            const match = document.cookie.match(/(?:^|; )mfl_franchise_id=([^;]*)/);
            if (match) fId = match[1];
        }

        if (fId) {
            DNFL.currentFranchiseId = fId.padStart(4, '0');
            highlightUserTeamRows();
            window.dispatchEvent(new CustomEvent('dnfl:userResolved', {
                detail: { franchiseId: DNFL.currentFranchiseId }
            }));
        }
    }

    function highlightUserTeamRows() {
        if (!DNFL.currentFranchiseId) return;
        const targetId = DNFL.currentFranchiseId;

        document.querySelectorAll(`tr[data-franchise="${targetId}"], tr[data-team="${targetId}"]`).forEach(el => {
            el.classList.add('dnfl-myfranchise', 'dnfl-my-team');
        });
    }

    // ----------------------------------------------------------------------
    // DNFL.Client Public API Definition
    // ----------------------------------------------------------------------
    DNFL.Client = {
        _initialized: true,
        TTL: CONFIG.TTL,

        fetchData: function (mflRequestType, params = {}, options = {}) {
            return executeFetch(mflRequestType, params, options);
        },

        fetchRawText: async function (url) {
            const cacheKey = `raw_${btoa(url).slice(-20)}`;
            const cached = DNFL.Cache.get(cacheKey);
            if (cached) return cached;

            const res = await fetch(url);
            if (!res.ok) throw new Error(`[DNFL.Client] Error ${res.status} fetching ${url}`);
            const text = await res.text();
            DNFL.Cache.set(cacheKey, text, CONFIG.TTL.HOURLY);
            return text;
        },

        getFranchise: function (franchiseId) {
            const paddedId = String(franchiseId).padStart(4, '0');
            return DNFL.franchiseMap[paddedId] || null;
        },

        getContext: resolveContext,
        bootstrap: bootstrapMetadata
    };

    // ----------------------------------------------------------------------
    // 100% Backwards Compatibility Alias
    // ----------------------------------------------------------------------
    window.DNFLClient = DNFL.Client;

    // Bootstrapping on script load
    bootstrapMetadata();

})(window, document);
