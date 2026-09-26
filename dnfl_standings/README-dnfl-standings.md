# Duke Networking Fantasy League (DNFL) - Standings & Seeding Engine Guide

## 1. Executive Summary & Architectural Overview

The **DNFL Standings & Seeding Engine** (`scripts/dnfl-standings.js`) calculates and renders live league leaderboards, divisional crowns, playoff seeding qualifications, and promotion/relegation indicators for the Duke Networking Fantasy League.

Powered by the `DNFL.Client` API middleware, the module dynamically evaluates era-based league bylaws defined in `standings_rules.json` and integrates seamlessly with live data from MyFantasyLeague (MFL).

### Core Architectural Principles
* **Separation of Concerns**: Presentation is governed strictly by compiled SCSS (`css/dnfl-global.css`). The engine contains zero inline `style="..."` attribute string injections.
* **Class-Based State Management**: Collapsible division rows use `.dnfl-is-hidden` for DOM state toggling rather than direct `.style.display` manipulations.
* **Centralized Middleware API Routing**: All data requests flow through `DNFL.Client.fetchData()` and `DNFL.Client.fetchRawText()`, providing multi-tier caching (RAM + LocalStorage), request deduplication, and isolated cache keys (`_L{leagueId}_Y{year}`).
* **4-Digit Franchise & 2-Digit ID Normalization**: All franchise IDs (`"0001"`) and division/conference IDs (`"00"`) are padded to guarantee strict string equality across MFL API payloads.
* **Automated User Session Highlight**: Resolves the active logged-in user's franchise across 5 environment context tiers and automatically defaults the conference filter dropdown to the owner's conference.

---

## 2. Repository Directory Location & Component Map

In accordance with the DNFL framework repository layout, standings assets are organized across core scripts and module-specific directories:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
│
├── css/
│   └── dnfl-global.css                 # Master design system stylesheet
│
├── scripts/
│   ├── dnfl-api-client.js              # Central API middleware
│   ├── dnfl-header.js                  # Central framework loader
│   └── dnfl-standings.js               # Standings calculation & seeding logic engine
│
└── dnfl_standings/
    ├── README-dnfl-standings.md        # Standings module developer guide (This file)
    ├── standings_rules.json            # Dynamic season-by-season rules configuration
    └── hpm-standings-embed.html        # Semantic HTML5 embed shell stub for MFL
```

---

## 3. System Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                           MFL HOST PAGE EMBED SHELL                               |
|  +-----------------------------------------------------------------------------+  |
|  | <div id="dnfl-standings-container" class="dnfl-card"> ... </div>            |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                       STANDINGS LOGIC ENGINE (dnfl-standings.js)                  |
|  1. DOM Detection Retry Loop (#dnfl-standings-tbody, maxRetries = 50)             |
|  2. Parallel API Data Fetching via DNFL.Client Middleware                        |
+-----------------------------------------------------------------------------------+
                                         │
            ┌────────────────────────────┼────────────────────────────┐
            ▼                            ▼                            ▼
+-----------------------+   +-----------------------+   +---------------------------+
| MFL 'leagueStandings' |   |   MFL 'league' Meta   |   |   'standings_rules.json'  |
| - h2hw / h2hl / h2ht  |   | - Franchises Array    |   | - Seeding Scopes & Models |
| - Points For (PF)     |   | - Conferences Array   |   | - Playoff Cutoffs         |
| - Points Against (PA) |   | - Divisions Array     |   | - Promotion & Relegation  |
+-----------------------+   +-----------------------+   +---------------------------+
            │                            │                            │
            └────────────────────────────┼────────────────────────────┘
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                         SEEDING & BADGE CALCULATION ENGINE                        |
|  - ID Normalization: normFranchiseId() -> '0005', norm() -> '01'                 |
|  - PA Fallback Engine: Calculates PA via 'weeklyResults' if MFL returns 0.00      |
|  - Seeding Scope: 'conference' vs 'league'                                        |
|  - Seeding Models: 'standard_div_winners_first', 'tiered_div_finish_pf', etc.     |
|  - Badge Assignment: Division Crowns 👑, Playoff Seeds 🏆, Promotion 🟢/Relegation 🔴|
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        USER SESSION & DOM RENDERING PIPELINE                      |
|  - Resolve Logged-In Franchise ID across 5 context layers                         |
|  - Populate #dnfl_standings_confFilter & default to owner's conference            |
|  - Render #dnfl-standings-tbody with zebra striping (.dnfl-row-odd/even)          |
|  - Apply Canary Yellow highlight (.dnfl-my-team) to user row                      |
|  - Inject dynamic legend key into #dnfl-standings-key                             |
+-----------------------------------------------------------------------------------+
```

---

## 4. Seeding & Rules Configuration (`standings_rules.json`)

The `standings_rules.json` configuration file governs seeding models, playoff cutoffs, and movement rules across league eras:

```json
{
  "2006-2024": {
    "seedingScope": "conference",
    "seedingModel": "standard_div_winners_first",
    "playoffCutoff": 6,
    "hasDivisionCrown": true
  },
  "2025": {
    "seedingScope": "conference",
    "seedingModel": "standard_div_winners_first",
    "playoffCutoff": 7,
    "hasDivisionCrown": true
  },
  "2026": {
    "seedingScope": "league",
    "seedingModel": "tiered_div_finish_pf",
    "playoffCutoff": 16,
    "hasDivisionCrown": true,
    "relegation": { "enabled": true, "type": "division", "count": 1 }
  },
  "default": {
    "seedingScope": "conference",
    "seedingModel": "standard_div_winners_first",
    "playoffCutoff": 6,
    "hasDivisionCrown": true,
    "relegation": { "enabled": true, "type": "division", "count": 1 },
    "promotion": { "enabled": true, "count": 4 }
  }
}
```

### Supported Seeding Models
* **`standard_div_winners_first`**: Division winners receive seeds 1..N sorted by win percentage / points for, followed by wildcard qualifiers.
* **`tiered_div_finish_pf`**: 1st-place division finishers sorted by Points For (PF) receive top seeds, followed by 2nd-place division finishers sorted by PF, followed by remaining teams sorted by PF.
* **`mfl_native`**: Uses native MFL standings sorting order directly.
* **`manual`**: Applies explicit manual mapping provided in a `manualSeeds` dictionary.

---

## 5. UI Components, Status Badges & CSS Class Reference

The Standings module utilizes standardized BEM component classes and design tokens defined in `css/dnfl-global.css`:

### 5.1 Standings Table Column Layout (`#dnfl-standings-container`)
* **Seed Column (`.dnfl-col-seed`)**: Fixed `95px` width (`white-space: nowrap`) housing circular seed badges alongside status icons.
* **Franchise Column (`.dnfl-col-franchise`)**: Flexible `180px+` cell displaying franchise icon (`.franchiseicon`), team name link (`.dnfl-team-name`: `0.95rem` Obsidian Black), and owner name subtext (`.dnfl-owner-name`: `0.8rem` Charcoal).
* **Points For Column (`.dnfl-col-pf`)**: Centered `110px` cell with Mint status badge (`.dnfl-badge-green`).
* **Points Against Column (`.dnfl-col-pa`)**: Centered `110px` cell with Rose status badge (`.dnfl-badge-red`).
* **Record Column (`.dnfl-col-record`)**: Centered `95px` cell housing solid Cobalt Blue pill capsule (`.dnfl-pill-blue`: e.g. `10-2-0`).
* **BBID Column (`.dnfl-col-bbid`)**: Centered `85px` cell formatting balance (`$100.00`).

### 5.2 Circular Standings Seed Badge (`.dnfl-seed-badge`)
A dedicated circular badge (`28px x 28px`, `50%` border radius, `#f1f5f9` slate background) used to display calculated seeds:
```html
<td class="dnfl-col-seed">
    <span class="dnfl-seed-badge">1</span>
    <i class="fa-solid fa-crown dnfl-icon-blue" title="Division Winner"></i>
</td>
```

### 5.3 Status Indicators & Icons
* 👑 **Division Winner**: `<i class="fa-solid fa-crown dnfl-icon-blue"></i>` (Rendered when `hasDivisionCrown: true`).
* 🏆 **Playoff Qualifier**: `<i class="fa-solid fa-trophy dnfl-icon-amber"></i>` (Rendered when calculated `seed <= playoffCutoff`).
* 🟢 **Promotion Zone**: `<i class="fa-solid fa-circle-arrow-up dnfl-icon-green"></i>` (Top N teams in conference).
* 🔴 **Relegation Zone**: `<i class="fa-solid fa-circle-arrow-down dnfl-icon-red"></i>` (Bottom N teams in division/conference).

---

## 6. HTML Embed Shell Architecture (`hpm-standings-embed.html`)

The HTML embed shell mounts inside MFL Home Page Modules using the global 3-level card hierarchy:

```html
<!-- DNFL STANDINGS MODULE EMBED -->
<div id="dnfl-standings-container" class="dnfl-card">
    <!-- Level 2 Card Header -->
    <div class="dnfl-card-header">
        <h3 id="dnfl-standings-title" class="dnfl-card-title">
            <i class="fa-solid fa-list"></i> DNFL Standings
        </h3>
    </div>

    <!-- Level 2 Card Body -->
    <div class="dnfl-card-body">
        <!-- Level 3 Controls Toolbar -->
        <div class="dnfl-toolbar">
            <div class="dnfl-filter-group">
                <label for="dnfl_standings_confFilter">Conference Filter</label>
                <select id="dnfl_standings_confFilter" class="dnfl-select" onchange="DNFL.Standings.updateView()"></select>
            </div>
        </div>

        <!-- Level 3 Dynamic Legend Key Container -->
        <div id="dnfl-standings-key" class="dnfl-legend-panel"></div>

        <!-- Level 3 Standings Data Table Container -->
        <div id="dnfl_standingsTableWrapper" class="dnfl-table-wrapper">
            <table id="dnfl_standingsTable" class="dnfl-table">
                <tbody id="dnfl-standings-tbody">
                    <tr>
                        <td colspan="6" class="dnfl-status-loading">
                            <i class="fa-solid fa-spinner fa-spin"></i> Loading DNFL League Standings...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</div>
```

---

## 7. Public API & Methods Reference

The Standings engine registers its public API under `window.DNFL.Standings`:

### `DNFL.Standings.init()`
Asynchronously initializes the standings module. Retries DOM discovery for `#dnfl-standings-tbody` up to 50 times (100ms intervals), fetches MFL data in parallel via `DNFL.Client`, calculates seeds/badges, resolves user session, and renders the initial view.

### `DNFL.Standings.updateView()`
Refreshes the rendered standings table and legend key based on the active selection in `#dnfl_standings_confFilter`.

### `DNFL.Standings.toggleDivision(divId)`
Toggles the visibility of division rows (`.dnfl-div-row-{divId}`) using framework state class `.dnfl-is-hidden`, updating the toggle button text (`Hide` / `Show`).

---

## 8. Developer Maintenance & Annual Rollover

1. **Season Bylaw Updates**: When playoff cutoffs, seeding models, or promotion/relegation rules change for a new season, update `standings_rules.json` on `dnfl.live`.
2. **Automatic Target Year Resolution**: The engine dynamically resolves `targetYear` from URL path regex (`/20\d{2}/`), `window.current_year`, or the system calendar year.
3. **Cache Invalidation**: When testing rule updates, clear `localStorage` or call `DNFL.Client.clearCache()`.
