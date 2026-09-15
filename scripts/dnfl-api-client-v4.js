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
     * Feature 2: IndexedDB Storage Engine (with localStorage Fallback)
     */
    const DB_NAME = 'DNFL_Cache_DB';
    const DB_VERSION = 1;
    const STORE_NAME = 'cache_store';
    let dbInstance = null;

    function openIDB() {
        if (dbInstance) return Promise.resolve(dbInstance);
        if (typeof indexedDB === 'undefined') return Promise.resolve(null);

        return new Promise((resolve) => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    }
                };
                request.onsuccess = (e) => {
                    dbInstance = e.target.result;
                    resolve(dbInstance);
                };
                request.onerror = (err) => {
                    console.warn('[DNFLClient] IndexedDB open error, falling back to localStorage:', err);
                    resolve(null);
                };
            } catch (err) {
                console.warn('[DNFLClient] IndexedDB exception:', err);
                resolve(null);
            }
        });
    }

    async function getCacheEntry(key) {
        // 1. Check in-memory cache first (instant hit)
        if (memoryCache.has(key)) {
            return memoryCache.get(key);
        }

        // 2. Try IndexedDB
        try {
            const db = await openIDB();
            if (db) {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const item = await new Promise((resolve) => {
                    const req = store.get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                });
                if (item && item.value) {
                    memoryCache.set(key, item.value);
                    return item.value;
                }
            }
        } catch (e) {
            console.warn('[DNFLClient] IndexedDB read error:', e);
        }

        // 3. Fallback to localStorage
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

    async function setCacheEntry(key, data, ttlMs, dataType = '', params = {}, fromSync = false) {
        const timestamp = getBucketTimestamp(ttlMs);
        const expiresAt = timestamp + ttlMs;
        const cacheEntry = {
            timestamp,
            expiresAt,
            data,
            dataType,
            params
        };

        // 1. Memory Cache
        memoryCache.set(key, cacheEntry);

        // 2. IndexedDB
        try {
            const db = await openIDB();
            if (db) {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ key: key, value: cacheEntry });
            }
        } catch (e) {
            console.warn('[DNFLClient] IndexedDB write error:', e);
        }

        // 3. Backup to localStorage for backwards compatibility
        try {
            localStorage.setItem(`dnfl_cache_${key}`, JSON.stringify(cacheEntry));
        } catch (e) {
            purgeExpiredLocalStorage();
        }

        // Feature 3: Cross-Tab Broadcast Sync
        if (!fromSync && broadcastChannel) {
            try {
                broadcastChannel.postMessage({
                    type: 'CACHE_UPDATE',
                    key,
                    cacheEntry
                });
            } catch (e) {
                console.warn('[DNFLClient] BroadcastChannel postMessage error:', e);
            }
        }

        // Feature 3: Dispatch Reactive DOM Event
        signalMFLCacheUpdate(dataType, params, data);
    }

    function purgeExpiredLocalStorage() {
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
     * Feature 1: Cross-Tab Broadcast Synchronization (BroadcastChannel)
     */
    const broadcastChannel = (typeof BroadcastChannel !== 'undefined')
        ? new BroadcastChannel('DNFL_Cache_BC')
        : null;

    if (broadcastChannel) {
        broadcastChannel.onmessage = (event) => {
            if (!event || !event.data) return;
            const { type, key, cacheEntry } = event.data;

            if (type === 'CACHE_UPDATE' && key && cacheEntry) {
                console.log(`[DNFLClient] Cross-Tab Sync received update for key: ${key}`);
                memoryCache.set(key, cacheEntry);
                
                // Save to local storage/IDB asynchronously without re-broadcasting
                setCacheEntry(key, cacheEntry.data, cacheEntry.expiresAt - cacheEntry.timestamp, cacheEntry.dataType, cacheEntry.params, true).catch(() => {});
            }
        };
    }

    /**
     * Feature 3: Reactive DOM Events (MFLCacheUpdate)
     * Dispatches custom event so UI components can update reactively on background cache refreshes
     */
    function signalMFLCacheUpdate(dataType, params, data) {
        try {
            const eventDetail = {
                dataType: dataType || 'general',
                params: params || {},
                data: data || null,
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
     * Fetches MFL API endpoints with tiered caching, deduplication, BroadcastChannel sync, and Stale-While-Revalidate.
     */
    window.DNFLClient.fetchData = async function (dataType, params = {}, options = {}) {
        const resolved = getResolvedParams(params);
        const cacheKey = `${dataType}_${resolved.YEAR}_${resolved.L}_${JSON.stringify(params)}`;
        const forceRefresh = options.force === true;
        const requestedTtl = options.ttl || getDynamicTTL(dataType, params);

        // Stale-While-Revalidate & Cache Lookup
        if (!forceRefresh) {
            const cached = await getCacheEntry(cacheKey);
            if (cached && cached.data) {
                const isExpired = Date.now() > cached.expiresAt;
                if (!isExpired) {
                    return cached.data; // Instant Fresh Hit
                }
                // Stale-While-Revalidate: Serve stale data instantly, refresh in background
                console.log(`[DNFLClient] Serving STALE cache for ${cacheKey}, refreshing in background...`);
                window.DNFLClient.fetchData(dataType, params, { force: true, ttl: requestedTtl }).catch(() => {});
                return cached.data;
            }
        }

        // Deduplicate in-flight network requests across caller threads in current tab
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
                await setCacheEntry(cacheKey, json, requestedTtl, dataType, params);
                return json;
            } catch (error) {
                console.error(`[DNFLClient] Fetch error for ${dataType}:`, error);
                // Fallback to stale data if available on network failure
                const stale = await getCacheEntry(cacheKey);
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
            const cached = await getCacheEntry(cacheKey);
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
                await setCacheEntry(cacheKey, text, requestedTtl, 'raw', { url });
                return text;
            } catch (error) {
                console.error(`[DNFLClient] Raw fetch error for ${url}:`, error);
                const stale = await getCacheEntry(cacheKey);
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
    window.DNFLClient.clearCache = async function () {
        memoryCache.clear();
        try {
            const db = await openIDB();
            if (db) {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).clear();
            }
        } catch (e) {}

        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('dnfl_cache_')) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            console.log('[DNFLClient] Local & IndexedDB cache cleared manually.');
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

    console.log('[DNFLClient] API Client v3.10 Middleware (IndexedDB, BroadcastChannel, MFLCacheUpdate, TimeBucketing) loaded.');
})();
