# Duke Networking Fantasy League (DNFL) Framework Architecture & Developer Guide

## 1. Executive Summary & System Philosophy

The **Duke Networking Fantasy League (DNFL) Framework** is a modular, client-side web application architecture engineered to embed rich, interactive fantasy football modules—such as dynamic standings, z-score power rankings, interactive bylaws, media players, and commissioner data exporters—directly into host platforms like MyFantasyLeague (MFL).

The framework enforces a strict **Separation of Concerns** across four architectural layers:

1. **Presentation & Design System (`css/dnfl-global.css`)**: All layout, typography, colors, responsive card wrappers, and component styles are governed by consolidated SCSS partials and CSS variables (`:root, .dnfl`). Inline `style="..."` attributes are strictly prohibited in HTML embeds and JavaScript templates.
2. **State & DOM Visibility (`.dnfl-is-hidden`, `.is-expanded`)**: Component states (collapsed accordions, hidden action bars, loading indicators) are managed exclusively through framework CSS utility classes, eliminating direct `.style.display` or `.style.color` DOM assignments in JavaScript.
3. **Centralized Data & API Middleware (`scripts/dnfl-api-client.js`)**: All network communication routes through `DNFL.Client` (`window.DNFLClient`), providing multi-tier caching (RAM + LocalStorage), cross-tab synchronization via `BroadcastChannel`, request deduplication, isolated cache keys (`_L{leagueId}_Y{year}`), and HTML response guards. Direct `fetch()` calls from feature modules are strictly forbidden.
4. **Lifecycle & Orchestration (`scripts/dnfl-header.js`)**: A centralized loader handles asynchronous asset injection, MutationObserver DOM readiness, mobile viewport enforcement, and dispatches a unified custom event (`dnfl:ready`) when all dependencies and feature scripts are fully loaded.

---

## 2. Repository Directory Structure & File Map

The framework repository maintains a clean separation between core infrastructure scripts, design system stylesheets, and module-specific embeds and data assets:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
│
├── css/
│   └── dnfl-global.css                 # Master design system & CSS variables
│
├── dnfl_podcast/
│   ├── README-dnfl-podcast.md          # Podcast module developer guide
│   ├── devils_advocate_logo.png        # Podcast module branding banner
│   ├── hpm-podcast-embed.html          # HTML embed shell stub for MFL
│   └── 2026/                           # Season media & transcript directory
│       ├── episodes.json               # Dynamic episode index manifest
│       ├── DA_S1E1.m4a                 # Audio stream file
│       └── DA_S1E1.md                  # Markdown transcript file
│
├── dnfl_rankings/
│   ├── README-dnfl-rankings.md          # Power rankings developer guide
│   ├── hpm-rankings-embed.html         # HTML embed shell stub for MFL
│   └── 2026/                           # Season rankings data directory
│       ├── weeks.json                  # Published weeks directory manifest
│       ├── data_00_pre-season.csv      # Pre-season rankings CSV data
│       └── data_01.csv                 # Weekly rankings CSV data
│
├── dnfl_rules/
│   ├── README-dnfl-rules.md             # Bylaws module developer guide
│   └── hpm-rules-embed.html            # Official bylaws HTML embed shell stub for MFL
│
├── dnfl_standings/
│   ├── README-dnfl-standings.md        # Standings module developer guide
│   ├── hpm-standings-embed.html        # Standings HTML embed shell stub for MFL
│   └── standings_rules.json            # Dynamic season-by-season rules configuration
│
├── dnfl_exporter/
│   ├── README-dnfl-exporter.md         # Exporter module developer guide
│   └── hpm-exporter-embed.html         # Commissioner exporter HTML embed shell stub for MFL
│
└── scripts/
    ├── dnfl-header.js                  # Framework script loader & version controller
    ├── dnfl-api-client.js              # Central API middleware (caching & deduplication)
    ├── dnfl-standings.js               # Dynamic standings & seeding engine
    ├── dnfl-rankings.js                # Power rankings CSV parser & Chart.js engine
    ├── dnfl-rules.js                   # Official bylaws interactive accordion engine
    ├── dnfl-podcast.js                 # Audio stream player & transcript viewer
    └── dnfl-exporter.js                # Data extraction & z-score power rankings engine
```

---

## 3. System Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                            MFL HOST PAGE (HTML / HPM)                             |
|  +-----------------------------------------------------------------------------+  |
|  | <script src="https://dnfl.live/scripts/dnfl-header.js"></script>             |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                   DNFL HEADER LOADER (dnfl-header.js)                             |
|  Stage 1: Inject Global CSS: /css/dnfl-global.css                                 |
|  Stage 2: Load Core Infra: FontAwesome 6, PapaParse, Marked.js, API Client        |
|  Stage 3: Load Conditional Libraries: Chart.js (via MutationObserver)             |
|  Stage 4: Load Feature Modules: dnfl-standings, dnfl-rankings, dnfl-rules, etc.  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|               CENTRAL API CLIENT MIDDLEWARE (DNFL.Client / window.DNFLClient)     |
|  - Multi-tier LocalStorage + RAM TTL Caching (Realtime, 5-Min, Hourly, Daily)    |
|  - Request Deduplication Queue (ACTIVE_FETCHES)                                   |
|  - BroadcastChannel Cross-Tab Cache Synchronization ('dnfl_cache_sync')           |
|  - HTML Error Page Response Guards for JSON/CSV/MD feeds                          |
|  - Isolated Cache Key Hashing: {Type}_{Segment}_L{LeagueId}_Y{Year}_{Params}       |
+-----------------------------------------------------------------------------------+
         │                                │                               │
         ▼                                ▼                               ▼
+------------------+            +-------------------+           +-------------------+
|   MFL API ENDPOINTS |            |    DATA FEEDS     |           |   MEDIA / CDN     |
| - league         |            | - standings_rules |           | - episodes.json   |
| - leagueStandings|            | - weeks.json      |           | - .m4a Audio      |
| - weeklyResults  |            | - data_*.csv      |           | - .md Transcripts |
| - rosters        |            | - rankings_overri |           |                   |
+------------------+            +-------------------+           +-------------------+
         │                                │                               │
         +--------------------------------+-------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                       FEATURE MODULE ENGINES (window.DNFL.*)                      |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  | DNFL.Standings      |  | DNFL.Rankings       |  | DNFL.Podcast              |  |
|  | - Seeding & Badges  |  | - Chart.js Render   |  | - Audio Player            |  |
|  | - Owner Highlight   |  | - 1..N Table Ranker |  | - Marked.md Transcript    |  |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  +---------------------------------+  +----------------------------------------+  |
|  | DNFL.Rules                      |  | DNFL.Exporter                          |  |
|  | - Accordion Hierarchy & Toggles |  | - Data Extraction & Z-Score Engine     |  |
|  | - CSS Counter Auto-Numbering    |  | - Multi-Format Exports (CSV/JSON/MD)   |  |
|  +---------------------------------+  +----------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                           DOM USER INTERFACE (HTML Embeds)                        |
|  Renders into semantic shells (#dnfl-card) mounted on MFL pages                   |
+-----------------------------------------------------------------------------------+
```

---

## 4. Core Infrastructure Components

### 4.1 Master Framework Loader (`dnfl-header.js`)

The framework loader serves as the entry point and dependency orchestrator for the entire application:

* **Viewport Injection**: Automatically verifies and injects `<meta name="viewport" content="width=device-width, initial-scale=1.0">` into the document head if missing.
* **Multi-Stage Bootstrap Pipeline**:
  1. **Stage 1 (Stylesheets)**: Loads `dnfl-global.css` asynchronously and non-blockingly.
  2. **Stage 2 (Infrastructure Libraries)**: Loads FontAwesome 6 kit, PapaParse CSV parser, Marked.js Markdown parser, and `dnfl-api-client.js`.
  3. **Stage 3 (Conditional Libraries)**: Evaluates target DOM elements (e.g., `#dnfl_powerRankingChart`) and injects Chart.js only when needed. If targets render dynamically later, a `MutationObserver` (`DNFL.Utils.onElementReady`) triggers injection on demand.
  4. **Stage 4 (Feature Modules)**: Asynchronously injects `dnfl-standings`, `dnfl-rankings`, `dnfl-podcast`, `dnfl-rules`, and `dnfl-exporter`.
* **Framework Readiness Event**: Dispatches custom event `dnfl:ready` on `window` and sets `window.DNFL.isReady = true` when all stages complete successfully.

### 4.2 Central API Client Middleware (`dnfl-api-client.js`)

The `DNFL.Client` singleton manages all data fetching, caching, and user session resolution:

* **Multi-Tier Caching Architecture**:
  * **RAM Cache (`RAM_CACHE`)**: In-memory `Map` for ultra-fast lookup within the active page session.
  * **LocalStorage Storage (`DNFL.Cache`)**: Persistent storage across page navigations with explicit TTL presets (`REALTIME` 30s, `FIVE_MIN` 5m, `HOURLY` 1h, `DAILY` 24h, `WEEKLY` 7d).
  * **Automatic Stale Eviction**: Automatically catches quota limit errors, evicts expired `dnfl_` keys, and retries writes.
* **Cross-Tab Synchronization**: Utilizes a native `BroadcastChannel('dnfl_cache_sync')` to broadcast invalidation and clear events across open browser tabs in real time.
* **Request Deduplication**: Tracks in-flight HTTP requests in an `ACTIVE_FETCHES` `Map`. Simultaneous requests for the same endpoint share a single underlying promise, preventing network thrashing.
* **HTML Response Guard**: `fetchRawText()` inspects returned text content for `.json`, `.csv`, or `.md` feeds. If an endpoint returns an HTML error page (e.g., 200 OK with `<!DOCTYPE html>`), the client rejects the promise with an explicit error.
* **Isolated Cache Keys**: Constructs deterministic cache keys including league segment, isolated league ID, active year, and sorted parameters (`{Type}_{Segment}_L{LeagueId}_Y{Year}_{Params}`) to eliminate cross-league cache contamination.
* **Metadata & User Session Resolution**: `bootstrapMetadata()` auto-fetches `league` metadata, constructs a normalized 4-digit franchise lookup map (`DNFL.franchiseMap`), auto-resolves the active logged-in franchise ID across 5 context tiers (globals, URL params, cookies, DOM links, form elements), and highlights user team rows (`.dnfl-my-team`, `.dnfl-myfranchise`).

### 4.3 Master SCSS Design System (`dnfl-global.css`)

The compiled global stylesheet provides the visual groundwork for all modules:

* **Design Tokens (`:root, .dnfl`)**: Standardized CSS variables for brand colors (Duke Shale Blue `#0577B1`, Ocean Blue `#045e8c`), neutral shades, card elevations, chart color slots (`--dnfl-chart-1..6`), and status indicators.
* **Card Architecture (`.dnfl-card`)**: 3-level container hierarchy featuring rounded corners (`12px`), elevated box shadows, dark/slate headers (`.dnfl-card-header`), and responsive body padding.
* **Unified Table System (`.dnfl-table`)**: Zebra striping (`.dnfl-row-odd` / `.dnfl-row-even`), interactive row hover (`.dnfl-primary-light`), yellow logged-in franchise highlighting (`.dnfl-my-team`), and upright header resets (`table.dnfl-table th { font-style: normal !important; }`).
* **Badges & Pills**: Circular neutral Standings seed badges (`.dnfl-seed-badge`), status indicator badges (`.dnfl-badge-green/red/blue/amber`), and solid blue record capsules (`.dnfl-pill-blue`).
* **State Utility Classes**: `.dnfl-is-hidden`, `.dnfl-is-visible`, `.dnfl-is-flex`, `.is-expanded`, `.is-collapsed`.

---

## 5. Framework Execution Pipeline & Event Lifecycle

```text
[1. MFL Page Mounts Embed Shell]
       │
       ▼
[2. Include <script src="dnfl-header.js"></script>]
       │
       ▼
[3. Stage 1: Load dnfl-global.css] ──────────► Inject <link> into <head>
       │
       ▼
[4. Stage 2: Load Core Infra] ───────────────► Load FontAwesome 6, PapaParse, Marked, API Client
       │
       ▼
[5. API Client Bootstrap] ────────────────────► Fetch 'league' metadata, populate DNFL.franchiseMap,
       │                                        resolve user session & dispatch 'dnfl:leagueLoaded'
       ▼
[6. Stage 3: Evaluate Conditional Libs] ──────► Inject Chart.js if canvas is present or watch DOM
       │
       ▼
[7. Stage 4: Load Feature Modules] ───────────► Asynchronously load JS engines (Standings, Rules, etc.)
       │
       ▼
[8. Dispatch 'dnfl:ready' Event] ─────────────► window.dispatchEvent(new CustomEvent('dnfl:ready'))
       │
       ▼
[9. Feature Modules Auto-Initialize] ─────────► Feature engines bind to 'dnfl:ready', detect DOM stubs,
                                                and render data via DNFL.Client
```

---

## 6. Feature Module Ecosystem Summaries

### 6.1 Standings & Seeding Engine (`dnfl-standings.js`)
* **Purpose**: Calculates live standings, division crowns, playoff seedings, and promotion/relegation indicators.
* **Key Features**: Dynamically evaluates `standings_rules.json`, pads 4-digit franchise IDs and 2-digit conference/division IDs, calculates circular seed badges (`.dnfl-seed-badge`), formats Points For/Against with locale formatting, auto-defaults conference filters to the logged-in owner's conference, and toggles division visibility via `.dnfl-is-hidden`.

### 6.2 Power Rankings Dashboard (`dnfl-rankings.js`)
* **Purpose**: Interactive power rankings dashboard with Chart.js horizontal bar visualization and sortable data table.
* **Key Features**: Fetches decoupled `weeks.json` manifests and weekly `data_*.csv` files via `DNFL.Client.fetchRawText()`, renders responsive bar charts with conference color palette mapping, manages sequential table ranks (`1..N`), and expands commentary callout rows (`.dnfl-comment-row`) using `.dnfl-is-hidden`.

### 6.3 Official Bylaws & Rules Module (`dnfl-rules.js`)
* **Purpose**: Interactive 3-level accordion engine for exploring official league bylaws.
* **Key Features**: Class-based accordion toggling (`.is-expanded` / `.is-collapsed`), dynamic FontAwesome 6 icon updates (`fa-solid fa-chevron-*`, `fa-caret-*`, `fa-angle-*`), SCSS CSS Counter auto-numbering across split list blocks, and global toolbar controls (`Expand All`, `Collapse All`, `Show Submenus`).

### 6.4 Podcast Player Module (`dnfl-podcast.js`)
* **Purpose**: Media player and dynamic Markdown transcript viewer for *The Devil's Advocate* podcast.
* **Key Features**: Decoupled `episodes.json` manifest fetching, HTML5 audio stream binding (`.m4a`), CDN Markdown transcript parsing (`.md`) via Marked.js, raw text fallback formatting (`.dnfl-transcript-raw`), and collapsible transcript view toggling.

### 6.5 Commissioner Data Exporter (`dnfl-exporter.js`)
* **Purpose**: Data extraction engine and automated z-score power rankings calculator.
* **Key Features**: Real-time MFL API retrieval for standings, rosters, matchups, and weekly lineup details. Features a weighted Z-score power ranking algorithm (60–100 scale, centered at 80 with 6.5 dispersion), multi-format formatting (CSV, JSON, Markdown), copy-to-clipboard, file downloads, and class-based action bar toggling (`.dnfl-is-hidden`).

---

## 7. Developer Integration Guide: Building a New Module

Follow these step-by-step instructions to create and integrate a new feature module into the DNFL Framework:

### Step 1: Create Module Folder & Assets
Create a dedicated asset directory under the repository root and place the JavaScript logic engine in `scripts/`:
* **Core Logic Engine**: `scripts/dnfl-myfeature.js`
* **Embed HTML Shell**: `dnfl_myfeature/hpm-myfeature-embed.html`
* **Developer Documentation**: `dnfl_myfeature/README-dnfl-myfeature.md`

### Step 2: Implement IIFE & Global Namespace Export
Wrap all JavaScript code in an Immediately Invoked Function Expression (IIFE) and register public methods on `window.DNFL.<ModuleName>`:

```javascript
/* ==========================================================================
   DNFL Custom Feature Module Engine
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */
(function(window, document) {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    let retryCount = 0;
    const maxRetries = 50;

    /**
     * Safely resolve API Client Middleware
     */
    function getApiClient() {
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("[DNFL MyFeature] DNFL.Client API middleware is required but unavailable.");
        }
        return client;
    }

    /**
     * Main Module Initialization Routine
     */
    async function init() {
        const container = document.getElementById('dnfl-myfeature-container');
        if (!container) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        try {
            const client = getApiClient();
            const data = await client.fetchData('leagueStandings');
            renderUI(data);
        } catch (err) {
            console.error("[DNFL MyFeature] Initialization error:", err);
        }
    }

    function renderUI(data) {
        // Build DOM elements using global utility classes
    }

    // Export Module API onto window.DNFL
    window.DNFL.MyFeature = {
        init: init
    };

    // Event-Driven Lifecycle Binding
    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
```

### Step 3: Fetch Data Exclusively via `DNFL.Client`
Never use direct `fetch()` or `jQuery.ajax()` calls. Utilize `DNFL.Client`:
* **MFL API Endpoints**: `client.fetchData('leagueStandings', { W: 1 }, { ttl: client.TTL.HOURLY })`
* **Raw JSON/CSV/MD Feeds**: `client.fetchRawText('https://dnfl.live/dnfl_myfeature/data.json')`

### Step 4: Build HTML Embed Shell Using Global Design System
Construct `hpm-myfeature-embed.html` using established framework BEM classes and utility tokens. Do NOT include inline `style="..."` attributes:

```html
<!-- DNFL MyFeature Module Embed -->
<div class="dnfl-card" id="dnfl-myfeature-container">
    <div class="dnfl-card-header">
        <h3 class="dnfl-card-title">
            <i class="fa-solid fa-star"></i> My Feature Title
        </h3>
    </div>
    
    <div class="dnfl-card-body">
        <div class="dnfl-toolbar">
            <div class="dnfl-filter-group">
                <label for="dnfl-myfeature-select">Select Option</label>
                <select id="dnfl-myfeature-select" class="dnfl-select"></select>
            </div>
            <div class="dnfl-buttons-right">
                <button id="dnfl-myfeature-btn" class="dnfl-btn dnfl-btn-primary">
                    <i class="fa-solid fa-bolt"></i> Execute Action
                </button>
            </div>
        </div>

        <div id="dnfl-myfeature-content" class="dnfl-table-wrapper">
            <!-- Dynamic Content Injected Here -->
        </div>
    </div>
</div>
```

### Step 5: Register Script in Framework Header Loader
Add the new module script definition to the `FEATURE_MODULES` array in `scripts/dnfl-header.js`:

```javascript
FEATURE_MODULES: [
    { name: "standings", url: "dnfl-standings.js" },
    { name: "rankings",  url: "dnfl-rankings.js" },
    { name: "podcast",   url: "dnfl-podcast.js" },
    { name: "rules",     url: "dnfl-rules.js" },
    { name: "exporter",  url: "dnfl-exporter.js" },
    { name: "myfeature", url: "dnfl-myfeature.js" } // New Module Registered
]
```
