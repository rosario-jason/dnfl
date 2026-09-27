# DNFL Last Team Standing Requirements & Prompt Specification Template

Use this template to define the specifications for creating a new Duke Networking Fantasy League (DNFL) web module. Fill out each section with as much detail as possible, then submit this document alongside the DNFL Core Infrastructure source files (`README-dnfl.md`, `README-dnfl-css.md`, `README-dnfl-api.md`) to generate the module logic engine (`scripts/dnfl-lts.js`), HTML embed shell (`dnfl_lts/hpm-lts-embed.html`), and developer documentation (`dnfl_lts/README-dnfl-lts.md`).

---

## 1. Module Overview & Metadata

* **Module Name (Kebab-Case)**: `dnfl-lts`
* **Module Name (CamelCase / Namespace)**: `DNFL.LTS`
* **Directory Name**: `dnfl_lts/`
* **Container ID**: `#dnfl-lts-container`
* **Embed File Name**: `hpm-lts-embed.html`
* **Script File Name**: `dnfl-lts.js`
* **Primary Objective**: Module ingests weekly scores via the MFL API to chronologically calculate weekly survival status (knocking out the lowest active scorer each week when LTS is enabled), identify weekly high/low scores, identify weekly high score prize winners (when HighScores is Enabled), and dynamically render a comprehensive Survival Timeline Cross-Grid (Weekly Scores) matrix and a chronological table (title Weekly Summary) within the MFL website.

Weekly Scores table will have rows for each franchise in the selected conference. Columns are each week scores (only showing columns for weeks with scores). Conferences should be shown in alphabetical order. If LTS is enabled the Eliminated Teams should move to lower section of table with subheader row (Eliminated Teams). Weekly High Score should be badge-green by default, if `highScore_isEnabled=TRUE` then should be green pill instead - see below. Low Score should be badge-red by default unless it is the eliminatedScore. If `lts_isEnabled=TRUE` eliminatedScore should be displayed in red pill (see below.)

Weekly Summary table displays Week, Eliminated Franchise (formatted with icon/name), Knockout/Low Score (red badge), Weekly High Scorer (formatted with icon/name), High Score(green badge with fa-star).

* **Target MFL Embed Page**: MFL Homepage Module

---

## 2. Architectural & Core Constraints (Mandatory)

All DNFL modules must strictly adhere to these framework rules:
1. **Zero Inline Styles**: All styling must be handled via global CSS classes in `css/dnfl-global.css` or the module partial `css/scss/_lts.scss`. No `style="..."` attributes or `.style.display` assignments in JS.
2. **API Middleware Only**: All network communication must use `DNFL.Client` (`window.DNFLClient`). No raw `fetch()` or `jQuery.ajax()` calls allowed.
3. **Class-Based State Management**: Visibility and UI states must use framework utility classes (`.dnfl-is-hidden`, `.dnfl-is-visible`, `.dnfl-is-flex`, `.is-expanded`, `.is-collapsed`).
4. **Lifecycle Event Binding**: Logic must bind to `window.addEventListener('dnfl:ready', init)` and include retry guards (`maxRetries = 50`, `100ms` intervals) for DOM mounting.
5. **Component Scoping**: All CSS rules must be strictly scoped under `#dnfl-lts-container`.

---

## 3. Data Sources & API Middleware Requirements

### 3.1 MFL API Endpoints (`DNFL.Client.fetchData`)
List all required MFL API endpoints, parameters, and TTL caching presets:
* **Endpoint 1**:
  * **Export Type**: `league`
  * **Parameters**: L: from API
  * **TTL Preset**: (`client.TTL.REALTIME` [30s] | `FIVE_MIN` [5m] | `HOURLY` [1h] | `DAILY` [24h] | `WEEKLY` [7d])
* **Endpoint 2**: 
  * **Export Type**: `weeklyResults`
  * **Parameters**: Need all weeks
  * **TTL Preset**: (`client.TTL.REALTIME` [30s] | `FIVE_MIN` [5m] | `HOURLY` [1h] | `DAILY` [24h] | `WEEKLY` [7d])

### 3.2 External / CDN Data Feeds (`DNFL.Client.fetchRawText`)
List any custom JSON manifests, CSV files, or Markdown transcripts:
* **Feed URL / Path**: `dnfl_lts/{YEAR}/lts_rules.json`
* **Format**: JSON
* **TTL Preset**: n/a
* **Parsing Library**: provides 9 variables, 3 per conference: lts_isEnabled: Boolean, highScore_isEnabled: Boolean, startWeek: auto or integer (if auto module dynamically calculate `startWeek = regularSeasonEndWeek - (activeTeamsInConference - 1)`)

### 3.3 User Franchise & Session Requirements
* **Highlight Active User**: (YES) - Highlight the logged-in owner's row/card using `.dnfl-my-team` or `.myfranchise`.
* **Auto-Filter Context**: (YES) - Default view/filters to the active user's conference.

---

## 4. UI Layout & Visual Component Requirements

### 4.1 Shell Container Structure
* **Card Architecture**:
  * [X] Standard Single Card (`.dnfl-card`)

* **Header Title & Icon**:
  * **Title**: Last Team Standing
  * **FontAwesome 6 Icon**: `fa-solid fa-medal`

### 4.2 Toolbar Controls & Filters (`.dnfl-toolbar`)
List all dropdowns, toggle buttons, or search fields:
* **Filter 1**: Conference
* **Action Buttons**: "Hide/Show Grid", "Hide/Show Summary"

### 4.3 Data Presentation Components
Specify how the primary data should be rendered:
* [X] **Table (`.dnfl-table`)**:
  * Wrapped in `.dnfl-table-wrapper` for mobile touch scrolling.
  * Columns list: (e.g., Rank, Team, Record, Points For, Status)
  * Row striping: `.dnfl-row-odd` / `.dnfl-row-even`
* [ ] **Sub-Cards / Game Grid Cards (`.dnfl-game-card`)**:
  * Sub-card layout details: (e.g., Team A vs Team B, live score badges)
* [ ] **Visualizations / Charts**:
  * Chart.js type: (Horizontal Bar, Line Chart, Pie)
  * Target canvas ID: `#dnfl_lts_chart`
* [ ] **Accordions / Expandable Callouts**:
  * Level hierarchy and toggle behavior (`.is-expanded` / `.is-collapsed`)

### 4.4 Status Badges, Pills & Indicators
List any required status badges or capsules:
**Weekly Scores Grid**
* [X] **Eliminated Pills**: `.dnfl-pill-red` with fa-solid skull icon
* [X] **High Score Winner Pill**: `.dnfl-pill-green` with fa-solid star icon
* [X] **Low Score Badge**: `.dnfl-badge-red` low score if not Eliminated Pill
* [X] **High Score Badge**: `.dnfl-seed-badge` high score if not High Score Winner Pill
**Weekly Summary Table**
* [X] **Low Score Badge**: `.dnfl-badge-red` Eliminated Team Score (if lts_isEnabled)
* [X] **High Score Badge**: `.dnfl-seed-badge` Weekly High Score Winner (if highScore_isEnabled)

---

## 5. Interactive Logic & Functionality

Describe all user interactions and state changes:
1. **Initial Load Sequence**: Grid & Table are presented with logged in user Conference
2. **User Filter / Selection Change**: Table refreshed for new conference
3. **Toggle Actions**: Describe expandable rows, chart hide/show, or modal actions.
4. **Calculations & Business Logic**:
   * Detail any custom math, tiebreakers, sorting algorithms, or statistical calculations (e.g., Z-scores, custom standings tiebreakers, win probabilities).

---

## 6. Public API & Export Specifications

List the public methods that should be exposed on `window.DNFL.lts`:
* `DNFL.lts.init()`: Primary initialization method.
* `DNFL.lts.updateView()`: (e.g., re-renders UI on filter change)
* Custom methods: (e.g., `toggleDetail(id)`, `exportData(format)`)

---

## 7. Expected Artifact Deliverables

When generating this module, the output should include:
1. **Module Logic Script**: `scripts/dnfl-lts.js` (IIFE with safe middleware resolution and retry loop)
2. **HTML Embed Shell**: `dnfl_lts/hpm-lts-embed.html` (Semantic, 100% inline-style-free HTML stub)
3. **Developer Documentation**: `dnfl_lts/README-dnfl-lts.md` (Architectural guide, data pipeline, and maintenance checklist)
4. **SCSS Partial (Optional)**: `css/scss/_lts.scss` (If custom module-specific styling beyond `_containers.scss` is required)