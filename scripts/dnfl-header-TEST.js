/* ==========================================================================
   DNFL Master Header & Loader Script (v3.00-TEST2)
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */

(function (window, document) {
    'use strict';

    // =========================================================================
    // 1. Framework Configuration
    // =========================================================================
    const CONFIG = {
        FRAMEWORK_VERSION: 'TEST',
        BASE_URL: 'https://dnfl.live/',
        API_CLIENT_SCRIPT: 'dnfl-api-client-TEST.js',
        GLOBAL_CSS: 'dnfl-global.css',
        FEATURE_MODULES: [
            { name: 'standings', url: 'dnfl-standings-TEST.js' },
            { name: 'rankings',  url: 'dnfl-rankings.js' },
            { name: 'podcast',   url: 'dnfl-podcast-TEST.js' },
            { name: 'rules',     url: 'dnfl-rules.js' }
        ]
    };

    const startTime = performance.now();
    const tag = `[DNFL Framework ${CONFIG.FRAMEWORK_VERSION}]`;

    // =========================================================================
    // 2. Global Namespace Initialization
    // =========================================================================
    window.DNFL = window.DNFL || {};
    window.DNFL.version = CONFIG.FRAMEWORK_VERSION;
    window.DNFL.Utils = window.DNFL.Utils || {};

    /**
     * DOM MutationObserver Helper (Replaces polling timers)
     * Executes callback as soon as selector renders in the DOM.
     */
    window.DNFL.Utils.onElementReady = function (selector, callback) {
        if (!selector || typeof callback !== 'function') return;

        const check = () => {
            const el = document.querySelector(selector);
            if (el) {
                callback(el);
                return true;
            }
            return false;
        };

        if (check()) return;

        const observer = new MutationObserver((_, obs) => {
            if (check()) obs.disconnect();
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    };

    // =========================================================================
    // 3. Resource Loading Helpers
    // =========================================================================

    /**
     * Dynamically injects JavaScript files asynchronously
     */
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) {
                resolve(url);
                return;
            }

            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            script.async = true;

            script.onload = () => resolve(url);
            script.onerror = (err) => reject(new Error(`Failed to load script: ${url}`));

            (document.head || document.documentElement).appendChild(script);
        });
    }

    /**
     * Dynamically injects CSS stylesheets
     */
    function loadStylesheet(url) {
        return new Promise((resolve) => {
            if (document.querySelector(`link[href="${url}"]`)) {
                resolve(url);
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = url;

            link.onload = () => resolve(url);
            link.onerror = () => {
                console.warn(`${tag} Non-fatal warning: CSS stylesheet could not be loaded (${url})`);
                resolve(url);
            };

            (document.head || document.documentElement).appendChild(link);
        });
    }

    /**
     * Resolves absolute CDN URLs
     */
    function resolveUrl(filename) {
        if (!filename) return '';
        if (filename.startsWith('http://') || filename.startsWith('https://')) {
            return filename;
        }
        return CONFIG.BASE_URL + filename.replace(/^\//, '');
    }

    // =========================================================================
    // 4. Master Framework Initialization Pipeline
    // =========================================================================
    async function bootstrap() {
        console.groupCollapsed(`${tag} Initializing Framework Loader...`);

        try {
            // Stage 1: Core API Client Middleware
            const apiClientUrl = resolveUrl(CONFIG.API_CLIENT_SCRIPT);
            console.log(`${tag} Stage 1/3: Loading Core API Middleware (${CONFIG.API_CLIENT_SCRIPT})...`);
            await loadScript(apiClientUrl);
            console.log(`${tag} -> Core API Middleware loaded successfully (${CONFIG.API_CLIENT_SCRIPT}).`);

            // Stage 2: Global CSS Stylesheet
            const cssUrl = resolveUrl(CONFIG.GLOBAL_CSS);
            console.log(`${tag} Stage 2/3: Injecting Global Stylesheet (${CONFIG.GLOBAL_CSS})...`);
            await loadStylesheet(cssUrl);
            console.log(`${tag} -> Global Stylesheet injected (${CONFIG.GLOBAL_CSS}).`);

            // Stage 3: Feature Modules
            console.log(`${tag} Stage 3/3: Loading Feature Modules (${CONFIG.FEATURE_MODULES.length} configured)...`);

            const modulePromises = CONFIG.FEATURE_MODULES.map(async (mod) => {
                const modUrl = resolveUrl(mod.url);
                try {
                    console.log(`${tag} -> Loading Module [${mod.name}]: ${mod.url}`);
                    await loadScript(modUrl);
                    console.log(`${tag} -> Module [${mod.name}] loaded successfully (${mod.url}).`);
                } catch (err) {
                    console.warn(`${tag} Warning: Feature module [${mod.name}] failed to load (${mod.url}).`, err);
                }
            });

            await Promise.allSettled(modulePromises);

            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`${tag} Framework initialization completed successfully in ${duration}ms.`);
            console.groupEnd();

            // Dispatch Event
            window.DNFL.isReady = true;
            const readyEvent = new CustomEvent('dnfl:ready', {
                detail: {
                    version: CONFIG.FRAMEWORK_VERSION,
                    timestamp: Date.now()
                }
            });
            window.dispatchEvent(readyEvent);

        } catch (fatalErr) {
            console.error(`${tag} Fatal Core Initialization Error:`, fatalErr);
            console.groupEnd();
        }
    }

    // Execute Bootstrap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})(window, document);
