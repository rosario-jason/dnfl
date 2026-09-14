# DNFL Power Rankings Module (`dnfl_rankings/`)

The **DNFL Power Rankings Module** delivers an interactive power rankings dashboard combining a dynamic Chart.js horizontal bar visualization and a detailed, sortable data table. Data is decoupled into annual CSV data files and dynamic JSON week manifests hosted on GitHub.

---

## 📁 Repository Directory Location

In accordance with the `rosario-jason/dnfl` GitHub repository structure:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
├── ./scripts/
│   └── dnfl-rankings-v2.js             # Rankings parser, Chart.js renderer, & table engine
└── ./dnfl_rankings/
    ├── hpm-rankings-embed-v2.html      # HTML embed stub for MFL Home Page Modules
    └── ./2026/                         # Season Data Directory (Data-Decoupled)
        ├── weeks.json                  # Published weeks directory log
        ├── data_00_pre-season.csv      # Pre-season rankings data file
        └── data_01_week1.csv           # Weekly rankings data file
```

---

## ⚙️ Logic Engine Architecture (`dnfl-rankings-v2.js`)

The Power Rankings Module operates within the global `window.DNFL.Rankings` namespace.

### Core Pipeline & Initialization Flow
1. **Year Resolution (`init`)**: Resolves active season year from `mflYear` argument, `window.current_year`, URL path regex (`/20\d{2}/`), or current calendar year.
2. **Dynamic Manifest Fetch**: Asynchronously fetches `weeks.json` for the active season year via `DNFLClient.fetchRawText()`.
3. **Week Selector Population**: Populates `#dnfl_weekSelector` dropdown options and automatically selects the most recent published week.
4. **CSV Parsing (`loadWeeklyData`)**: Fetches `data_{selectedWeek}.csv` via `DNFLClient.fetchRawText()` and parses raw text into JavaScript objects using `Papa.parse()`.
5. **Conference Filtering (`applyConferenceFilter`)**: Filters master dataset based on `#dnfl_confFilter` selection ("All", "Cameron Crazies", "K-Ville", "Blue Devils").
6. **Chart & Table Rendering (`renderChartAndTable`)**:
   * **Table Badges**: Displays sequential **1..N** ranks for the active filtered table view (`displayRank = index + 1`).
   * **Chart.js Bar Chart**: Renders a responsive horizontal bar chart (`indexAxis: 'y'`) sorted by `Overall Grade` with conference-themed color fills (`conferenceColors`) and borders (`conferenceBorders`).
   * **Tooltip Data**: Preserves overall `DNFL Rank: ${item.rank}` within Chart.js hover tooltips alongside owner names, division, and projected records.

### Key Public Methods (`window.DNFL.Rankings`)
* `init(mflYear)`: Initializes module context and week manifest.
* `loadWeeklyData()`: Fetches and parses CSV data for selected week.
* `renderChartAndTable(records)`: Builds HTML table rows and instantiates/updates Chart.js bar chart.
* `applyConferenceFilter()`: Filters dataset by conference and recalculates chart height (`(length * 32) + 100` px).
* `toggleElementVisibility(sectionType)`: Toggles visibility of chart container (`#dnfl_chartWrapperContainer`) or table container (`#dnfl_dataTable`).

---

## 📊 Data Decoupling & Schemas

### 1. Weeks Manifest (`weeks.json`)
Located at `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_rankings/{YEAR}/weeks.json`:

```json
[
  { "id": "00_pre-season", "display": "Pre-Season" },
  { "id": "01_week1", "display": "Week 1" },
  { "id": "02_week2", "display": "Week 2" }
]
```

### 2. CSV Data Schema (`data_{ID}.csv`)
CSV files placed in `{YEAR}/` must contain exact headers:

| Header Name | Type | Description |
| :--- | :--- | :--- |
| `Rank` | Integer | Overall DNFL league rank (1..36) |
| `Franchise` | String | Team name |
| `Conference` | String | Conference name ("Cameron Crazies", "K-Ville", "Blue Devils") |
| `Conference - Division` | String | Division name |
| `Owner Name` | String | Primary owner name |
| `Co-Owner Name` | String | Co-owner name (optional) |
| `Overall Grade` | Float | Power rank numerical grade (0.0 – 100.0) |
| `Projected W-L` | String | Projected record (e.g. "10-4") |
| `Rank Comments` | String | Ranker commentary text |

---

## 🎨 HTML Embed Shell (`hpm-rankings-embed-v2.html`)

The HTML embed template utilizes the global utility classes from `dnfl-global-v2.css`:

```html
<!-- DNFL POWER RANKINGS MODULE EMBED -->
<div class="dnfl-module-container">
    <div class="dnfl-controls">
        <div class="dnfl-filter-group">
            <label for="dnfl_weekSelector">Week:</label>
            <select id="dnfl_weekSelector" class="dnfl-select" onchange="DNFL.Rankings.loadWeeklyData()"></select>
        </div>
        <div class="dnfl-filter-group">
            <label for="dnfl_confFilter">Conference:</label>
            <select id="dnfl_confFilter" class="dnfl-select" onchange="DNFL.Rankings.applyConferenceFilter()">
                <option value="All">All Conferences</option>
                <option value="Cameron Crazies">Cameron Crazies</option>
                <option value="K-Ville">K-Ville</option>
                <option value="Blue Devils">Blue Devils</option>
            </select>
        </div>
    </div>

    <div class="dnfl-rankings-legend">
        <div class="dnfl-legend-item"><span class="dnfl-legend-swatch crazies"></span><span>Cameron Crazies</span></div>
        <div class="dnfl-legend-item"><span class="dnfl-legend-swatch kville"></span><span>K-Ville</span></div>
        <div class="dnfl-legend-item"><span class="dnfl-legend-swatch bluedevils"></span><span>Blue Devils</span></div>
    </div>
    
    <div class="dnfl-section-header-row">
        <button id="dnfl_chartToggleBtn" class="dnfl-visibility-toggle-btn" onclick="DNFL.Rankings.toggleElementVisibility('chart')">Hide Chart</button>
    </div>

    <div id="dnfl_chartWrapperContainer" class="dnfl-chart-wrapper">
        <canvas id="dnfl_powerRankingChart"></canvas>
    </div>
</div>

<div id="dnfl_tableWrapperContainer" class="dnfl-table-wrapper">
    <div class="dnfl-toolbar">
        <div class="dnfl-section-header-row">
            <button id="dnfl_tableToggleBtn" class="dnfl-visibility-toggle-btn" onclick="DNFL.Rankings.toggleElementVisibility('table')">Hide Table</button>
        </div>
    </div>
    <table id="dnfl_dataTable" class="dnfl-table">
        <thead>
            <tr>
                <th>Rank</th>
                <th>Franchise</th>
                <th>Owners</th>
                <th>Grade</th>
                <th>Proj W-L</th>
                <th>Rank Comments</th>
            </tr>
        </thead>
        <tbody id="dnfl_tableBody"></tbody>
    </table>
</div>
```

---

## 🔄 Lifecycle Diagram

```text
[Init Module Context]   ──► Fetch {YEAR}/weeks.json via DNFLClient
       │
       ▼
[Populate Dropdown]     ──► Select latest published week
       │
       ▼
[Fetch CSV Data]        ──► Parse data_{selectedWeek}.csv via PapaParse
       │
       ▼
[Apply Filters]         ──► Filter masterData by Conference selection
       │
       ▼
[Render Chart & Table]  ──► Update Chart.js canvas & render 1..N table ranks
```

---

## 🚀 Annual Rollover & Maintenance

1. **New Season Directory**: Create `./dnfl_rankings/{YEAR}/` on GitHub.
2. **Week Manifest**: Place `weeks.json` inside `{YEAR}/` containing week IDs.
3. **Weekly Updates**: Upload new CSV files (`data_01_week1.csv`, etc.) and update `weeks.json`. The module automatically displays the newly published week.