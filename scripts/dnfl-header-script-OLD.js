// dnfl-header-script.js v1.01
(function() {
    // ==========================================
    // 1. MASTER SCRIPT REGISTRY
    // Add script names here as you create them!
    // ==========================================
    const SCRIPTS_TO_LOAD = [
        "dnfl-api-client.js?v1.01",
        "dnfl-standings.js?v1.02"
    ];

    // ==========================================
    // 2. CHRONOLOGICAL INJECTION ENGINE
    // ==========================================
    const baseUrl = "https://dnfl.live/scripts/";
    // Automatically creates a unique timestamp to force browser cache bypass on every single load
    const cacheBuster = "?v=" + new Date().getTime(); 

    function loadScriptSequentially(index) {
        if (index >= SCRIPTS_TO_LOAD.length) {
            console.log("🚀 All DNFL Framework Modules initialized successfully.");
            return;
        }

        const scriptName = SCRIPTS_TO_LOAD[index];
        const scriptElement = document.createElement("script");
        
        scriptElement.src = baseUrl + scriptName + cacheBuster;
        scriptElement.type = "text/javascript";
        
        // Triggers the next file in the list only after the current one fully loads
        scriptElement.onload = function() {
            loadScriptSequentially(index + 1);
        };

        scriptElement.onerror = function() {
            console.error("❌ DNFL Loader Exception: Failed to execute layer " + scriptName);
            loadScriptSequentially(index + 1);
        };

        document.head.appendChild(scriptElement);
    }

    // Start loading sequence at index 0
    loadScriptSequentially(0);
})();
