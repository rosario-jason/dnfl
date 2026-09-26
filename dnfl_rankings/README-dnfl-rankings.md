# Duke Networking Fantasy League (DNFL) - Power Rankings & Analytics Engine Guide

## 1. Executive Summary & Core Principles

The **DNFL Power Rankings Module** (`scripts/dnfl-rankings.js`) is an interactive analytics dashboard engineered to parse, visualize, and display weekly power rankings, Power Index scores, rank changes, conference breakdowns, and commissioner commentaries across Duke Networking Fantasy League seasons.

The module strictly enforces the framework's **Separation of Concerns**:
* **Zero Inline Styles**: All layout, typography, chart containers, badges, and commentary callout boxes are governed by global SCSS (`css/dnfl-global.css`). Inline `style="..."` attributes and direct `.style` DOM assignments are strictly prohibited.
* **Decoupled Data Architecture**: Ranking data is completely decoupled from application logic. Weekly rankings are stored as lightweight CSV files (`data_01.csv`, `data_02.csv`) indexed by a season manifest (`weeks.json`).
* **Class-Based State Management**: Chart visibility, commentary callout expansion, and container loading states are managed exclusively through framework CSS state classes (`.dnfl-is-hidden`, `.is-expanded`, `.is-collapsed`).
* **Air-Gapped Network Routing**: All CSV feeds and JSON manifests are fetched exclusively through `DNFL.Client.fetchRawText()`, providing multi-tier caching (RAM + LocalStorage), HTML error page guards, and request deduplication.

---

## 2. Repository Directory Placement

The Power Rankings documentation and assets are co-located under the `dnfl_rankings/` directory:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
│
├── css/
│   └── dnfl-global.css                 # Master design system stylesheet
│
├── scripts/
│   ├── dnfl-header.js                  # Central framework loader
│   ├── dnfl-api-client.js              # Central API middleware
│   └── dnfl-rankings.js                # Power Rankings & Chart.js logic engine
│
└── dnfl_rankings/
    ├── README-dnfl-rankings.md          # Power Rankings developer guide (This file)
    ├── hpm-rankings-embed.html         # HTML embed shell stub for MFL
    └── 2026/                           # Active season data directory
        ├── weeks.json                  # Published weeks directory manifest
        ├── data_00_pre-season.csv      # Pre-season rankings CSV dataset
        ├── data_01.csv                 # Week 1 rankings CSV dataset
        └── data_02.csv                 # Week 2 rankings CSV dataset
```

---

## 3. System Architecture & Data Pipeline

```text
[Page Mount: hpm-rankings-embed.html]
       │
       ▼
[DNFL Header Loader: dnfl-header.js] ─────────► Detects #dnfl_powerRankingChart
       │                                        Injects Chart.js & dnfl-rankings.js
       ▼
[Module Initialization: DNFL.Rankings.init()]
       │
       ▼
[Fetch Manifest via DNFL.Client] ─────────────► Fetch /dnfl_rankings/{Year}/weeks.json
       │                                        (TTL: DAILY / 24 Hours)
       ▼
[Populate Week Selector Dropdown] ─────────────► Resolve Active Week & Populate #dnfl_powerRankingWeek
       │
       ▼
[Fetch Weekly CSV Data] ──────────────────────► Fetch /dnfl_rankings/{Year}/{File}.csv
       │                                        (TTL: DAILY / 24 Hours)
       ▼
[PapaParse CSV Execution] ────────────────────► Parse CSV text into structured JS objects
       │
       ▼
[Render Chart.js Horizontal Bar Graph] ───────► Destroy stale chart instance & render canvas
       │
       ▼
[Render Ranked Data Table] ───────────────────► Assign 1..N ranks, calculate rank movement badges,
       │                                        and inject expandable commentary callouts
       ▼
[Bind Interactive Events] ────────────────────► Conference Filter, Week Select, Chart Toggle,
                                                and Commentary Row Toggles (.dnfl-is-hidden)
```

---

## 4. Data Pipeline & File Standards

### 4.1 Season Manifest Schema (`weeks.json`)
The `weeks.json` file resides in the season data folder (`/dnfl_rankings/{Year}/weeks.json`) and serves as the published week index:

```json
{
  "season": 2026,
  "active_week": "01",
  "weeks": [
    { "id": "00", "label": "Pre-Season", "file": "data_00_pre-season.csv" },
    { "id": "01", "label": "Week 1", "file": "data_01.csv" },
    { "id": "02", "label": "Week 2", "file": "data_02.csv" }
  ]
}
```

### 4.2 Weekly CSV Dataset Schema (`data_WW.csv`)
Rankings datasets are stored as comma-separated values (`.csv`). The CSV header must include the following standard column headers:

```csv
Rank,Previous,TeamID,TeamName,Owner,Record,PowerIndex,ConfID,Commentary
1,1,0004,Cameron Crazies,Jason Rosario,10-2-0,94.2,01,Dominant victory in Week 1 with top overall score.
2,4,0001,Blue Devils,John Smith,9-3-0,88.7,01,Surged 2 spots after pulling off a crucial divisional upset.
3,2,0008,Devil Dogs,Mike Johnson,8-4-0,85.1,02,Solid performance despite minor lineup injuries.
```

| CSV Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `Rank` | Integer | Current week assigned power rank position (1..N). | `1` |
| `Previous` | Integer | Prior week rank position (used to compute `▲ +N` / `▼ -N` badges). | `3` |
| `TeamID` | String | Normalized 4-digit MFL franchise ID. | `"0004"` |
| `TeamName` | String | Official franchise name. | `"Cameron Crazies"` |
| `Owner` | String | Franchise owner full name. | `"Jason Rosario"` |
| `Record` | String | Current team record string (`W-L-T`). | `"10-2-0"` |
| `PowerIndex` | Float | Calculated power index rating score (0.0 – 100.0). | `94.2` |
| `ConfID` | String | Normalized 2-digit conference ID (`"01"`, `"02"`). | `"01"` |
| `Commentary` | String | Commissioner weekly commentary note (Markdown supported). | `"Dominant victory..."` |

### 4.3 Data Fetching via `DNFL.Client.fetchRawText()`
The logic engine retrieves manifests and CSV files using `DNFL.Client.fetchRawText()`:
```javascript
const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;

// 1. Fetch Season Manifest
const manifestText = await client.fetchRawText('https://dnfl.live/dnfl_rankings/2026/weeks.json', {
    ttl: client.TTL.DAILY
});
const manifest = JSON.parse(manifestText);

// 2. Fetch Weekly CSV
const csvText = await client.fetchRawText(`https://dnfl.live/dnfl_rankings/2026/${selectedFile}`, {
    ttl: client.TTL.DAILY
});

// 3. Parse CSV with PapaParse
const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
```

---

## 5. Chart.js Visualization Engine

The rankings engine utilizes Chart.js to render a horizontal bar chart comparing team Power Index ratings:

### 5.1 Chart Configuration & Features
* **Horizontal Orientation**: Set via `type: 'bar'` with `indexAxis: 'y'`.
* **Responsive Canvas Wrapper**: Mounted inside a `.dnfl-chart-wrapper` container with `position: relative; width: 100%; min-height: 350px;`.
* **Conference Palette Slot Mapping**: Bar colors map dynamically to conference IDs using CSS variable tokens (`--dnfl-chart-1` through `--dnfl-chart-6`):
  * Conference 01: Cobalt Blue (`#3b82f6`)
  * Conference 02: Emerald Green (`#10b981`)
  * Conference 03: Warm Amber (`#f59e0b`)
  * Conference 04: Coral Red (`#ef4444`)
* **Lifecycle Management**: Before rendering a new week or conference view, the script verifies if an active instance exists (`DNFL.Rankings.chartInstance`) and calls `chartInstance.destroy()` to prevent canvas reuse conflicts.

### 5.2 Chart Visibility Toggle
The chart container (`#dnfl_chartWrapperContainer`) can be toggled open or closed using the toolbar action button (`#dnfl_toggleChartBtn`). Visibility is controlled strictly by toggling the `.dnfl-is-hidden` utility class.

---

## 6. UI Components, Badges & Commentary Callouts

### 6.1 Rank Movement Badges
Rank movement is computed automatically by comparing `Rank` against `Previous`:
* **Rank Up (`Previous > Rank`)**: Rendered as a green status badge (`.dnfl-badge-green`) displaying `▲ +N` (e.g., `▲ +2`).
* **Rank Down (`Previous < Rank`)**: Rendered as a red status badge (`.dnfl-badge-red`) displaying `▼ -N` (e.g., `▼ -3`).
* **Rank Unchanged (`Previous == Rank`)**: Rendered as a gray neutral badge (`.dnfl-badge-gray`) displaying `—`.
* **New Entry (`Previous == 0` / Unranked)**: Rendered as an amber status badge (`.dnfl-badge-amber`) displaying `NEW`.

### 6.2 Solid Power Index Pills
Power Index scores are formatted inside solid metadata pill capsules (`.dnfl-pill-blue` / `.dnfl-record-pill`):
```html
<span class="dnfl-pill-blue dnfl-pill">94.2</span>
```

### 6.3 Expandable Commentary Callout Rows (`.dnfl-comment-row`)
Each team row can expand to reveal commissioner commentary notes.
* **HTML Structure**: Commentary resides in a dedicated child row (`.dnfl-comment-row`) immediately following the primary team row.
* **Callout Box Styling**: Text is styled inside `.dnfl-comment-box`, featuring a `3px` Duke Shale Blue (`#0577B1`) left accent border, soft slate background (`#f8fafc`), and italicized typography.
* **Pure Class Toggling**: Expanding and collapsing commentary rows toggles `.dnfl-is-hidden` on the `.dnfl-comment-row` element without inline style modifications.

```html
<!-- Primary Ranked Row -->
<tr class="dnfl-row-odd dnfl-rank-row" data-team-id="0004">
    <td class="dnfl-col-rank">1</td>
    <td class="dnfl-col-badge"><span class="dnfl-badge-green dnfl-badge">▲ +2</span></td>
    <td class="dnfl-col-team">
        <span class="dnfl-team-name">Cameron Crazies</span>
        <span class="dnfl-owner-name">Jason Rosario</span>
    </td>
    <td class="dnfl-col-record">10-2-0</td>
    <td class="dnfl-col-power"><span class="dnfl-pill-blue dnfl-pill">94.2</span></td>
    <td class="dnfl-col-action">
        <button class="dnfl-btn-icon dnfl-comment-toggle" title="Toggle Commentary">
            <i class="fa-solid fa-comment-dots"></i>
        </button>
    </td>
</tr>

<!-- Expandable Commentary Row -->
<tr class="dnfl-comment-row dnfl-is-hidden" id="dnfl-comment-0004">
    <td colspan="6">
        <div class="dnfl-comment-box">
            <i class="fa-solid fa-quote-left dnfl-icon-blue"></i>
            <span>Dominant victory in Week 1 with top overall score.</span>
        </div>
    </td>
</tr>
```

### 6.4 Logged-In Owner Highlighting
When `DNFL.Client` resolves the active user's franchise ID (e.g., `"0004"`), matching table rows automatically receive `.dnfl-my-team` or `.myfranchise`, highlighting the row in soft Canary Yellow (`#fde68a`).

---

## 7. HTML Embed Shell Specification (`hpm-rankings-embed.html`)

The Power Rankings HTML shell is embedded directly into MyFantasyLeague HPM modules. It provides the semantic 3-level card container structure:

```html
<!-- DNFL Power Rankings Module Embed -->
<div class="dnfl-card" id="dnfl-rankings-container">
    <!-- Card Header -->
    <div class="dnfl-card-header">
        <h3 class="dnfl-card-title">
            <i class="fa-solid fa-chart-line"></i> Power Rankings
        </h3>
    </div>

    <!-- Card Body -->
    <div class="dnfl-card-body">
        <!-- Control Toolbar -->
        <div class="dnfl-toolbar">
            <div class="dnfl-filter-group">
                <div class="dnfl-select-wrapper">
                    <label for="dnfl_powerRankingWeek">Week:</label>
                    <select id="dnfl_powerRankingWeek" class="dnfl-select"></select>
                </div>
                <div class="dnfl-select-wrapper">
                    <label for="dnfl_powerRankingConf">Conference:</label>
                    <select id="dnfl_powerRankingConf" class="dnfl-select">
                        <option value="ALL">All Conferences</option>
                    </select>
                </div>
            </div>
            <div class="dnfl-buttons-right">
                <button id="dnfl_toggleChartBtn" class="dnfl-btn dnfl-btn-secondary">
                    <i class="fa-solid fa-chart-bar"></i> Hide Chart
                </button>
            </div>
        </div>

        <!-- Chart Container -->
        <div id="dnfl_chartWrapperContainer" class="dnfl-chart-container">
            <div class="dnfl-chart-wrapper">
                <canvas id="dnfl_powerRankingChart"></canvas>
            </div>
        </div>

        <!-- Ranked Data Table -->
        <div class="dnfl-table-wrapper">
            <table id="dnfl_powerRankingTable" class="dnfl-table">
                <thead>
                    <tr>
                        <th class="dnfl-col-rank">Rank</th>
                        <th class="dnfl-col-badge">Change</th>
                        <th class="dnfl-col-team">Franchise</th>
                        <th class="dnfl-col-record">Record</th>
                        <th class="dnfl-col-power">Power Index</th>
                        <th class="dnfl-col-action">Notes</th>
                    </tr>
                </thead>
                <tbody id="dnfl_powerRankingTbody">
                    <!-- Dynamic Rows Injected by dnfl-rankings.js -->
                </tbody>
            </table>
        </div>
    </div>
</div>
```

---

## 8. Public API Reference & Developer Guidelines

### 8.1 Public API Methods (`window.DNFL.Rankings`)

```javascript
// Initialize Module
DNFL.Rankings.init();

// Load Specific Week Dataset
DNFL.Rankings.loadWeek("02");

// Toggle Chart Container Visibility
DNFL.Rankings.toggleChart();

// Toggle Commentary Row for a Specific Franchise
DNFL.Rankings.toggleCommentary("0004");
```

### 8.2 Developer Maintenance Checklist

When publishing new weekly rankings or starting a new season:
1. **Create Weekly CSV File**: Save the new dataset in `/dnfl_rankings/{Year}/data_WW.csv` matching the schema defined in Section 4.2.
2. **Update Season Manifest**: Edit `/dnfl_rankings/{Year}/weeks.json` to append the new week entry and update `"active_week"` to the newly published week ID.
3. **Validate CSV Headers**: Ensure CSV headers match `Rank,Previous,TeamID,TeamName,Owner,Record,PowerIndex,ConfID,Commentary` exactly.
4. **Verify Mobile Touch Scrolling**: Confirm the table remains wrapped inside `.dnfl-table-wrapper` for hardware-accelerated horizontal scrolling.
5. **Verify State Utility Toggling**: Check that clicking `#dnfl_toggleChartBtn` and commentary buttons toggles `.dnfl-is-hidden` rather than applying direct inline `.style.display` modifications.
