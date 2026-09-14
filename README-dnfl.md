# Duke Networking Fantasy League (DNFL) Framework Architecture & Developer Guide

Welcome to the **DNFL Framework** developer documentation for the `rosario-jason/dnfl` repository (hosted at `dnfl.live`). This document provides a high-level technical overview of the system architecture, repository folder structure, core module breakdowns, execution lifecycles, and a developer guide for building and integrating new framework modules.

---

## 📁 Repository Directory Structure

The repository organizes core JavaScript logic engines under `./scripts/`, master stylesheet design system files under `./css/`, and module-specific configuration files, HTML embed stubs, READMEs, and dynamic data assets within dedicated module folders (`./dnfl_standings/`, `./dnfl_rankings/`, `./dnfl_podcast/`, `./dnfl_rules/`).

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
│
├── css/
│   └── dnfl-global-v2.css                  # Master design system & CSS variables
│
├── dnfl_podcast/
│   ├── README.md                           # Podcast developer guide
│   ├── devils_advocate_logo.png            # Podcast module branding asset
│   ├── hpm-podcast-embed-v2.html           # HTML embed shell stub for MFL
│   └── 2026/                               # Season media & transcript directory
│       ├── episodes.json                   # Dynamic episode directory index
│       ├── DA_S1E1.m4a                     # Audio stream file
│       └── DA_S1E1.md                      # Episode markdown transcript
│
├── dnfl_rankings/
│   ├── README.md                           # Rankings developer guide
│   ├── hpm-rankings-embed-v2.html          # HTML embed shell stub for MFL
│   └── 2026/                               # Season rankings data directory
│       ├── weeks.json                      # Published weeks directory index
│       └── data_00_pre-season.csv          # Weekly rankings CSV file
│
├── dnfl_rules/
│   └── hpm-rules-embed-v3.html             # Bylaws HTML embed shell stub for MFL
│
├── dnfl_standings/
│   ├── README.md                           # Standings developer guide
│   ├── hpm-standings-embed-v2.html         # HTML embed shell stub for MFL
│   └── standings_rules.json                # Season-by-season rules & qualification overrides
│
└── scripts/
    ├── dnfl-header-script-v2.js            # Framework script loader & version controller
    ├── dnfl-api-client-v2.js               # Central API middleware (caching & deduplication)
    ├── dnfl-podcast-v2.js                  # Audio stream player & transcript viewer
    ├── dnfl-rankings-v2.js                 # Power rankings CSV parser & Chart.js engine
    ├── dnfl-rules-v3.js                    # Official bylaws accordion engine
    └── dnfl-standings-v3.js                # Standings calculator & dynamic seeding engine
```

---

## 🏗️ Architecture Framework Diagram

The framework operates on a client-side architecture where a central script loader initializes global styling, third-party libraries, and middleware before running feature-specific module engines.

```text
+-----------------------------------------------------------------------------------+
|                            MFL HOST PAGE (HTML / HPM - Header)                    |
|  +-----------------------------------------------------------------------------+  |
|  | <script src="https://dnfl.live/scripts/dnfl-header-script-v2.js"></script>  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        DNFL HEADER SCRIPT (Loader & Versioning)                   |
|  1. Injects global CSS: /css/dnfl-global-v2.css                                   |
|  2. Loads CDNs: PapaParse (CSV), Chart.js (Charts), Marked.js (Markdown)          |
|  3. Loads Middleware: /scripts/dnfl-api-client-v2.js                              |
|  4. Loads Module Engines: /scripts/dnfl-*.js                                      |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                       CENTRAL API CLIENT (window.DNFLClient)                      |
|  - Request Deduplication & Rate Limiting                                          |
|  - Multi-tier LocalStorage TTL Caching (Realtime, Hourly, Daily)                  |
|  - Raw Text & JSON Fetcher (`fetchRawText`, `fetchData`)                          |
+-----------------------------------------------------------------------------------+
         │                                │                               │
         ▼                                ▼                               ▼
+------------------+            +-------------------+           +-------------------+
|   MFL API DATA   |            |    DATA FEEDS     |           |   MEDIA SERVER    |
| (leagueStandings |            | - standings_rules |           | - episodes.json   |
|     league)      |            | - weeks.json      |           | - .m4a Audio      |
|                  |            | - data_*.csv      |           | - .md Transcripts |
+------------------+            +-------------------+           +-------------------+
         │                                │                               │
         +--------------------------------+-------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                              FEATURE MODULE ENGINES                               |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  | Standings Module    |  | Power Rankings      |  | Podcast Module            |  |
|  | - Seeding & Badges  |  | - Chart.js Render   |  | - Audio Player            |  |
|  | - Auto-Conf Default |  | - 1..N Table Ranker |  | - Marked.md Transcript    |  |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  +-----------------------------------------------------------------------------+  |
|  | Rules Bylaws Module: Accordion Engine & Section Navigation                  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                                DOM USER INTERFACE                                 |
|  Renders into HTML Embed Stubs (hpm-*-embed-v2/v3.html) on MFL Pages              |
+-----------------------------------------------------------------------------------+
```

---

## 🧩 High-Level Module Descriptions

### 1. Global Design System (`./css/`)
* **File**: `css/dnfl-global-v2.css`
* **Purpose**: Serves as the single source of truth for design tokens, dark/light color themes (`--dnfl-*`), responsive toolbar layouts (`.dnfl-toolbar`), tables (`.dnfl-table`), rank badges (`.dnfl-rank-badge`, `.dnfl-rank-circle`), toggle buttons (`.dnfl-visibility-toggle-btn`), and status indicators (`.dnfl-status-loading`, `.dnfl-status-error`).

### 2. Core Scripts & API Engine (`./scripts/`)
* **Header Loader (`dnfl-header-script-v2.js`)**: Manages non-blocking injection of CDN libraries (PapaParse, Chart.js, Marked.js) and internal JavaScript engines. Features `FRAMEWORK_VERSION` query-string cache busting (`?v=2.01`) to clear browser caches across client devices.
* **API Middleware (`dnfl-api-client-v2.js` / `DNFLClient`)**: Handles data fetching from MFL endpoints with multi-tier TTL caching (realtime, hourly, daily) and request deduplication. Exposes `DNFLClient.fetchRawText(url)` for async JSON, CSV, and Markdown loading.

### 3. Standings & Seeding Engine (`./dnfl_standings/` & `./scripts/dnfl-standings-v3.js`)
* **Files**: `scripts/dnfl-standings-v3.js`, `dnfl_standings/hpm-standings-embed-v2.html`, `dnfl_standings/standings_rules.json`
* **Purpose**: Fetches MFL standings and league structures to dynamically calculate conference seedings, division crowns, playoff qualifications, and promotion/relegation indicators.
* **Features**: Detects logged-in franchise sessions across a multi-tier context chain, auto-defaults dropdown selection to the owner's conference, normalizes franchise/division IDs, and formats Points For/Against (`toLocaleString('en-US')`).

### 4. Power Rankings Module (`./dnfl_rankings/` & `./scripts/dnfl-rankings-v2.js`)
* **Files**: `scripts/dnfl-rankings-v2.js`, `dnfl_rankings/hpm-rankings-embed-v2.html`, `dnfl_rankings/{YEAR}/`
* **Purpose**: Parses weekly CSV ranking data and renders interactive Chart.js horizontal bar charts along with detailed data tables.
* **Features**: Decoupled data fetching via `weeks.json`, conference filtering, dynamic canvas height resizing, and sequential 1..N table ranking while retaining overall league rank in tooltips.

### 5. Podcast Module (`./dnfl_podcast/` & `./scripts/dnfl-podcast-v2.js`)
* **Files**: `scripts/dnfl-podcast-v2.js`, `dnfl_podcast/hpm-podcast-embed-v2.html`, `dnfl_podcast/{YEAR}/`
* **Purpose**: Media player interface for *The Devil's Advocate* podcast episodes with automated transcript viewing.
* **Features**: Decoupled episode listing via `episodes.json`, stream loading (`.m4a`), dynamic transcript fetching (`.md`), Markdown parsing via `Marked.js`, and collapsible transcript display.

### 6. Official Rules Module (`./dnfl_rules/` & `./scripts/dnfl-rules-v3.js`)
* **Files**: `scripts/dnfl-rules-v3.js`, `dnfl_rules/hpm-rules-embed-v3.html`
* **Purpose**: Interactive accordion interface for the official DNFL Bylaws and Rulebook.
* **Features**: Computed-style visibility toggling (`getComputedStyle`), global toolbar controls (Expand All, Collapse All, Show Sub-Menus), and clean HTML template shells free of hardcoded inline display attributes.

---

## ⚙️ Execution Pipeline & Event Lifecycle

1. **Page Load**: MFL page includes `<script src="https://dnfl.live/scripts/dnfl-header-script-v2.js"></script>`.
2. **Dependency Loading**: `dnfl-header-script-v2.js` injects `dnfl-global-v2.css`, CDN scripts (`PapaParse`, `Chart.js`, `Marked.js`), and `dnfl-api-client-v2.js`.
3. **Middleware Initialization**: `DNFLClient` registers TTL caches and request deduplication queues under `window.DNFLClient`.
4. **Module Execution**: Script loader injects feature engines (`dnfl-standings-v3.js`, `dnfl-rankings-v2.js`, `dnfl-podcast-v2.js`, `dnfl-rules-v3.js`).
5. **DOM Auto-Init**: Feature scripts automatically detect target HTML embed stubs (`#dnfl_weekSelector`, `#dnfl-standings-tbody`, etc.) and trigger initial data rendering.
6. **Framework Ready Event**: Dispatches custom event `dnflFrameworkReady` on `window`.

---

## 🛠️ Step-by-Step Developer Guide: Creating a New Module

Follow these steps to build and integrate a new framework module into `rosario-jason/dnfl`:

### Step 1: Create Module Directory Structure
Create a dedicated folder for the module assets and place the logic engine in `./scripts/`:
* Core Logic Script: `./scripts/dnfl-<module>-v1.js`
* Embed HTML Stub: `./dnfl_<module>/hpm-<module>-embed-v1.html`
* Module Documentation: `./dnfl_<module>/README.md`

### Step 2: Implement IIFE & Register on Global Namespace
Encapsulate all JavaScript in an Immediately Invoked Function Expression (IIFE) and expose public methods on `window.DNFL.<ModuleName>`:

```javascript
/* ==========================================================================
   DNFL Custom Module Engine
   ========================================================================== */
/* global DNFLClient */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};

    function init() {
        // Module initialization logic
    }

    // Export public methods onto the global namespace
    window.DNFL.MyNewModule = {
        init: init
    };

    // Auto-initialize when target DOM element is present
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
```

### Step 3: Fetch Data via `DNFLClient` Middleware
Avoid direct `fetch()` calls. Use `window.DNFLClient`:
* **MFL Endpoints**: `DNFLClient.fetchData('leagueStandings')`
* **External JSON/CSV/MD Feeds**: `DNFLClient.fetchRawText('https://dnfl.live/dnfl_new/data.json')`

### Step 4: Build HTML Embed Shell Using Global CSS
Construct `hpm-<module>-embed-v1.html` using established utility classes:
* Container elements: `.dnfl-module-container`, `.dnfl-toolbar`, `.dnfl-controls`, `.dnfl-table-wrapper`
* Buttons: `.dnfl-visibility-toggle-btn`
* Status indicators: `.dnfl-status-loading`, `.dnfl-status-error`
* Avoid inline layout styles (`style="width:..."`, `style="text-align:..."`).

### Step 5: Register Script in Framework Header Loader
Add the new script URL to `frameworkScripts` in `./scripts/dnfl-header-script-v2.js` and increment `FRAMEWORK_VERSION`:

```javascript
const frameworkScripts = [
    'https://dnfl.live/scripts/dnfl-api-client-v2.js',
    'https://dnfl.live/scripts/dnfl-standings-v3.js',
    'https://dnfl.live/scripts/dnfl-rankings-v2.js',
    'https://dnfl.live/scripts/dnfl-podcast-v2.js',
    'https://dnfl.live/scripts/dnfl-rules-v3.js',
    'https://dnfl.live/scripts/dnfl-newmodule-v1.js' // New module engine
];
```
