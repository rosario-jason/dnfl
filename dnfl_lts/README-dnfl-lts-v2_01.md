# DNFL Last Team Standing (LTS) Module (v2_01) Developer Guide

## Overview
The Last Team Standing (LTS) module tracks a weekly survival elimination competition across Duke Networking Fantasy League (DNFL) conferences. It renders a responsive two-part layout:
1. **Table 1: Weekly Scores** (`.dnfl-lts-scores-table`): Full regular season scoring matrix displaying high score stars, knockout skulls, post-elimination scores, and the LTS Champion.
2. **Table 2: Weekly Summary** (`.dnfl-lts-summary-table`): Chronological survival and high scorer log across completed weeks.

---

## File Deliverables
- **Logic Engine**: `scripts/dnfl-lts-v2_01.js`
- **Embed Shell**: `dnfl_lts/hpm-lts-embed-v2_01.txt`
- **SCSS Partial**: `css/scss/_lts.scss`
- **Rules Configuration**: `dnfl_lts/2026/lts_rules.json`

---

## Key Framework Integration Highlights
1. **Container Alignment**: Embed shell uses `<div class="dnfl-card" id="dnfl-lts-container">` with Level 1 Header (`<h3>`), Level 2 Body, and Level 3 Toolbar & Sections.
2. **Legend Panel Placement**: The dynamic legend panel (`#dnfl-lts-legend`) is positioned directly below the controls toolbar (`.dnfl-toolbar`) and above the table section wrappers.
3. **Declarative Toolbar Actions**: Toggles specify `type="button"` and declarative `onclick` handlers (`DNFL.LTS.toggleScores()` and `DNFL.LTS.toggleSummary()`). Zero programmatic `addEventListener` click bindings in JS.
4. **Parallel Multi-Week API Engine**: Route 100% of data traffic through `DNFL.Client.fetchData()`, dynamically resolving `endWeek` (`league.lastRegularSeasonWeek`) and executing parallel requests for `weeklyResults` (W1..`endWeek`) via `Promise.all(...)`.
5. **Class-Based Visibility**: Section toggling uses direct `document.getElementById('id')` queries toggling `.dnfl-is-hidden`.
6. **In-Table Sticky Headers**: Section titles and division sub-headers use `<td class="dnfl-sticky-col">` (`position: sticky; left: 0; z-index: 10;`) to remain pinned left during horizontal scrolling.
