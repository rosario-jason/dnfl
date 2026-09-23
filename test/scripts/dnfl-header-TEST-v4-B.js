/* ==========================================================================
   DNFL Master Header & Loader Script
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */

(function (window, document) {
    'use strict';

    // =========================================================================
    // 1. Expanded Framework Configuration
    // =========================================================================
    const CONFIG = {
        VERSION: "4.25-B",
        BASE_URL: "https://dnfl.live/test/scripts/",

        STYLESHEETS: [
            { id: "dnfl-global-css", url: "https://dnfl.live/test/css/dnfl-global-v4_20.css" }
        ],

        INFRASTRUCTURE: [
            { name: "fontawesome", url: "https://kit.fontawesome.com/aa3dbf3e4a.js", isExternal: true },
            { name: "papaparse", url: "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.6.1/papaparse.min.js", isExternal: true },
            { name: "marked",     url: "https://cdn.jsdelivr.net/npm/marked/marked.min.js", isExternal: true },
            { name: "api-client", url: "dnfl-api-client-v3_36.js" }
        ],

        FEATURE_MODULES: [
            // { name: "ui-enhancements", url: "dnfl-ui-enhancements-TEST.js" },
            { name: "standings", url: "dnfl-standings-v3_36.js" },
            { name: "rankings",  url: "dnfl-rankings-v3_36.js" },
            { name: "podcast",   url: "dnfl-podcast-v3_36.js" },
            { name: "rules",     url: "dnfl-rules-v3_36.js" },
            { name: "exporter",  url: "dnfl-exporter-v4_25.js" }
        ],

        CONDITIONAL_LIBRARIES: {
            chartjs: {
                url: "https://cdn.jsdelivr.net/npm/chart.js",
                targets: ["#dnfl_powerRankingChart", "#dnfl_chartWrapperContainer"]
            }
        }
    };

    const startTime = performance.now();
    const tag = `[DNFL Framework v${CONFIG.VERSION}]`;

    // =========================================================================
    // 2. Global Namespace & Utilities
    // =========================================================================
    window.DNFL = window.DNFL || {};
    window.DNFL.version = CONFIG.VERSION;
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
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));

            (document.head || document.documentElement).appendChild(script);
        });
    }

    /**
     * Dynamically injects CSS stylesheets
     */
    function loadStylesheet(sheet) {
        return new Promise((resolve) => {
            const href = sheet.url.startsWith('http') ? sheet.url : CONFIG.BASE_URL + sheet.url;
            if (document.querySelector(`link[href="${href}"], link[id="${sheet.id}"]`)) {
                resolve(href);
                return;
            }

            const link = document.createElement('link');
            if (sheet.id) link.id = sheet.id;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = href;

            link.onload = () => resolve(href);
            link.onerror = () => {
                console.warn(`${tag} Non-fatal warning: CSS stylesheet could not be loaded (${href})`);
                resolve(href);
            };

            (document.head || document.documentElement).appendChild(link);
        });
    }

    /**
     * Resolves absolute CDN URLs using CONFIG.BASE_URL for relative assets
     */
    function resolveUrl(item) {
        if (!item) return '';
        const urlStr = typeof item === 'string' ? item : item.url;
        if (item.isExternal || urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
            return urlStr;
        }
        return CONFIG.BASE_URL + urlStr.replace(/^\//, '');
    }

    // =========================================================================
    // 4. Master Framework Initialization Pipeline
    // =========================================================================
    async function bootstrap() {
        console.groupCollapsed(`${tag} Initializing Framework Loader...`);

        try {
            // Mobile Viewport Injection
            if (!document.querySelector('meta[name="viewport"]')) {
                const meta = document.createElement('meta');
                meta.name = 'viewport';
                meta.content = 'width=device-width, initial-scale=1.0';
                (document.head || document.documentElement).appendChild(meta);
                console.log(`${tag} Injected mobile viewport meta tag.`);
        }    
            
            // Stage 1: Global Stylesheets
            if (CONFIG.STYLESHEETS && CONFIG.STYLESHEETS.length > 0) {
                console.log(`${tag} Stage 1/4: Injecting Stylesheets (${CONFIG.STYLESHEETS.length} configured)...`);
                for (const cssItem of CONFIG.STYLESHEETS) {
                    const cssUrl = resolveUrl(cssItem);
                    console.log(`${tag} -> Injecting Stylesheet [${cssItem.id || 'css'}]: ${cssUrl}`);
                    await loadStylesheet(cssItem);
                    console.log(`${tag} -> Stylesheet loaded successfully (${cssUrl}).`);
                }
            }

            // Stage 2: Core Infrastructure Libraries (PapaParse, Marked, API Client)
            if (CONFIG.INFRASTRUCTURE && CONFIG.INFRASTRUCTURE.length > 0) {
                console.log(`${tag} Stage 2/4: Loading Core Infrastructure (${CONFIG.INFRASTRUCTURE.length} libraries)...`);
                for (const infra of CONFIG.INFRASTRUCTURE) {
                    const infraUrl = resolveUrl(infra);
                    console.log(`${tag} -> Loading Infrastructure [${infra.name}]: ${infraUrl}`);
                    await loadScript(infraUrl);
                    console.log(`${tag} -> Library [${infra.name}] loaded successfully (${infraUrl}).`);
                }
            }

            // Stage 3: Conditional Libraries (e.g., Chart.js)
            if (CONFIG.CONDITIONAL_LIBRARIES) {
                console.log(`${tag} Stage 3/4: Evaluating Conditional Libraries...`);
                for (const libKey in CONFIG.CONDITIONAL_LIBRARIES) {
                    const lib = CONFIG.CONDITIONAL_LIBRARIES[libKey];
                    const targets = lib.targets || [];
                    const needsLoading = targets.some(selector => document.querySelector(selector));

                    if (needsLoading) {
                        const libUrl = resolveUrl(lib);
                        console.log(`${tag} -> Target element present. Loading Conditional Library [${libKey}]: ${libUrl}`);
                        await loadScript(libUrl);
                        console.log(`${tag} -> Conditional Library [${libKey}] loaded successfully (${libUrl}).`);
                    } else {
                        // Attach DOM observer to load dynamically if element renders later
                        targets.forEach(selector => {
                            window.DNFL.Utils.onElementReady(selector, async () => {
                                const libUrl = resolveUrl(lib);
                                console.log(`${tag} -> Dynamic target (${selector}) rendered. Loading Conditional Library [${libKey}]: ${libUrl}`);
                                try {
                                    await loadScript(libUrl);
                                    console.log(`${tag} -> Conditional Library [${libKey}] loaded successfully (${libUrl}).`);
                                } catch (e) {
                                    console.warn(`${tag} Failed to load conditional library [${libKey}]:`, e);
                                }
                            });
                        });
                        console.log(`${tag} -> Targets for [${libKey}] not immediately present; watching DOM for dynamic render.`);
                    }
                }
            }

            // Stage 4: Feature Modules
            if (CONFIG.FEATURE_MODULES && CONFIG.FEATURE_MODULES.length > 0) {
                console.log(`${tag} Stage 4/4: Loading Feature Modules (${CONFIG.FEATURE_MODULES.length} configured)...`);

                const modulePromises = CONFIG.FEATURE_MODULES.map(async (mod) => {
                    const modUrl = resolveUrl(mod);
                    try {
                        console.log(`${tag} -> Loading Module [${mod.name}]: ${mod.url}`);
                        await loadScript(modUrl);
                        console.log(`${tag} -> Module [${mod.name}] loaded successfully (${mod.url}).`);
                    } catch (err) {
                        console.warn(`${tag} Warning: Feature module [${mod.name}] failed to load (${mod.url}).`, err);
                    }
                });

                await Promise.allSettled(modulePromises);
            }

            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`${tag} Framework initialization completed successfully in ${duration}ms.`);
            console.groupEnd();

            // Dispatch Framework Ready Event
            window.DNFL.isReady = true;
            window.dispatchEvent(new CustomEvent('dnfl:ready', {
                detail: {
                    version: CONFIG.VERSION,
                    timestamp: Date.now()
                }
            }));

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
