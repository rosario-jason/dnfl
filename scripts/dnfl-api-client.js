// dnfl-api-client.js v1.01
const DNFLClient = {
    // Cache tiers configurations
    CACHE_CONFIGS: {
        weekly:    7 * 24 * 60 * 60 * 1000, 
        daily:     24 * 60 * 60 * 1000,     
        hourly:    1 * 60 * 60 * 1000,
        halfHourly: 30 * 60 * 1000,
        quarterHourly: 15 * 60 * 1000,
        realtime:  30 * 1000             
    },

    // Dynamic API Request Registry Layout
    MFL_REQUEST_REGISTRY: [
        ['daily',    'league',           true,  ''],
        ['daily',    'leagueStandings',  true,  '&COLUMN_NAMES=1&ALL=1'],
        ['daily',    'rules',            true,  ''],
    ],

    // 1. SIMULTANEOUS REQUEST TRACKER
    // Tracks network handshakes actively flying through cyberspace to catch duplicate blocks
    activeFetches: {},

    async fetchData(MflRequestType) {
        const config = this.MFL_REQUEST_REGISTRY.find(row => row[1] === MflRequestType);
        
        if (!config) {
            console.error("DNFL Client Error: Request type [" + MflRequestType + "] not defined in registry.");
            return null;
        }

        const [frequency, , includeLeague, mflArgs] = config;
        const leagueId = window.league_id || null;
        const apiKey = window.apiKey || new URLSearchParams(window.location.search).get('APIKEY') || null;
        const activeHost = window.location.hostname || "://myfantasyleague.com";

        let targetYear = window.current_year || null;
        if (!targetYear) {
            const pathSegments = window.location.pathname.split('/');
            const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
            targetYear = foundYear ? foundYear : new Date().getFullYear();
        }

        if (includeLeague && !leagueId) {
            console.error("DNFL Client Error: " + MflRequestType + " requires an active League ID context.");
            return null;
        }

        const leagueSegment = (includeLeague && leagueId) ? "L" + leagueId : 'GLOBAL';
        const cacheKey = "dnfl_" + MflRequestType + "_" + leagueSegment + "_Y" + targetYear;
        
        const cachedRecord = localStorage.getItem(cacheKey);
        const currentTime = Date.now();
        const allowedTtl = this.CACHE_CONFIGS[frequency];

        // Cache Hit: Serve instantly from browser memory
        if (cachedRecord) {
            const parsedRecord = JSON.parse(cachedRecord);
            if (currentTime - parsedRecord.timestamp < allowedTtl) {
                console.log("[" + MflRequestType + "] - Loading from DNFL browser cache");
                return parsedRecord.payload;
            }
        }

        // 2. THE DEDUPLICATOR ENGINE
        // If an identical request is ALREADY downloading, join that active promise instead of making a new one
        if (this.activeFetches[cacheKey]) {
            console.log("[" + MflRequestType + "] - Simultaneous call detected. Bundling with existing network stream.");
            return this.activeFetches[cacheKey];
        }

        // Cache Miss: Initiate a single, secure network handshake wrapped inside a trackable Promise
        this.activeFetches[cacheKey] = (async () => {
            try {
                console.log("[" + MflRequestType + "] - API request from https://" + activeHost + "/" + targetYear + "/export?TYPE=" + MflRequestType);
                
                let mflUrl = "https://" + activeHost + "/" + targetYear + "/export?TYPE=" + MflRequestType + "&JSON=1";
                if (includeLeague && leagueId) mflUrl += "&L=" + leagueId.toString().trim();
                if (apiKey)                   mflUrl += "&APIKEY=" + apiKey.toString().trim();
                if (mflArgs)                  mflUrl += mflArgs.toString().trim();
                
                const response = await fetch(mflUrl);
                if (!response.ok) throw new Error("MFL Server rejected connection request.");
                
                const data = await response.json();

                const recordToCache = {
                    timestamp: currentTime,
                    payload: data
                };
                localStorage.setItem(cacheKey, JSON.stringify(recordToCache));

                return data;
            } catch (error) {
                console.error("DNFL Network Exception [" + MflRequestType + "]:", error.message);
                if (cachedRecord) return JSON.parse(cachedRecord).payload;
                return null;
            } finally {
                // 3. FLUSH THE TRACKER
                // Remove the tracking link once the data arrives, leaving the pipeline completely clear for future calls
                delete this.activeFetches[cacheKey];
            }
        })();

        return this.activeFetches[cacheKey];
    }
};
