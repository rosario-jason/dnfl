/* ==========================================================================
   DNFL Framework Script Loader & Version Controller (v3.00-TEST4)
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Manages global CSS injection, 3-step async dependency pipeline, conditional library
   hydration, and DOM mutation observers for dynamic MFL elements.
   ========================================================================== */

(function (window, document) {
    'use strict';

    // =========================================================================
    // USER CONFIGURATION BLOCK (Edit here to add/test modules or CSS)
    // =========================================================================
    const CONFIG = {
        VERSION: "3.00-TEST4",
        BASE_URL: "https://dnfl.live/scripts/",

        // Stylesheet Manifest (Edit URL here to test custom or test CSS)
        STYLESHEETS: [
            { id: "dnfl-global-css", url: "https://dnfl.live/css/dnfl-global.css" }
        ],

        // Core Infrastructure Scripts (Loaded first sequentially)
        INFRASTRUCTURE: [
            { name: "papaparse", url: "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.6.1/papaparse.min.js", isExternal: true },
            { name: "api-client", url: "dnfl-api-client-TEST4.js" }
        ],

        // Feature Modules (Loaded after third-party libraries are hydrated)
        FEATURE_MODULES: [
            { name: "standings", url: "dnfl-standings.js" },
            { name: "rankings",  url: "dnfl-rankings.js" },
            { name: "podcast",   url: "dnfl-podcast.js" },
            { name: "rules",     url: "dnfl-rules.js" }
        ],

        // Conditional Libraries (Hydrated on-demand if target DOM containers exist)
        CONDITIONAL_LIBRARIES: {
            chartjs: {
                url: "https://cdn.jsdelivr.net/npm/chart.js",
                targets: ["#dnfl_powerRankingChart", "#dnfl_chartWrapperContainer"]
            },
            marked: {
                url: "https://cdn.jsdelivr.net/npm/marked/marked.min.js",
                targets: ["#dnfl-podcast-transcript", "#dnfl_transcriptWrapper"]
            }
        }
    };

    // =========================================================================
    // FRAMEWORK LOADER ENGINE (No editing required below)
    // =========================================================================

    window.DNFL = window.DNFL || {};

    // Inject global CSS stylesheets if missing from DOM
    CONFIG.STYLESHEETS.forEach(sheet => {
        if (!document.getElementById(sheet.id)) {
            const cssLink = document.createElement('link');
            cssLink.id = sheet.id;
            cssLink.rel = 'stylesheet';
            cssLink.href = `${sheet.url}?v=${CONFIG.VERSION}`;
            document.head.appendChild(cssLink);
        }
    });

    /**
     * Load a single script tag and return a Promise
     */
    function loadScript(scriptConfig) {
        return new Promise((resolve) => {
            const scriptElement = document.createElement("script");
            const fullUrl = scriptConfig.isExternal 
                ? scriptConfig.url 
                : `${CONFIG.BASE_URL}${scriptConfig.url}?v=${CONFIG.VERSION}`;

            scriptElement.src = fullUrl;
            scriptElement.type = "text/javascript";
            scriptElement.async = false;

            scriptElement.onload = () => resolve({ success: true, url: scriptConfig.url });
            scriptElement.onerror = (err) => {
                console.error(`[DNFL Header] Script load error: ${scriptConfig.url}`, err);
                resolve({ success: false, url: scriptConfig.url });
            };

            document.head.appendChild(scriptElement);
        });
    }

    /**
     * Load an array of script configs strictly in sequential order
     */
    async function loadScriptsSequentially(scriptList) {
        for (const scriptConfig of scriptList) {
            await loadScript(scriptConfig);
        }
    }

    /**
     * Hydrate a conditional library if its target DOM elements are present
     */
    function loadConditionalLibrary(libKey) {
        return new Promise((resolve) => {
            const lib = CONFIG.CONDITIONAL_LIBRARIES[libKey];
            if (!lib) return resolve(false);

            const containerExists = lib.targets.some(selector => document.querySelector(selector) !== null);

            if (containerExists && !lib.loaded) {
                lib.loaded = true;
                const script = document.createElement("script");
                script.src = lib.url;
                script.async = true;
                script.onload = () => {
                    console.log(`[DNFL.Header] Hydrated library: ${libKey}`);
                    resolve(true);
                };
                script.onerror = () => {
                    console.error(`[DNFL.Header] Failed to hydrate library: ${libKey}`);
                    resolve(false);
                };
                document.head.appendChild(script);
            } else {
                resolve(lib.loaded || false);
            }
        });
    }

    /**
     * Scan and hydrate all required conditional libraries before feature module execution
     */
    async function loadRequiredConditionalLibraries() {
        const tasks = Object.keys(CONFIG.CONDITIONAL_LIBRARIES).map(key => loadConditionalLibrary(key));
        await Promise.all(tasks);
    }

    // Attach DOM & Library Utility Helpers
    DNFL.Utils = DNFL.Utils || {};

    /**
     * Execute callback when DOM selector becomes available (utilizing MutationObserver)
     */
    DNFL.Utils.onElementReady = function (selector, callback) {
        if (document.querySelector(selector)) {
            callback(document.querySelector(selector));
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                callback(element);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    };

    /**
     * Public method to manually trigger dynamic library hydration on-demand
     */
    DNFL.Utils.loadLibrary = function (libKey) {
        return loadConditionalLibrary(libKey);
    };

    // ----------------------------------------------------------------------
    // Execution Pipeline (3-Step Async Initialization Sequence)
    // ----------------------------------------------------------------------
    (async function initializeFramework() {
        // Step 1: Load Core Infrastructure
        await loadScriptsSequentially(CONFIG.INFRASTRUCTURE);

        // Step 2: Hydrate Required Conditional Libraries (Chart.js / Marked.js)
        await loadRequiredConditionalLibraries();

        // Step 3: Load Downstream Feature Modules
        await loadScriptsSequentially(CONFIG.FEATURE_MODULES);

        // Backup DOMContentLoaded listener for late-rendered containers
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadRequiredConditionalLibraries);
        }

        // Dispatch Readiness Events
        window.dispatchEvent(new CustomEvent('dnfl:ready', { detail: { version: CONFIG.VERSION } }));
        window.dispatchEvent(new CustomEvent('dnflFrameworkReady', { detail: { version: CONFIG.VERSION } }));
    })();

})(window, document);
