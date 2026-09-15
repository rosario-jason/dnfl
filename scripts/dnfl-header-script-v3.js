/**
 * ============================================================================
 * Duke Networking Fantasy League (DNFL) Framework Header Script
 * File: dnfl-header-script-v3.js
 * Version: 3.00
 * Description: Master script loader and framework cache manager.
 * ============================================================================
 */
(function () {
    'use strict';

    // 1. Framework Master Version (Bump to force cache refresh across all user browsers)
    const FRAMEWORK_VERSION = "3.00";
    window.DNFL_FRAMEWORK_VERSION = FRAMEWORK_VERSION;

    // 2. Global Namespace Initialization
    window.DNFL = window.DNFL || {};
    window.DNFL.version = FRAMEWORK_VERSION;

    /**
     * Versioned Cache Invalidation
     * Checks stored framework version against active FRAMEWORK_VERSION.
     * Flushes stale localStorage API cache entries if version mismatch is detected.
     */
    (function syncCacheVersion() {
        try {
            const storedVersion = localStorage.getItem('dnfl_framework_version');
            if (storedVersion !== FRAMEWORK_VERSION) {
                console.log(`[DNFL Header] Version change detected (${storedVersion || 'None'} -> ${FRAMEWORK_VERSION}). Purging stale API cache...`);
                
                // Evict all DNFL API cache items
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('dnfl_cache_') || key.startsWith('dnfl_api_'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));

                // Update stored version marker
                localStorage.setItem('dnfl_framework_version', FRAMEWORK_VERSION);
                console.log(`[DNFL Header] API cache cleared successfully for v${FRAMEWORK_VERSION}.`);
            }
        } catch (e) {
            console.warn('[DNFL Header] Storage sync error:', e);
        }
    })();

    /**
     * Asset Loader Helper
     * Dynamically injects CSS or JS dependencies with version query parameters.
     */
    window.DNFL.loadAsset = function (url, type = 'js') {
        const cacheBustUrl = url.includes('?') 
            ? `${url}&v=${FRAMEWORK_VERSION}` 
            : `${url}?v=${FRAMEWORK_VERSION}`;

        if (type === 'css') {
            if (!document.querySelector(`link[href*="${url}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = cacheBustUrl;
                document.head.appendChild(link);
            }
        } else if (type === 'js') {
            if (!document.querySelector(`script[src*="${url}"]`)) {
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = cacheBustUrl;
                script.async = true;
                document.head.appendChild(script);
            }
        }
    };

    console.log(`[DNFL Header] Loaded v${FRAMEWORK_VERSION} initialized.`);
})();
