// dnfl-api-client-v5.js v5.0
/* ==========================================================================
   DNFL API Client, Storage Guard & Request Deduplication Engine v5.0
   Repository: rosario-jason/dnfl
   File: scripts/dnfl-api-client-v5.js
   ========================================================================== */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    /**
     * Helper to resolve active League ID across MFL environments
     */
    function getLeagueId() {
        let lid = window.league_id || window.mflLeagueId || window.current_league_id;
        if (!lid && window.location && window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            lid = urlParams.get('L') || urlParams.get('LEAGUE_ID') || urlParams.get('l');
        }
        if (!lid && document.cookie) {
            const cookieMatch = document.cookie.match(/(?:MFL_LEAGUE_ID|league_id)=([^;]+)/i);
            if (cookieMatch && cookieMatch[1]) {
                lid = decodeURIComponent(cookieMatch[1]).trim();
            }
        }
        return lid ? String(lid).trim() : null;
    }

    /**
     * Helper to resolve target season year
     */
    function getTargetYear() {
        let targetYear = window.current_year || null;
        if (!targetYear && window.location) {
            const pathSegments = window.location.pathname.split('/');
            const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
            targetYear = foundYear ? foundYear : new Date().getFullYear();
        }
        return targetYear || new Date().getFullYear();
    }

    const DNFLClient = {
        // Cache Tier Configurations (TTL in milliseconds)
        CACHE_CONFIGS: {
            weekly:        7 * 24 * 60 * 60 * 1000,
            daily:         24 * 60 * 60 * 1000,
            hourly:        1 * 60 * 60 * 1000,
            halfHourly:    30 * 60 * 1000,
            quarterHourly: 15 * 60 * 1000,
            realtime:      30 * 1000
        },

        // Master Centralized MFL Request Registry
        // Format: [frequency, MflRequestType, includeLeague, defaultArgs]
        MFL_REQUEST_REGISTRY: [
            ['daily',    'league',          true,  ''],
            ['daily',    'leagueStandings', true,  '&COLUMN_NAMES=1&ALL=1'],
            ['daily',    'rules',           true,  ''],
            ['daily',    'players',         true,  '&DETAILS=1'],
            ['daily',    'rosters',         true,  ''],
            ['hourly',   'playerScores',    true,  ''],
            ['hourly',   'projectedScores', true,  ''],
            ['hourly',   'weeklyResults',   true,  '']
        ],

        // Active Network Handshake Tracker (Request Deduplication)
        activeFetches: {},

        /**
         * Safe localStorage getter
         * @param {string} key 
         * @returns {string|null}
         */
        safeGetStorage(key) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                console.warn("[DNFL Client] LocalStorage access restricted or unavailable:", e.message);
                return null;
            }
        },

        /**
         * Safe localStorage setter with quota exception handling
         * @param {string} key 
         * @param {string} value 
         */
        safeSetStorage(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                console.warn("[DNFL Client] LocalStorage write failed or quota exceeded:", e.message);
            }
        },

        /**
         * Main MFL Export API fetcher with dynamic parameter support, TTL caching, and request deduplication
         * @param {string} MflRequestType 
         * @param {string} [extraParams=''] - Dynamic extra query string parameters (e.g. '&W=3' or '&W=YTD')
         * @returns {Promise<any>}
         */
        async fetchData(MflRequestType, extraParams = '') {
            let config = this.MFL_REQUEST_REGISTRY.find(row => row[1] === MflRequestType);
            
            // Fallback config if endpoint is not explicitly pre-registered
            if (!config) {
                console.warn(`[DNFL Client] Endpoint [${MflRequestType}] not found in static registry. Applying dynamic hourly configuration.`);
                config = ['hourly', MflRequestType, true, ''];
            }

            const [frequency, , includeLeague, defaultArgs] = config;
            const leagueId = getLeagueId();
            const targetYear = getTargetYear();
            const apiKey = window.apiKey || new URLSearchParams(window.location.search).get('APIKEY') || null;
            const activeHost = window.location.hostname || "myfantasyleague.com";

            if (includeLeague && !leagueId) {
                console.error(`DNFL Client Error: ${MflRequestType} requires an active League ID context.`);
                return null;
            }

            // Create parameter-aware cache key to handle parameterized queries (e.g., &W=3 vs &W=YTD)
            const leagueSegment = (includeLeague && leagueId) ? `L${leagueId}` : 'GLOBAL';
            const paramSlug = extraParams ? `_P${extraParams.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
            const cacheKey = `dnfl_${MflRequestType}_${leagueSegment}_Y${targetYear}${paramSlug}`;
            
            const cachedRecord = this.safeGetStorage(cacheKey);
            const currentTime = Date.now();
            const allowedTtl = this.CACHE_CONFIGS[frequency] || this.CACHE_CONFIGS.hourly;

            // Cache Hit: Serve instantly from browser memory if valid
            if (cachedRecord) {
                try {
                    const parsedRecord = JSON.parse(cachedRecord);
                    if (currentTime - parsedRecord.timestamp < allowedTtl) {
                        console.log(`[DNFLClient] Serving cached [${MflRequestType}${extraParams}] (Key: ${cacheKey})`);
                        return parsedRecord.payload;
                    }
                } catch (e) {
                    console.warn(`[DNFLClient] Corrupted cache record for [${cacheKey}]. Refetching...`);
                }
            }

            // Request Deduplication: If identical network call is active, join existing Promise
            if (this.activeFetches[cacheKey]) {
                console.log(`[DNFLClient] Bundling simultaneous fetch for [${cacheKey}]`);
                return this.activeFetches[cacheKey];
            }

            // Initiate Network Request via fetch() wrapped in a trackable Promise
            this.activeFetches[cacheKey] = (async () => {
                try {
                    let mflUrl = `https://${activeHost}/${targetYear}/export?TYPE=${MflRequestType}&JSON=1`;
                    if (includeLeague && leagueId) mflUrl += `&L=${leagueId.toString().trim()}`;
                    if (apiKey)                   mflUrl += `&APIKEY=${apiKey.toString().trim()}`;
                    if (defaultArgs)              mflUrl += defaultArgs.toString().trim();
                    if (extraParams)              mflUrl += extraParams.toString().trim();

                    console.log(`[DNFLClient] Initiating network fetch: ${mflUrl}`);
                    
                    const response = await fetch(mflUrl);
                    if (!response.ok) throw new Error(`MFL Server rejected connection request: HTTP ${response.status}`);
                    
                    const data = await response.json();

                    // Cache payload securely
                    const recordToCache = {
                        timestamp: currentTime,
                        payload: data
                    };
                    this.safeSetStorage(cacheKey, JSON.stringify(recordToCache));

                    return data;
                } catch (error) {
                    console.error(`DNFL Network Exception [${MflRequestType}]:`, error.message);
                    if (cachedRecord) {
                        try { return JSON.parse(cachedRecord).payload; } catch (e) {}
                    }
                    return null;
                } finally {
                    delete this.activeFetches[cacheKey];
                }
            })();

            return this.activeFetches[cacheKey];
        },

        /**
         * Generic Raw Text/CSV/Markdown fetcher with Request Deduplication
         * @param {string} url 
         * @returns {Promise<string>}
         */
        async fetchRawText(url) {
            if (this.activeFetches[url]) {
                console.log(`[DNFL Client] Bundling raw text fetch for ${url}`);
                return this.activeFetches[url];
            }

            this.activeFetches[url] = (async () => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    return await response.text();
                } catch (error) {
                    console.error(`DNFL Raw Fetch Exception [${url}]:`, error.message);
                    throw error;
                } finally {
                    delete this.activeFetches[url];
                }
            })();

            return this.activeFetches[url];
        }
    };

    // Export Client to Namespaces
    window.DNFL.Client = DNFLClient;
    window.DNFLClient = DNFLClient;
})();
