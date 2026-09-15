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

    // Fast synchronous in-memory cache
    const memoryCache = new Map();
    // In-flight request deduplication registry
    const inFlightRequests = new Map();

    /**
     * Feature 1: Multi-Tab Broadcast Synchronization Channel
     */
    const bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('DNFL_Cache_BC') : null;
    if (bc) {
        bc.onmessage = function (event) {
            if (event.data && event.data.type === 'CACHE_UPDATE' && event.data.key) {
                const { key, cacheEntry, dataType, params } = event.data;
                memoryCache.set(key, cacheEntry);
                console.log(`[DNFLClient] Broadcast message received from another tab for key: ${key}`);
                dispatchReactiveEvent(dataType, params, cacheEntry.data, 'broadcast');
            }
        };
    }

    /**
     * Feature 2: IndexedDB Storage Layer Initialization
     */
    const DB_NAME = 'DNFL_Cache_DB';
    const DB_VERSION = 1;
    const STORE_NAME = 'api_cache';
    let dbPromise = null;

    function initIndexedDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve) => {
                if (typeof indexedDB === 'undefined') {
                    console.warn('[DNFLClient] IndexedDB not supported. Falling back to localStorage.');
                    resolve(null);
                    return;
                }
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = function (e) {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    }
                };
                request.onsuccess = function (e) {
                    const db = e.target.result;
                    console.log('[DNFLClient] IndexedDB initialized successfully.');
                    resolve(db);
                };
                request.onerror = function (e) {
                    console.warn('[DNFLClient] IndexedDB open error. Falling back to localStorage:', e);
                    resolve(null);
                };
            });
        }
        return dbPromise;
    }

    async function idbGet(key) {
        const db = await initIndexedDB();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result ? req.result.value : null);
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    }

    async function idbSet(key, cacheEntry) {
        const db = await initIndexedDB();
        if (!db) return;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ key: key, value: cacheEntry });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    }

    async function idbClear() {
        const db = await initIndexedDB();
        if (!db) return;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.clear();
                tx.oncomplete = () => resolve(true);
            } catch (e) {
                resolve(false);
            }
        });
    }

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
     * Feature 4: Deterministic Time Bucketing
     * Rounds request timestamps into fixed time intervals based on TTL.
     * Prevents staggered cache keys/expiration offsets for concurrent requests.
     */
    function getTimeBucketSize(ttlMs) {
        if (ttlMs <= TTL.LIVE) return 15 * 1000;          // 15-second bucket
        if (ttlMs <= TTL.INTRADAY) return 5 * 60 * 1000;   // 5-minute bucket
        if (ttlMs <= TTL.DAILY) return 60 * 60 * 1000;     // 1-hour bucket
        return 24 * 60 * 60 * 1000;                        // 1-day bucket
    }

    function getBucketTimestamp(ttlMs) {
        const now = Date.now();
        const bucketSize = getTimeBucketSize(ttlMs);
        return Math.floor(now / bucketSize) * bucketSize;
    }

    /**
     * Determine Cache TTL based on data type and game context
     */
    function getDynamicTTL(dataType, params = {}) {
        const resolved = getResolvedParams(params);
        const currentYear = String(new Date().getFullYear());
        const targetYear = String(resolved.YEAR);

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
     * Feature 3: Reactive DOM Events Dispatcher
     */
    function dispatchReactiveEvent(dataType, params, data, source = 'api') {
        try {
            const eventDetail = {
                dataType: dataType,
                params: params,
                data: data,
                source: source,
                timestamp: Date.now()
            };
            window.dispatchEvent(new CustomEvent('MFLCacheUpdate', { detail: eventDetail }));
        } catch (e) {
            console.warn('[DNFLClient] Error dispatching MFLCacheUpdate event:', e);
        }
    }

    /**
     * Resolve Full Request Context (Host, Year, League ID)
     */
    function getResolvedParams(params = {}) {
        const host = params.HOST || (window.DNFL && window.DNFL.getHost ? window.DNFL.getHost() : window.location.host || 'www48.myfantasyleague.com');
        const year = params.YEAR || (window.DNFL && window.DNFL.getYear ? window.DNFL.getYear() : '2026');
        const leagueId = params.L || (window.DNFL && window.DNFL.getLeagueId ? window.DNFL.getLeagueId() : '00000');
        return {
            ...params,
            HOST: host,
            YEAR: year,
            L: leagueId
        };
    }

    /**
     * Dual Storage Cache Resolver (Memory -> IndexedDB -> LocalStorage)
     */
    async function getCacheAsync(key) {
        // 1. Check in-memory map
        if (memoryCache.has(key)) {
            return memoryCache.get(key);
        }
        // 2. Check IndexedDB
        const idbResult = await idbGet(key);
        if (idbResult) {
            memoryCache.set(key, idbResult);
            return idbResult;
        }
        // 3. Fallback to LocalStorage
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

    function setCache(key, data, ttlMs, dataType, params) {
        const bucketedTimestamp = getBucketTimestamp(ttlMs);
        const cacheEntry = {
            timestamp: bucketedTimestamp,
            expiresAt: bucketedTimestamp + ttlMs,
            data: data
        };

        // 1. In-Memory
        memoryCache.set(key, cacheEntry);

        // 2. IndexedDB (Asynchronous)
        idbSet(key, cacheEntry).catch(() => {});

        // 3. LocalStorage Fallback
        try {
            localStorage.setItem(`dnfl_cache_${key}`, JSON.stringify(cacheEntry));
        } catch (e) {
            console.warn('[DNFLClient] LocalStorage write warning:', e);
        }

        // 4. Cross-Tab Broadcast Sync
        if (bc) {
            bc.postMessage({
                type: 'CACHE_UPDATE',
                key: key,
                cacheEntry: cacheEntry,
                dataType: dataType,
                params: params
            });
            console.log(`[DNFLClient] Broadcasted update for ${key}`);
        }

        // 5. Reactive DOM Event
        dispatchReactiveEvent(dataType, params, data, 'api');
    }

    /**
     * Construct MFL API Export URL
     */
    function buildMflUrl(dataType, params = {}) {
        const resolved = getResolvedParams(params);
        let url = `https://${resolved.HOST}/${resolved.YEAR}/export?TYPE=${dataType}&L=${resolved.L}&JSON=1`;

        Object.keys(params).forEach(key => {
            if (!['HOST', 'YEAR', 'L'].includes(key)) {
                url += `&${key}=${encodeURIComponent(params[key])}`;
            }
        });

        return url;
    }

    /**
     * Public API: fetchData
     */
    window.DNFLClient.fetchData = async function (dataType, params = {}, options = {}) {
        const resolved = getResolvedParams(params);
        const cacheKey = `${dataType}_${resolved.YEAR}_${resolved.L}_${JSON.stringify(params)}`;
        const forceRefresh = options.force === true;
        const requestedTtl = options.ttl || getDynamicTTL(dataType, params);

        // Stale-While-Revalidate & Cache Lookup
        if (!forceRefresh) {
            const cached = await getCacheAsync(cacheKey);
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
                setCache(cacheKey, json, requestedTtl, dataType, params);
                return json;
            } catch (error) {
                console.error(`[DNFLClient] Fetch error for ${dataType}:`, error);
                const stale = await getCacheAsync(cacheKey);
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
     */
    window.DNFLClient.fetchRawText = async function (url, options = {}) {
        const cacheKey = `raw_${url}`;
        const forceRefresh = options.force === true;
        const requestedTtl = options.ttl || TTL.INTRADAY;

        if (!forceRefresh) {
            const cached = await getCacheAsync(cacheKey);
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
                setCache(cacheKey, text, requestedTtl, 'rawText', { url });
                return text;
            } catch (error) {
                console.error(`[DNFLClient] Raw fetch error for ${url}:`, error);
                const stale = await getCacheAsync(cacheKey);
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
        idbClear().catch(() => {});
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('dnfl_cache_')) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            console.log('[DNFLClient] Local and IndexedDB cache cleared manually.');
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

    window.DNFLClient.normFranchiseId = function (val) {
        if (window.DNFL && window.DNFL.normFranchiseId) return window.DNFL.normFranchiseId(val);
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    };

    window.DNFLClient.norm = function (val) {
        if (window.DNFL && window.DNFL.norm) return window.DNFL.norm(val);
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s) return '';
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    };

    console.log('[DNFLClient] API Client v4.00 Middleware loaded (IndexedDB + BroadcastChannel enabled).');
})();
