/* ==========================================================================
   DNFL Central Framework Header Loader & Lifecycle Controller
   Repository: rosario-jason/dnfl
   File: scripts/dnfl-header.js
   Architecture: Production-Ready, Non-Blocking Script/CSS Ingestion,
                 Framework Versioning, Custom Event Bus, and Namespace Safeguards.
   ========================================================================== */

(function(window, document) {
    'use strict';

    // 1. EARLY GLOBAL NAMESPACE INITIALIZATION & SUB-ENCLAVES
    window.DNFL = window.DNFL || {};
    window.DNFL.UI = window.DNFL.UI || {};
    window.DNFL.Utils = window.DNFL.Utils || {};

    // 2. FRAMEWORK VERSION & BASE URL CONFIGURATION
    const FRAMEWORK_VERSION = "3.01";
    const BASE_SCRIPT_URL = "https://dnfl.live/scripts/";
    const GLOBAL_CSS_URL = "https://dnfl.live/css/dnfl-global.css";

    window.DNFL.version = FRAMEWORK_VERSION;

    /* --------------------------------------------------------------------------
     * GLOBAL STYLESHEET AUTO-INJECTION
     * -------------------------------------------------------------------------- */
    function injectGlobalStylesheet() {
        if (document.getElementById('dnfl-global-css')) return;

        const linkEl = document.createElement('link');
        linkEl.id = 'dnfl-global-css';
        linkEl.rel = 'stylesheet';
        linkEl.type = 'text/css';
        linkEl.href = `${GLOBAL_CSS_URL}?v=${FRAMEWORK_VERSION}`;

        // Insert before any custom page overrides if head exists
        const head = document.head || document.getElementsByTagName('head')[0];
        if (head) {
            head.appendChild(linkEl);
        }
    }

    // Inject CSS immediately
    injectGlobalStylesheet();

    /* --------------------------------------------------------------------------
     * MASTER CHRONOLOGICAL DEPENDENCY REGISTRY
     * -------------------------------------------------------------------------- */
    const SCRIPTS_TO_LOAD = [
        // Third-Party CDN Libraries
        { name: "PapaParse", url: "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.6.1/papaparse.min.js", isExternal: true },
        { name: "Chart.js",  url: "https://cdn.jsdelivr.net/npm/chart.js", isExternal: true },
        { name: "Marked.js", url: "https://cdn.jsdelivr.net/npm/marked/marked.min.js", isExternal: true },

        // Central Middleware Engine
        { name: "API Client", url: "dnfl-api-client-TEST.js", isExternal: false },

        // Feature Modules
        { name: "Standings Engine", url: "dnfl-standings.js", isExternal: false },
        { name: "Power Rankings",   url: "dnfl-rankings.js",  isExternal: false },
        { name: "Podcast Player",  url: "dnfl-podcast.js",   isExternal: false },
        { name: "Bylaws Rules",     url: "dnfl-rules.js",     isExternal: false }
    ];

    /**
     * Injects framework scripts sequentially to ensure dependency order
     * @param {number} index Index in SCRIPTS_TO_LOAD
     */
    function loadScriptSequentially(index) {
        if (index >= SCRIPTS_TO_LOAD.length) {
            console.log(`🚀 [DNFL Framework v${FRAMEWORK_VERSION}] All modules & dependencies loaded successfully.`);
            
            // Execute Framework Lifecycle Initialization
            initFrameworkLifecycle();
            return;
        }

        const scriptConfig = SCRIPTS_TO_LOAD[index];
        const scriptElement = document.createElement("script");

        // Construct full URL with controlled version query string
        const fullUrl = scriptConfig.isExternal 
            ? scriptConfig.url 
            : `${BASE_SCRIPT_URL}${scriptConfig.url}?v=${FRAMEWORK_VERSION}`;

        scriptElement.src = fullUrl;
        scriptElement.type = "text/javascript";
        scriptElement.async = false; // Maintain execution order in document flow

        scriptElement.onload = function() {
            console.log(`[DNFL Loader] Loaded layer (${index + 1}/${SCRIPTS_TO_LOAD.length}): ${scriptConfig.name}`);
            loadScriptSequentially(index + 1);
        };

        scriptElement.onerror = function(err) {
            console.error(`❌ [DNFL Loader Exception] Failed loading layer (${scriptConfig.name}): ${scriptConfig.url}`, err);
            // Non-blocking: Proceed to next script so a third-party CDN failure doesn't halt entire page
            loadScriptSequentially(index + 1);
        };

        const targetHead = document.head || document.getElementsByTagName('head')[0];
        targetHead.appendChild(scriptElement);
    }

    /**
     * Executes post-load framework bootstrapping and dispatches lifecycle events
     */
    async function initFrameworkLifecycle() {
        const apiClient = window.DNFLClient || (window.DNFL && window.DNFL.Client);

        if (apiClient && typeof apiClient.bootstrapLeagueMetadata === 'function') {
            try {
                // Bootstraps static league metadata once upon framework load
                await apiClient.bootstrapLeagueMetadata();
            } catch (err) {
                console.warn("[DNFL Loader] League metadata bootstrapping warning:", err);
            }
        }

        // Dispatch Custom Lifecycle Event Bus Milestones
        window.dispatchEvent(new CustomEvent('dnfl:ready', {
            detail: { version: FRAMEWORK_VERSION, client: apiClient }
        }));

        // Backwards compatibility event for legacy modules
        window.dispatchEvent(new CustomEvent('dnflFrameworkReady', {
            detail: { version: FRAMEWORK_VERSION }
        }));
    }

    // Start loading pipeline
    loadScriptSequentially(0);

})(window, document);
