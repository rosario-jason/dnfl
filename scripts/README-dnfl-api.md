# Duke Networking Fantasy League (DNFL) - Infrastructure & API Client Guide

## 1. Executive Summary & Core Infrastructure Architecture

The **DNFL Core Infrastructure** consists of two foundational scripts located in `scripts/`:

1. **Framework Header Loader (`scripts/dnfl-header.js`)**: Serves as the single bootstrap entry point for host platforms like MyFantasyLeague (MFL). It orchestrates mobile viewport enforcement, asynchronous stylesheet injection (`css/dnfl-global.css`), dependency library loading (FontAwesome 6, PapaParse, Marked, Chart.js), feature module execution, and dispatches the global `dnfl:ready` lifecycle event.
2. **Central API Client Middleware (`scripts/dnfl-api-client.js`)**: Encapsulates all network traffic through the `DNFL.Client` (`window.DNFLClient`) singleton. It provides multi-tier caching (RAM + LocalStorage), cross-tab cache synchronization via native `BroadcastChannel`, request deduplication, isolated cache keys (`_L{leagueId}_Y{year}`), HTML response guards, and automated logged-in user franchise resolution.

### Core Architectural Mandates
* **Single Entry Script**: Host pages embed a single script tag pointing to `scripts/dnfl-header.js`. Direct loading of individual module scripts or raw stylesheets on host pages is prohibited.
* **Zero Direct Fetches**: Feature modules must never execute raw `fetch()` or `jQuery.ajax()` calls. All network requests must route through `DNFL.Client`.
* **Clean Namespace**: Infrastructure and modules export cleanly under `window.DNFL` (`window.DNFL.Client`, `window.DNFL.Standings`, etc.).

---

## 2. Directory & Component Layout

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
│
├── css/
│   └── dnfl-global.css                 # Master design system stylesheet
│
└── scripts/
    ├── dnfl-header.js                  # Central bootstrap loader & dependency orchestrator
    ├── dnfl-api-client.js              # Central API middleware & caching engine
    └── README-dnfl-api.md              # Infrastructure & API Client guide (This file)
```

---

## 3. Framework Header Loader (`scripts/dnfl-header.js`)

The framework loader manages initialization, dependency loading order, and DOM readiness.

### 3.1 Mobile Viewport Enforcement
Upon execution, `dnfl-header.js` inspects the document `<head>`. If a viewport meta tag is missing, it dynamically injects:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### 3.2 Four-Stage Bootstrap Pipeline

```text
[Page Mount: dnfl-header.js]
       │
       ▼
[Stage 1: Async CSS Injection] ──────────► Inject /css/dnfl-global.css <link>
       │
       ▼
[Stage 2: Core Infrastructure] ──────────► Load FontAwesome 6, PapaParse, Marked, dnfl-api-client.js
       │
       ▼
[Stage 3: Conditional Libraries] ────────► Evaluate DOM (e.g. #dnfl_powerRankingChart)
       │                                  Inject Chart.js or attach MutationObserver
       ▼
[Stage 4: Feature Modules Async] ────────► Asynchronously inject dnfl-standings, dnfl-rankings,
       │                                  dnfl-rules, dnfl-podcast, dnfl-exporter
       ▼
[Stage 5: Framework Readiness] ──────────► Dispatch custom event 'dnfl:ready' on window
                                          Set window.DNFL.isReady = true
```

1. **Stage 1: Async Stylesheet Injection**: Injects `<link rel="stylesheet" href="https://dnfl.live/css/dnfl-global.css">` into `<head>` without blocking DOM rendering.
2. **Stage 2: Core Infrastructure Libraries**: Injects critical dependencies in parallel:
   * FontAwesome 6 Font Kit
   * PapaParse CSV Parser (`papaparse.min.js`)
   * Marked Markdown Parser (`marked.min.js`)
   * Central API Middleware (`scripts/dnfl-api-client.js`)
3. **Stage 3: Conditional Heavy Libraries (Chart.js)**: Scans the DOM for targets requiring Chart.js (e.g., `#dnfl_powerRankingChart`). If target elements render asynchronously later, a `MutationObserver` (`DNFL.Utils.onElementReady`) defers library injection until the target element mounts.
4. **Stage 4: Feature Module Scripts**: Asynchronously loads feature module scripts (`dnfl-standings.js`, `dnfl-rankings.js`, `dnfl-rules.js`, `dnfl-podcast.js`, `dnfl-exporter.js`).
5. **Stage 5: Framework Readiness Signal**: When all stages complete successfully, the loader sets `window.DNFL.isReady = true` and dispatches a custom event on `window`:
```javascript
window.dispatchEvent(new CustomEvent('dnfl:ready', { detail: { timestamp: Date.now() } }));
```

---

## 4. Central API Client Middleware (`scripts/dnfl-api-client.js`)

The `DNFL.Client` singleton is the central communications engine for all framework data fetching.

### 4.1 Multi-Tier Caching Architecture
`DNFL.Client` implements a 2-level caching mechanism to eliminate redundant network requests:

1. **In-Memory RAM Cache (`RAM_CACHE`)**: An active JavaScript `Map` providing instant zero-latency lookups during the active page session.
2. **Persistent LocalStorage Cache (`DNFL.Cache`)**: Serializes responses into browser `localStorage` with explicit Time-To-Live (TTL) expiration timestamps.

#### TTL Presets (`client.TTL`)
| Preset Name | Duration | Standard Use Case |
| :--- | :--- | :--- |
| `client.TTL.REALTIME` | 30 Seconds | Live Matchup Scores & Play-by-Play |
| `client.TTL.FIVE_MIN` | 5 Minutes | Weekly Standings & Live Leaderboards |
| `client.TTL.HOURLY` | 1 Hour | Weekly Results, Rosters & Schedule Feeds |
| `client.TTL.DAILY` | 24 Hours | Bylaws, Manifests & Historical CSVs |
| `client.TTL.WEEKLY` | 7 Days | Static League Metadata & Season Configurations |

#### Storage Quota Guard & Stale Eviction
If `localStorage` reaches capacity during a write, `DNFL.Cache` automatically catches the `QuotaExceededError`, purges expired `dnfl_` cache entries, and retries the operation seamlessly.

### 4.2 Cross-Tab Cache Synchronization
To ensure data consistency across multiple open browser tabs, `DNFL.Client` initializes a native `BroadcastChannel('dnfl_cache_sync')`. When a tab invalidates or clears a cache key, a message is broadcast to all active tabs, instantly evicting the key from their local `RAM_CACHE` and `localStorage`.

### 4.3 Request Deduplication Queue (`ACTIVE_FETCHES`)
If multiple components simultaneously request the exact same URL/endpoint before the first request finishes, `DNFL.Client` registers the request in an `ACTIVE_FETCHES` `Map`. Subsequent calls receive the existing active `Promise`, executing only **one underlying network HTTP request** and resolving all callers simultaneously.

### 4.4 HTML Response Guard
When fetching raw text files (`.json`, `.csv`, `.md`) via `client.fetchRawText()`, the response body is evaluated before parsing. If host platforms (such as MFL) redirect a missing file or failed endpoint to an HTML error page (returning `200 OK` with `<!DOCTYPE html>`), `DNFL.Client` detects the HTML tag, rejects the promise, and prevents script syntax crashes.

### 4.5 Deterministic & Isolated Cache Keys
Cache keys are deterministically generated to prevent cross-league or cross-year data leaks:
```text
{TYPE}_{SEGMENT}_L{LEAGUE_ID}_Y{YEAR}_{PARAMS_HASH}
```
*Example*: `MFL_API_L33580_Y2026_TYPE_leagueStandings_W_1`

### 4.6 User Franchise & Session Resolution (`bootstrapMetadata()`)
On initialization, `DNFL.Client` fetches `league` metadata and resolves user session details:
* **Franchise Lookup Map (`DNFL.franchiseMap`)**: Constructs a normalized 4-digit ID map (`"0001"`, `"0002"`, ...) mapping franchise IDs to team names, owner names, division IDs, and icon URLs.
* **5-Tier Logged-In Franchise Resolution**: Auto-detects the active logged-in user's franchise ID by checking across 5 context layers:
  1. Global MFL JavaScript variables (`window.franchise_id`)
  2. URL search parameters (`?FRANCHISE_ID=...`)
  3. MFL Session Cookies (`MFL_FRANCHISE_ID`)
  4. Host page DOM links (`a[href*="options?O="]`)
  5. Login form input fields
* **DOM Highlighting**: Sets `DNFL.loggedInFranchiseId` and automatically adds user highlighting classes (`.dnfl-my-team`, `.dnfl-myfranchise`) to matching data rows.

---

## 5. API Client Method Reference

### `DNFL.Client.fetchData(endpoint, params, options)`
Fetches JSON data from the MFL API or custom endpoints with caching.
* **Arguments**:
  * `endpoint` *(string)*: MFL API export type (e.g., `'leagueStandings'`, `'weeklyResults'`, `'rosters'`).
  * `params` *(object)*: Query string parameters (e.g., `{ W: 1, L: 33580 }`).
  * `options` *(object)*: Configuration object:
    * `ttl` *(number)*: Cache duration in ms (e.g., `DNFL.Client.TTL.HOURLY`).
    * `bypassCache` *(boolean)*: If `true`, forces a network refresh.
* **Returns**: `Promise<object>` - Parsed JSON response.

```javascript
const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;

try {
    const data = await client.fetchData('leagueStandings', { W: 1 }, { ttl: client.TTL.HOURLY });
    console.log("Standings data:", data.leagueStandings);
} catch (err) {
    console.error("Failed to fetch standings:", err);
}
```

---

### `DNFL.Client.fetchRawText(url, options)`
Fetches text feeds (`.csv`, `.json`, `.md`) from external sources or CDNs with caching and HTML error page protection.
* **Arguments**:
  * `url` *(string)*: Full URL to text asset.
  * `options` *(object)*: `{ ttl: number, bypassCache: boolean }`.
* **Returns**: `Promise<string>` - Raw text content.

```javascript
try {
    const csvText = await client.fetchRawText(
        'https://dnfl.live/dnfl_rankings/2026/data_01.csv',
        { ttl: client.TTL.DAILY }
    );
    const parsedData = Papa.parse(csvText, { header: true });
} catch (err) {
    console.error("Failed to fetch rankings CSV:", err);
}
```

---

### `DNFL.Client.getLoggedInFranchiseId()`
Returns the normalized 4-digit franchise ID of the active logged-in user, or `null` if unauthenticated.
* **Returns**: `string | null` (e.g., `"0004"`).

---

### `DNFL.Client.getFranchise(franchiseId)`
Retrieves metadata for a specific franchise from the normalized lookup map.
* **Arguments**: `franchiseId` *(string|number)* (e.g., `"0001"` or `1`).
* **Returns**: `object | null` - `{ id, name, owner_name, icon, division }`.

---

### `DNFL.Client.clearCache()` / `DNFL.Client.invalidateCache(keyPattern)`
* `clearCache()`: Purges all `dnfl_` keys from RAM and LocalStorage, broadcasting the clear event across tabs.
* `invalidateCache(keyPattern)`: Invalidates specific cache keys matching a substring or regex pattern.

---

## 6. Developer Guide: Integrating API Middleware into a Feature Module

Follow this standardized pattern when creating a new feature module engine (e.g., `scripts/dnfl-myfeature.js`):

### Standard Integration Boilerplate

```javascript
/* ==========================================================================
   DNFL MyFeature Module Logic Engine
   ========================================================================== */
(function(window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};

    let retryCount = 0;
    const maxRetries = 50;

    /**
     * Safely resolve API Client Middleware
     */
    function getApiClient() {
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("[DNFL MyFeature] DNFL.Client API middleware is unavailable.");
        }
        return client;
    }

    /**
     * Module Initialization Routine
     */
    async function init() {
        const container = document.getElementById('dnfl-myfeature-container');
        
        // Handle Asynchronous DOM Mounting
        if (!container) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        try {
            const client = getApiClient();

            // 1. Fetch MFL API Data with 1-Hour TTL
            const standingsData = await client.fetchData('leagueStandings', {}, {
                ttl: client.TTL.HOURLY
            });

            // 2. Fetch Raw External Feeds with Daily TTL
            const rawConfig = await client.fetchRawText('https://dnfl.live/dnfl_myfeature/config.json', {
                ttl: client.TTL.DAILY
            });

            // 3. Resolve Active User Session
            const userFranchiseId = client.getLoggedInFranchiseId();

            renderUI(container, standingsData, JSON.parse(rawConfig), userFranchiseId);

        } catch (err) {
            console.error("[DNFL MyFeature] Initialization error:", err);
            renderErrorState(container, err);
        }
    }

    function renderUI(container, data, config, userId) {
        // Render UI using framework CSS classes
    }

    function renderErrorState(container, err) {
        const content = container.querySelector('#dnfl-myfeature-content');
        if (content) {
            content.innerHTML = '<div class="dnfl-status-error">Failed to load module data.</div>';
        }
    }

    // Export Module API onto window.DNFL
    window.DNFL.MyFeature = { init: init };

    // Event-Driven Lifecycle Binding
    window.addEventListener('dnfl:ready', init);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
```

### Developer Best Practices Checklist
1. **Never Call `fetch()` Directly**: Always use `client.fetchData()` or `client.fetchRawText()`.
2. **Always Specify TTL**: Select an appropriate TTL preset (`REALTIME`, `HOURLY`, `DAILY`) to respect host platform rate limits and optimize load speeds.
3. **Handle Mounting Delays**: Implement retry guards for container element discovery (`setTimeout(init, 100)`).
4. **Bind to `dnfl:ready`**: Register initialization logic to `window.addEventListener('dnfl:ready', init)` to guarantee all core libraries are loaded before code execution.
5. **Sanitize Data Fetches**: Handle rejected promises gracefully and render clean `.dnfl-status-error` UI messaging instead of leaving blank screens or console exceptions.
