# Duke Networking Fantasy League (DNFL) - Official Rules & Bylaws Engine Guide

## 1. Executive Summary & Core Principles

The **DNFL Official Rules & Bylaws Engine** (`scripts/dnfl-rules.js`) powers an interactive, 3-level accordion interface for navigating complex league bylaws, scoring systems, financial payout structures, and schedule rules directly within host platforms like MyFantasyLeague (MFL).

The engine enforces strict **Separation of Concerns**:
* **Class-Based Accordion State Toggling**: Accordion expansion and collapse are managed strictly by toggling `.is-expanded` and `.is-collapsed` state classes on container elements. Inline DOM `.style.display` assignments are strictly prohibited.
* **FontAwesome 6 Icon Synchronization**: Toggling accordion headers dynamically updates FontAwesome 6 icon classes (`fa-solid fa-chevron-down`/`fa-chevron-up`, `fa-caret-down`/`fa-caret-right`, `fa-angle-down`/`fa-angle-right`) without direct style overrides.
* **Automated SCSS List Auto-Numbering**: Rule list numbering (`1.`, `2.`, `3.`) across split `<ol class="subnum">` list blocks is driven automatically by SCSS CSS Counters (`counter-reset` and `counter-increment`). Manual `start="N"` attributes and orphaned list tags have been completely eliminated.
* **Nested Table Formatting**: Rules tables (`.dnfl-rules-table`) feature soft slate headers (`#f1f5f9`), Duke Blue bottom accent lines (`#0577B1`), indented captions (`padding: 8px 12px`), and column alignment rules (3-column scoring vs. 4-column financial payout tables).
* **Zero Inline Styles**: All layout, typography, borders, and animations in the HTML embed shell (`hpm-rules-embed.html`) and JavaScript templates are governed by `css/dnfl-global.css`.

---

## 2. Repository Directory Placement

The Bylaws module documentation lives alongside its HTML embed shell in the repository:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
│
├── dnfl_rules/
│   ├── README-dnfl-rules.md          # Official Bylaws Module Guide (This file)
│   └── hpm-rules-embed.html          # HTML embed shell stub for MFL
│
├── css/
│   └── scss/
│       └── modules/
│           └── _rules.scss           # Scoped bylaws & accordion stylesheet
│
└── scripts/
    └── dnfl-rules.js                 # Accordion logic & toolbar action engine
```

---

## 3. System Architecture Diagram

```text
[1. MFL Host Page Mounts #dnfl-rules-container]
       │
       ▼
[2. Scripts Loader Injects dnfl-rules.js & Dispatches 'dnfl:ready']
       │
       ▼
[3. DNFL.Rules.init() Execution]
       │
       ├──► 3.1 Retry Loop: Finds #dnfl-rules-container (maxRetries = 50)
       ├──► 3.2 Global Toolbar Event Binding (#dnfl-rules-expand-all, #dnfl-rules-collapse-all)
       ├──► 3.3 Accordion Header Event Delegation (click listeners on .dnfl-rules-tabhead, subhead, topichead)
       └──► 3.4 Initial State Resolution (Defaults all accordion levels to .is-collapsed)
       │
       ▼
[4. User Interaction Events]
       │
       ├──► Click Header ──► Toggle .is-expanded / .is-collapsed & Update FontAwesome 6 Icons
       └──► Click Toolbar ─► Expand All / Collapse All / Toggle Submenus
```

---

## 4. Accordion Hierarchy & CSS Counter Architecture

### 4.1 Three-Level Accordion Structure

The rulebook organizes content into a clear 3-tier visual hierarchy:

| Level | Header Class | Content Container Class | Visual Style & Indicators |
| :--- | :--- | :--- | :--- |
| **Level 1: Main Section** | `.dnfl-rules-tabhead` | `.dnfl-rules-main-content` | Dark Slate Header Bar, Bold `1.1rem` Text, Section Badge |
| **Level 2: Subsection** | `.dnfl-rules-subhead` | `.dnfl-rules-sub-content` | Soft Slate Tint, `1rem` Text, `4px` Left Blue Accent Border |
| **Level 3: Rule Topic** | `.dnfl-rules-topichead` | `.dnfl-rules-topic-content` | Compact `0.95rem` Slate Header, Chevron Indicator |

### 4.2 State Class Toggling

Opening or closing an accordion toggles framework state utility classes:

```html
<!-- Expanded Subsection Example -->
<div class="dnfl-rules-subhead is-expanded">
    <i class="fa-solid fa-chevron-down"></i> 2.1 Regular Season Schedule
</div>
<div class="dnfl-rules-sub-content is-expanded">
    <!-- Topic Content inside -->
</div>

<!-- Collapsed Subsection Example -->
<div class="dnfl-rules-subhead is-collapsed">
    <i class="fa-solid fa-chevron-right"></i> 2.2 Playoff Bracket
</div>
<div class="dnfl-rules-sub-content is-collapsed">
    <!-- Hidden Content -->
</div>
```

### 4.3 Automated SCSS CSS Counter Numbering

To allow schedule sub-headers (`<p class="dnfl-rules-schedule-header">`) or relegation headers to interrupt rule lists without resetting or manually numbering items, the module relies on native CSS Counters in `modules/_rules.scss`:

```scss
#dnfl-rules-container {
  /* Reset counter at the top of each topic container */
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

#### Valid HTML Markup Pattern for Split Lists
```html
<div class="dnfl-rules-topic-content">
    <ol class="subnum">
        <li class="subtext">First rule item in topic (Renders "1.")</li>
        <li class="subtext">Second rule item in topic (Renders "2.")</li>
    </ol>

    <!-- Header interrupts list without resetting counter -->
    <p class="dnfl-rules-schedule-header">Week 13 — First Round Playoffs</p>

    <ol class="subnum">
        <li class="subtext">Third rule item in topic (Renders "3.")</li>
        <li class="subtext">Fourth rule item in topic (Renders "4.")</li>
    </ol>
</div>
```

---

## 5. Rules Table System & Column Alignments

Bylaws tables use `.dnfl-table .dnfl-rules-table` for clean sub-header styling inside accordions.

### 5.1 Nested Header Styling & Caption Padding
* **Header Cells (`th`)**: Soft slate background (`var(--dnfl-bg-subhead, #f1f5f9)`), Duke Blue bottom accent border (`2px solid #0577B1`), uppercase `0.8rem` bold text, and `8px 12px` padding.
* **Table Captions (`caption`)**: Uppercase bold title text with Duke Blue bottom underline and `padding: 8px 12px` to prevent text from being clipped by container rounded corners (`border-radius`).

### 5.2 Column Alignment Rules
`modules/_rules.scss` automatically formats table columns based on table structure:

1. **3-Column Scoring Tables (Event, Range, Points)**:
   * Column 1 (Event/Action): Left-aligned
   * Column 2 (Range e.g., `0-299` yards): Center-aligned
   * Column 3 (Points/Details): Left-aligned
2. **4-Column Payout Tables (Prize, Payout $, Notes, Total $)**:
   * Column 1 (Prize Category): Left-aligned
   * Column 2 (Payout Amount): Right-aligned
   * Column 3 (Notes/Description): Left-aligned
   * Column 4 (Total Category Payout): Right-aligned

```scss
/* SCSS Column Alignment Rules */
.dnfl-rules-table {
  /* 3-Column Scoring Tables */
  th:nth-child(1), td:nth-child(1) { text-align: left !important; }
  th:nth-child(2), td:nth-child(2) { text-align: center !important; }
  th:nth-child(3), td:nth-child(3) { text-align: left !important; }

  /* 4-Column Payout Tables */
  &:has(th:nth-child(4)) {
    th:nth-child(1), td:nth-child(1) { text-align: left !important; }
    th:nth-child(2), td:nth-child(2) { text-align: right !important; }
    th:nth-child(3), td:nth-child(3) { text-align: left !important; }
    th:nth-child(4), td:nth-child(4) { text-align: right !important; }
  }
}
```

---

## 6. HTML Embed Shell Reference (`hpm-rules-embed.html`)

The HTML embed shell provides the toolbar controls and semantic container hierarchy:

```html
<!-- DNFL Official Bylaws & Rules Embed Shell -->
<div class="dnfl-card" id="dnfl-rules-container">
    <div class="dnfl-card-header">
        <h3 class="dnfl-card-title">
            <i class="fa-solid fa-gavel"></i> Official League Bylaws & Rules
        </h3>
    </div>

    <div class="dnfl-card-body">
        <!-- Global Toolbar Controls -->
        <div class="dnfl-toolbar">
            <div class="dnfl-buttons-right">
                <button id="dnfl-rules-expand-all" class="dnfl-btn dnfl-btn-secondary">
                    <i class="fa-solid fa-angles-down"></i> Expand All
                </button>
                <button id="dnfl-rules-collapse-all" class="dnfl-btn dnfl-btn-secondary">
                    <i class="fa-solid fa-angles-up"></i> Collapse All
                </button>
                <button id="dnfl-rules-toggle-submenus" class="dnfl-btn dnfl-btn-primary">
                    <i class="fa-solid fa-list-check"></i> Toggle Submenus
                </button>
            </div>
        </div>

        <!-- Accordion Container Hierarchy -->
        <div class="dnfl-rules-accordion-wrapper">
            <!-- Level 1 Main Section -->
            <div class="dnfl-rules-tabhead is-collapsed">
                <span><i class="fa-solid fa-chevron-right"></i> 1. LEAGUE STRUCTURE</span>
                <span class="dnfl-badge dnfl-badge-blue">Core Bylaws</span>
            </div>
            <div class="dnfl-rules-main-content is-collapsed">
                <!-- Level 2 Subsection -->
                <div class="dnfl-rules-subhead is-collapsed">
                    <i class="fa-solid fa-caret-right"></i> 1.1 Divisions & Conferences
                </div>
                <div class="dnfl-rules-sub-content is-collapsed">
                    <!-- Level 3 Topic -->
                    <div class="dnfl-rules-topichead is-collapsed">
                        <i class="fa-solid fa-angle-right"></i> Division Alignment
                    </div>
                    <div class="dnfl-rules-topic-content is-collapsed">
                        <ol class="subnum">
                            <li class="subtext">Rule description details here.</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

---

## 7. Public API Reference & Developer Integration

The engine exports public controls on `window.DNFL.Rules`:

### Public Methods

#### `DNFL.Rules.init()`
Initializes DOM retry discovery, binds event listeners to headers and toolbar buttons, and resolves initial state.

#### `DNFL.Rules.expandAll()`
Expands all Level 1, Level 2, and Level 3 accordion containers across the entire rulebook and updates icons to expanded state (`fa-chevron-down`, `fa-caret-down`, `fa-angle-down`).

#### `DNFL.Rules.collapseAll()`
Collapses all Level 1, Level 2, and Level 3 accordion containers across the entire rulebook and resets icons to collapsed state (`fa-chevron-right`, `fa-caret-right`, `fa-angle-right`).

#### `DNFL.Rules.toggleSubmenus()`
Toggles the expansion state of all Level 2 subsections and Level 3 topics simultaneously without collapsing Level 1 section headers.

#### `DNFL.Rules.toggleAccordion(headerElement)`
Programmatically toggles a specific header element (`.dnfl-rules-tabhead`, `.dnfl-rules-subhead`, or `.dnfl-rules-topichead`) and its corresponding sibling content container.

---

## 8. Maintenance Checklist & Best Practices

1. **Adding New Rules**: Place rule items inside `<ol class="subnum"><li class="subtext">...</li></ol>`. Do NOT assign hardcoded number prefixes or `start="N"` attributes; CSS Counters handle numbering automatically.
2. **Adding Schedule Breaks**: Wrap schedule headers in `<p class="dnfl-rules-schedule-header">Header Title</p>`. Never place schedule headers inside `<ol>` or `<li>` tags.
3. **Updating Tables**: Wrap rules tables in `<table class="dnfl-table dnfl-rules-table">`. Ensure captions use `<caption><span>TABLE TITLE</span></caption>` for Duke Blue underline styling.
4. **FontAwesome 6 Standardization**: Always use `fa-solid` icon classes for accordion toggles and card headers.
