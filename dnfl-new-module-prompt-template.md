# DNFL Framework — New Module Creation Prompt Template

> **Instructions for Use:**
> Attach or reference the recommended framework files in your Gemini AI context, fill in the `[PLACEHOLDER]` sections below with your specific module requirements, and send this prompt to Gemini AI to generate the complete JavaScript engine and HTML embed stub for your new module.

---

## 🤖 System Context & Role Definition
You are an expert lead frontend engineer building a new interactive feature module for the **Duke Networking Fantasy League (DNFL) Web Framework**.

You adhere strictly to the DNFL architectural guidelines, modular coding standards, global CSS design system (`dnfl-global-v2.css`), central API middleware (`DNFLClient`), and `window.DNFL` namespace patterns.

---

## 📚 Grounding Framework Sources Attached
The following core framework files have been provided as context for this task:
1. `README-dnfl.md`: Architecture overview, repository tree, execution pipeline, and developer guidelines.
2. `dnfl-global-v2.css`: Global CSS variable definitions (`--dnfl-*`), layout wrappers (`.dnfl-module-container`, `.dnfl-toolbar`), tables (`.dnfl-table`), badges, and status classes (`.dnfl-status-loading`, `.dnfl-status-error`).
3. `dnfl-api-client-v2.js`: Central network middleware (`DNFLClient.fetchData()`, `DNFLClient.fetchRawText()`) with TTL caching and request deduplication.
4. `dnfl-header-script-v2.js`: Framework script loader and version manager.
5. `[INSERT REFERENCE MODULE JS/HTML - e.g. dnfl-rankings-v2.js / hpm-rankings-embed-v2.html]`: Reference pattern implementation.

---

## 📋 Module Specifications & Requirements

### 1. Module Overview
* **Module Name**: `[INSERT MODULE NAME, e.g., Trades & Transactions / Draft Recaps]`
* **File Base Name**: `[INSERT SLUG, e.g., dnfl-trades]`
* **Module Namespace**: `window.DNFL.[INSERT MODULE CLASS NAME, e.g., Trades]`
* **Core Purpose**: `[INSERT HIGH-LEVEL DESCRIPTION OF WHAT THIS MODULE DOES AND THE PROBLEM IT SOLVES]`

### 2. Data Sources & API Feeds
* **Primary Data Sources**: `[SPECIFY DATA SOURCE TYPES: MFL API endpoints (e.g., 'transactions'), GitHub raw CSV/JSON files, or external feeds]`
* **API Endpoints / File URLs**: `[INSERT URL TEMPLATES OR MFL EXPORT TYPE KEYS]`
* **Data Schema / Fields**:
  - `[FIELD 1: e.g., Franchise ID / Name]`
  - `[FIELD 2: e.g., Transaction Date / Timestamp]`
  - `[FIELD 3: e.g., Player Details / Trade Assets]`
  - `[FIELD 4: e.g., Comments / Summary Notes]`

### 3. UI Components & User Interactions
* **Controls & Filters**: `[LIST DROPDOWNS, SEASON YEAR SELECTORS, SEARCH INPUTS, OR CONFERENCE FILTERS]`
* **Data Visualizations / Tables**: `[DESCRIBE CHARTS (Chart.js), TABLES, ACCORDIONS, CARDS, OR AUDIO PLAYERS]`
* **Toggle Buttons / Visibility**: `[SPECIFY ANY HIDE/SHOW TOGGLE BUTTONS FOR TABLES OR CHARTS]`
* **Default Views & Logged-In Owner Context**: `[SPECIFY DEFAULT FILTER BEHAVIOR, e.g., Auto-selecting logged-in franchise ID / conference or defaulting to current season]`

### 4. Technical & Code Requirements

#### JavaScript Logic Engine (`/scripts/dnfl-[module]-v1.js`)
- Wrap entire script in an Immediately Invoked Function Expression (IIFE) with `'use strict';`.
- Include `/* global DNFLClient */` header directive to prevent VS Code linter warnings.
- Register all public methods under `window.DNFL.[ModuleName]`.
- Use `window.DNFLClient` middleware exclusively for network fetches (`DNFLClient.fetchData()` or `DNFLClient.fetchRawText()`).
- Implement defensive ID normalization (`norm()`, `normFranchiseId()`) where applicable for team/conference matching.
- Auto-initialize safely on `DOMContentLoaded` or immediate ready-state check when target DOM element is present.

#### HTML Embed Shell (`./dnfl_[module]/hpm-[module]-embed-v1.html`)
- Construct an ultra-lean semantic HTML stub without inline layout styles (`style="width:..."`, `style="text-align:..."`).
- Use global CSS classes exclusively: `.dnfl-module-container`, `.dnfl-toolbar`, `.dnfl-controls`, `.dnfl-select`, `.dnfl-visibility-toggle-btn`, `.dnfl-table-wrapper`, `.dnfl-table`.
- Include initial loading state markup with `<p class="dnfl-status-loading">Loading [Module] data...</p>`.

---

## 🎯 Desired Deliverables
Please provide:
1. **Full JavaScript Logic File (`./scripts/dnfl-[module]-v1.js`)**: Production-ready, fully commented code block.
2. **Full HTML Embed Shell File (`./dnfl_[module]/hpm-[module]-embed-v1.html`)**: Complete HTML markup stub block.
3. **Integration Steps**: Brief instructions for adding the script URL to `dnfl-header-script-v2.js` and updating `FRAMEWORK_VERSION`.
