/* ==========================================================================
   DNFL Framework Script Loader & Version Controller
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Manages global CSS injection, sequential module loading, conditional library
   hydration, and DOM mutation observers for dynamic MFL elements.
   ========================================================================== */

(function (window, document) {
    'use strict';

    // =========================================================================
    // USER CONFIGURATION BLOCK (Edit here to add/test modules or CSS)
    // =========================================================================
    const CONFIG = {
        VERSION: "3.01-TEST3",
        BASE_URL: "https://dnfl.live/scripts/",

        // Stylesheet Manifest (Change URL here to test custom or test CSS)
        STYLESHEETS: [
            { id: "dnfl-global-css", url: "https://dnfl.live/css/dnfl-global.css" }
        ],

        // Core Scripts Pipeline (Loaded sequentially in array order)
        // Add new modules or swap to -TEST.js files here
        SCRIPTS: [
            { name: "papaparse", url: "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.6.1/papaparse.min.js", isExternal: true },
            { name: "api-client", url: "dnfl-api-client-TEST3.js" },
            { name: "standings",  url: "dnfl-standings.js" },
            { name: "rankings",   url: "dnfl-rankings.js" },
            { name: "podcast",    url: "dnfl-podcast.js" },
            { name: "rules",      url: "dnfl-rules.js" }
        ],

        // Conditional Libraries (Hydrated on-demand if DOM container exists)
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

    // Inject global CSS design tokens if not present
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
     * Load core framework scripts sequentially to ensure strict dependency order
     */
    function loadScriptSequentially(index, callback) {
        if (index >= CONFIG.SCRIPTS.length) {
            if (callback) callback();
            return;
        }

        const scriptConfig = CONFIG.SCRIPTS[index];
        const scriptElement = document.createElement("script");
        const fullUrl = scriptConfig.isExternal 
            ? scriptConfig.url 
            : `${CONFIG.BASE_URL}${scriptConfig.url}?v=${CONFIG.VERSION}`;

        scriptElement.src = fullUrl;
        scriptElement.type = "text/javascript";
        scriptElement.async = false;

        scriptElement.onload = function() {
            loadScriptSequentially(index + 1, callback);
        };

        scriptElement.onerror = function(err) {
            console.error(`[DNFL Header] Script load error: ${scriptConfig.url}`, err);
            loadScriptSequentially(index + 1, callback);
        };

        document.head.appendChild(scriptElement);
    }

    /**
     * Dynamically inject heavy third-party libraries only if target DOM containers exist
     */
    function checkAndLoadConditionalLibraries() {
        Object.keys(CONFIG.CONDITIONAL_LIBRARIES).forEach(libKey => {
            const lib = CONFIG.CONDITIONAL_LIBRARIES[libKey];
            const shouldLoad = lib.targets.some(selector => document.querySelector(selector) !== null);

            if (shouldLoad && !lib.loaded) {
                lib.loaded = true;
                const script = document.createElement("script");
                script.src = lib.url;
                script.async = true;
                script.onload = () => console.log(`[DNFL.Header] Dynamically loaded ${libKey}`);
                document.head.appendChild(script);
            }
        });
    }

    // Attach DOM Utility Helper
    DNFL.Utils = DNFL.Utils || {};
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

    // Execution Pipeline
    loadScriptSequentially(0, function() {
        checkAndLoadConditionalLibraries();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAndLoadConditionalLibraries);
        }

        window.dispatchEvent(new CustomEvent('dnfl:ready', { detail: { version: CONFIG.VERSION } }));
        window.dispatchEvent(new CustomEvent('dnflFrameworkReady', { detail: { version: CONFIG.VERSION } }));
    });

})(window, document);
