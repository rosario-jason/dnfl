# Duke Networking Fantasy League (DNFL) - Master SCSS & CSS Design System Guide

## 1. Executive Summary & Design System Architecture

The **DNFL CSS Design System** (`css/dnfl-global.css`) provides a unified, mobile-responsive, BEM-encapsulated visual foundation across all Duke Networking Fantasy League web modules and MyFantasyLeague (MFL) home page embeds.

The design system is engineered with a strict **Separation of Concerns**:
* **Zero Inline Styles**: All layout, typography, colors, padding, borders, and animations are governed exclusively by stylesheets. HTML embed shells and JavaScript engines must never inject direct `style="..."` attributes or `.style.display` assignments.
* **Modular SCSS Architecture**: The master stylesheet (`css/dnfl-global.css`) is compiled from 13 dedicated SCSS partials, organizing variables, base resets, mixins, state utilities, badges, containers, tables, and component-scoped overrides.
* **Component-Scoped Scoping**: To prevent CSS bleed across embedded MFL modules, feature-specific styles are strictly scoped under parent container IDs (`#dnfl-standings-container`, `#dnfl-rankings-container`, `#dnfl-podcast-container`, `#dnfl-rules-container`, `#dnfl-exporter-container`).

---

## 2. SCSS Directory Layout & Partials Structure

The design system stylesheet is maintained as modular SCSS source partials under the `css/` directory and compiled into `css/dnfl-global.css`:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
│
└── css/
    ├── dnfl-global.css              # Compiled production stylesheet
    ├── README-dnfl-css.md           # Master CSS design system guide (This file)
    └── scss/                        # Source SCSS partials directory
        ├── dnfl-global.scss         # Compiler entry manifest file
        ├── _variables.scss          # Design tokens & CSS variables
        ├── _base.scss               # Typography defaults & MFL shell resets
        ├── _mixins.scss             # Reusable SCSS flexbox & shadow mixins
        ├── _utilities.scss          # State utility classes (.dnfl-is-hidden, .is-expanded)
        ├── _badges.scss             # Status badges, record capsules & seed badges
        ├── _containers.scss         # Card architecture (.dnfl-card), toolbars & controls
        ├── _tables.scss             # Base table rules (.dnfl-table), striping & user highlight
        ├── _standings.scss          # Scoped Standings column alignments & division headers
        ├── _rankings.scss           # Scoped Rankings bar chart wrapper & comment callout box
        ├── _podcast.scss            # Scoped Podcast audio player block & markdown transcript
        ├── _rules.scss               # Scoped Official Bylaws accordions & CSS counter lists
        ├── _exporter.scss           # Scoped Exporter toolbar & monospace preview textarea
        └── _mfl-overrides.scss      # Native MFL host site header, menu & icon overrides
```

---

## 3. Design Tokens & CSS Variable Reference (`:root, .dnfl`)

All visual styling relies on centralized CSS Custom Properties defined in `_variables.scss` under `:root` and `.dnfl`:

```css
:root, .dnfl {
  /* 1. BRAND & PRIMARY COLOR PALETTE */
  --dnfl-primary: #0577B1;                  /* Duke Shale Blue (Primary Accent) */
  --dnfl-primary-hover: #045e8c;            /* Ocean Blue (Darker Accent) */
  --dnfl-primary-light: #b6e2ff;            /* Ice Blue (Row Hover & Active Tint) */
  --dnfl-primary-ultra-light: #f0f9ff;      /* Sky Blue Tint (Soft Card Background) */

  /* 2. NEUTRAL SURFACES & BORDERS */
  --dnfl-bg-main: #ffffff;                 /* Pure White Surface */
  --dnfl-bg-card: #ffffff;                 /* Card Surface */
  --dnfl-bg-subhead: #f1f5f9;              /* Slate Sub-header Tint */
  --dnfl-bg-alt: #fafafa;                  /* Alternate Table Row Tint */
  --dnfl-border-subtle: #e2e8f0;           /* Card & Table Divider Border */
  --dnfl-border-focus: #0577B1;            /* Input Focus Outline */

  /* 3. TYPOGRAPHY & TEXT COLORS */
  --dnfl-text-heading: #0f172a;            /* Midnight Obsidian (Headings & Titles) */
  --dnfl-text-main: #121212;               /* Primary Dark Body Text */
  --dnfl-text-muted: #555555;              /* Medium Charcoal (Subtext & Legends) */
  --dnfl-text-light: #94a3b8;              /* Slate Muted Subtext */

  /* 4. USER SESSION & FRANCHISE HIGHLIGHT */
  --dnfl-highlight-yellow: #fde68a;         /* Canary Yellow (Logged-In User Row) */
  --dnfl-highlight-yellow-hover: #fcd34d;   /* Warm Gold (User Row Hover) */

  /* 5. CHART & CONFERENCE PALETTE */
  --dnfl-chart-1: #0577B1;                 /* Duke Shale Blue */
  --dnfl-chart-2: #0284c7;                 /* Cobalt Blue */
  --dnfl-chart-3: #0d9488;                 /* Teal Accent */
  --dnfl-chart-4: #d97706;                 /* Amber Gold */
  --dnfl-chart-5: #dc2626;                 /* Crimson Red */
  --dnfl-chart-6: #4f46e5;                 /* Indigo Accent */

  /* 6. STATUS & BADGE TINTS */
  --dnfl-green-bg: #dcfce7;                /* Emerald Tint (Positive Rank / High Score) */
  --dnfl-green-text: #15803d;              /* Dark Emerald Text */
  --dnfl-green-border: #bbf7d0;            /* Emerald Border */
  --dnfl-red-bg: #fee2e2;                  /* Rose Tint (Negative Rank / Relegation) */
  --dnfl-red-text: #b91c1c;                /* Crimson Red Text */
  --dnfl-red-border: #fecaca;              /* Rose Border */
  --dnfl-blue-bg: #dbeafe;                 /* Ice Blue (General Status Background) */
  --dnfl-blue-text: #1d4ed8;               /* Royal Blue Text */
  --dnfl-blue-border: #bfdbfe;              /* Ice Blue Border */
  --dnfl-amber-bg: #fef3c7;                /* Soft Amber Tint (Playoff Qualifier) */
  --dnfl-amber-text: #b45309;              /* Warm Amber Gold Text */
  --dnfl-amber-border: #fde68a;            /* Amber Border */
  --dnfl-gray-bg: #f1f5f9;                 /* Slate Tint (Neutral Status Background) */
  --dnfl-gray-text: #64748b;               /* Medium Slate Text */
  --dnfl-gray-border: #e2e8f0;             /* Slate Border */

  /* 7. DIMENSIONS, ELEVATION & MOTION */
  --dnfl-radius-lg: 12px;                  /* Card Corner Curve */
  --dnfl-radius-md: 8px;                   /* Control Input & Toolbar Curve */
  --dnfl-radius-sm: 4px;                   /* Badge & Button Curve */
  --dnfl-shadow-card: 0 4px 16px rgba(0, 0, 0, 0.4); /* Card Elevation Shadow */
  --dnfl-shadow-subtle: 0 1px 3px rgba(0, 0, 0, 0.05); /* Component Elevation Shadow */
  --dnfl-transition-fast: 0.15s ease;     /* Button Hover & Focus Motion */
  --dnfl-transition-smooth: 0.2s ease;    /* Accordion & Row Hover Motion */
}
```

---

## 4. DOM State & Utility Classes (`_utilities.scss`)

Framework JavaScript engines manage component visibility exclusively by toggling standardized CSS state classes:

### 4.1 Visibility State Utility Classes
* `.dnfl-is-hidden`: Forces element hiding (`display: none !important`). Replaces `.style.display = 'none'`.
* `.dnfl-is-visible`: Forces block display (`display: block !important`). Replaces `.style.display = 'block'`.
* `.dnfl-is-flex`: Forces flexbox display (`display: flex !important`). Replaces `.style.display = 'flex'`.

### 4.2 Accordion Expansion State Classes
* `.is-expanded`: Applied to active accordion content containers (`.dnfl-rules-main-content`, `.dnfl-rules-sub-content`, `.dnfl-rules-topic-content`) to expand content (`display: block !important`).
* `.is-collapsed`: Applied to inactive accordion content containers to collapse content (`display: none !important`).

### 4.3 Status Bar & Messaging Tokens
* `.dnfl-status-loading`: Italicized charcoal text (`#555555`) for active fetch states.
* `.dnfl-status-success`: Bold emerald green text (`#10b981`) for completed actions.
* `.dnfl-status-error`: Bold coral red text (`#ef4444`) for failed operations.

### 4.4 Icon Color Utility Helpers
* `.dnfl-icon-blue`: Cobalt blue (`#3b82f6`) icon tint.
* `.dnfl-icon-amber`: Warm amber (`#f59e0b`) icon tint.
* `.dnfl-icon-red`: Coral red (`#ef4444`) icon tint.
* `.dnfl-icon-green`: Emerald green (`#10b981`) icon tint.

---

## 5. Badges, Pills & Status Capsules (`_badges.scss`)

The framework provides three distinct badge architectures:

### 5.1 Standard Rectangle Status Badges (`.dnfl-badge`)
Compact rounded rectangles (`6px` border radius, `0.8rem` bold text) used for rank changes and indicators:
* `.dnfl-badge-green`: Positive rank change (`▲ +3`) / high score indicator.
* `.dnfl-badge-red`: Negative rank change (`▼ -2`) / relegation alert.
* `.dnfl-badge-blue`: General status information.
* `.dnfl-badge-amber`: Playoff qualifier warning.
* `.dnfl-badge-gray`: Unchanged status (`—`).

### 5.2 Solid Metadata Pill Capsules (`.dnfl-pill`, `.dnfl-pill-blue`)
Full-capsule badges (`9999px` border radius) with solid backgrounds and white text:
* `.dnfl-pill-blue` / `.dnfl-record-pill`: Solid cobalt blue (`#3b82f6`) background for win-loss records (`10-2-0`) and Power Index grades (`84.5`).
* `.dnfl-pill-green`: Solid emerald green background for high scores.
* `.dnfl-pill-red`: Solid coral red background for knockout alerts.

### 5.3 Circular Standings Seed Badge (`.dnfl-seed-badge`)
A dedicated circular badge (`28px x 28px`, `50%` border radius, soft slate `#f1f5f9` background) used in the Standings left-aligned seed column:
```html
<td class="dnfl-col-seed">
    <span class="dnfl-seed-badge">1</span>
    <i class="fa-solid fa-crown dnfl-icon-blue" title="Division Winner"></i>
</td>
```

### 5.4 Conference Rank Badges (`.dnfl-rank-badge`)
Square badges (`28px x 28px`, `6px` radius) assigned per conference using slot classes `.color-1` through `.color-6`:
```html
<span class="dnfl-rank-badge color-1">1</span>
```

---

## 6. Card Container Architecture & Controls (`_containers.scss`)

Every feature module renders inside a standardized 3-level card container hierarchy:

### 6.1 Card Shell Hierarchy
```html
<div class="dnfl-card" id="dnfl-myfeature-container">
    <!-- Level 1: Card Header -->
    <div class="dnfl-card-header">
        <h3 class="dnfl-card-title">
            <i class="fa-solid fa-star"></i> Module Title
        </h3>
    </div>

    <!-- Level 2: Card Body -->
    <div class="dnfl-card-body">
        <!-- Level 3: Control Toolbar -->
        <div class="dnfl-toolbar">
            <div class="dnfl-filter-group">
                <label for="dnfl-select-id">Filter Label</label>
                <select id="dnfl-select-id" class="dnfl-select"></select>
            </div>
            <div class="dnfl-buttons-right">
                <button class="dnfl-btn dnfl-btn-primary">Action</button>
            </div>
        </div>

        <!-- Level 3: Content Wrapper -->
        <div class="dnfl-table-wrapper">
            <!-- Dynamic Data Table -->
        </div>
    </div>
</div>
```

### 6.2 Button Classes
* `.dnfl-btn-primary`: Solid Duke Shale Blue (`#0577B1`) with white text and hover state.
* `.dnfl-btn-secondary`: White background with Duke Shale Blue border and text, shading to ice blue tint on hover.
* `.dnfl-btn-icon`: Compact padding for icon-only action buttons.
* `.dnfl-visibility-toggle-btn`: Flat, borderless uppercase text button for toggling charts or submenus.

### 6.3 Legend Panels (`.dnfl-legend-panel`)
Soft slate (`#f1f5f9`) container providing conference swatch keys (`.dnfl-legend-swatch`) and disclaimer notes (`.dnfl-disclaimer-note`).

### 6.4 Multi-Column & Scoreboard Grid Architecture (`_containers.scss`)

For modules that require multi-card displays—such as a league scoreboard, weekly matchup grid, or multi-divisional layout—the framework provides a mobile-responsive CSS Grid system defined in `_containers.scss`:

```scss
/* Multi-Column Card & Scoreboard Grid System */
.dnfl-card-grid,
.dnfl-scoreboard-grid {
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)) !important;
  gap: 1rem !important;
  width: 100% !important;
  box-sizing: border-box !important;

  @media (max-width: 640px) {
    grid-template-columns: 1fr !important; /* Stacks cards vertically on mobile viewports */
  }
}

/* Individual Sub-Card / Game Scoreboard Container */
.dnfl-game-card,
.dnfl-card-sm {
  background-color: var(--dnfl-bg-card, #ffffff) !important;
  border: 1px solid var(--dnfl-border-subtle, #e2e8f0) !important;
  border-radius: var(--dnfl-radius-md, 8px) !important;
  padding: 1rem !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  box-shadow: var(--dnfl-shadow-subtle, 0 1px 3px rgba(0,0,0,0.05)) !important;
  transition: border-color var(--dnfl-transition-fast, 0.15s ease) !important;

  &:hover {
    border-color: var(--dnfl-primary, #0577B1) !important;
  }
}
```

#### Scoreboard HTML Structure Example
```html
<div class="dnfl-card" id="dnfl-scoreboard-container">
    <div class="dnfl-card-header">
        <h3 class="dnfl-card-title">
            <i class="fa-solid fa-football"></i> Live Scoreboard
        </h3>
    </div>
    <div class="dnfl-card-body">
        <!-- Multi-Column Grid Wrapper -->
        <div class="dnfl-scoreboard-grid">
            <!-- Game Card 1 -->
            <div class="dnfl-game-card">
                <div class="dnfl-game-header">Game 1</div>
                <div class="dnfl-game-team">
                    <span class="dnfl-team-name">Cameron Crazies</span>
                    <span class="dnfl-pill-blue dnfl-pill">112.4</span>
                </div>
                <div class="dnfl-game-team">
                    <span class="dnfl-team-name">Blue Devils</span>
                    <span class="dnfl-pill-blue dnfl-pill">105.1</span>
                </div>
            </div>
            <!-- Game Card 2 -->
            <div class="dnfl-game-card"> ... </div>
        </div>
    </div>
</div>
```

---

## 7. Unified Table System (`_tables.scss`)

All statistical tables use `.dnfl-table` for automatic zebra striping, interactive hover, and mobile responsiveness:

### 7.1 Touch Scrolling Wrapper (`.dnfl-table-wrapper`)
Wrapping any table in `.dnfl-table-wrapper` guarantees hardware-accelerated horizontal touch scrolling on mobile devices (`-webkit-overflow-scrolling: touch`).

### 7.2 Upright Table Headers Reset
Native MFL themes apply forced italics to `th` elements. The framework overrides this globally:
```css
table.dnfl-table th,
.dnfl-table th {
  font-style: normal !important;
}
```

### 7.3 Row Striping & Highlighting
* **Zebra Striping**: Alternates between white (`#ffffff`, `.dnfl-row-odd`) and off-white (`#fafafa`, `.dnfl-row-even`).
* **Row Hover**: Unselected rows highlight in Ice Blue (`#b6e2ff`, `--dnfl-primary-light`).
* **Logged-In Franchise Highlighting**: Rows belonging to the active logged-in user receive `.dnfl-my-team` or `.myfranchise`, styling the row in soft Canary Yellow (`#fde68a`, `--dnfl-highlight-yellow`) with Warm Gold (`#fcd34d`) hover feedback.

### 7.4 Franchise Link Typography
* **Team Name (`.dnfl-team-name`)**: Bold `0.95rem` Obsidian Black (`#121212`) text. Transitions to Duke Shale Blue on hover.
* **Owner Subtext (`.dnfl-owner-name`)**: Regular `0.8rem` Medium Charcoal (`#555555`) text.

---

## 8. Component-Scoped Module Styling

### 8.1 Standings (`_standings.scss` - `#dnfl-standings-container`)
* Left-aligned Seed Column (`.dnfl-col-seed`): Fixed `95px` width with `white-space: nowrap` to accommodate circular seed badges (`.dnfl-seed-badge`) alongside status icons.
* Points For / Points Against (`.dnfl-col-pf`, `.dnfl-col-pa`): Centered `110px` columns with green/red status badges.
* BBID Column (`.dnfl-col-bbid`): Centered `85px` column formatting dollar amounts (`$100.00`).
* Division Headers (`.dnfl-division-header`): Slate header bars with right-aligned collapse buttons (`Hide`/`Show`).

### 8.2 Power Rankings (`_rankings.scss` - `#dnfl-rankings-container`)
* Fluid Layout (`table-layout: auto !important`): Allows commentary callout rows (`.dnfl-comment-row`) to expand cleanly across all columns.
* Chart Wrapper (`.dnfl-chart-wrapper`): Relative container housing the responsive Chart.js canvas.
* Nested Commentary Box (`.dnfl-comment-box`): Italicized quote callout box featuring a `3px` Duke Shale Blue left accent border.

### 8.3 Podcast Player (`_podcast.scss` - `#dnfl-podcast-container`)
* Dark Media Block (`.dnfl-media-player-block`): Dark Charcoal (`#262626`) container hosting audio streams and metadata.
* Transcript Scrollbars (`.dnfl-transcript-wrapper`): Max height `450px` scrollable panel with custom WebKit scrollbars (`6px` width, slate thumb).
* Markdown Typography Overrides: Restores clear headers (`h1-h4`), bold text, and italicized Duke Blue emphasis (`em`).

### 8.4 Official Bylaws Rules (`_rules.scss` - `#dnfl-rules-container`)
* 3-Level Accordion Tabs:
  * Level 1 Section (`.dnfl-rules-tabhead`): Bold `1.1rem` header with badge.
  * Level 2 Subsection (`.dnfl-rules-subhead`): `1rem` header with `4px` left blue border.
  * Level 3 Topic (`.dnfl-rules-topichead`): `0.95rem` slate header.
* Automated SCSS CSS Counters: Automatically calculates ordered rule numbers (`1.`, `2.`, `3.`) across schedule sub-header breaks (`<p class="dnfl-rules-schedule-header">`):
```scss
#dnfl-rules-container {
  .dnfl-rules-topic-content {
    counter-reset: rule-counter;
  }

  ol.subnum {
    list-style-type: none !important;
    padding-left: 0 !important;
    margin-left: 0 !important;

    li.subtext {
      counter-increment: rule-counter;
      position: relative;
      padding-left: 2rem !important;

      &::before {
        content: counter(rule-counter) ". ";
        position: absolute;
        left: 0;
        top: 0;
        font-weight: 600;
        color: var(--dnfl-text-heading, #0f172a);
      }
    }
  }
}
```
* Nested Rules Tables (`.dnfl-rules-table`): Soft slate headers (`#f1f5f9`) with blue accent lines, indented captions (`padding: 8px 12px`), and column alignment rules (3-column scoring vs 4-column financial tables).

### 8.5 Data Exporter (`_exporter.scss` - `#dnfl-exporter-container`)
* Action Toolbar Overrides: Controls `.dnfl-is-hidden` on copy/download action bars.
* Monospace Preview Textarea (`.dnfl-preview-textarea`): `350px` height monospace block (`#f8fafc` background) for JSON and Markdown report previews.

---

## 9. Native MFL Overrides (`_mfl-overrides.scss`)

Provides targeted overrides for native MyFantasyLeague host elements:
* Sticky Navigation Bar (`.myfantasyleague_menu`): Forces sticky positioning (`top: 0`, `z-index: 1000`) and Duke Shale Blue background.
* Franchise Icons (`.franchiseicon`): Enforces square aspect ratio (`4rem x 4rem` desktop / `2.25rem x 2.25rem` mobile) with `25%` rounded corners and `object-fit: cover`.
* Franchise Logos (`.franchiselogo`): Max height `25rem` centered container.
* Transparent Outer Container Reset: Removes background colors and box shadows from MFL `#body_content`, `#reports`, and `.homepagemodule` wrappers so framework cards render seamlessly.

---

## 10. Developer Guide: Creating CSS for a New DNFL Module

When developing styling for a new framework feature module (e.g. a live score ticker, draft board, or rivalry matrix), follow these step-by-step design standards:

### Step 1: Create a Dedicated SCSS Partial
1. Create a new partial file under `css/scss/` named `_myfeature.scss`.
2. Open `css/scss/dnfl-global.scss` and add `@import 'myfeature';` right before `_mfl-overrides.scss`.
3. Recompile `css/dnfl-global.css` using your SCSS compiler pipeline.

### Step 2: Enforce Component Container Scoping
To prevent CSS leaks onto MFL host pages or other framework modules, wrap **all rules** inside your module's parent container ID:

```scss
/* ==========================================================================
   DNFL Custom Feature Module Styles (_myfeature.scss)
   ========================================================================== */
#dnfl-myfeature-container {
  /* All component rules must be nested here */
  .dnfl-myfeature-custom-class {
    color: var(--dnfl-text-heading);
  }
}
```

### Step 3: Global Grid vs. Feature Partial Architecture
* **Global Grid Layouts**: If your module uses multi-card containers, scoreboards, or game cards, rely on the global `.dnfl-card-grid`, `.dnfl-scoreboard-grid`, and `.dnfl-game-card` classes defined in `_containers.scss`.
* **Feature Partial Styles**: Use `_myfeature.scss` strictly for styles unique to your module—such as team logo sizes, clock badges, or custom stats spacing.

### Step 4: Starter SCSS Boilerplate
Use this template as a starting point for `_myfeature.scss`:

```scss
#dnfl-myfeature-container {
  /* Custom Toolbar Adjustments */
  .dnfl-toolbar {
    margin-bottom: 1rem !important;
  }

  /* Custom Data Grid or Table Customizations */
  .dnfl-myfeature-stat {
    font-weight: 700 !important;
    color: var(--dnfl-primary, #0577B1) !important;
  }

  /* Mobile Responsive Tweaks */
  @media (max-width: 768px) {
    .dnfl-myfeature-stat {
      font-size: 0.85rem !important;
    }
  }
}
```

### Step 5: Development Checklist & Code Quality Rules
* **Zero Inline Styles**: Never write `style="..."` in your HTML embed shell or JavaScript template literals.
* **Use CSS Custom Properties**: Always use `var(--dnfl-primary)`, `var(--dnfl-bg-card)`, etc., for colors, borders, and radii instead of hardcoded hex values.
* **Toggle Visibility via Utilities**: Use `.dnfl-is-hidden`, `.dnfl-is-visible`, `.dnfl-is-flex`, `.is-expanded`, and `.is-collapsed` in JavaScript rather than direct `.style` manipulation.
* **Mobile Touch Scrolling**: Always wrap tabular data in `<div class="dnfl-table-wrapper"><table class="dnfl-table">...</table></div>` to guarantee horizontal mobile scrolling.
