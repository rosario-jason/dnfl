/* ==========================================================================
   DNFL Central API Middleware & Storage Engine
   Repository: rosario-jason/dnfl
   File: scripts/dnfl-api-client.js
   Architecture: Production-Ready, Parameter-Aware Caching, Request Deduplication,
                 Single-Pass Metadata Bootstrapping, and Custom Event Lifecycle.
   ========================================================================== */

(function(window, document) {
    'use strict';

    // 1. GLOBAL NAMESPACE INITIALIZATION & SUB-ENCLAVES
    window.DNFL = window.DNFL || {};
    window.DNFL.UI = window.DNFL.UI || {};
    window.DNFL.Utils = window.DNFL.Utils || {};

    /* --------------------------------------------------------------------------
     * DNFL UTILITIES (DNFL.Utils)
     * -------------------------------------------------------------------------- */
    
    /**
     * Normalizes franchise/division/conference IDs to 4-digit zero-padded strings
     * @param {string|number} id 
     * @returns {string} 4-digit zero-padded ID (e.g., '0018')
     */
    window.DNFL.Utils.normId = function(id) {
        if (id === null || id === undefined || id === '') return '';
        const str = String(id).trim();
        if (!str || str.toUpperCase() === 'BYE' || str.toUpperCase() === 'AVG') return str.toUpperCase();
        return str.padStart(4, '0');
    };

    /**
     * Formats numbers into US locale strings with fixed precision
     * @param {number|string} val 
     * @param {number} decimals 
     * @returns {string} Formatted number string (e.g. '1,234.56')
     */
    window.DNFL.Utils.formatNumber = function(val, decimals = 2) {
        const num = parseFloat(val);
        if (isNaN(num)) return (0).toFixed(decimals);
        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    /**
     * MutationObserver-based helper for binding event listeners or reacting to dynamic MFL AJAX renders
     * @param {string} selector DOM selector string to watch for
     * @param {function} callback Function executed when matching element is found in DOM
     * @param {Object} options Observer configuration options
     */
    window.DNFL.Utils.onElementReady = function(selector, callback, options = {}) {
        if (typeof callback !== 'function') return;

        const existingEl = document.querySelector(selector);
        if (existingEl) {
            callback(existingEl);
            if (!options.continuous) return;
        }

        const targetNode = options.targetNode || document.body || document.documentElement;
        const observer = new MutationObserver(function(mutations, obs) {
            const el = document.querySelector(selector);
            if (el) {
                callback(el);
                if (!options.continuous) {
                    obs.disconnect();
                }
            }
        });

        observer.observe(targetNode, {
            childList: true,
            subtree: true,
            attributes: options.attributes || false
        });

        return observer;
    };


    /* --------------------------------------------------------------------------
     * DNFL API CLIENT CLASS (DNFLClient)
     * -------------------------------------------------------------------------- */

    class DNFLApiClient {
        constructor() {
            // Versioning
            this.version = "6.00";

            // In-flight fetch registry for Promise Deduplication
            this.activeFetches = new Map();

            // In-memory cache tier for instant sync hits
            this.memoryCache = new Map();

            // Cached core league metadata (Single-Pass Bootstrapping)
            this.leagueMetadata = null;
            this.franchiseMap = {};
            this.isMetadataBootstrapped = false;

            // Logged-in User Franchise Session
            this.userFranchiseId = null;

            // TTL Presets (in seconds)
            this.TTL = {
                REALTIME: 20,         // 20s (Live Scoring)
                FIVE_MIN: 300,        // 5m (Rosters / Transactions)
                FIFTEEN_MIN: 900,     // 15m (Weather / Articles)
                HOURLY: 3600,         // 1 hour
                SIX_HOUR: 21600,      // 6 hours
                DAILY: 86400,         // 24 hours (League structure / Standings)
                WEEKLY: 604800,       // 7 days
                NEVER: 2592000        // 30 days
            };

            // Base URL Resolution
            this.baseUrl = this._resolveBaseUrl();
            this.year = this._resolveYear();
            this.leagueId = this._resolveLeagueId();

            // Resolve User Session & Auto-Highlight
            this.resolveUserFranchiseId();
        }

        /**
         * Resolves the MFL dynamic base URL
         * @private
         */
        _resolveBaseUrl() {
            if (typeof window.baseURLDynamic !== 'undefined' && window.baseURLDynamic) {
                return window.baseURLDynamic;
            }
            const host = window.location.host;
            const protocol = window.location.protocol;
            return `${protocol}//${host}`;
        }

        /**
         * Resolves current MFL Season Year
         * @private
         */
        _resolveYear() {
            if (typeof window.year !== 'undefined' && window.year) {
                return String(window.year);
            }
            if (typeof window.current_year !== 'undefined' && window.current_year) {
                return String(window.current_year);
            }
            const pathSegments = window.location.pathname.split('/');
            const foundYear = pathSegments.find(seg => /^20\d{2}$/.test(seg));
            if (foundYear) return foundYear;
            return String(new Date().getFullYear());
        }

        /**
         * Resolves current MFL League ID
         * @private
         */
        _resolveLeagueId() {
            if (typeof window.league_id !== 'undefined' && window.league_id) {
                return String(window.league_id);
            }
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('L')) return urlParams.get('L');
            const match = window.location.pathname.match(/\/home\/(\d+)/);
            if (match) return match[1];
            return '00000'; // Default fallback
        }

        /**
         * Resolves the logged-in manager's Franchise ID
         */
        resolveUserFranchiseId() {
            let rawFid = null;

            // 1. Inspect MFL Global Variable
            if (typeof window.franchise_id !== 'undefined' && window.franchise_id) {
                rawFid = window.franchise_id;
            }
            // 2. Inspect URL Parameters
            if (!rawFid) {
                const urlParams = new URLSearchParams(window.location.search);
                rawFid = urlParams.get('FRANCHISE') || urlParams.get('F') || urlParams.get('FID');
            }
            // 3. Inspect LocalStorage / Cookie hints
            if (!rawFid) {
                try {
                    rawFid = localStorage.getItem(`dnfl_fid_${this.leagueId}`) || localStorage.getItem('mfl_user_fid');
                } catch (e) {}
            }

            if (rawFid && rawFid !== '0000') {
                this.userFranchiseId = window.DNFL.Utils.normId(rawFid);
                window.DNFL.userFranchiseId = this.userFranchiseId;

                // Dispatch custom lifecycle event
                window.dispatchEvent(new CustomEvent('dnfl:userResolved', {
                    detail: { userFranchiseId: this.userFranchiseId }
                }));

                // Highlight manager's row in DOM
                this.highlightUserFranchiseRows();
            }

            return this.userFranchiseId;
        }

        /**
         * Automatically applies CSS highlight classes (.dnfl-myfranchise / .dnfl-my-team)
         * @param {Element|Document} container 
         */
        highlightUserFranchiseRows(container = document) {
            if (!this.userFranchiseId) return;
            const fid = this.userFranchiseId;
            const normFid = window.DNFL.Utils.normId(fid);

            const selectors = [
                `tr[data-franchise-id="${normFid}"]`,
                `tr[data-fid="${normFid}"]`,
                `tr.franchise_${normFid}`,
                `tr.fid_${normFid}`
            ];

            try {
                const rows = container.querySelectorAll(selectors.join(', '));
                rows.forEach(row => {
                    row.classList.add('dnfl-myfranchise', 'dnfl-my-team');
                });
            } catch (e) {
                // Non-fatal DOM query guard
            }
        }

        /**
         * Formulates parameter-aware cache keys
         * Formula: dnfl_${MflRequestType}_${leagueSegment}_Y${targetYear}${paramSlug}
         */
        generateCacheKey(requestType, targetYear, leagueId, paramsStr = '') {
            const cleanType = String(requestType).trim();
            const seg = leagueId ? `L${leagueId}` : `L${this.leagueId}`;
            const yr = targetYear ? targetYear : this.year;

            // Sanitize query string params into deterministic slug
            let paramSlug = '';
            if (paramsStr) {
                const cleanParams = String(paramsStr)
                    .replace(/^\?/, '')
                    .replace(/^&/, '')
                    .split('&')
                    .sort()
                    .filter(Boolean)
                    .join('_')
                    .replace(/=/g, '');
                if (cleanParams) {
                    paramSlug = `_${cleanParams}`;
                }
            }

            return `dnfl_${cleanType}_${seg}_Y${yr}${paramSlug}`;
        }

        /**
         * Safe LocalStorage Item Setter with Quota Exceeded & Eviction Guard
         */
        safeLocalStorageSet(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (err) {
                if (err instanceof DOMException && (
                    err.code === 22 ||
                    err.code === 1014 ||
                    err.name === 'QuotaExceededError' ||
                    err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
                )) {
                    console.warn(`[DNFL Cache] LocalStorage quota exceeded writing key: ${key}. Evicting stale entries...`);
                    this.evictStaleLocalStorage();
                    try {
                        localStorage.setItem(key, value);
                        return true;
                    } catch (retryErr) {
                        console.warn(`[DNFL Cache] LocalStorage still full after eviction. Key not cached: ${key}`);
                    }
                }
                return false;
            }
        }

        /**
         * Purges expired 'dnfl_' keys from LocalStorage
         */
        evictStaleLocalStorage() {
            const now = Date.now();
            const keysToRemove = [];

            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('dnfl_')) {
                        try {
                            const raw = localStorage.getItem(k);
                            if (!raw) {
                                keysToRemove.push(k);
                                continue;
                            }
                            const entry = JSON.parse(raw);
                            if (!entry || !entry.storedAt || !entry.ttlMs) {
                                keysToRemove.push(k);
                                continue;
                            }
                            if (now - entry.storedAt > entry.ttlMs) {
                                keysToRemove.push(k);
                            }
                        } catch (e) {
                            keysToRemove.push(k);
                        }
                    }
                }

                keysToRemove.forEach(k => {
                    try { localStorage.removeItem(k); } catch (e) {}
                });
                console.log(`[DNFL Cache] Evicted ${keysToRemove.length} stale LocalStorage entries.`);
            } catch (e) {
                console.warn('[DNFL Cache] Error during LocalStorage eviction:', e);
            }
        }

        /**
         * Synchronous / Async Cache Getter (Memory -> LocalStorage)
         */
        getCacheEntry(cacheKey) {
            const now = Date.now();

            // 1. Check In-Memory Cache Tier
            if (this.memoryCache.has(cacheKey)) {
                const memEntry = this.memoryCache.get(cacheKey);
                if (memEntry && now - memEntry.storedAt < memEntry.ttlMs) {
                    return memEntry.data;
                }
                this.memoryCache.delete(cacheKey);
            }

            // 2. Check LocalStorage Tier
            try {
                const raw = localStorage.getItem(cacheKey);
                if (!raw) return null;
                const entry = JSON.parse(raw);
                if (!entry || !entry.storedAt || !entry.ttlMs) return null;

                if (now - entry.storedAt < entry.ttlMs) {
                    // Populate memory tier for subsequent hits
                    this.memoryCache.set(cacheKey, entry);
                    return entry.data;
                } else {
                    // Expired
                    localStorage.removeItem(cacheKey);
                }
            } catch (err) {
                // Parse error or access restriction
            }

            return null;
        }

        /**
         * Sets Cache Entry across Memory and LocalStorage
         */
        setCacheEntry(cacheKey, data, ttlSeconds) {
            const ttlMs = (ttlSeconds || this.TTL.DAILY) * 1000;
            const entry = {
                data: data,
                storedAt: Date.now(),
                ttlMs: ttlMs
            };

            // Store in memory
            this.memoryCache.set(cacheKey, entry);

            // Store in LocalStorage safely
            this.safeLocalStorageSet(cacheKey, JSON.stringify(entry));
        }

        /**
         * Primary JSON Fetcher with Parameter-Aware Caching & Request Deduplication
         * @param {string} requestType MFL API Export Type (e.g. 'leagueStandings', 'league', 'rosters')
         * @param {string} params Query string parameters (e.g. '&W=1', '&W=YTD')
         * @param {Object} options Options object { ttlSeconds, skipCache, forceRefresh, year, leagueId }
         * @returns {Promise<Object>} JSON Response Object
         */
        async fetchData(requestType, params = '', options = {}) {
            const reqYear = options.year || this.year;
            const reqLeagueId = options.leagueId || this.leagueId;
            const ttl = options.ttlSeconds || (requestType === 'league' || requestType === 'leagueStandings' ? this.TTL.DAILY : this.TTL.FIVE_MIN);

            const cacheKey = this.generateCacheKey(requestType, reqYear, reqLeagueId, params);

            // 1. Check Cache unless skipCache/forceRefresh requested
            if (!options.skipCache && !options.forceRefresh) {
                const cachedData = this.getCacheEntry(cacheKey);
                if (cachedData) {
                    return cachedData;
                }
            }

            // 2. Request Deduplication: Return pending in-flight fetch promise if active
            if (this.activeFetches.has(cacheKey)) {
                return this.activeFetches.get(cacheKey);
            }

            // 3. Formulate MFL Export Endpoint URL
            const cleanParams = params ? (params.startsWith('&') ? params : `&${params}`) : '';
            const fetchUrl = `${this.baseUrl}/${reqYear}/export?TYPE=${requestType}&L=${reqLeagueId}&JSON=1${cleanParams}`;

            // 4. Initiate Fetch with Deduplication Tracking
            const fetchPromise = (async () => {
                try {
                    const response = await fetch(fetchUrl, { cache: 'no-store' });
                    if (!response.ok) {
                        throw new Error(`[DNFL API HTTP Exception] ${requestType} returned status ${response.status}`);
                    }
                    const data = await response.json();

                    // Store in cache
                    if (data && !options.skipCache) {
                        this.setCacheEntry(cacheKey, data, ttl);
                    }

                    return data;
                } catch (err) {
                    console.error(`❌ [DNFL API Error] Failed to fetch ${requestType} (${params}):`, err);
                    throw err;
                } finally {
                    // Remove from active fetches registry
                    this.activeFetches.delete(cacheKey);
                }
            })();

            this.activeFetches.set(cacheKey, fetchPromise);
            return fetchPromise;
        }

        /**
         * Raw Text / CSV / Markdown / JSON Fetcher with Parameter-Aware Caching & Deduplication
         * @param {string} url Full target URL
         * @param {Object} options Options object { ttlSeconds, skipCache, forceRefresh }
         * @returns {Promise<string>} Raw text content
         */
        async fetchRawText(url, options = {}) {
            const ttl = options.ttlSeconds || this.TTL.HOURLY;
            
            // Build cache key based on URL hash/slug
            const urlSlug = url.replace(/[^a-zA-Z0-9]/g, '_').slice(-80);
            const cacheKey = `dnfl_raw_${urlSlug}`;

            if (!options.skipCache && !options.forceRefresh) {
                const cachedText = this.getCacheEntry(cacheKey);
                if (cachedText) {
                    return cachedText;
                }
            }

            if (this.activeFetches.has(cacheKey)) {
                return this.activeFetches.get(cacheKey);
            }

            const fetchPromise = (async () => {
                try {
                    const response = await fetch(url, { cache: 'no-store' });
                    if (!response.ok) {
                        throw new Error(`[DNFL Raw Fetch HTTP Exception] ${url} status ${response.status}`);
                    }
                    const text = await response.text();

                    if (text && !options.skipCache) {
                        this.setCacheEntry(cacheKey, text, ttl);
                    }

                    return text;
                } catch (err) {
                    console.error(`❌ [DNFL Raw Fetch Error] Failed loading ${url}:`, err);
                    throw err;
                } finally {
                    this.activeFetches.delete(cacheKey);
                }
            })();

            this.activeFetches.set(cacheKey, fetchPromise);
            return fetchPromise;
        }

        /**
         * Single-Pass In-Memory League Metadata Bootstrapping
         * Fetches 'league' endpoint once and stores franchise, owner, logo, conference, and division dictionaries
         */
        async bootstrapLeagueMetadata(forceRefresh = false) {
            if (this.isMetadataBootstrapped && !forceRefresh && this.leagueMetadata) {
                return this.leagueMetadata;
            }

            try {
                const leagueData = await this.fetchData('league', '', {
                    ttlSeconds: this.TTL.DAILY,
                    forceRefresh: forceRefresh
                });

                if (leagueData && leagueData.league) {
                    const lg = leagueData.league;

                    // 1. Build Conferences Map
                    const confMap = {};
                    if (lg.conferences && lg.conferences.conference) {
                        const cList = Array.isArray(lg.conferences.conference) ? lg.conferences.conference : [lg.conferences.conference];
                        cList.forEach(c => {
                            confMap[String(c.id)] = c.name;
                        });
                    }

                    // 2. Build Divisions Map
                    const divMap = {};
                    if (lg.divisions && lg.divisions.division) {
                        const dList = Array.isArray(lg.divisions.division) ? lg.divisions.division : [lg.divisions.division];
                        dList.forEach(d => {
                            const cName = confMap[String(d.conference)] || '';
                            divMap[String(d.id)] = {
                                divName: d.name,
                                conferenceId: String(d.conference || ''),
                                confName: cName
                            };
                        });
                    }

                    // 3. Build Franchises Map (36 Teams)
                    const franchiseMap = {};
                    if (lg.franchises && lg.franchises.franchise) {
                        const fList = Array.isArray(lg.franchises.franchise) ? lg.franchises.franchise : [lg.franchises.franchise];
                        fList.forEach(f => {
                            const normFid = window.DNFL.Utils.normId(f.id);
                            const divInfo = divMap[String(f.division)] || {};
                            const confName = f.conference || divInfo.confName || '';

                            franchiseMap[normFid] = {
                                id: normFid,
                                name: f.name || 'Unknown Team',
                                ownerName: f.owner_name || 'Owner',
                                icon: f.icon || f.logo || 'https://dnfl.live/images/ficon-dnfl.png',
                                logo: f.logo || f.icon || 'https://dnfl.live/images/ficon-dnfl.png',
                                conference: confName,
                                division: divInfo.divName || '',
                                divisionId: String(f.division || '')
                            };
                        });
                    }

                    this.franchiseMap = franchiseMap;
                    this.leagueMetadata = {
                        name: lg.name,
                        year: this.year,
                        leagueId: this.leagueId,
                        conferences: confMap,
                        divisions: divMap,
                        franchises: franchiseMap,
                        raw: lg
                    };

                    this.isMetadataBootstrapped = true;

                    // Attach synchronously to window.DNFL
                    window.DNFL.leagueMetadata = this.leagueMetadata;
                    window.DNFL.franchiseMap = this.franchiseMap;

                    // Dispatch custom event
                    window.dispatchEvent(new CustomEvent('dnfl:leagueLoaded', {
                        detail: { metadata: this.leagueMetadata, franchiseMap: this.franchiseMap }
                    }));

                    console.log(`✅ [DNFL Middleware] Single-pass league metadata bootstrapped (${Object.keys(franchiseMap).length} franchises).`);
                    return this.leagueMetadata;
                }
            } catch (err) {
                console.warn('[DNFL Middleware] League metadata bootstrapping warning:', err);
            }

            return null;
        }

        /**
         * Synchronously returns cached League Metadata
         */
        getLeagueMetadata() {
            return this.leagueMetadata;
        }

        /**
         * Synchronously returns User Franchise ID
         */
        getUserFranchiseId() {
            return this.userFranchiseId || this.resolveUserFranchiseId();
        }

        /**
         * Clears all DNFL cached storage entries
         */
        clearCache() {
            this.memoryCache.clear();
            this.evictStaleLocalStorage();
            console.log('[DNFL Middleware] API Client cache purged.');
        }
    }

    // 2. INSTANTIATE SINGLETON & EXPOSE TO GLOBAL NAMESPACE
    const clientInstance = new DNFLApiClient();

    // Attach to namespace
    window.DNFL.Client = clientInstance;
    window.DNFLClient = clientInstance; // Global Alias for Backwards Compatibility

})(window, document);
