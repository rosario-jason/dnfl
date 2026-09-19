/* ==========================================================================
   DNFL API Client Middleware (v3.00-TEST4/TEST5)
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */

(function (window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};
    const DNFL = window.DNFL;

    DNFL.UI = DNFL.UI || {};
    DNFL.Utils = DNFL.Utils || {};
    DNFL.leagueMetadata = DNFL.leagueMetadata || null;
    DNFL.franchiseMap = DNFL.franchiseMap || {};
    DNFL.currentFranchiseId = DNFL.currentFranchiseId || null;

    if (DNFL.Client && DNFL.Client._initialized) {
        console.warn("[DNFL.Client] API Client already initialized.");
        return;
    }

    const CACHE_PREFIX = 'dnfl_';
    const RAM_CACHE = new Map();
    let cacheChannel = null;

    try {
        if ('BroadcastChannel' in window) {
            cacheChannel = new BroadcastChannel('dnfl_cache_sync');
            cacheChannel.onmessage = (event) => {
                if (!event.data) return;
                if (event.data.type === 'INVALIDATE') {
                    RAM_CACHE.delete(event.data.key);
                } else if (event.data.type === 'CLEAR') {
                    RAM_CACHE.clear();
                }
            };
        }
    } catch (e) {
        console.warn("[DNFL.Cache] BroadcastChannel initialized without cross-tab sync:", e.message);
    }

    DNFL.Cache = {
        get: function (key) {
            const prefixedKey = CACHE_PREFIX + key;
            if (RAM_CACHE.has(prefixedKey)) {
                const ramItem = RAM_CACHE.get(prefixedKey);
                if (Date.now() < ramItem.expiry) {
                    return ramItem.value;
                }
                RAM_CACHE.delete(prefixedKey);
            }

            try {
                const raw = localStorage.getItem(prefixedKey);
                if (!raw) return null;

                const parsed = JSON.parse(raw);
                if (parsed.expiry && Date.now() > parsed.expiry) {
                    localStorage.removeItem(prefixedKey);
                    return null;
                }

                RAM_CACHE.set(prefixedKey, { value: parsed.value, expiry: parsed.expiry });
                return parsed.value;
            } catch (err) {
                console.warn(`[DNFL.Cache] Failed to read key "${prefixedKey}":`, err.message);
                return null;
            }
        },

        set: function (key, value, ttlMs) {
            const prefixedKey = CACHE_PREFIX + key;
            const expiry = ttlMs && ttlMs > 0 ? Date.now() + ttlMs : 0;
            const payload = { value, expiry, timestamp: Date.now() };

            RAM_CACHE.set(prefixedKey, { value, expiry });

            try {
                localStorage.setItem(prefixedKey, JSON.stringify(payload));
            } catch (err) {
                console.warn(`[DNFL.Cache] LocalStorage quota limit for "${prefixedKey}". Evicting stale items...`);
                this.evictStale();
                try {
                    localStorage.setItem(prefixedKey, JSON.stringify(payload));
                } catch (retryErr) {
                    console.error(`[DNFL.Cache] LocalStorage quota exhausted. Stored in RAM only.`);
                }
            }
        },

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

    const CONFIG = {
        BASE_DOMAIN: 'https://dnfl.live',
        DEFAULT_LEAGUE_ID: '22883',
        TTL: {
            REALTIME: 30 * 1000,
            FIVE_MIN: 5 * 60 * 1000,
            HOURLY: 60 * 60 * 1000,
            DAILY: 24 * 60 * 60 * 1000,
            WEEKLY: 7 * 24 * 60 * 60 * 1000,
            NEVER: 365 * 24 * 60 * 60 * 1000
        }
    };

    const ACTIVE_FETCHES = new Map();

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

    function normalizeParams(params) {
        if (!params) return {};
        if (typeof params === 'object' && params !== null) {
            return { ...params };
        }
        if (typeof params === 'string') {
            const parsed = {};
            const cleanStr = params.replace(/^[&?]/, '');
            const searchParams = new URLSearchParams(cleanStr);
            searchParams.forEach((val, key) => {
                if (key) parsed[key] = val;
            });
            return parsed;
        }
        return {};
    }

    function buildExportUrl(context, mflRequestType, paramsObj) {
        const isMflHost = window.location.host && window.location.host.includes('myfantasyleague.com');
        const baseUrl = isMflHost 
            ? `${window.location.origin}/${context.year}/export`
            : `https://api.myfantasyleague.com/${context.year}/export`;

        const queryObj = {
            TYPE: mflRequestType,
            L: context.leagueId,
            JSON: '1',
            ...paramsObj
        };

        return `${baseUrl}?${new URLSearchParams(queryObj).toString()}`;
    }

    function buildCacheKey(mflRequestType, paramsObj, context) {
        let paramSlug = '';
        if (paramsObj && typeof paramsObj === 'object') {
            const sortedKeys = Object.keys(paramsObj)
                .filter(k => !['TYPE', 'L', 'JSON', 'YEAR'].includes(k))
                .sort();
            if (sortedKeys.length > 0) {
                paramSlug = '_' + sortedKeys.map(k => `${k}${paramsObj[k]}`).join('_');
            }
        }
        return `${mflRequestType}_${context.leagueSegment}_Y${context.year}${paramSlug}`;
    }

    function generateUrlCacheKey(url) {
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            hash = ((hash << 5) - hash) + url.charCodeAt(i);
            hash |= 0;
        }
        const cleanSlug = url.replace(/[^a-zA-Z0-9]/g, '_').slice(-30);
        return `raw_${cleanSlug}_${Math.abs(hash)}`;
    }

    async function executeFetch(mflRequestType, params = {}, options = {}) {
        const context = resolveContext();
        const normParams = normalizeParams(params);
        const cacheKey = buildCacheKey(mflRequestType, normParams, context);
        const ttl = options.ttl !== undefined ? options.ttl : CONFIG.TTL.HOURLY;

        if (!options.forceRefresh) {
            const cachedData = DNFL.Cache.get(cacheKey);
            if (cachedData !== null) {
                return cachedData;
            }
        }

        if (ACTIVE_FETCHES.has(cacheKey)) {
            return ACTIVE_FETCHES.get(cacheKey);
        }

        const targetUrl = buildExportUrl(context, mflRequestType, normParams);

        const fetchPromise = (async () => {
            try {
                const response = await fetch(targetUrl);
                if (!response.ok) {
                    throw new Error(`[DNFL.Client] HTTP ${response.status} fetching ${mflRequestType}`);
                }
                const json = await response.json();
                DNFL.Cache.set(cacheKey, json, ttl);
                return json;
            } catch (error) {
                console.error(`[DNFL.Client] Fetch error for ${mflRequestType}:`, error);
                throw error;
            } finally {
                ACTIVE_FETCHES.delete(cacheKey);
            }
        })();

        ACTIVE_FETCHES.set(cacheKey, fetchPromise);
        return fetchPromise;
    }

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
                        const paddedId = String(f.id).padStart(4, '0');
                        franchiseMap[paddedId] = {
                            id: paddedId,
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

                window.dispatchEvent(new CustomEvent('dnfl:leagueLoaded', {
                    detail: { metadata: DNFL.leagueMetadata, franchiseMap: DNFL.franchiseMap }
                }));
            }
        } catch (err) {
            console.warn('[DNFL.Client] Metadata bootstrap failed:', err.message);
        }
    }

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
            DNFL.currentFranchiseId = String(fId).padStart(4, '0');
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

    DNFL.Client = {
        _initialized: true,
        TTL: CONFIG.TTL,

        fetchData: function (mflRequestType, params = {}, options = {}) {
            return executeFetch(mflRequestType, params, options);
        },

        fetchRawText: async function (url) {
            const cacheKey = generateUrlCacheKey(url);
            const cached = DNFL.Cache.get(cacheKey);
            if (cached) return cached;

            const res = await fetch(url);
            if (!res.ok) throw new Error(`[DNFL.Client] HTTP ${res.status} fetching ${url}`);
            const text = await res.text();
            DNFL.Cache.set(cacheKey, text, CONFIG.TTL.HOURLY);
            return text;
        },

        getFranchise: function (franchiseId) {
            if (!franchiseId) return null;
            const paddedId = String(franchiseId).padStart(4, '0');
            return DNFL.franchiseMap[paddedId] || null;
        },

        getContext: resolveContext,
        bootstrap: bootstrapMetadata
    };

    window.DNFLClient = DNFL.Client;
    bootstrapMetadata();

})(window, document);
