# DNFL New Module Requirements & Prompt Specification Template

Use this template to define the specifications for creating a new Duke Networking Fantasy League (DNFL) web module. Fill out each section with as much detail as possible, then submit this document alongside the DNFL Core Infrastructure source files (`README-dnfl.md`, `README-dnfl-css.md`, `README-dnfl-api.md`) to generate the module logic engine (`scripts/dnfl-[module-name].js`), HTML embed shell (`dnfl_[module_name]/hpm-[module-name]-embed.html`), and developer documentation (`dnfl_[module_name]/README-dnfl-[module-name].md`).

---

## 1. Module Overview & Metadata

* **Module Name (Kebab-Case)**: `dnfl-[module-name]` (e.g., `dnfl-scoreboard`, `dnfl-draft-history`)
* **Module Name (CamelCase / Namespace)**: `DNFL.[ModuleName]` (e.g., `DNFL.Scoreboard`)
* **Directory Name**: `dnfl_[module_name]/`
* **Container ID**: `#dnfl-[module-name]-container`
* **Embed File Name**: `hpm-[module-name]-embed.html`
* **Script File Name**: `dnfl-[module-name].js`
* **Primary Objective**: Brief 1–2 sentence description of what this module does and why it exists.
* **Target MFL Embed Page**: (e.g., Homepage Module, Custom Page 01, Standings Tab)

---

## 2. Architectural & Core Constraints (Mandatory)

All DNFL modules must strictly adhere to these framework rules:
1. **Zero Inline Styles**: All styling must be handled via global CSS classes in `css/dnfl-global.css` or the module partial `css/scss/_[module-name].scss`. No `style="..."` attributes or `.style.display` assignments in JS.
2. **API Middleware Only**: All network communication must use `DNFL.Client` (`window.DNFLClient`). No raw `fetch()` or `jQuery.ajax()` calls allowed.
3. **Class-Based State Management**: Visibility and UI states must use framework utility classes (`.dnfl-is-hidden`, `.dnfl-is-visible`, `.dnfl-is-flex`, `.is-expanded`, `.is-collapsed`).
4. **Lifecycle Event Binding**: Logic must bind to `window.addEventListener('dnfl:ready', init)` and include retry guards (`maxRetries = 50`, `100ms` intervals) for DOM mounting.
5. **Component Scoping**: All CSS rules must be strictly scoped under `#dnfl-[module-name]-container`.

---

## 3. Data Sources & API Middleware Requirements

### 3.1 MFL API Endpoints (`DNFL.Client.fetchData`)
List all required MFL API endpoints, parameters, and TTL caching presets:
* **Endpoint 1**:
  * **Export Type**: (e.g., `leagueStandings`, `weeklyResults`, `rosters`, `schedule`, `liveScoring`)
  * **Parameters**: (e.g., `{ W: 'THIS_WEEK', L: '33580' }`)
  * **TTL Preset**: (`client.TTL.REALTIME` [30s] | `FIVE_MIN` [5m] | `HOURLY` [1h] | `DAILY` [24h] | `WEEKLY` [7d])
* **Endpoint 2**: (if applicable)

### 3.2 External / CDN Data Feeds (`DNFL.Client.fetchRawText`)
List any custom JSON manifests, CSV files, or Markdown transcripts:
* **Feed URL / Path**: (e.g., `https://dnfl.live/dnfl_[module_name]/2026/data.json`)
* **Format**: (JSON / CSV / Markdown)
* **TTL Preset**: (`client.TTL.DAILY` / `WEEKLY`)
* **Parsing Library**: (PapaParse for CSV, Marked.js for MD, native `JSON.parse`)

### 3.3 User Franchise & Session Requirements
* **Highlight Active User**: (Yes / No) - Highlight the logged-in owner's row/card using `.dnfl-my-team` or `.myfranchise`.
* **Auto-Filter Context**: (Yes / No) - Default view/filters to the active user's division or conference.

---

## 4. UI Layout & Visual Component Requirements

### 4.1 Shell Container Structure
* **Card Architecture**:
  * [ ] Standard Single Card (`.dnfl-card`)
  * [ ] Multi-Column Card Grid (`.dnfl-card-grid` / `.dnfl-scoreboard-grid`)
  * [ ] Multi-Tab / Multi-Panel Accordion Layout
* **Header Title & Icon**:
  * **Title**: (e.g., "Weekly Matchups", "League Draft Board")
  * **FontAwesome 6 Icon**: (e.g., `fa-solid fa-football`, `fa-solid fa-chart-line`)

### 4.2 Toolbar Controls & Filters (`.dnfl-toolbar`)
List all dropdowns, toggle buttons, or search fields:
* **Filter 1**: (e.g., Week Selector `<select id="dnfl-[module-name]-week">`)
* **Filter 2**: (e.g., Conference / Division Selector `<select>`)
* **Action Buttons**: (e.g., "Expand All", "Export CSV", "Toggle Chart")

### 4.3 Data Presentation Components
Specify how the primary data should be rendered:
* [ ] **Table (`.dnfl-table`)**:
  * Wrapped in `.dnfl-table-wrapper` for mobile touch scrolling.
  * Columns list: (e.g., Rank, Team, Record, Points For, Status)
  * Row striping: `.dnfl-row-odd` / `.dnfl-row-even`
* [ ] **Sub-Cards / Game Grid Cards (`.dnfl-game-card`)**:
  * Sub-card layout details: (e.g., Team A vs Team B, live score badges)
* [ ] **Visualizations / Charts**:
  * Chart.js type: (Horizontal Bar, Line Chart, Pie)
  * Target canvas ID: `#dnfl_[module-name]_chart`
* [ ] **Accordions / Expandable Callouts**:
  * Level hierarchy and toggle behavior (`.is-expanded` / `.is-collapsed`)

### 4.4 Status Badges, Pills & Indicators
List any required status badges or capsules:
* [ ] **Record Pills**: `.dnfl-pill-blue` (Solid blue capsule for records/scores)
* [ ] **Seed Badges**: `.dnfl-seed-badge` (Circular neutral badge for rank numbers)
* [ ] **Status Badges**: `.dnfl-badge-green` (Positive/Up), `.dnfl-badge-red` (Negative/Down), `.dnfl-badge-amber` (Warning)

---

## 5. Interactive Logic & Functionality

Describe all user interactions and state changes:
1. **Initial Load Sequence**: What happens when the module mounts?
2. **User Filter / Selection Change**: How does changing a dropdown update the UI?
3. **Toggle Actions**: Describe expandable rows, chart hide/show, or modal actions.
4. **Calculations & Business Logic**:
   * Detail any custom math, tiebreakers, sorting algorithms, or statistical calculations (e.g., Z-scores, custom standings tiebreakers, win probabilities).

---

## 6. Public API & Export Specifications

List the public methods that should be exposed on `window.DNFL.[ModuleName]`:
* `DNFL.[ModuleName].init()`: Primary initialization method.
* `DNFL.[ModuleName].updateView()`: (e.g., re-renders UI on filter change)
* Custom methods: (e.g., `toggleDetail(id)`, `exportData(format)`)

---

## 7. Expected Artifact Deliverables

When generating this module, the output should include:
1. **Module Logic Script**: `scripts/dnfl-[module-name].js` (IIFE with safe middleware resolution and retry loop)
2. **HTML Embed Shell**: `dnfl_[module_name]/hpm-[module-name]-embed.html` (Semantic, 100% inline-style-free HTML stub)
3. **Developer Documentation**: `dnfl_[module_name]/README-dnfl-[module-name].md` (Architectural guide, data pipeline, and maintenance checklist)
4. **SCSS Partial (Optional)**: `css/scss/_[module-name].scss` (If custom module-specific styling beyond `_containers.scss` is required)