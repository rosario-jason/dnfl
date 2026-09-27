# Duke Networking Fantasy League (DNFL) - Last Team Standing (LTS) Module Guide (v2)

## 1. Executive Summary & Core Principles

The **Last Team Standing (LTS) Module (`dnfl-lts-v2.js`)** tracks weekly survival eliminations and weekly high score prize achievements across DNFL conferences.

Key responsibilities include:
* Ingesting weekly score streams via `DNFL.Client.fetchData('weeklyResults')`.
* Executing the **Weekly Elimination Algorithm**, identifying the lowest active scorer each week starting at `startWeek`.
* Applying the **Official Rulebook Low-Score Tiebreaker**: resolving low-score ties by eliminating the team with the **fewest cumulative year-to-date (YTD) points** through that week.
* Supporting a **3-Tier Cascading Rules Resolution Engine**: automatically discovering conferences via the MFL `league` API, applying built-in engine defaults (`lts_isEnabled: true`, `highScore_isEnabled: true`, `startWeek: "auto"`), and merging sparse exception overrides from `lts_rules-v2.json`.
* Rendering two complementary views:
  * **View A (Survival Cross-Grid Matrix)**: Full matrix of team scores across completed weeks, with sticky left franchise column, active vs. eliminated team grouping (`LTS Eliminated Teams` divider), dimmed post-elimination score styling (`.dnfl-text-muted` 💀), and Weekly High Score prize pill overrides (`.dnfl-pill-green` ⭐).
  * **View B (Weekly Summary Table)**: Chronological list of weekly knockouts and high score winners.

---

## 2. Directory Layout & Repository Placement

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
│
├── css/
│   ├── dnfl-global.css                 # Master compiled stylesheet
│   └── scss/
│       └── _lts.scss                   # LTS partial (sticky columns & muted rows)
│
├── scripts/
│   └── dnfl-lts-v2.js                  # LTS logic engine (v2)
│
└── dnfl_lts/
    ├── hpm-lts-embed-v2.txt            # MFL HTML Embed Shell stub (v2)
    ├── README-dnfl-lts-v2.md           # Developer & Architecture Guide (v2)
    └── 2026/
        └── lts_rules-v2.json           # Sparse Exception Overrides JSON (v2)
```

---

## 3. Rules Configuration Engine (3-Tier Cascading Resolution)

Conferences are discovered dynamically via the MFL API. `lts_rules-v2.json` is fetched from `dnfl_lts/{YEAR}/lts_rules.json` (24-hour TTL) with a graceful `try/catch` fallback.

```text
[Page Load: dnfl-lts-v2.js]
       │
       ▼
[Tier 1: JS Engine Defaults] ──► { lts_isEnabled: true, highScore_isEnabled: true, startWeek: 'auto' }
       │
       ▼
[Tier 2: API Conference Discovery] ──► Query 'league' API for active conference IDs
       │
       ▼
[Tier 3: Sparse Exception JSON] ──► Merge top-level or per-conference exceptions from lts_rules-v2.json
```

### Sample Exceptions JSON (`lts_rules-v2.json`)
```json
{
  "season": 2026,
  "exceptions": {
    "01": {
      "highScore_isEnabled": false
    }
  }
}
```

---

## 4. Low-Score Tiebreaker Logic (Official Rulebook)

1. **Evaluation Window**: Begins at `startWeek` (`regularSeasonEndWeek - (activeTeamsInConference - 1)` if set to `"auto"`).
2. **Lowest Weekly Scorer**: Scans active teams for the lowest score in a completed week.
3. **Tiebreaker Algorithm**: If two or more remaining LTS-eligible teams tie for the lowest weekly score:
   * The module calculates the cumulative Year-To-Date (YTD) points for each tied team from Week 1 through Week `w`.
   * The team with the **fewest cumulative YTD points** is eliminated.

---

## 5. UI Architecture & Sticky Column Specifications

* **Wrapped Container**: Table is wrapped in `<div class="dnfl-table-wrapper">` for mobile touch scrolling.
* **Sticky Franchise Column**: The left Franchise column uses `position: sticky; left: 0; z-index: 10` so team names stay pinned.
* **Post-Elimination High Score Override**: Eliminated teams' cells display dimmed scores (`.dnfl-text-muted` 💀) unless they win the Weekly High Score prize, in which case they display the bright **High Score Green Star Pill (`.dnfl-pill-green` ⭐)**.

---

## 6. Public API Specifications

Exposed under global namespace `window.DNFL.LTS`:
* `DNFL.LTS.init()`: Primary initialization routine.
* `DNFL.LTS.updateView()`: Re-renders UI on conference filter change.
* `DNFL.LTS.toggleGrid()`: Toggles visibility of the Cross-Grid Matrix.
* `DNFL.LTS.toggleSummary()`: Toggles visibility of the Weekly Summary Table.
