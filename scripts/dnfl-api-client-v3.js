/**
 * ============================================================================
 * Duke Networking Fantasy League (DNFL) Framework API Client Middleware
 * ============================================================================
 */
(function () {
    'use strict';

    window.DNFLClient = window.DNFLClient || {};
    if (window.DNFL) {
        window.DNFL.Client = window.DNFLClient;
    }

    // In-memory cache for ultra-fast synchronous hits during session
    const memoryCache = new Map();
    // In-flight request deduplication registry
    const inFlightRequests = new Map();

    /**
     * Tiered TTL Durations (in milliseconds)
     */
    const TTL = {
        LIVE: 30 * 1000,            // 30 seconds for live scoring on game days
        INTRADAY: 15 * 60 * 1000,   // 15 minutes for rosters, injuries, transactions
        DAILY: 24 * 60 * 60 * 1000, // 24 hours for league setup, standings, schedules
        NEVER: 30 * 24 * 60 * 60 * 1000 // 30 days (Permanent) for past weeks & historical seasons
    };

    /**
     * Determine Cache TTL based on data type and game context
     */
    function getDynamicTTL(dataType, params = {}) {
        const currentYear = String(new Date().getFullYear());
        const targetYear = params.YEAR || (window.DNFL && window.DNFL.getYear ? window.DNFL.getYear() : currentYear);

        // Past season is permanently cached
        if (targetYear !== currentYear) {
            return TTL.NEVER;
        }

        // Past completed week is permanently cached
        if (params.W && window.mflCurrentWeek && Number(params.W) < Number(window.mflCurrentWeek)) {
            return TTL.NEVER;
        }

        // Active game day check (Sunday=0, Monday=1, Thursday=4)
        const dayOfWeek = new Date().getDay();
        const isGameDay = (dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 4);

        if (dataType === 'weeklyResults' || dataType === 'liveScoring') {
            return isGameDay ? TTL.LIVE : TTL.INTRADAY;
        }
        if (dataType === 'rosters' || dataType === 'injuries' || dataType === 'transactions') {
            return TTL.INTRADAY;
        }
        if (dataType === 'league' || dataType === 'leagueStandings' || dataType === 'nflSchedule') {
            return TTL.DAILY;
        }

        return TTL.INTRADAY;
    }

    /**
     * LocalStorage Helper with Expiration Management
     */
    function getCache(key) {
        // 1. Check in-memory map
        if (memoryCache.has(key)) {
            const memItem = memoryCache.get(key);
            return memItem;
        }
        // 2. Check localStorage
        try {
            const raw = localStorage.getItem(`dnfl_cache_${key}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            memoryCache.set(key, parsed);
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function setCache(key, data, ttlMs) {
        const cacheEntry = {
            timestamp: Date.now(),
            expiresAt: Date.now() + ttlMs,
            data: data
        };
        memoryCache.set(key, cacheEntry);
        try {
            localStorage.setItem(`dnfl_cache_${key}`, JSON.stringify(cacheEntry));
        } catch (e) {
            console.warn('[DNFLClient] localStorage write failed or full. Purging old cache...', e);
            purgeExpiredCache();
        }
    }

    function purgeExpiredCache() {
        try {
            const now = Date.now();
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('dnfl_cache_')) {
                    try {
                        const item = JSON.parse(localStorage.getItem(k));
                        if (item && item.expiresAt && now > item.expiresAt) {
                            keysToRemove.push(k);
                        }
                    } catch (err) {
                        keysToRemove.push(k);
                    }
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
    }

    /**
     * Construct MFL API Export URL
     */
    function buildMflUrl(dataType, params = {}) {
        const host = params.HOST || (window.DNFL && window.DNFL.getHost ? window.DNFL.getHost() : window.location.host || 'www48.myfantasyleague.com');
        const year = params.YEAR || (window.DNFL && window.DNFL.getYear ? window.DNFL.getYear() : '2026');
        const leagueId = params.L || (window.DNFL && window.DNFL.getLeagueId ? window.DNFL.getLeagueId() : '00000');

        let url = `https://${host}/${year}/export?TYPE=${dataType}&L=${leagueId}&JSON=1`;

        Object.keys(params).forEach(key => {
            if (!['HOST', 'YEAR', 'L'].includes(key)) {
                url += `&${key}=${encodeURIComponent(params[key])}`;
            }
        });

        return url;
    }

    /**
     * Public API: fetchData
     * Fetches MFL API endpoints with tiered caching, deduplication, and stale-while-revalidate.
     */
    window.DNFLClient.fetchData = async function (dataType, params = {}, options = {}) {
        const cacheKey = `${dataType}_${JSON.stringify(params)}`;
        const forceRefresh = options.force === true;
        const requestedTtl = options.ttl || getDynamicTTL(dataType, params);

        // Stale-While-Revalidate & Cache Lookup
        if (!forceRefresh) {
            const cached = getCache(cacheKey);
            if (cached && cached.data) {
                const isExpired = Date.now() > cached.expiresAt;
                if (!isExpired) {
                    return cached.data; // Instant Fresh Hit
                }
                // Stale-While-Revalidate: Return stale data immediately, trigger background refresh
                console.log(`[DNFLClient] Serving STALE cache for ${cacheKey}, refreshing in background...`);
                window.DNFLClient.fetchData(dataType, params, { force: true, ttl: requestedTtl }).catch(() => {});
                return cached.data;
            }
        }

        // Deduplicate in-flight network requests
        if (inFlightRequests.has(cacheKey)) {
            console.log(`[DNFLClient] In-flight deduplication hit for ${cacheKey}`);
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const targetUrl = buildMflUrl(dataType, params);
                console.log(`[DNFLClient] FETCHING: ${targetUrl}`);
                const response = await fetch(targetUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                }
                const json = await response.json();
                setCache(cacheKey, json, requestedTtl);
                return json;
            } catch (error) {
                console.error(`[DNFLClient] Fetch error for ${dataType}:`, error);
                // Fallback to stale data if available on network failure
                const stale = getCache(cacheKey);
                if (stale && stale.data) {
                    console.warn(`[DNFLClient] Returning stale fallback data after fetch failure for ${cacheKey}`);
                    return stale.data;
                }
                throw error;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    };

    /**
     * Public API: fetchRawText
     * Fetches raw text/JSON files (e.g. GitHub config feeds) with caching.
     */
    window.DNFLClient.fetchRawText = async function (url, options = {}) {
        const cacheKey = `raw_${url}`;
        const forceRefresh = options.force === true;
        const requestedTtl = options.ttl || TTL.INTRADAY;

        if (!forceRefresh) {
            const cached = getCache(cacheKey);
            if (cached && cached.data) {
                if (Date.now() <= cached.expiresAt) {
                    return cached.data;
                }
                // Background refresh
                window.DNFLClient.fetchRawText(url, { force: true, ttl: requestedTtl }).catch(() => {});
                return cached.data;
            }
        }

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                console.log(`[DNFLClient] FETCHING RAW: ${url}`);
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                }
                const text = await response.text();
                setCache(cacheKey, text, requestedTtl);
                return text;
            } catch (error) {
                console.error(`[DNFLClient] Raw fetch error for ${url}:`, error);
                const stale = getCache(cacheKey);
                if (stale && stale.data) return stale.data;
                throw error;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    };

    /**
     * Public Utility Methods
     */
    window.DNFLClient.clearCache = function () {
        memoryCache.clear();
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('dnfl_cache_')) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            console.log('[DNFLClient] Local cache cleared manually.');
        } catch (e) {}
    };

    window.DNFLClient.getHost = function () {
        return window.DNFL && window.DNFL.getHost ? window.DNFL.getHost() : window.location.host || 'www48.myfantasyleague.com';
    };

    window.DNFLClient.getYear = function () {
        if (window.DNFL && window.DNFL.getYear) return window.DNFL.getYear();
        try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('YEAR')) return urlParams.get('YEAR');
            if (urlParams.has('Y')) return urlParams.get('Y');
        } catch (e) {}
        const match = window.location.pathname.match(/\/(\d{4})\//);
        if (match && match[1]) return match[1];
        return String(new Date().getFullYear());
    };

    window.DNFLClient.getLeagueId = function () {
        return window.DNFL && window.DNFL.getLeagueId ? window.DNFL.getLeagueId() : '00000';
    };

    window.DNFLClient.getLoggedInFranchiseId = function () {
        return window.DNFL && window.DNFL.getLoggedInFranchiseId ? window.DNFL.getLoggedInFranchiseId() : '0000';
    };

    window.DNFLClient.normFranchiseId = function (id) {
        return window.DNFL && window.DNFL.normFranchiseId ? window.DNFL.normFranchiseId(id) : String(id || '0000').padStart(4, '0');
    };

    window.DNFLClient.norm = function (id) {
        return window.DNFL && window.DNFL.norm ? window.DNFL.norm(id) : String(id || '00').padStart(2, '0');
    };

    console.log('[DNFLClient] API Client v3.00 Middleware loaded.');
})();
