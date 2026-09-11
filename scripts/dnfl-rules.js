/* ==========================================================================
   DNFL Official Rules Module Script v1.1
   Features: Dynamic Year Fetching, Markdown Parsing, PDF Rule Numbering,
             Collapsible Accordions, and Live MFL Scoring API Integration.
   ========================================================================== */

let activeRulesYear = '';
let currentRulesMarkdown = '';
let isSubheadsVisible = false;

/**
 * Main Entry Point - Called by HPM Embed
 */
async function initRulesDashboard(mflYear) {
    // 1. Resolve active year context
    let targetYear = mflYear && mflYear !== '%YEAR%' ? mflYear : (window.current_year || null);
    if (!targetYear) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear().toString();
    }
    activeRulesYear = targetYear.toString();

    // 2. Populate Season Dropdown
    setupRulesYearDropdown();

    // 3. Load Rulebook and MFL Scoring Rules
    await loadRulebookData(activeRulesYear);
}

/**
 * Populate Season Selector Dropdown
 */
function setupRulesYearDropdown() {
    const selector = document.getElementById('dnfl_rulesYearSelector');
    if (!selector) return;

    selector.innerHTML = '';
    const currentYear = new Date().getFullYear();
    const availableYears = [];

    // Generate years from 2026 up to current season
    for (let yr = 2026; yr <= Math.max(currentYear, 2026); yr++) {
        availableYears.push(yr.toString());
    }

    availableYears.forEach(yr => {
        const opt = document.createElement('option');
        opt.value = yr;
        opt.textContent = `${yr} Rules`;
        if (yr === activeRulesYear) opt.selected = true;
        selector.appendChild(opt);
    });
}

/**
 * Change Rules Year via Selector
 */
function changeRulesYear() {
    const selector = document.getElementById('dnfl_rulesYearSelector');
    if (!selector) return;
    activeRulesYear = selector.value;
    loadRulebookData(activeRulesYear);
}

/**
 * Fetches Markdown File & MFL Scoring Rules, then Parses DOM
 */
async function loadRulebookData(year) {
    const container = document.getElementById('dnfl_rulesOutputContainer');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #555;">
            <i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Loading ${year} Rulebook & Live Scoring Rules...
        </div>`;

    try {
        // Parallel fetch: Markdown rulebook file & MFL Live Scoring Rules
        const [markdownText, mflRulesData] = await Promise.all([
            fetchMarkdownRulebook(year),
            DNFLClient ? DNFLClient.fetchData("rules") : null
        ]);

        currentRulesMarkdown = markdownText;

        // Render Markdown into Structured Accordion DOM
        renderRulebookDOM(markdownText, mflRulesData);

    } catch (error) {
        console.error("DNFL Rules Module Error:", error);
        container.innerHTML = `
            <div style="text-align: center; color: #ef4444; padding: 2rem;">
                ⚠️ Failed to load rulebook for ${year}. Please try again later.
            </div>`;
    }
}

/**
 * Fetch Rulebook Markdown File from GitHub/Domain
 */
async function fetchMarkdownRulebook(year) {
    const primaryUrl = `https://dnfl.live/dnfl_rules/dnfl-rules-${year}.md`;
    const fallbackUrl = `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_rules/dnfl-rules-${year}.md`;

    try {
        let response = await fetch(primaryUrl);
        if (!response.ok) response = await fetch(fallbackUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} - Markdown rulebook missing`);
        return await response.text();
    } catch (err) {
        console.warn(`Rules file for ${year} not found on server. Loading fallback template.`);
        return `# I. GENERAL\n## A) Welcome\n### A1. Overview\n1. Welcome to the DNFL ${year} Rules.`;
    }
}

/**
 * Render HTML Accordions & Inject Live MFL Scoring
 */
function renderRulebookDOM(markdownText, mflRulesData) {
    const container = document.getElementById('dnfl_rulesOutputContainer');
    if (!container) return;

    // Inject live MFL scoring tables into placeholder {{MFL_SCORING_TABLES}}
    let mflScoringHtml = generateMflScoringTablesHtml(mflRulesData);
    let processedMarkdown = markdownText;

    if (processedMarkdown.includes('{{MFL_SCORING_TABLES}}')) {
        processedMarkdown = processedMarkdown.replace('{{MFL_SCORING_TABLES}}', mflScoringHtml);
    }

    // Split Markdown into Sections by `# Level 1` (Main Sections like I. GENERAL)
    const rawSections = processedMarkdown.split(/^# /m).filter(sec => sec.trim().length > 0);

    let htmlOutput = '';

    rawSections.forEach((secStr, secIndex) => {
        const lines = secStr.trim().split('\n');
        const mainTitle = lines[0].trim(); // E.g., "I. GENERAL"
        const sectionBodyMarkdown = lines.slice(1).join('\n');

        // Parse subsections (`## A) Title`)
        const subSections = sectionBodyMarkdown.split(/^## /m).filter(sub => sub.trim().length > 0);

        htmlOutput += `
            <div class="dnfl-rules-section" data-section-idx="${secIndex}">
                <div class="dnfl-rules-tabhead" onclick="toggleSection(${secIndex})">
                    <span><i class="fas fa-chevron-right dnfl-rules-icon"></i> ${mainTitle}</span>
                    <span class="dnfl-rules-badge">Section ${secIndex + 1}</span>
                </div>
                <div id="dnfl-rules-sec-body-${secIndex}" class="dnfl-rules-main-content" style="display: none;">`;

        if (subSections.length === 0 || !subSections[0].includes('\n')) {
            htmlOutput += `<div class="dnfl-rules-block">${marked.parse(sectionBodyMarkdown)}</div>`;
        } else {
            subSections.forEach((subStr, subIndex) => {
                const subLines = subStr.trim().split('\n');
                const subTitle = subLines[0].trim(); // E.g., "A) Welcome"
                const subBodyMarkdown = subLines.slice(1).join('\n');

                htmlOutput += `
                    <div class="dnfl-rules-subsection">
                        <div class="dnfl-rules-subhead" onclick="toggleSubSection(${secIndex}, ${subIndex})">
                            <span><i class="fas fa-caret-right dnfl-sub-icon"></i> ${subTitle}</span>
                        </div>
                        <div id="dnfl-rules-sub-body-${secIndex}-${subIndex}" class="dnfl-rules-sub-content" style="display: none;">
                            ${marked.parse(subBodyMarkdown)}
                        </div>
                    </div>`;
            });
        }

        htmlOutput += `
                </div>
            </div>`;
    });

    container.innerHTML = htmlOutput;
    formatParsedRuleElements();
}

/**
 * Generate Live MFL Scoring Tables HTML directly from API
 */
function generateMflScoringTablesHtml(mflRulesData) {
    if (!mflRulesData || !mflRulesData.rules || !mflRulesData.rules.scoringRules) {
        return `<p style="font-style: italic; color: #777;">*Live scoring table loaded directly from MFL API when available.*</p>`;
    }

    const rulesList = mflRulesData.rules.scoringRules.rule;
    if (!rulesList || !Array.isArray(rulesList)) return '';

    let offenseRules = [];
    let defenseRules = [];

    rulesList.forEach(r => {
        const eventStr = r.event || r.description || '';
        const pointsStr = r.points || '';
        const rangeStr = `${r.range || 'All'}`;

        if (eventStr.toLowerCase().includes('def') || eventStr.toLowerCase().includes('tackle') || eventStr.toLowerCase().includes('sack') || eventStr.toLowerCase().includes('interception caught')) {
            defenseRules.push({ event: eventStr, range: rangeStr, points: pointsStr });
        } else {
            offenseRules.push({ event: eventStr, range: rangeStr, points: pointsStr });
        }
    });

    const buildTable = (title, items) => `
        <p><strong>${title} (Live MFL API Sync)</strong></p>
        <div class="mobile-wrap">
            <table class="homepagemodule report dnfl-rules-table">
                <thead>
                    <tr>
                        <th style="text-align: left;">Event</th>
                        <th style="text-align: center;">Range (Low-High)</th>
                        <th style="text-align: right;">Points</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, idx) => `
                        <tr class="${idx % 2 === 0 ? 'oddtablerow' : 'eventablerow'}">
                            <td style="text-align: left;">${item.event}</td>
                            <td style="text-align: center;">${item.range}</td>
                            <td style="text-align: right;">${item.points}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;

    return buildTable("Rules for QB, RB, WR, TE, PK", offenseRules) + buildTable("Rules for DEF", defenseRules);
}

/**
 * DOM Formatting Helper
 */
function formatParsedRuleElements() {
    document.querySelectorAll('#dnfl_rulesOutputContainer table').forEach(tbl => {
        if (!tbl.classList.contains('dnfl-rules-table')) {
            tbl.classList.add('homepagemodule', 'report', 'dnfl-rules-table');
        }
        if (!tbl.parentElement.classList.contains('mobile-wrap')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'mobile-wrap';
            tbl.parentNode.insertBefore(wrapper, tbl);
            wrapper.appendChild(tbl);
        }
    });
}

/**
 * Toggle Level 1 Accordion Section
 */
function toggleSection(secIdx) {
    const body = document.getElementById(`dnfl-rules-sec-body-${secIdx}`);
    if (!body) return;
    const icon = body.previousElementSibling.querySelector('.dnfl-rules-icon');

    if (body.style.display === 'none') {
        body.style.display = 'block';
        if (icon) icon.className = 'fas fa-chevron-down dnfl-rules-icon';
    } else {
        body.style.display = 'none';
        if (icon) icon.className = 'fas fa-chevron-right dnfl-rules-icon';
    }
}

/**
 * Toggle Level 2 Accordion Subsection
 */
function toggleSubSection(secIdx, subIdx) {
    const body = document.getElementById(`dnfl-rules-sub-body-${secIdx}-${subIdx}`);
    if (!body) return;
    const icon = body.previousElementSibling.querySelector('.dnfl-sub-icon');

    if (body.style.display === 'none') {
        body.style.display = 'block';
        if (icon) icon.className = 'fas fa-caret-down dnfl-sub-icon';
    } else {
        body.style.display = 'none';
        if (icon) icon.className = 'fas fa-caret-right dnfl-sub-icon';
    }
}

/**
 * Global Action: Toggle Subhead Visibility
 */
function toggleSubheadMenus() {
    isSubheadsVisible = !isSubheadsVisible;
    document.querySelectorAll('.dnfl-rules-main-content').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.dnfl-rules-sub-content').forEach(el => el.style.display = isSubheadsVisible ? 'block' : 'none');
    document.querySelectorAll('.dnfl-rules-icon').forEach(icon => icon.className = 'fas fa-chevron-down dnfl-rules-icon');
}

/**
 * Global Action: Expand All
 */
function expandAllRules() {
    document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.dnfl-rules-icon').forEach(icon => icon.className = 'fas fa-chevron-down dnfl-rules-icon');
    document.querySelectorAll('.dnfl-sub-icon').forEach(icon => icon.className = 'fas fa-caret-down dnfl-sub-icon');
}

/**
 * Global Action: Collapse All
 */
function collapseAllRules() {
    document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.dnfl-rules-icon').forEach(icon => icon.className = 'fas fa-chevron-right dnfl-rules-icon');
    document.querySelectorAll('.dnfl-sub-icon').forEach(icon => icon.className = 'fas fa-caret-right dnfl-sub-icon');
}