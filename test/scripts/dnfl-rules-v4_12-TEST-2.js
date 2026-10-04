/**
 * ============================================================================
 * DNFL OFFICIAL BYLAWS & RULES MODULE v4.2
 * ============================================================================
 * Dynamic Markdown Rulebook Engine for Duke Networking Fantasy League (DNFL)
 * Fetches unnumbered /dnfl_rules/{YEAR}/DNFL_Rulebook.md on page load,
 * parses Markdown, dynamically generates 3-tier accordion DOM with Roman/Letter/Topic
 * section codes, handles interactive state toggles, and provides PDF downloads.
 * ============================================================================
 */

(function () {
    'use strict';

    // Global Namespace Setup
    window.DNFL = window.DNFL || {};

    let isInitialized = false;
    let rulesMFLYear = 2026;
    let loadedMdText = null;

    /**
     * Roman Numeral Generator for Level 1 Sections (1 -> I, 2 -> II, etc.)
     */
    function toRoman(num) {
        const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
        let roman = '';
        for (let i in lookup) {
            while (num >= lookup[i]) {
                roman += i;
                num -= lookup[i];
            }
        }
        return roman || 'I';
    }

    /**
     * Letter Index Generator for Level 2 Subsections (1 -> A, 2 -> B, 27 -> AA, etc.)
     */
    function toLetter(num) {
        let letter = '';
        while (num > 0) {
            let rem = (num - 1) % 26;
            letter = String.fromCharCode(65 + rem) + letter;
            num = Math.floor((num - 1) / 26);
        }
        return letter || 'A';
    }

    /**
     * Resolve Active Season Year
     */
    function resolveSeasonYear() {
        if (window.DNFL && window.DNFL.leagueMetadata && window.DNFL.leagueMetadata.year) {
            return parseInt(window.DNFL.leagueMetadata.year, 10) || 2026;
        }
        if (typeof window !== 'undefined') {
            const rawYear = window.mflYear || window.current_year || window.year;
            if (rawYear) {
                const parsed = parseInt(rawYear, 10);
                if (!isNaN(parsed) && parsed > 2000) return parsed;
            }
        }
        return new Date().getFullYear() || 2026;
    }

    /**
     * API / Raw Text Fetch Helper
     */
    async function fetchRulebookMarkdown(year) {
        const urls = [
            `https://dnfl.live/dnfl_rules/${year}/DNFL_Rulebook.md`,
            `/dnfl_rules/${year}/DNFL_Rulebook.md`,
            `https://dnfl.live/dnfl_rules/2026/DNFL_Rulebook.md`,
            `/dnfl_rules/2026/DNFL_Rulebook.md`
        ];

        const client = (window.DNFL && typeof window.DNFL.getApiClient === 'function') ? window.DNFL.getApiClient() : null;

        for (const url of urls) {
            try {
                const fullUrl = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
                let text = null;
                if (client && typeof client.fetchRawText === 'function') {
                    text = await client.fetchRawText(fullUrl, {
                        ttl: client.TTL ? client.TTL.REALTIME : 30000,
                        forceRefresh: true
                    }).catch(() => null);
                }
                if (!text) {
                    const resp = await fetch(fullUrl);
                    if (resp.ok) text = await resp.text();
                }
                if (text && text.trim().length > 0) {
                    return text;
                }
            } catch (e) {
                // Try next candidate URL
            }
        }
        return null;
    }

    /**
     * Core Markdown -> 3-Tier Accordion HTML Compiler
     */
    function compileMarkdownToAccordionHtml(mdText) {
        if (!mdText) return '<div class="dnfl-status-error">Unable to load rulebook Markdown content.</div>';

        const lines = mdText.split(/\r?\n/);
        let secIdx = 0;
        let subIdx = 0;
        let topIdx = 0;
        let currentSubLetter = 'A';

        const htmlOut = [];

        let inSec = false;
        let inSub = false;
        let inTop = false;
        let inList = false;
        let inTable = false;
        let tableRows = [];
        let tableCaption = '';

        function closeList() {
            if (inList) {
                htmlOut.push('                    </ol>');
                inList = false;
            }
        }

        function closeTable() {
            if (inTable) {
                closeList();
                htmlOut.push('                    <div class="dnfl-table-wrapper">');
                htmlOut.push('                      <table class="dnfl-table dnfl-rules-table">');
                if (tableCaption) {
                    htmlOut.push(`                        <caption><span>${tableCaption}</span></caption>`);
                }
                if (tableRows.length > 0) {
                    htmlOut.push('                        <thead><tr>');
                    tableRows[0].forEach(h => {
                        htmlOut.push(`                            <th>${h.trim()}</th>`);
                    });
                    htmlOut.push('                          </tr></thead><tbody>');

                    for (let rIdx = 1; rIdx < tableRows.length; rIdx++) {
                        const rowCls = (rIdx % 2 === 1) ? 'dnfl-row-odd' : 'dnfl-row-even';
                        htmlOut.push(`                          <tr class="${rowCls}">`);
                        tableRows[rIdx].forEach(c => {
                            htmlOut.push(`                            <td>${c.trim()}</td>`);
                        });
                        htmlOut.push('                          </tr>');
                    }
                    htmlOut.push('                        </tbody>');
                }
                htmlOut.push('                      </table></div>');
                inTable = false;
                tableRows = [];
                tableCaption = '';
            }
        }

        function closeTop() {
            if (inTop) {
                closeList();
                closeTable();
                htmlOut.push('                  </div>'); // close dnfl-rules-topic-content
                htmlOut.push('                </div>'); // close dnfl-rules-topicsection
                inTop = false;
            }
        }

        function closeSub() {
            if (inSub) {
                closeTop();
                htmlOut.push('              </div>'); // close dnfl-rules-sub-content
                htmlOut.push('            </div>'); // close dnfl-rules-subsection
                inSub = false;
            }
        }

        function closeSec() {
            if (inSec) {
                closeSub();
                htmlOut.push('          </div>'); // close dnfl-rules-main-content
                htmlOut.push('        </div>'); // close dnfl-rules-section
                inSec = false;
            }
        }

        function formatInlineMarkdown(str) {
            if (!str) return '';
            let s = str;
            // Bold
            s = s.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            s = s.replace(/__(.*?)__/g, '<b>$1</b>');
            // Italics
            s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
            s = s.replace(/_(.*?)_/g, '<em>$1</em>');
            return s;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const sline = line.trim();

            if (!sline) {
                closeList();
                continue;
            }

            // Level 1 Section (# Heading)
            if (sline.startsWith('# ') && !sline.startsWith('## ')) {
                closeSec();
                secIdx++;
                subIdx = 0;
                topIdx = 0;
                const rawTitle = sline.substring(2).trim();
                const roman = toRoman(secIdx);
                inSec = true;

                htmlOut.push(`        <!-- SECTION ${roman}: ${rawTitle.toUpperCase()} -->`);
                htmlOut.push('        <div class="dnfl-rules-section">');
                htmlOut.push('          <div class="dnfl-rules-tabhead" onclick="DNFL.Rules.toggleElement(this)">');
                htmlOut.push(`            <span><i class="fa-solid fa-chevron-right dnfl-rules-icon"></i> ${roman}. ${rawTitle.toUpperCase()}</span>`);
                htmlOut.push(`            <span class="dnfl-rules-badge">Section ${secIdx}</span>`);
                htmlOut.push('          </div>');
                htmlOut.push('          <div class="dnfl-rules-main-content">');
                continue;
            }

            // Level 2 Subsection (## Heading)
            if (sline.startsWith('## ') && !sline.startsWith('### ')) {
                closeSub();
                subIdx++;
                topIdx = 0;
                const rawTitle = sline.substring(3).trim();
                currentSubLetter = toLetter(subIdx);
                inSub = true;

                htmlOut.push('            <div class="dnfl-rules-subsection">');
                htmlOut.push('              <div class="dnfl-rules-subhead" onclick="DNFL.Rules.toggleElement(this)">');
                htmlOut.push(`                <span><i class="fa-solid fa-caret-right dnfl-sub-icon"></i> ${currentSubLetter}) ${rawTitle}</span>`);
                htmlOut.push('              </div>');
                htmlOut.push('              <div class="dnfl-rules-sub-content">');
                continue;
            }

            // Level 3 Topic (### Heading)
            if (sline.startsWith('### ')) {
                closeTop();
                topIdx++;
                const rawTitle = sline.substring(4).trim();
                const topicCode = `${currentSubLetter}${topIdx}`;
                inTop = true;

                htmlOut.push('                <div class="dnfl-rules-topicsection">');
                htmlOut.push('                  <div class="dnfl-rules-topichead" onclick="DNFL.Rules.toggleElement(this)">');
                htmlOut.push(`                    <span><i class="fa-solid fa-angle-right dnfl-topic-icon"></i> ${topicCode}. ${rawTitle}</span>`);
                htmlOut.push('                  </div>');
                htmlOut.push('                  <div class="dnfl-rules-topic-content">');
                continue;
            }

            // Level 4 Sub-Header (#### Heading)
            if (sline.startsWith('#### ')) {
                closeList();
                closeTable();
                const rawTitle = sline.substring(5).trim();
                htmlOut.push(`                    <p class="dnfl-rules-schedule-header">${formatInlineMarkdown(rawTitle)}</p>`);
                continue;
            }

            // Table Caption Label: [Table: Caption]
            if (sline.startsWith('[Table:') && sline.endsWith(']')) {
                tableCaption = sline.substring(7, sline.length - 1).trim();
                continue;
            }

            // Table Grid Row
            if (sline.startsWith('|') && sline.endsWith('|')) {
                // Skip separator rows like |---|---|
                if (/^\|[\s:-|-]+\|$/.test(sline)) {
                    continue;
                }
                const cols = sline.split('|').slice(1, -1).map(c => c.trim());
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(cols);
                continue;
            } else if (inTable) {
                closeTable();
            }

            // Bullet List Items (- or * or numbered list)
            const listMatch = sline.match(/^(?:\d+\.|\-|\*)\s+(.*)$/);
            if (listMatch) {
                const itemText = listMatch[1].trim();
                if (!inList) {
                    inList = true;
                    htmlOut.push('                    <ol class="subnum">');
                }
                htmlOut.push(`                      <li class="subtext">${formatInlineMarkdown(itemText)}</li>`);
                continue;
            } else if (inList) {
                closeList();
            }

            // Regular Paragraph / Note Line
            if (sline) {
                htmlOut.push(`                    <p>${formatInlineMarkdown(sline)}</p>`);
            }
        }

        closeSec();

        return htmlOut.join('\n');
    }

    /**
     * Interactivity: Accordion Container Toggle
     */
    function toggleElement(triggerEl) {
        if (!triggerEl) return;
        const parentSection = triggerEl.closest('.dnfl-rules-section, .dnfl-rules-subsection, .dnfl-rules-topicsection');
        if (!parentSection) return;

        const contentChild = parentSection.querySelector('.dnfl-rules-main-content, .dnfl-rules-sub-content, .dnfl-rules-topic-content');
        if (!contentChild) return;

        const isExpanded = contentChild.classList.contains('is-expanded');

        if (isExpanded) {
            contentChild.classList.remove('is-expanded');
            parentSection.classList.remove('is-expanded');
        } else {
            contentChild.classList.add('is-expanded');
            parentSection.classList.add('is-expanded');
        }

        // Update Icon
        const icon = triggerEl.querySelector('i');
        if (icon) {
            if (icon.classList.contains('dnfl-rules-icon')) {
                icon.className = isExpanded ? 'fa-solid fa-chevron-right dnfl-rules-icon' : 'fa-solid fa-chevron-down dnfl-rules-icon';
            } else if (icon.classList.contains('dnfl-sub-icon')) {
                icon.className = isExpanded ? 'fa-solid fa-caret-right dnfl-sub-icon' : 'fa-solid fa-caret-down dnfl-sub-icon';
            } else if (icon.classList.contains('dnfl-topic-icon')) {
                icon.className = isExpanded ? 'fa-solid fa-angle-right dnfl-topic-icon' : 'fa-solid fa-angle-down dnfl-topic-icon';
            }
        }
    }

    /**
     * Interactivity: Expand All Accordions
     */
    function expandAll() {
        const sections = document.querySelectorAll('#dnfl-rules-container .dnfl-rules-section, #dnfl-rules-container .dnfl-rules-subsection, #dnfl-rules-container .dnfl-rules-topicsection');
        sections.forEach(sec => {
            sec.classList.add('is-expanded');
            const content = sec.querySelector('.dnfl-rules-main-content, .dnfl-rules-sub-content, .dnfl-rules-topic-content');
            if (content) content.classList.add('is-expanded');

            const icon = sec.querySelector('.dnfl-rules-tabhead i, .dnfl-rules-subhead i, .dnfl-rules-topichead i');
            if (icon) {
                if (icon.classList.contains('dnfl-rules-icon')) icon.className = 'fa-solid fa-chevron-down dnfl-rules-icon';
                else if (icon.classList.contains('dnfl-sub-icon')) icon.className = 'fa-solid fa-caret-down dnfl-sub-icon';
                else if (icon.classList.contains('dnfl-topic-icon')) icon.className = 'fa-solid fa-angle-down dnfl-topic-icon';
            }
        });
    }

    /**
     * Interactivity: Show Submenus (Expand Level 1 & Level 2, collapse Level 3)
     */
    function showSubMenus() {
        // Expand Level 1 & Level 2
        const lvl1And2 = document.querySelectorAll('#dnfl-rules-container .dnfl-rules-section, #dnfl-rules-container .dnfl-rules-subsection');
        lvl1And2.forEach(sec => {
            sec.classList.add('is-expanded');
            const content = sec.querySelector('.dnfl-rules-main-content, .dnfl-rules-sub-content');
            if (content) content.classList.add('is-expanded');

            const icon = sec.querySelector('.dnfl-rules-tabhead i, .dnfl-rules-subhead i');
            if (icon) {
                if (icon.classList.contains('dnfl-rules-icon')) icon.className = 'fa-solid fa-chevron-down dnfl-rules-icon';
                else if (icon.classList.contains('dnfl-sub-icon')) icon.className = 'fa-solid fa-caret-down dnfl-sub-icon';
            }
        });

        // Collapse Level 3
        const lvl3 = document.querySelectorAll('#dnfl-rules-container .dnfl-rules-topicsection');
        lvl3.forEach(sec => {
            sec.classList.remove('is-expanded');
            const content = sec.querySelector('.dnfl-rules-topic-content');
            if (content) content.classList.remove('is-expanded');

            const icon = sec.querySelector('.dnfl-rules-topichead i');
            if (icon) icon.className = 'fa-solid fa-angle-right dnfl-topic-icon';
        });
    }

    /**
     * Interactivity: Collapse All Accordions
     */
    function collapseAll() {
        const sections = document.querySelectorAll('#dnfl-rules-container .dnfl-rules-section, #dnfl-rules-container .dnfl-rules-subsection, #dnfl-rules-container .dnfl-rules-topicsection');
        sections.forEach(sec => {
            sec.classList.remove('is-expanded');
            const content = sec.querySelector('.dnfl-rules-main-content, .dnfl-rules-sub-content, .dnfl-rules-topic-content');
            if (content) content.classList.remove('is-expanded');

            const icon = sec.querySelector('.dnfl-rules-tabhead i, .dnfl-rules-subhead i, .dnfl-rules-topichead i');
            if (icon) {
                if (icon.classList.contains('dnfl-rules-icon')) icon.className = 'fa-solid fa-chevron-right dnfl-rules-icon';
                else if (icon.classList.contains('dnfl-sub-icon')) icon.className = 'fa-solid fa-caret-right dnfl-sub-icon';
                else if (icon.classList.contains('dnfl-topic-icon')) icon.className = 'fa-solid fa-angle-right dnfl-topic-icon';
            }
        });
    }

    /**
     * Action: Download CDN Hosted PDF Rulebook
     */
    function downloadPDF() {
        const year = rulesMFLYear || 2026;
        const pdfUrl = `https://dnfl.live/dnfl_rules/${year}/DNFL_Official_Rulebook_${year}.pdf`;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `DNFL_Official_Rulebook_${year}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Render Rules Engine into DOM
     */
    async function renderRulesModule() {
        rulesMFLYear = resolveSeasonYear();
        const container = document.getElementById('dnfl-rules-container');
        if (!container) return;

        let wrapper = container.querySelector('.dnfl-rules-wrapper');
        if (!wrapper) {
            const cardBody = container.querySelector('.dnfl-card-body') || container;
            wrapper = document.createElement('div');
            wrapper.className = 'dnfl-rules-wrapper';
            cardBody.appendChild(wrapper);
        }

        wrapper.innerHTML = `<div class="dnfl-status-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading ${rulesMFLYear} Official Rulebook...</div>`;

        try {
            loadedMdText = await fetchRulebookMarkdown(rulesMFLYear);
            if (!loadedMdText) {
                wrapper.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Official ${rulesMFLYear} Rulebook dataset is not available.</div>`;
                return;
            }

            const accordionHtml = compileMarkdownToAccordionHtml(loadedMdText);
            wrapper.innerHTML = accordionHtml;

        } catch (err) {
            console.error('[DNFL Rules Module] Render Error:', err);
            wrapper.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Error rendering rulebook: ${err.message}</div>`;
        }
    }

    /**
     * Initialization Handler
     */
    function init() {
        if (isInitialized) return;
        isInitialized = true;
        renderRulesModule();
    }

    // Public API
    window.DNFL.Rules = {
        init: init,
        toggleElement: toggleElement,
        showSubMenus: showSubMenus,
        expandAll: expandAll,
        collapseAll: collapseAll,
        downloadPDF: downloadPDF,
        compileMarkdownToAccordionHtml: compileMarkdownToAccordionHtml
    };

    // Auto-Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.addEventListener('dnfl:ready', init);

})();
