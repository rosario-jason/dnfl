# DNFL Standings & Seeding Engine (`dnfl_standings/`)

The **DNFL Standings Engine** calculates live league standings, divisional crowns, playoff seeding qualification, and promotion/relegation zone indicators for the Duke Networking Fantasy League (DNFL). Powered by the `DNFLClient` API middleware, it dynamically evaluates league rules from `standings_rules.json` and integrates seamlessly with MyFantasyLeague (MFL) live data.

---

## 📁 Repository Directory Location

In accordance with the `rosario-jason/dnfl` GitHub repository structure:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
├── ./scripts/
│   └── dnfl-standings-v4.js            # Standings calculation & seeding logic engine
└── ./dnfl_standings/
    ├── README.md                       # Standings Module Developer Guide (This File)
    ├── standings_rules.json            # Dynamic season-by-season rules configuration
    └── hpm-standings-embed-v2.html     # HTML template shell for MFL Home Page Modules
```

---

## ⚙️ Logic Engine Architecture (`dnfl-standings-v4.js`)

The Standings Module operates within the global `window.DNFL.Standings` namespace.

### Core Pipeline & Initialization Flow
1. **DOM Container Detection**: Retries DOM lookup up to 50 times (100ms intervals) until `#dnfl-standings-tbody` is mounted.
2. **Parallel Middleware API Fetch**: Calls `DNFLClient.fetchData('leagueStandings')`, `DNFLClient.fetchData('league')`, and `DNFLClient.fetchRawText('standings_rules.json')` in parallel.
3. **Seeding & Qualification Calculation**: Executes `calculateSeedsAndBadges()` to evaluate division leaders, playoff seeds, and promotion/relegation zones.
4. **Logged-in Franchise Resolution**: Runs `getLoggedInFranchiseId()` to auto-detect the active owner's franchise ID across 5 environment tiers (globals, URL parameters, cookies, DOM links, and form elements).
5. **Dropdown Setup**: Populates `#dnfl_standings_confFilter` and defaults to the logged-in owner's conference (with fallback to Cameron Crazies or Playoffs).
6. **UI Rendering**: Renders `#dnfl-standings-tbody` and dynamic legend key `#dnfl-standings-key`.

### Key Technical Innovations
* **4-Digit Franchise ID Normalization (`normFranchiseId`)**: Pads IDs (e.g., `5` -> `"0005"`) to prevent strict equality failures when matching MFL API payload structures.
* **2-Digit Division/Conference ID Normalization (`norm`)**: Pads division/conference IDs (e.g., `0` -> `"00"`) to resolve numeric string mismatches across seasons.
* **Division-to-Conference Mapping**: Resolves team conference alignment via `cachedDivisions` when MFL API team objects omit explicit `conference` attributes.
* **Number Formatting**: Formats Points For (PF) and Points Against (PA) using `toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` (e.g., `1,076.55`).

---

## 📊 Rules Configuration (`standings_rules.json`)

The rules dictionary governs seeding models, playoff cutoffs, and movement rules across league eras:

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

### Seeding Models Supported
* **`standard_div_winners_first`**: Division winners receive seeds 1..N based on MFL rank/record, followed by remaining wildcards.
* **`tiered_div_finish_pf`**: Division 1st-place finishers ranked by Points For (PF), then 2nd-place finishers by PF, followed by remaining teams by PF.
* **`mfl_native`**: Uses native MFL standings sorting order.
* **`manual`**: Applies explicit `manualSeeds` dictionary mapping.

### Status Badges & Icons
* 👑 **Division Winner**: `<i class="fas fa-crown" style="color: var(--dnfl-badge-blue);"></i>` (If `hasDivisionCrown: true`)
* 🏆 **Playoff Qualifier**: `<i class="fas fa-trophy" style="color: var(--dnfl-badge-amber);"></i>` (Seed <= `playoffCutoff`)
* 🟢 **Promotion Zone**: `<i class="fas fa-arrow-circle-up" style="color: var(--dnfl-success-green);"></i>` (Top N teams in conference)
* 🔴 **Relegation Zone**: `<i class="fas fa-arrow-circle-down" style="color: var(--dnfl-alert-red);"></i>` (Bottom N teams in division/conference)

---

## 🎨 HTML Embed Shell (`hpm-standings-embed-v2.html`)

The embed template provides a clean HTML structure integrated with `dnfl-global-v2.css`:

```html
<!-- DNFL STANDINGS MODULE EMBED -->
<div class="dnfl-module-container">
    <div class="dnfl-toolbar">
        <div class="dnfl-filter-group">
            <label for="dnfl_standings_confFilter">Conference:</label>
            <select id="dnfl_standings_confFilter" class="dnfl-select" onchange="DNFL.Standings.updateView()"></select>
        </div>
        <div id="dnfl-standings-key" class="dnfl-actions-right">
            <!-- Dynamic Legend Key & Disclaimer injected by JS -->
        </div>
    </div>
</div>

<div class="dnfl-table-wrapper">
    <table class="dnfl-table dnfl-standings-table">
        <thead>
            <tr>
                <th>Seed</th>
                <th>Franchise</th>
                <th class="dnfl-hide-mobile">PF</th>
                <th class="dnfl-hide-mobile">PA</th>
                <th>Record</th>
                <th class="dnfl-hide-mobile">BBID $</th>
            </tr>
        </thead>
        <tbody id="dnfl-standings-tbody">
            <tr>
                <td colspan="6" class="dnfl-status-loading">Loading DNFL League Standings...</td>
            </tr>
        </tbody>
    </table>
</div>
```

---

## 🔄 Lifecycle Diagram

```text
[MFL Page Mounts Embed]
       │
       ▼
[DNFLClient API Engine] ──► Fetch 'leagueStandings', 'league', & 'standings_rules.json'
       │
       ▼
[ID Normalization]      ──► Normalize 4-digit Team IDs & 2-digit Division/Conf IDs
       │
       ▼
[Seeding Engine]        ──► Calculate Seeds, Crowns, Relegation/Promotion Zones
       │
       ▼
[Owner Auto-Detect]     ──► Resolve logged-in owner's conference via getLoggedInFranchiseId()
       │
       ▼
[DOM Render]            ──► Inject rows into #dnfl-standings-tbody & update legend key
```

---

## 🚀 Annual Rollover & Maintenance

1. **New Season Verification**: Update `standings_rules.json` on GitHub if playoff cutoffs, promotion counts, or seeding models change for the new season year.
2. **Automatic Data Resolution**: No JavaScript changes required — the engine dynamically reads `targetYear` from URL path/`window.current_year`.
3. **Cache Busting**: Increment `FRAMEWORK_VERSION` in `dnfl-header-script-v2.js` when modifying `dnfl-standings-v4.js`.