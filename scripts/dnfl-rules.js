/* ==========================================================================
   DNFL Official Rules Module Script v1.06
   Features: Deterministic Control Buttons (Show Sub Menus, Expand All, Collapse All),
             3-Level Accordions (#, ##, ###), PDF Numbering, Table Sync.
   ========================================================================== */
(function() {
    let activeRulesYear = '';
    let currentRulesMarkdown = '';

    let clientRetryCount = 0;
    const maxClientRetries = 30;

    /**
     * Main Entry Point
     */
    async function initRulesDashboard(mflYear) {
        let targetYear = mflYear && mflYear !== '%YEAR%' ? mflYear : (window.current_year || null);
        if (!targetYear) {
            const pathSegments = window.location.pathname.split('/');
            const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
            targetYear = foundYear ? foundYear : new Date().getFullYear().toString();
        }
        activeRulesYear = targetYear.toString();

        setupRulesYearDropdown();
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
     * Safely Fetch Data using DNFLClient if available
     */
    async function safeFetchMFLRules() {
        if (typeof window.DNFLClient !== 'undefined' && window.DNFLClient.fetchData) {
            return await window.DNFLClient.fetchData("rules");
        }
        return null;
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

        if (typeof window.DNFLClient === 'undefined' && clientRetryCount < maxClientRetries) {
            clientRetryCount++;
            setTimeout(() => loadRulebookData(year), 100);
            return;
        }

        try {
            const [markdownText, mflRulesData] = await Promise.all([
                fetchMarkdownRulebook(year),
                safeFetchMFLRules()
            ]);

            currentRulesMarkdown = markdownText;
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
     * Render HTML Accordions (3 Levels: #, ##, ###) & Inject Live MFL Scoring
     */
    function renderRulebookDOM(markdownText, mflRulesData) {
        const container = document.getElementById('dnfl_rulesOutputContainer');
        if (!container) return;

        let mflScoringHtml = generateMflScoringTablesHtml(mflRulesData);
        let processedMarkdown = markdownText;

        if (processedMarkdown.includes('{{MFL_SCORING_TABLES}}')) {
            processedMarkdown = processedMarkdown.replace('{{MFL_SCORING_TABLES}}', mflScoringHtml);
        }

        const rawSections = processedMarkdown.split(/^# /m).filter(sec => sec.trim().length > 0);

        let htmlOutput = '';

        rawSections.forEach((secStr, secIndex) => {
            const lines = secStr.trim().split('\n');
            const mainTitle = lines[0].trim();
            const sectionBodyMarkdown = lines.slice(1).join('\n');

            const subSections = sectionBodyMarkdown.split(/^## /m).filter(sub => sub.trim().length > 0);

            htmlOutput += `
                <div class="dnfl-rules-section" data-section-idx="${secIndex}">
                    <div class="dnfl-rules-tabhead" onclick="window.toggleSection(${secIndex})">
                        <span><i class="fas fa-chevron-right dnfl-rules-icon"></i> ${mainTitle}</span>
                        <span class="dnfl-rules-badge">Section ${secIndex + 1}</span>
                    </div>
                    <div id="dnfl-rules-sec-body-${secIndex}" class="dnfl-rules-main-content" style="display: none;">`;

            if (subSections.length === 0) {
                const parsedContent = window.marked ? window.marked.parse(sectionBodyMarkdown) : sectionBodyMarkdown;
                htmlOutput += `<div class="dnfl-rules-block">${parsedContent}</div>`;
            } else {
                subSections.forEach((subStr, subIndex) => {
                    const subLines = subStr.trim().split('\n');
                    const subTitle = subLines[0].trim();
                    const subBodyMarkdown = subLines.slice(1).join('\n');

                    const rawTopics = subBodyMarkdown.split(/^### /m);

                    htmlOutput += `
                        <div class="dnfl-rules-subsection">
                            <div class="dnfl-rules-subhead" onclick="window.toggleSubSection(${secIndex}, ${subIndex})">
                                <span><i class="fas fa-caret-right dnfl-sub-icon"></i> ${subTitle}</span>
                            </div>
                            <div id="dnfl-rules-sub-body-${secIndex}-${subIndex}" class="dnfl-rules-sub-content" style="display: none;">`;

                    if (rawTopics.length <= 1) {
                        const parsedSubContent = window.marked ? window.marked.parse(subBodyMarkdown) : subBodyMarkdown;
                        htmlOutput += parsedSubContent;
                    } else {
                        if (rawTopics[0].trim().length > 0) {
                            htmlOutput += window.marked ? window.marked.parse(rawTopics[0]) : rawTopics[0];
                        }

                        rawTopics.slice(1).forEach((topicStr, topicIndex) => {
                            const topicLines = topicStr.trim().split('\n');
                            const topicTitle = topicLines[0].trim();
                            const topicBodyMarkdown = topicLines.slice(1).join('\n');
                            const parsedTopicContent = window.marked ? window.marked.parse(topicBodyMarkdown) : topicBodyMarkdown;

                            htmlOutput += `
                                <div class="dnfl-rules-topicsection">
                                    <div class="dnfl-rules-topichead" onclick="window.toggleTopic(${secIndex}, ${subIndex}, ${topicIndex})">
                                        <span><i class="fas fa-angle-right dnfl-topic-icon"></i> ${topicTitle}</span>
                                    </div>
                                    <div id="dnfl-rules-topic-body-${secIndex}-${subIndex}-${topicIndex}" class="dnfl-rules-topic-content" style="display: none;">
                                        ${parsedTopicContent}
                                    </div>
                                </div>`;
                        });
                    }

                    htmlOutput += `
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

        const rawRules = mflRulesData.rules.scoringRules.rule;
        if (!rawRules) return '';
        const rulesList = Array.isArray(rawRules) ? rawRules : [rawRules];

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
     * DOM Post-Processing & Alignment Synchronization
     */
    function formatParsedRuleElements() {
        document.querySelectorAll('#dnfl_rulesOutputContainer table').forEach(tbl => {
            tbl.classList.add('homepagemodule', 'report', 'dnfl-rules-table');

            const rows = tbl.querySelectorAll('tr');
            if (rows.length > 0) {
                const headerCells = tbl.querySelectorAll('th');
                const firstDataRow = tbl.querySelector('tbody tr') || rows[1];
                if (firstDataRow) {
                    const dataCells = firstDataRow.querySelectorAll('td');
                    headerCells.forEach((th, colIdx) => {
                        if (dataCells[colIdx]) {
                            const tdAlign = dataCells[colIdx].style.textAlign || getComputedStyle(dataCells[colIdx]).textAlign;
                            if (tdAlign) {
                                th.style.textAlign = tdAlign;
                            }
                        }
                    });
                }
            }

            if (!tbl.parentElement.classList.contains('mobile-wrap')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'mobile-wrap';
                tbl.parentNode.insertBefore(wrapper, tbl);
                wrapper.appendChild(tbl);
            }
        });

        document.querySelectorAll('#dnfl_rulesOutputContainer h1, #dnfl_rulesOutputContainer h2, #dnfl_rulesOutputContainer h3, #dnfl_rulesOutputContainer h4').forEach(h => {
            h.style.textAlign = 'left';
        });
    }

    /**
     * Toggle Level 1 Accordion Section (#)
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
     * Toggle Level 2 Accordion Subsection (##)
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
     * Toggle Level 3 Accordion Topic (###)
     */
    function toggleTopic(secIdx, subIdx, topicIdx) {
        const body = document.getElementById(`dnfl-rules-topic-body-${secIdx}-${subIdx}-${topicIdx}`);
        if (!body) return;
        const icon = body.previousElementSibling.querySelector('.dnfl-topic-icon');

        if (body.style.display === 'none') {
            body.style.display = 'block';
            if (icon) icon.className = 'fas fa-angle-down dnfl-topic-icon';
        } else {
            body.style.display = 'none';
            if (icon) icon.className = 'fas fa-angle-right dnfl-topic-icon';
        }
    }

    /**
     * Action: Show Sub Menus
     * Opens Section (#) and Subsection (##) headers, but collapses Topic (###) contents.
     */
    function showSubMenus() {
        document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.dnfl-rules-topic-content').forEach(el => el.style.display = 'none');
        
        document.querySelectorAll('.dnfl-rules-icon').forEach(icon => icon.className = 'fas fa-chevron-down dnfl-rules-icon');
        document.querySelectorAll('.dnfl-sub-icon').forEach(icon => icon.className = 'fas fa-caret-down dnfl-sub-icon');
        document.querySelectorAll('.dnfl-topic-icon').forEach(icon => icon.className = 'fas fa-angle-right dnfl-topic-icon');
    }

    /**
     * Action: Expand All (Levels 1, 2, 3)
     */
    function expandAllRules() {
        document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content, .dnfl-rules-topic-content').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.dnfl-rules-icon').forEach(icon => icon.className = 'fas fa-chevron-down dnfl-rules-icon');
        document.querySelectorAll('.dnfl-sub-icon').forEach(icon => icon.className = 'fas fa-caret-down dnfl-sub-icon');
        document.querySelectorAll('.dnfl-topic-icon').forEach(icon => icon.className = 'fas fa-angle-down dnfl-topic-icon');
    }

    /**
     * Action: Collapse All (Collapses down to Level 1 # tabheads only)
     */
    function collapseAllRules() {
        document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content, .dnfl-rules-topic-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.dnfl-rules-icon').forEach(icon => icon.className = 'fas fa-chevron-right dnfl-rules-icon');
        document.querySelectorAll('.dnfl-sub-icon').forEach(icon => icon.className = 'fas fa-caret-right dnfl-sub-icon');
        document.querySelectorAll('.dnfl-topic-icon').forEach(icon => icon.className = 'fas fa-angle-right dnfl-topic-icon');
    }

    // Bind public methods to window object
    window.initRulesDashboard = initRulesDashboard;
    window.changeRulesYear = changeRulesYear;
    window.toggleSection = toggleSection;
    window.toggleSubSection = toggleSubSection;
    window.toggleTopic = toggleTopic;
    window.showSubMenus = showSubMenus;
    window.toggleSubheadMenus = showSubMenus; // Backward-compatibility alias
    window.expandAllRules = expandAllRules;
    window.collapseAllRules = collapseAllRules;
})();