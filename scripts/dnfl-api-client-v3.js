/**
 * ============================================================================
 * Duke Networking Fantasy League (DNFL) Framework API Client Middleware
 * File: dnfl-api-client-v3.js
 * Version: 3.00
 * Description: High-performance MFL API middleware with tiered TTL caching,
 *              stale-while-revalidate pattern, request deduplication, and
 *              automatic local storage eviction.
 * ============================================================================
 */
/* global DNFLClient */
(function () {
    'use strict';

    // 1. Tiered TTL Definitions (in milliseconds)
    const TTL = {
        LIVE: 30 * 1000,                // 30 seconds: Live scoring during game days
        INTRADAY: 15 * 60 * 1000,       // 15 minutes: Rosters, injuries, transactions
        DAILY: 24 * 60 * 60 * 1000,     // 24 hours: League settings, standings, rules
        NEVER: 30 * 24 * 60 * 60 * 1000 // 30 days (Permanent): Historical weeks & past seasons
    };

    const CACHE_PREFIX = 'dnfl_cache_';
    const inFlightRequests = new Map();

    /**
     * Determine active host and target year dynamically from window location or MFL globals
     */
    function getContext() {
        const host = window.location.host || 'www48.myfantasyleague.com';
        const match = window.location.pathname.match(/\/(\d{4})\//);
        const year = match ? match[1] : (window.MFL_YEAR || new Date().getFullYear().toString());
        return { host, year };
    }

    /**
     * Get appropriate TTL based on data volatility and context
     */
    function getTTL(exportName, params = {}) {
        const { year } = getContext();
        const currentYear = new Date().getFullYear().toString();

        // 1. Past Seasons are permanently cached
        if (parseInt(year, 10) < parseInt(currentYear, 10)) {
            return TTL.NEVER;
        }

        // 2. Specific Export Type Rules
        switch (exportName) {
            case 'weeklyResults': {
                // Past weeks in current season are permanently cached
                if (params.W && parseInt(params.W, 10) < (window.DNFL_COMPLETED_WEEK || 0)) {
                    return TTL.NEVER;
                }
                // Live game day check (Sunday = 0, Monday = 1, Thursday = 4)
                const day = new Date().getDay();
                if (day === 0 || day === 1 || day === 4) {
                    return TTL.LIVE;
                }
                return TTL.INTRADAY;
            }

            case 'league':
            case 'leagueStandings':
            case 'rulesJson':
                return TTL.DAILY;

            case 'liveScoring':
                return TTL.LIVE;

            default:
                return TTL.INTRADAY;
        }
    }

    /**
     * Cache Storage Helper with Eviction and Quota Management
     */
    const Storage = {
        get(key) {
            try {
                const raw = localStorage.getItem(CACHE_PREFIX + key);
                if (!raw) return null;
                const entry = JSON.parse(raw);
                const isExpired = Date.now() > entry.expiresAt;
                return { data: entry.data, timestamp: entry.timestamp, isExpired };
            } catch (e) {
                return null;
            }
        },

        set(key, data, ttlMs) {
            const entry = {
                data: data,
                timestamp: Date.now(),
                expiresAt: Date.now() + ttlMs
            };
            try {
                localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
            } catch (e) {
                // On QuotaExceededError, evict expired entries and retry once
                Storage.evictExpired();
                try {
                    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
                } catch (retryError) {
                    console.warn('[DNFLClient] LocalStorage quota reached. Skipping persistent cache for key:', key);
                }
            }
        },

        evictExpired() {
            try {
                const now = Date.now();
                const toRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(CACHE_PREFIX)) {
                        try {
                            const item = JSON.parse(localStorage.getItem(k));
                            if (item && item.expiresAt && now > item.expiresAt) {
                                toRemove.push(k);
                            }
                        } catch (err) {
                            toRemove.push(k);
                        }
                    }
                }
                toRemove.forEach(k => localStorage.removeItem(k));
            } catch (e) {
                console.warn('[DNFLClient] Eviction error:', e);
            }
        }
    };

    /**
     * Public API Client Object
     */
    const Client = {
        /**
         * Fetch structured JSON data from MFL Export API with Stale-While-Revalidate caching
         */
        fetchData(exportName, params = {}, options = {}) {
            const { host, year } = getContext();
            const queryParams = new URLSearchParams({ TYPE: exportName, JSON: '1', ...params });
            const url = `https://${host}/${year}/export?${queryParams.toString()}`;
            const cacheKey = `export_${exportName}_${year}_${queryParams.toString()}`;
            const ttlMs = getTTL(exportName, params);

            // 1. Force Refresh Option
            if (options.force) {
                return this._networkFetch(url, cacheKey, ttlMs, true);
            }

            // 2. Check Cache
            const cached = Storage.get(cacheKey);
            if (cached) {
                if (cached.isExpired) {
                    // Stale-While-Revalidate: Return stale data immediately, trigger background refresh
                    console.log(`[DNFLClient] Stale cache hit for ${exportName}. Serving instantly, refreshing background...`);
                    this._networkFetch(url, cacheKey, ttlMs, true).catch(err => {
                        console.warn(`[DNFLClient] Background refresh failed for ${exportName}:`, err);
                    });
                }
                return Promise.resolve(cached.data);
            }

            // 3. Cache Miss: Perform Network Fetch
            return this._networkFetch(url, cacheKey, ttlMs, false);
        },

        /**
         * Fetch raw text/JSON from arbitrary URL (e.g. GitHub config files)
         */
        fetchRawText(url, options = {}) {
            const cacheKey = `raw_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const ttlMs = options.ttl || TTL.DAILY;

            if (options.force) {
                return this._rawFetch(url, cacheKey, ttlMs);
            }

            const cached = Storage.get(cacheKey);
            if (cached) {
                if (cached.isExpired) {
                    this._rawFetch(url, cacheKey, ttlMs).catch(() => {});
                }
                return Promise.resolve(cached.data);
            }

            return this._rawFetch(url, cacheKey, ttlMs);
        },

        /**
         * Internal deduplicated network fetch for MFL exports
         */
        _networkFetch(url, cacheKey, ttlMs, isBackground) {
            if (inFlightRequests.has(cacheKey)) {
                return inFlightRequests.get(cacheKey);
            }

            const promise = fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    return res.json();
                })
                .then(json => {
                    Storage.set(cacheKey, json, ttlMs);
                    inFlightRequests.delete(cacheKey);
                    return json;
                })
                .catch(err => {
                    inFlightRequests.delete(cacheKey);
                    throw err;
                });

            inFlightRequests.set(cacheKey, promise);
            return promise;
        },

        /**
         * Internal deduplicated raw fetch
         */
        _rawFetch(url, cacheKey, ttlMs) {
            if (inFlightRequests.has(cacheKey)) {
                return inFlightRequests.get(cacheKey);
            }

            const promise = fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    return res.text();
                })
                .then(text => {
                    Storage.set(cacheKey, text, ttlMs);
                    inFlightRequests.delete(cacheKey);
                    return text;
                })
                .catch(err => {
                    inFlightRequests.delete(cacheKey);
                    throw err;
                });

            inFlightRequests.set(cacheKey, promise);
            return promise;
        }
    };

    // Register on Global Namespace
    window.DNFLClient = Client;
    window.DNFL = window.DNFL || {};
    window.DNFL.Client = Client;

    console.log('[DNFLClient] API Middleware v3.00 Initialized with Tiered TTL & Stale-While-Revalidate.');
})();
