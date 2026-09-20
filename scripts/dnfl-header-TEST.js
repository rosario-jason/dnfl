/* ==========================================================================
   DNFL Framework Script Loader & Version Controller
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Manages global CSS injection, 3-step async dependency pipeline, conditional 
   library hydration, string padding utilities, and DOM mutation observers.
   ========================================================================== */

(function (window, document) {
    'use strict';

    const LOG_PREFIX = `[DNFL Framework]`;

    const CONFIG = {
        VERSION: "3.15-TEST",
        BASE_URL: "https://dnfl.live/scripts/",

        STYLESHEETS: [
            { id: "dnfl-global-css", url: "https://dnfl.live/css/dnfl-global.css" }
        ],

        INFRASTRUCTURE: [
            { name: "papaparse", url: "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.6.1/papaparse.min.js", isExternal: true },
            { name: "marked",     url: "https://cdn.jsdelivr.net/npm/marked/marked.min.js", isExternal: true },
            { name: "api-client", url: "dnfl-api-client-TEST.js" }
        ],

        FEATURE_MODULES: [
            { name: "standings", url: "dnfl-standings.js" },
            { name: "rankings",  url: "dnfl-rankings.js" },
            { name: "podcast",   url: "dnfl-podcast-TEST.js" },
            { name: "rules",     url: "dnfl-rules.js" }
        ],

        CONDITIONAL_LIBRARIES: {
            chartjs: {
                url: "https://cdn.jsdelivr.net/npm/chart.js",
                targets: ["#dnfl_powerRankingChart", "#dnfl_chartWrapperContainer"]
            }
        }
    };

    window.DNFL = window.DNFL || {};

    // ----------------------------------------------------------------------
    // Execution Engine
    // ----------------------------------------------------------------------

    function loadScript(scriptConfig, sectionName) {
        return new Promise((resolve) => {
            const scriptElement = document.createElement("script");
            const fullUrl = scriptConfig.isExternal 
                ? scriptConfig.url 
                : `${CONFIG.BASE_URL}${scriptConfig.url}?v=${CONFIG.VERSION}`;

            scriptElement.src = fullUrl;
            scriptElement.type = "text/javascript";
            scriptElement.async = false;

            scriptElement.onload = () => resolve({ success: true });
            scriptElement.onerror = (err) => {
                console.error(`${LOG_PREFIX} ERROR in ${sectionName}: Failed to load "${scriptConfig.name}" from "${fullUrl}"`, err);
                resolve({ success: false });
            };

            document.head.appendChild(scriptElement);
        });
    }

    async function loadGroup(scriptList, sectionName) {
        let allOk = true;
        for (const item of scriptList) {
            const result = await loadScript(item, sectionName);
            if (!result.success) allOk = false;
        }
        return allOk;
    }

    function checkOptionalLibraries() {
        return new Promise((resolve) => {
            const keys = Object.keys(CONFIG.CONDITIONAL_LIBRARIES);
            if (keys.length === 0) return resolve(true);

            keys.forEach(key => {
                const lib = CONFIG.CONDITIONAL_LIBRARIES[key];
                const exists = lib.targets.some(sel => document.querySelector(sel) !== null);
                if (exists && !lib.loaded) {
                    lib.loaded = true;
                    const script = document.createElement("script");
                    script.src = lib.url;
                    script.async = true;
                    script.onerror = () => console.error(`${LOG_PREFIX} ERROR in Section 3 (Optional Tools): Failed to load "${key}" from "${lib.url}"`);
                    document.head.appendChild(script);
                }
            });
            resolve(true);
        });
    }

    // ----------------------------------------------------------------------
    // Framework Helper Utilities
    // ----------------------------------------------------------------------
    DNFL.Utils = DNFL.Utils || {};

    /**
     * Core String Padding Utility
     * @param {string|number} val - Input value to normalize
     * @param {number} length - Desired target string length (defaults to 4)
     */
    DNFL.Utils.pad = function (val, length = 4) {
        return String(val ?? '').trim().padStart(length, '0');
    };

    // Explicit Length Shortcuts
    DNFL.Utils.pad2 = (val) => DNFL.Utils.pad(val, 2); // Conferences, Divisions, Weeks (e.g., "01")
    DNFL.Utils.pad4 = (val) => DNFL.Utils.pad(val, 4); // Franchise IDs, Years (e.g., "0001")
    DNFL.Utils.pad5 = (val) => DNFL.Utils.pad(val, 5); // Player IDs (e.g., "09912")

    /**
     * Execute callback when DOM selector becomes available
     * @param {string} selector - CSS selector
     * @param {Function} callback - Callback function
     */
    DNFL.Utils.onElementReady = function (selector, callback) {
        const check = () => {
            const el = document.querySelector(selector);
            if (el) { callback(el); return true; }
            return false;
        };
        if (check()) return;

        const observer = new MutationObserver((_, obs) => {
            if (check()) obs.disconnect();
        });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    };

    /**
     * Public helper to trigger dynamic library hydration on-demand
     * @param {string} libKey - Key in CONFIG.CONDITIONAL_LIBRARIES
     */
    DNFL.Utils.loadLibrary = function (libKey) {
        const lib = CONFIG.CONDITIONAL_LIBRARIES[libKey];
        if (!lib || lib.loaded) return Promise.resolve(!!lib?.loaded);
        lib.loaded = true;
        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = lib.url;
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => { lib.loaded = false; resolve(false); };
            document.head.appendChild(script);
        });
    };

    // ----------------------------------------------------------------------
    // Main 5-Step Pipeline
    // ----------------------------------------------------------------------
    (async function runFramework() {
        // Step 1: Stylesheets
        CONFIG.STYLESHEETS.forEach(s => {
            if (!document.getElementById(s.id)) {
                const link = document.createElement('link');
                link.id = s.id;
                link.rel = 'stylesheet';
                link.href = `${s.url}?v=${CONFIG.VERSION}`;
                document.head.appendChild(link);
            }
        });
        console.log(`${LOG_PREFIX} 1/5: Stylesheets loaded.`);

        // Step 2: Core Libraries
        const coreOk = await loadGroup(CONFIG.INFRASTRUCTURE, "Section 2 (Core Libraries)");
        if (coreOk) {
            console.log(`${LOG_PREFIX} 2/5: Core site libraries loaded (PapaParse, Marked, API Client).`);
        }

        // Step 3: Optional Tools
        await checkOptionalLibraries();
        console.log(`${LOG_PREFIX} 3/5: Optional page tools checked.`);

        // Step 4: Feature Modules
        const featuresOk = await loadGroup(CONFIG.FEATURE_MODULES, "Section 4 (League Features)");
        if (featuresOk) {
            console.log(`${LOG_PREFIX} 4/5: League features loaded (Standings, Rankings, Podcast, Rules).`);
        }

        // Step 5: Readiness Event
        window.dispatchEvent(new CustomEvent('dnfl:ready', { detail: { version: CONFIG.VERSION } }));
        window.dispatchEvent(new CustomEvent('dnflFrameworkReady', { detail: { version: CONFIG.VERSION } }));
        console.log(`${LOG_PREFIX} 5/5: DNFL Framework is ready.`);
    })();

})(window, document);
