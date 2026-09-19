/* ==========================================================================
   DNFL Framework Script Loader & Version Controller
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */

(function (window, document) {
    'use strict';

    const CONFIG = {
        VERSION: "3.03-TEST4",
        BASE_URL: "https://dnfl.live/scripts/",

        STYLESHEETS: [
            { id: "dnfl-global-css", url: "https://dnfl.live/css/dnfl-global.css" }
        ],

        INFRASTRUCTURE: [
            { name: "papaparse", url: "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.6.1/papaparse.min.js", isExternal: true },
            { name: "api-client", url: "dnfl-api-client-TEST4.js" }
        ],

        FEATURE_MODULES: [
            { name: "standings", url: "dnfl-standings.js" },
            { name: "rankings",  url: "dnfl-rankings.js" },
            { name: "podcast",   url: "dnfl-podcast-TEST1.js" },
            { name: "rules",     url: "dnfl-rules.js" }
        ],

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

    window.DNFL = window.DNFL || {};

    CONFIG.STYLESHEETS.forEach(sheet => {
        if (!document.getElementById(sheet.id)) {
            const cssLink = document.createElement('link');
            cssLink.id = sheet.id;
            cssLink.rel = 'stylesheet';
            cssLink.href = `${sheet.url}?v=${CONFIG.VERSION}`;
            document.head.appendChild(cssLink);
        }
    });

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

    async function loadScriptsSequentially(scriptList) {
        for (const scriptConfig of scriptList) {
            await loadScript(scriptConfig);
        }
    }

    function loadConditionalLibrary(libKey, force = false) {
        return new Promise((resolve) => {
            const lib = CONFIG.CONDITIONAL_LIBRARIES[libKey];
            if (!lib) return resolve(false);

            if (lib.loaded) return resolve(true);

            const containerExists = force || lib.targets.some(selector => document.querySelector(selector) !== null);

            if (containerExists) {
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
                    lib.loaded = false;
                    resolve(false);
                };
                document.head.appendChild(script);
            } else {
                resolve(false);
            }
        });
    }

    async function loadRequiredConditionalLibraries() {
        const tasks = Object.keys(CONFIG.CONDITIONAL_LIBRARIES).map(key => loadConditionalLibrary(key, false));
        await Promise.all(tasks);
    }

    DNFL.Utils = DNFL.Utils || {};

    DNFL.Utils.onElementReady = function (selector, callback) {
        const check = () => {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
                return true;
            }
            return false;
        };

        if (check()) return;

        const startObserver = () => {
            if (check()) return;
            const target = document.body || document.documentElement;
            const observer = new MutationObserver((mutations, obs) => {
                if (check()) {
                    obs.disconnect();
                }
            });
            observer.observe(target, { childList: true, subtree: true });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startObserver);
        } else {
            startObserver();
        }
    };

    DNFL.Utils.loadLibrary = function (libKey) {
        return loadConditionalLibrary(libKey, true);
    };

    (async function initializeFramework() {
        await loadScriptsSequentially(CONFIG.INFRASTRUCTURE);
        await loadRequiredConditionalLibraries();
        await loadScriptsSequentially(CONFIG.FEATURE_MODULES);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadRequiredConditionalLibraries);
        }

        window.dispatchEvent(new CustomEvent('dnfl:ready', { detail: { version: CONFIG.VERSION } }));
        window.dispatchEvent(new CustomEvent('dnflFrameworkReady', { detail: { version: CONFIG.VERSION } }));
    })();

})(window, document);
