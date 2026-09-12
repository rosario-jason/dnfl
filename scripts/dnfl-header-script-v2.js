// dnfl-header-script-v2.js v1.0
/* ==========================================================================
   DNFL Central Framework Header Loader & Dependency Manager
   ========================================================================== */
(function() {
    'use strict';

    // 1. EARLY GLOBAL NAMESPACE INITIALIZATION
    window.DNFL = window.DNFL || {};

    // 2. FRAMEWORK VERSION (Increment this to bust browser cache globally)
    const FRAMEWORK_VERSION = "2.00";
    const BASE_URL = "https://dnfl.live/scripts/";

    /* 3. MASTER CHRONOLOGICAL SCRIPT REGISTRY
       - External CDN libraries are loaded first so modules have access to dependencies.
       - Core API client loads before individual UI feature modules.
    */
    const SCRIPTS_TO_LOAD = [
        // Third-Party Libraries
        { url: "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.6.1/papaparse.min.js", isExternal: true },
        { url: "https://cdn.jsdelivr.net/npm/chart.js", isExternal: true },
        { url: "https://cdn.jsdelivr.net/npm/marked/marked.min.js", isExternal: true },

        // Core Framework & API Engine
        { url: "dnfl-api-client-v2.js", isExternal: false },

        // Feature Modules
        { url: "dnfl-standings-v2.js", isExternal: false },
        { url: "dnfl-rankings-v2.js", isExternal: false },
        { url: "dnfl-podcast-v2.js", isExternal: false },
        { url: "dnfl-rules-v2.js", isExternal: false }
    ];

    /**
     * Injects scripts in strict sequential order
     * @param {number} index 
     */
    function loadScriptSequentially(index) {
        if (index >= SCRIPTS_TO_LOAD.length) {
            console.log("🚀 [DNFL Framework] All modules & dependencies loaded successfully.");
            
            // Dispatch custom event to notify custom modules if needed
            window.dispatchEvent(new CustomEvent('dnflFrameworkReady', { detail: { version: FRAMEWORK_VERSION } }));
            return;
        }

        const scriptConfig = SCRIPTS_TO_LOAD[index];
        const scriptElement = document.createElement("script");
        
        // Construct full URL with controlled versioning
        const fullUrl = scriptConfig.isExternal 
            ? scriptConfig.url 
            : `${BASE_URL}${scriptConfig.url}?v=${FRAMEWORK_VERSION}`;

        scriptElement.src = fullUrl;
        scriptElement.type = "text/javascript";
        scriptElement.async = false; // Preserve execution order

        scriptElement.onload = function() {
            console.log(`[DNFL Loader] Loaded layer (${index + 1}/${SCRIPTS_TO_LOAD.length}): ${scriptConfig.url}`);
            loadScriptSequentially(index + 1);
        };

        scriptElement.onerror = function(err) {
            console.error(`❌ [DNFL Loader Exception] Failed to execute layer: ${scriptConfig.url}`, err);
            // Non-blocking: continue loading remaining framework modules
            loadScriptSequentially(index + 1);
        };

        document.head.appendChild(scriptElement);
    }

    // Start loading pipeline
    loadScriptSequentially(0);
})();