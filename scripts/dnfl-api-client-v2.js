// dnfl-api-client-v2.js v1.0
/* ==========================================================================
   DNFL API Client, Storage Guard & Request Deduplication Engine
   ========================================================================== */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

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

        // Dynamic API Request Registry Layout
        MFL_REQUEST_REGISTRY: [
            ['daily', 'league',          true,  ''],
            ['daily', 'leagueStandings', true,  '&COLUMN_NAMES=1&ALL=1'],
            ['daily', 'rules',           true,  '']
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
         * Main MFL Export API fetcher with TTL caching and request deduplication
         * @param {string} MflRequestType 
         * @returns {Promise<any>}
         */
        async fetchData(MflRequestType) {
            // FIX: Search by index 1 of each registry row array
            const config = this.MFL_REQUEST_REGISTRY.find(row => row[1] === MflRequestType);
            
            if (!config) {
                console.error(`DNFL Client Error: Request type [${MflRequestType}] not defined in registry.`);
                return null;
            }

            const [frequency, , includeLeague, mflArgs] = config;
            const leagueId = window.league_id || null;
            const apiKey = window.apiKey || new URLSearchParams(window.location.search).get('APIKEY') || null;
            const activeHost = window.location.hostname || "myfantasyleague.com";

            let targetYear = window.current_year || null;
            if (!targetYear) {
                const pathSegments = window.location.pathname.split('/');
                const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
                targetYear = foundYear ? foundYear : new Date().getFullYear();
            }

            if (includeLeague && !leagueId) {
                console.error(`DNFL Client Error: ${MflRequestType} requires an active League ID context.`);
                return null;
            }

            const leagueSegment = (includeLeague && leagueId) ? `L${leagueId}` : 'GLOBAL';
            const cacheKey = `dnfl_${MflRequestType}_${leagueSegment}_Y${targetYear}`;
            
            const cachedRecord = this.safeGetStorage(cacheKey);
            const currentTime = Date.now();
            const allowedTtl = this.CACHE_CONFIGS[frequency];

            // Cache Hit: Serve instantly from browser memory if valid
            if (cachedRecord) {
                try {
                    const parsedRecord = JSON.parse(cachedRecord);
                    if (currentTime - parsedRecord.timestamp < allowedTtl) {
                        console.log(`[${MflRequestType}] - Loading from DNFL browser cache`);
                        return parsedRecord.payload;
                    }
                } catch (e) {
                    console.warn(`[${MflRequestType}] - Corrupted cache record. Refetching...`);
                }
            }

            // Deduplicator Engine: If identical request is active, join existing Promise
            if (this.activeFetches[cacheKey]) {
                console.log(`[${MflRequestType}] - Simultaneous call detected. Bundling with existing network stream.`);
                return this.activeFetches[cacheKey];
            }

            // Initiate Single Network Request wrapped in a trackable Promise
            this.activeFetches[cacheKey] = (async () => {
                try {
                    console.log(`[${MflRequestType}] - API request from https://${activeHost}/${targetYear}/export?TYPE=${MflRequestType}`);
                    
                    let mflUrl = `https://${activeHost}/${targetYear}/export?TYPE=${MflRequestType}&JSON=1`;
                    if (includeLeague && leagueId) mflUrl += `&L=${leagueId.toString().trim()}`;
                    if (apiKey)                   mflUrl += `&APIKEY=${apiKey.toString().trim()}`;
                    if (mflArgs)                  mflUrl += mflArgs.toString().trim();
                    
                    const response = await fetch(mflUrl);
                    if (!response.ok) throw new Error("MFL Server rejected connection request.");
                    
                    const data = await response.json();

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