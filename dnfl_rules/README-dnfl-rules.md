# DNFL Official Rules Module (`dnfl_rules/`)

The **DNFL Official Rules Module** delivers an interactive, 3-level accordion engine for navigating the Duke Networking Fantasy League official bylaws. It features computed-style visibility detection, CSS-driven default collapsed states, toolbar navigation controls, and semantic schedule header styling.

---

## 📁 Repository Directory Location

In accordance with the `rosario-jason/dnfl` GitHub repository structure:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
├── ./scripts/
│   └── dnfl-rules-v4.js                # Interactive multi-level accordion logic engine
└── ./dnfl_rules/
    └── hpm-rules-embed-v3.html         # Live Remote HPM HTML embed stub (or hpm-dnfl-rules-v4.txt)
```

---

## ⚙️ Logic Engine Architecture (`dnfl-rules-v4.js`)

The Official Rules Module operates within the global `window.DNFL.Rules` namespace.

### Core Pipeline & Initialization Flow
1. **Computed Style Inspection**: Uses `window.getComputedStyle(content).display === 'none'` to reliably inspect collapsed/expanded element states even when default visibility is controlled by external CSS stylesheets rather than inline attributes.
2. **Icon State Synchronization**: Dynamic chevron icon class updating (`fa-chevron-*` for Level 1, `fa-caret-*` for Level 2, `fa-angle-*` for Level 3).
3. **Global Toolbar Action Methods**:
   * `DNFL.Rules.toggleElement(headerEl)`: Toggles individual section, subsection, or topic header.
   * `DNFL.Rules.showSubMenus()`: Opens Level 1 sections and Level 2 subsections while keeping Level 3 detailed topics collapsed.
   * `DNFL.Rules.expandAll()`: Fully expands all 3 accordion levels across the entire rulebook.
   * `DNFL.Rules.collapseAll()`: Fully collapses all 3 accordion levels.

### Accordion Class & Element Hierarchy

| Level | Header Class | Content Container | Icon Class |
| :--- | :--- | :--- | :--- |
| **Level 1 (Section)** | `.dnfl-rules-tabhead` | `.dnfl-rules-main-content` | `.dnfl-rules-icon` (`fa-chevron-right` / `down`) |
| **Level 2 (Subsection)** | `.dnfl-rules-subhead` | `.dnfl-rules-sub-content` | `.dnfl-sub-icon` (`fa-caret-right` / `down`) |
| **Level 3 (Topic)** | `.dnfl-rules-topichead` | `.dnfl-rules-topic-content` | `.dnfl-topic-icon` (`fa-angle-right` / `down`) |

---

## 📑 Rulebook Structure & Content Overview

The rulebook HTML shell (`hpm-rules-embed-v3.html` / `hpm-dnfl-rules-v4.txt`) contains the complete governance documentation structured across 8 core sections:

1. **Section I: General Operating Principles**: Mission statement, commissioner duties, league constitution.
2. **Section II: Accounting & Finances**: Dues structure, payout allocations, BBID budget rules.
3. **Section III: League Organization & Structure**: Conference & division alignments, team roster limits, calendar schedule.
4. **Section IV: Scoring Rules & Parameters**: Offensive & defensive scoring settings, tie-breaker policies.
5. **Section V: Transactions & Roster Management**: Free agency waivers, trade deadlines, IR eligibility.
6. **Section VI: Championships & Postseason**: Playoff qualification, bracket structures, postseason schedules.
7. **Section VII: Keeper Rules & Dynasty Governance**: Contract lengths, keeper inflation, draft capital.
8. **Section VIII: Relegation & Future Tier Structure**: Multi-tier league ascension, promotion/relegation rules.

### Sub-Header Utility Class
Schedule headers and section subtitles use semantic utility styling:
```html
<p class="dnfl-rules-schedule-header">Week 13 — First Round</p>
```

---

## 🎨 HTML Embed Shell (`hpm-rules-embed-v3.html`)

The HTML embed stub mounts the toolbar and nested accordion wrapper:

```html
<!-- DNFL RULES MODULE EMBED -->
<div class="dnfl-module-container">
    <div class="dnfl-controls">
        <div class="dnfl-rules-title">%YEAR% DNFL Official Rulebook</div>
        <div class="dnfl-actions-right">
            <button class="dnfl-visibility-toggle-btn" onclick="DNFL.Rules.showSubMenus()">Show Sub Menus</button>
            <button class="dnfl-visibility-toggle-btn" onclick="DNFL.Rules.expandAll()">Expand All</button>
            <button class="dnfl-visibility-toggle-btn" onclick="DNFL.Rules.collapseAll()">Collapse All</button>
        </div>
    </div>
    
    <div class="dnfl-rules-wrapper">
        <!-- SECTIONS I THROUGH VIII ACCORDION HTML -->
    </div>
</div>
```

---

## 🔄 Lifecycle Diagram

```text
[User Clicks Header]    ──► Trigger DNFL.Rules.toggleElement(this)
       │
       ▼
[Inspect Element State] ──► Read window.getComputedStyle(content).display
       │
       ▼
[Toggle Display State]  ──► Switch content style between 'block' and 'none'
       │
       ▼
[Update FontAwesome]    ──► Update icon class (fa-chevron / fa-caret / fa-angle)
```

---

## 🚀 Annual Rollover & Maintenance

1. **Rule Amendments**: Edit rule text or update sub-headers directly in `./dnfl_rules/hpm-rules-embed-v3.html`.
2. **No CSS Inline Styles Required**: Accordion content containers default to collapsed (`display: none`) via `dnfl-global-v2.css`.
3. **Cache Busting**: Increment `FRAMEWORK_VERSION` in `dnfl-header-script-v2.js` when modifying `dnfl-rules-v4.js`.