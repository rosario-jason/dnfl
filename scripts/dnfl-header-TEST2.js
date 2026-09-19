/* ==========================================================================
   DNFL Framework Header Loader
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Architectural Features:
   1. Centralized CSS injection (dnfl-global.css).
   2. Conditional & On-Demand loading for heavy libraries (Chart.js, Marked.js).
   3. Sequential pipeline execution with non-blocking error handling.
   4. Version-controlled asset cache busting (?v=3.00).
   5. Standardized event bus signaling ('dnfl:ready' & 'dnflFrameworkReady').
   6. Dynamic DOM observer utility (DNFL.Utils.onElementReady).
   ========================================================================== */

(function (window, document) {
    'use strict';

    // ----------------------------------------------------------------------
    // Global Namespace Pre-allocation
    // ----------------------------------------------------------------------
    window.DNFL = window.DNFL || {};
    const DNFL = window.DNFL;

    DNFL.version = "3.02";
    DNFL.UI = DNFL.UI || {};
    DNFL.Utils = DNFL.Utils || {};

    const FRAMEWORK_VERSION = "3.00";
    const BASE_DOMAIN = "https://dnfl.live";

    // ----------------------------------------------------------------------
    // CSS Global Injector
    // ----------------------------------------------------------------------
    function injectGlobalCSS() {
        const cssId = 'dnfl-global-css';
        if (!document.getElementById(cssId)) {
            const head = document.head || document.getElementsByTagName('head')[0];
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = `${BASE_DOMAIN}/css/dnfl-global.css?v=${FRAMEWORK_VERSION}`;
            link.media = 'all';
            head.appendChild(link);
        }
    }

    // ----------------------------------------------------------------------
    // Utilities & DOM Observers
    // ----------------------------------------------------------------------
    DNFL.Utils.onElementReady = function (selector, callback) {
        const existing = document.querySelector(selector);
        if (existing) {
            callback(existing);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                callback(el);
            }
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    };

    // ----------------------------------------------------------------------
    // On-Demand / Conditional Library Loader
    // ----------------------------------------------------------------------
    const LOADED_LIBRARIES = new Map();

    DNFL.Utils.loadLibrary = function (libKey, url) {
        if (LOADED_LIBRARIES.has(libKey)) {
            return LOADED_LIBRARIES.get(libKey);
        }

        const loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = () => {
                console.log(`[DNFL.Header] Dynamically loaded ${libKey}`);
                resolve();
            };
            script.onerror = (err) => {
                console.error(`[DNFL.Header] Failed to load library ${libKey}:`, err);
                reject(err);
            };
            document.head.appendChild(script);
        });

        LOADED_LIBRARIES.set(libKey, loadPromise);
        return loadPromise;
    };

    // ----------------------------------------------------------------------
    // Framework Script Registry
    // ----------------------------------------------------------------------
    const CORE_SCRIPTS = [
        // Essential CSV Parser
        { name: "papaparse", url: "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.6.1/papaparse.min.js", isExternal: true },
        
        // API Client Middleware
        { name: "apiClient", url: `${BASE_DOMAIN}/scripts/dnfl-api-client-TEST2.js?v=${FRAMEWORK_VERSION}`, isExternal: false },

        // Feature Modules
        { name: "standings", url: `${BASE_DOMAIN}/scripts/dnfl-standings.js?v=${FRAMEWORK_VERSION}`, isExternal: false },
        { name: "rankings", url: `${BASE_DOMAIN}/scripts/dnfl-rankings.js?v=${FRAMEWORK_VERSION}`, isExternal: false },
        { name: "podcast", url: `${BASE_DOMAIN}/scripts/dnfl-podcast.js?v=${FRAMEWORK_VERSION}`, isExternal: false },
        { name: "rules", url: `${BASE_DOMAIN}/scripts/dnfl-rules.js?v=${FRAMEWORK_VERSION}`, isExternal: false }
    ];

    // ----------------------------------------------------------------------
    // Dynamic / Conditional Check for Heavy Dependencies
    // ----------------------------------------------------------------------
    function checkConditionalDependencies() {
        // Load Chart.js only if power rankings chart container exists
        if (document.querySelector('#dnfl_powerRankingChart') || document.querySelector('.dnfl-chart-container')) {
            DNFL.Utils.loadLibrary('chartjs', 'https://cdn.jsdelivr.net/npm/chart.js');
        }

        // Load Marked.js only if podcast notes or markdown container exists
        if (document.querySelector('#dnfl-podcast-transcript') || document.querySelector('.dnfl-markdown')) {
            DNFL.Utils.loadLibrary('marked', 'https://cdn.jsdelivr.net/npm/marked/marked.min.js');
        }
    }

    // ----------------------------------------------------------------------
    // Sequential Script Loader Engine
    // ----------------------------------------------------------------------
    function loadScript(item) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = item.url;
            script.async = false; // Preserves execution order

            script.onload = () => resolve({ name: item.name, success: true });
            script.onerror = () => {
                console.warn(`[DNFL.Header] Non-blocking load failure for: ${item.name}`);
                resolve({ name: item.name, success: false });
            };

            document.head.appendChild(script);
        });
    }

    async function initializeFramework() {
        injectGlobalCSS();
        checkConditionalDependencies();

        for (const item of CORE_SCRIPTS) {
            await loadScript(item);
        }

        DNFL.isReady = true;

        // Dispatch Ready Signals
        const readyEvent = new CustomEvent('dnfl:ready', {
            detail: { version: DNFL.version, timestamp: Date.now() }
        });
        window.dispatchEvent(readyEvent);

        if (typeof window.dnflFrameworkReady === 'function') {
            try {
                window.dnflFrameworkReady(DNFL);
            } catch (e) {
                console.error('[DNFL.Header] Error in legacy dnflFrameworkReady handler:', e);
            }
        }
    }

    // Boot Pipeline
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFramework);
    } else {
        initializeFramework();
    }

})(window, document);
