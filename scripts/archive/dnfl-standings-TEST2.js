/* ==========================================================================
   DNFL Standings Engine (v3.00-TEST2)
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Dynamic standings, tie-breaker, seeding, and badge engine powered by
   DNFL.Client middleware. Auto-selects user conference and renders seeding
   badges and records cleanly.
   ========================================================================== */

(function (window, document) {
    'use strict';

    // Global Namespace Setup
    window.DNFL = window.DNFL || {};
    const DNFL = window.DNFL;

    // Module State Caches
    let STANDINGS_DATA = null;
    let STANDINGS_RULES = null;
    let currentConfId = 'ALL';

    // Helper Padding Utilities (fallback to local if header hasn't initialized)
    const pad4 = (val) => (DNFL.Utils && DNFL.Utils.pad4) ? DNFL.Utils.pad4(val) : String(val || '').trim().padStart(4, '0');
    const pad2 = (val) => (DNFL.Utils && DNFL.Utils.pad2) ? DNFL.Utils.pad2(val) : String(val || '').trim().padStart(2, '0');

    /**
     * Resolve rules for a specific season year (supporting ranges like "2021-2024" or lists "2024,2025")
     */
    function getYearRules(year, rulesObj) {
        if (!rulesObj) return null;
        if (rulesObj[year]) return rulesObj[year];

        const yrNum = parseInt(year, 10);
        for (const key of Object.keys(rulesObj)) {
            if (key.includes('-')) {
                const [start, end] = key.split('-').map(v => parseInt(v.trim(), 10));
                if (!isNaN(start) && !isNaN(end) && yrNum >= start && yrNum <= end) {
                    return rulesObj[key];
                }
            } else if (key.includes(',')) {
                const list = key.split(',').map(v => v.trim());
                if (list.includes(String(year))) {
                    return rulesObj[key];
                }
            }
        }
        return rulesObj["DEFAULT"] || null;
    }

    /**
     * Initialize Standings Module
     */
    async function init(yearOverride) {
        const tbody = document.getElementById('dnfl-standings-tbody');
        if (!tbody) return;

        const context = DNFL.Client ? DNFL.Client.getContext() : { year: new Date().getFullYear().toString() };
        const year = yearOverride || context.year;

        try {
            // Concurrently fetch standings data and custom standings rules
            const [rawStandings, rawRulesText] = await Promise.all([
                DNFL.Client.fetchData('leagueStandings'),
                DNFL.Client.fetchRawText('https://dnfl.live/dnfl_standings/standings_rules.json').catch(() => null)
            ]);

            STANDINGS_DATA = rawStandings;

            if (rawRulesText) {
                try {
                    STANDINGS_RULES = JSON.parse(rawRulesText);
                } catch (e) {
                    STANDINGS_RULES = null;
                }
            }

            // Ensure league metadata is available
            const leagueDetails = DNFL.leagueMetadata || (DNFL.Client ? await DNFL.Client.fetchData('league') : null);

            // Compute seeding, division crowns, and playoff cutoffs
            const computedState = calculateSeedsAndBadges(STANDINGS_DATA, STANDINGS_RULES, leagueDetails, year);

            // Populate conference dropdown filter
            setupDropdown(computedState.conferences);

            // Render table view
            updateView(computedState);

        } catch (err) {
            console.error('[DNFL.Standings] Error initializing standings module:', err);
            tbody.innerHTML = '<tr><td colspan="10" class="dnfl-disclaimer-text">Error loading standings data.</td></tr>';
        }
    }

    /**
     * Calculate seeds, division leaders, promotion, and relegation zones
     */
    function calculateSeedsAndBadges(standingsData, rulesObj, leagueDetails, year) {
        const teamSeeds = {};
        const divLeaders = {};
        const relegatedTeamIds = new Set();
        const promotedTeamIds = new Set();
        const conferences = [];

        if (!standingsData || !standingsData.leagueStandings) {
            return { teamSeeds, divLeaders, relegatedTeamIds, promotedTeamIds, conferences };
        }

        const rawFranchises = Array.isArray(standingsData.leagueStandings.franchise)
            ? standingsData.leagueStandings.franchise
            : [standingsData.leagueStandings.franchise];

        const baseRules = getYearRules(year, rulesObj) || {};

        // Map franchise data with calculated Points Against (PA) fallback if needed
        const processedTeams = rawFranchises.map(f => {
            const fid = pad4(f.id);
            const pf = parseFloat(f.pf || 0);
            const pa = parseFloat(f.pa || 0);
            const w = parseInt(f.h2hw || f.w || 0, 10);
            const l = parseInt(f.h2hl || f.l || 0, 10);
            const t = parseInt(f.h2ht || f.t || 0, 10);
            const pct = (w + l + t > 0) ? (w + 0.5 * t) / (w + l + t) : 0;

            const fMeta = (DNFL.franchiseMap && DNFL.franchiseMap[fid]) || {};
            const confId = pad2(fMeta.conference_id || f.conference_id || '01');
            const divId = pad2(fMeta.division_id || f.division_id || '01');

            return {
                id: fid,
                raw: f,
                w, l, t, pct, pf, pa,
                confId, divId,
                name: fMeta.name || f.name || `Franchise ${fid}`
            };
        });

        // Group teams by conference
        const confGroups = {};
        processedTeams.forEach(team => {
            if (!confGroups[team.confId]) confGroups[team.confId] = [];
            confGroups[team.confId].push(team);
        });

        // Evaluate seeding per conference
        Object.keys(confGroups).forEach(cId => {
            conferences.push(cId);
            const teams = confGroups[cId];
            const confOverrides = (baseRules.conferenceOverrides && baseRules.conferenceOverrides[cId]) || {};
            const playoffCutoff = confOverrides.playoffCutoff || baseRules.playoffCutoff || 4;

            // Group teams by division to determine division champions
            const divGroups = {};
            teams.forEach(team => {
                if (!divGroups[team.divId]) divGroups[team.divId] = [];
                divGroups[team.divId].push(team);
            });

            // Find division winners (highest win pct, tie-breaker: PF)
            Object.keys(divGroups).forEach(dId => {
                const divTeams = divGroups[dId];
                divTeams.sort((a, b) => b.pct - a.pct || b.pf - a.pf);
                if (divTeams.length > 0) {
                    divLeaders[divTeams[0].id] = true;
                }
            });

            // Sort entire conference: Division leaders first, then wildcards by Win% then PF
            teams.sort((a, b) => {
                const aIsDiv = divLeaders[a.id] ? 1 : 0;
                const bIsDiv = divLeaders[b.id] ? 1 : 0;
                if (aIsDiv !== bIsDiv) return bIsDiv - aIsDiv;
                if (b.pct !== a.pct) return b.pct - a.pct;
                return b.pf - a.pf;
            });

            // Assign numerical seed
            teams.forEach((team, idx) => {
                const seed = idx + 1;
                teamSeeds[team.id] = seed;

                // Relegation / Promotion tracking
                if (baseRules.enableRelegation) {
                    if (confOverrides.isLowestConference && seed > (teams.length - (baseRules.relegationCount || 2))) {
                        relegatedTeamIds.add(team.id);
                    } else if (!confOverrides.isLowestConference && seed <= (baseRules.promotionCount || 2)) {
                        promotedTeamIds.add(team.id);
                    }
                }
            });
        });

        return { teamSeeds, divLeaders, relegatedTeamIds, promotedTeamIds, conferences, processedTeams, baseRules };
    }

    /**
     * Populate Conference Filter Dropdown
     */
    function setupDropdown(conferences) {
        const select = document.getElementById('dnfl_standings_confFilter');
        if (!select) return;

        select.innerHTML = '';

        // Add 'All Conferences' option if multi-conference
        const optAll = document.createElement('option');
        optAll.value = 'ALL';
        optAll.textContent = 'All Conferences';
        select.appendChild(optAll);

        const activeFranchiseId = DNFL.currentFranchiseId ? pad4(DNFL.currentFranchiseId) : null;
        let userConfId = null;

        if (activeFranchiseId && DNFL.franchiseMap && DNFL.franchiseMap[activeFranchiseId]) {
            userConfId = pad2(DNFL.franchiseMap[activeFranchiseId].conference_id);
        }

        conferences.forEach(cId => {
            const opt = document.createElement('option');
            opt.value = cId;
            const confMeta = (DNFL.leagueMetadata && DNFL.leagueMetadata.conference)
                ? (Array.isArray(DNFL.leagueMetadata.conference) ? DNFL.leagueMetadata.conference.find(c => pad2(c.id) === cId) : DNFL.leagueMetadata.conference)
                : null;
            opt.textContent = confMeta ? confMeta.name : `Conference ${cId}`;
            select.appendChild(opt);
        });

        // Default to user's home conference or ALL
        if (userConfId && conferences.includes(userConfId)) {
            currentConfId = userConfId;
            select.value = userConfId;
        } else {
            currentConfId = 'ALL';
            select.value = 'ALL';
        }

        select.onchange = function () {
            currentConfId = this.value;
            const leagueDetails = DNFL.leagueMetadata;
            const context = DNFL.Client ? DNFL.Client.getContext() : { year: new Date().getFullYear().toString() };
            const state = calculateSeedsAndBadges(STANDINGS_DATA, STANDINGS_RULES, leagueDetails, context.year);
            updateView(state);
        };
    }

    /**
     * Render Table Rows based on selected conference filter
     */
    function updateView(state) {
        const tbody = document.getElementById('dnfl-standings-tbody');
        if (!tbody) return;

        const { teamSeeds, divLeaders, relegatedTeamIds, promotedTeamIds, processedTeams, baseRules } = state;

        if (!processedTeams || processedTeams.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="dnfl-disclaimer-text">No standings data available.</td></tr>';
            return;
        }

        const filteredTeams = (currentConfId === 'ALL')
            ? processedTeams
            : processedTeams.filter(t => t.confId === currentConfId);

        const activeFranchiseId = DNFL.currentFranchiseId ? pad4(DNFL.currentFranchiseId) : null;

        let html = '';

        filteredTeams.forEach((t, idx) => {
            const seed = teamSeeds[t.id] || (idx + 1);
            const isDivWinner = !!divLeaders[t.id];
            const isMyTeam = (t.id === activeFranchiseId);

            const confOverrides = (baseRules.conferenceOverrides && baseRules.conferenceOverrides[t.confId]) || {};
            const playoffCutoff = confOverrides.playoffCutoff || baseRules.playoffCutoff || 4;
            const isPlayoffBound = seed <= playoffCutoff;

            // Row styling class
            const rowClass = isMyTeam ? 'dnfl-myfranchise dnfl-my-team' : (idx % 2 === 0 ? 'dnfl-row-even' : 'dnfl-row-odd');

            // Badge icons
            let badgeHtml = '';
            if (isDivWinner) {
                badgeHtml += '<i class="fas fa-crown dnfl-badge-crown" title="Division Champion"></i> ';
            }
            if (isPlayoffBound) {
                badgeHtml += '<i class="fas fa-trophy dnfl-badge-trophy" title="Playoff Qualified"></i> ';
            }
            if (promotedTeamIds.has(t.id)) {
                badgeHtml += '<i class="fas fa-arrow-circle-up dnfl-badge-promoted" title="Promotion Zone"></i> ';
            }
            if (relegatedTeamIds.has(t.id)) {
                badgeHtml += '<i class="fas fa-arrow-circle-down dnfl-badge-relegated" title="Relegation Zone"></i> ';
            }

            const winPctStr = t.pct.toFixed(3).replace(/^0/, '');
            const pfStr = t.pf.toFixed(1);
            const paStr = t.pa.toFixed(1);
            const diffStr = (t.pf - t.pa).toFixed(1);

            html += `<tr class="${rowClass}">
                <td class="dnfl-text-center">${badgeHtml}<span class="dnfl-seed-number">${seed}</span></td>
                <td class="dnfl-team-cell">
                    <a href="options?L=${DNFL.Client ? DNFL.Client.getContext().leagueId : ''}&O=07&F=${t.id}" class="dnfl-team-link">
                        ${t.name}
                    </a>
                </td>
                <td class="dnfl-text-center">${t.w}</td>
                <td class="dnfl-text-center">${t.l}</td>
                <td class="dnfl-text-center">${t.t}</td>
                <td class="dnfl-text-center">${winPctStr}</td>
                <td class="dnfl-text-right">${pfStr}</td>
                <td class="dnfl-text-right">${paStr}</td>
                <td class="dnfl-text-right">${diffStr}</td>
            </tr>`;
        });

        tbody.innerHTML = html;
    }

    // Export Module API
    DNFL.Standings = {
        init: init,
        updateView: updateView
    };

    // Auto-Initialize on Framework Readiness or DOM Load
    function autoInit() {
        if (document.getElementById('dnfl-standings-tbody') || document.getElementById('dnfl_standings_confFilter')) {
            init();
        }
    }

    window.addEventListener('dnfl:ready', autoInit);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

})(window, document);
