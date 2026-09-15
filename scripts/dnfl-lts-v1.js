/* ==========================================================================
   DNFL Last Team Standing (LTS) & Weekly High/Low Scores Engine
   File: ./scripts/dnfl-lts-v1.js
   ========================================================================== */
/* global DNFLClient */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};
    window.DNFL.LTS = window.DNFL.LTS || {};

    // Remote Configuration URL & Fallback Schema
    const RULES_URL = "https://dnfl.live/dnfl_lts/lts_rules.json";
    let LTS_RULES = {};

    const DEFAULT_FALLBACK_RULES = {
        'default': {
            ltsEnabled: true,
            highLowEnabled: true,
            startWeek: "auto",
            cellActiveBg: "var(--dnfl-bg-card, #ffffff)",
            cellEliminatedBg: "var(--dnfl-lts-bg-eliminated, #f1f5f9)",
            textEliminatedColor: "var(--dnfl-lts-text-eliminated, #64748b)",
            badgeHighScoreClass: "dnfl-lts-badge-high-score",
            badgeKnockoutClass: "dnfl-lts-badge-knockout",
            textPostElimLowClass: "dnfl-lts-text-post-elim-low",
            tableClass: "dnfl-table dnfl-lts-table"
        }
    };

    // Global Context Engine Variables
    const activeHost = window.location.hostname || "myfantasyleague.com";
    let targetYear = window.current_year || null;
    if (!targetYear) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear();
    }
    const leagueId = window.league_id || null;
    let loggedInFranchiseId = null;

    // State Caches
    let cachedConferences = [];
    let cachedDivisions = [];
    let cachedFranchises = [];
    let cachedWeeklyScores = {}; // { weekNum: { franchiseId: score } }
    let cachedLastRegWeek = 14;
    let cachedCurrentWeek = 1;

    let selectedConferenceId = null;
    let retryCount = 0;
    const maxRetries = 50;

    /**
     * Helper to normalize 2-digit ID values (e.g. "0", 0, "00")
     * @param {string|number} val 
     * @returns {string}
     */
    function norm(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    /**
     * Helper to normalize 4-digit franchise IDs (e.g. "5", 5, "0005")
     * @param {string|number} val 
     * @returns {string}
     */
    function normFranchiseId(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    /**
     * Helper to safely convert MFL payload values into Arrays
     * @param {any} val 
     * @returns {Array}
     */
    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    /**
     * Dynamically detects the logged-in franchise ID across all MFL environments
     * Uses 5-tier resolution strategy matching DNFL Standings engine
     * @returns {string|null}
     */
    function getLoggedInFranchiseId() {
        let fid = window.franchise_id || window.mflFranchiseId || window.login_franchise_id || window.current_franchise_id;
        
        // Tier 2: Check URL Parameters
        if (!fid && window.location && window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            fid = urlParams.get('F') || urlParams.get('FRANCHISE_ID') || urlParams.get('f');
        }

        // Tier 3: Check MFL Cookies
        if (!fid && document.cookie) {
            const cookieMatch = document.cookie.match(/(?:MFL_USER_ID|MFL_FRANCHISE_ID|franchise_id)=([^;]+)/i);
            if (cookieMatch && cookieMatch[1]) {
                const rawCookieVal = decodeURIComponent(cookieMatch[1]);
                const idMatch = rawCookieVal.match(/(?:u%3D|u=)?(\d{4})/i);
                if (idMatch && idMatch[1]) {
                    fid = idMatch[1];
                }
            }
        }

        // Tier 4: Check MFL Header/Navigation DOM Links
        if (!fid) {
            const myTeamLink = document.querySelector('a[href*="O=01"], a[href*="O=02"], a[href*="F="]');
            if (myTeamLink && myTeamLink.href) {
                const hrefMatch = myTeamLink.href.match(/[?&]F=(\d{4})/i);
                if (hrefMatch && hrefMatch[1]) {
                    fid = hrefMatch[1];
                }
            }
        }

        // Tier 5: Check Form Inputs / Select Elements
        if (!fid) {
            const inputEl = document.querySelector('input[name="FRANCHISE_ID"], select[name="FRANCHISE_ID"]');
            if (inputEl) fid = inputEl.value;
        }

        const normalized = normFranchiseId(fid);
        return (normalized && normalized !== '0000') ? normalized : null;
    }

    /**
     * Resolves rule set for target season year from LTS_RULES
     * @returns {Object}
     */
    function getYearRules() {
        const yr = parseInt(targetYear, 10);
        if (LTS_RULES[yr]) return LTS_RULES[yr];
        if (LTS_RULES[String(targetYear)]) return LTS_RULES[String(targetYear)];

        for (const key in LTS_RULES) {
            if (key.startsWith('_')) continue;

            if (key.includes('-')) {
                const [start, end] = key.split('-').map(s => parseInt(s.trim(), 10));
                if (yr >= start && yr <= end) return LTS_RULES[key];
            }
            if (key.includes(',')) {
                const yearList = key.split(',').map(s => parseInt(s.trim(), 10));
                if (yearList.includes(yr)) return LTS_RULES[key];
            }
        }
        return LTS_RULES['default'] || DEFAULT_FALLBACK_RULES['default'];
    }

    /**
     * Deep merge resolver for conference-specific LTS overrides
     * @param {Object} yearRules 
     * @param {string} confId 
     * @returns {Object}
     */
    function getConfRules(yearRules, confId) {
        const defaultRules = LTS_RULES['default'] || DEFAULT_FALLBACK_RULES['default'];
        const base = { ...defaultRules, ...yearRules };
        const normConfId = norm(confId);

        if (yearRules && yearRules.conferences && yearRules.conferences[normConfId]) {
            return {
                ...base,
                ...yearRules.conferences[normConfId]
            };
        }
        return base;
    }

    /**
     * Parses raw MFL weeklyResults payload into structured score matrix
     * @param {Object} data 
     * @returns {Object} { weekNum: { franchiseId: scoreFloat } }
     */
    function parseWeeklyScores(data) {
        const scoresByWeek = {};
        if (!data || !data.weeklyResults) return scoresByWeek;

        let rawWeeks = data.weeklyResults.weeklyResults || data.weeklyResults;
        const weeksArray = toArray(rawWeeks);

        weeksArray.forEach(wObj => {
            const weekNum = parseInt(wObj.week, 10);
            if (isNaN(weekNum)) return;

            scoresByWeek[weekNum] = scoresByWeek[weekNum] || {};

            // Check franchise array
            if (wObj.franchise) {
                toArray(wObj.franchise).forEach(f => {
                    const fid = normFranchiseId(f.id);
                    const scoreVal = parseFloat(f.score);
                    if (fid && !isNaN(scoreVal)) {
                        scoresByWeek[weekNum][fid] = scoreVal;
                    }
                });
            }

            // Check matchup array
            if (wObj.matchup) {
                toArray(wObj.matchup).forEach(m => {
                    if (m.franchise) {
                        toArray(m.franchise).forEach(f => {
                            const fid = normFranchiseId(f.id);
                            const scoreVal = parseFloat(f.score);
                            if (fid && !isNaN(scoreVal)) {
                                scoresByWeek[weekNum][fid] = scoreVal;
                            }
                        });
                    }
                });
            }
        });

        return scoresByWeek;
    }

    /**
     * Format numbers to clean score string (e.g. 124.50)
     * @param {number} score 
     * @returns {string}
     */
    function formatScore(score) {
        if (score === null || score === undefined || isNaN(score)) return '-';
        return Number(score).toFixed(2);
    }

    /**
     * Helper to construct team HTML layout block matching Standings
     * @param {Object} franchise 
     * @returns {string}
     */
    function formatFranchiseCellHtml(franchise) {
        if (!franchise) return '<span class="dnfl-text-subtle">N/A</span>';
        const teamName = franchise.name || `Franchise ${franchise.id}`;
        const ownerName = franchise.owner_name || '';
        const iconUrl = franchise.icon || 'https://www.myfantasyleague.com/images/default_icon.png';
        const profileUrl = `https://${activeHost}/${targetYear}/options?L=${leagueId}&F=${franchise.id}&O=01`;

        return `
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${iconUrl}" class="franchiseicon" alt="${teamName}" onError="this.onerror=null;this.src='https://www.myfantasyleague.com/images/default_icon.png';" />
                <div>
                    <a href="${profileUrl}" class="dnfl-team-name" target="_top">${teamName}</a>
                    ${ownerName ? `<div class="dnfl-owner-name">${ownerName}</div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Primary Async Initialization Routine
     */
    async function init() {
        const moduleContainer = document.getElementById("dnfl_lts_module");
        if (!moduleContainer) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        const statusEl = document.getElementById("dnfl_lts_status");
        if (statusEl) {
            statusEl.className = "dnfl-status-loading";
            statusEl.textContent = "Loading Last Team Standing & Weekly High Scores data...";
        }

        try {
            const apiClient = window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
            if (!apiClient) {
                throw new Error("DNFLClient API middleware unavailable.");
            }

            loggedInFranchiseId = getLoggedInFranchiseId();

            const [leagueResponse, weeklyResultsResponse, rawRulesJson] = await Promise.all([
                apiClient.fetchData("league"),
                apiClient.fetchData("weeklyResults"),
                apiClient.fetchRawText(RULES_URL).catch(err => {
                    console.warn("[DNFL LTS] Could not load lts_rules.json, using fallback rules.", err);
                    return null;
                })
            ]);

            if (!leagueResponse) {
                throw new Error("Missing league configuration payload from MFL API.");
            }

            if (rawRulesJson) {
                try {
                    LTS_RULES = JSON.parse(rawRulesJson);
                } catch (e) {
                    console.error("[DNFL LTS] Corrupted lts_rules.json format. Fallback engaged.", e);
                }
            }

            if (!LTS_RULES || !LTS_RULES['default']) {
                LTS_RULES = DEFAULT_FALLBACK_RULES;
            }

            // Extract metadata from League API response
            cachedLastRegWeek = parseInt(leagueResponse.league?.lastRegularSeasonWeek || 14, 10);
            cachedCurrentWeek = parseInt(leagueResponse.league?.currentWk || 1, 10);

            cachedFranchises = toArray(leagueResponse.league?.franchises?.franchise);
            cachedConferences = toArray(leagueResponse.league?.conferences?.conference);
            cachedDivisions = toArray(leagueResponse.league?.divisions?.division);

            // If league has no conferences explicitly defined, construct synthetic conference 00
            if (cachedConferences.length === 0) {
                cachedConferences = [{ id: "00", name: "League Main" }];
            }

            // Map franchises to normalized IDs
            cachedFranchises.forEach(f => {
                f.id = normFranchiseId(f.id);
                if (f.conference) {
                    f.confId = norm(f.conference);
                } else if (f.division) {
                    const div = cachedDivisions.find(d => norm(d.id) === norm(f.division));
                    f.confId = div && div.conference ? norm(div.conference) : "00";
                } else {
                    f.confId = "00";
                }
            });

            // Parse Weekly Scores
            cachedWeeklyScores = parseWeeklyScores(weeklyResultsResponse);

            // Check global feature flag status across all active conferences
            const yrRules = getYearRules();
            let anyFeatureEnabled = false;

            cachedConferences.forEach(conf => {
                const cRules = getConfRules(yrRules, conf.id);
                if (cRules.ltsEnabled !== false || cRules.highLowEnabled !== false) {
                    anyFeatureEnabled = true;
                }
            });

            if (!anyFeatureEnabled) {
                const statusContainer = document.getElementById("dnfl_lts_status_container");
                if (statusContainer) {
                    statusContainer.innerHTML = `<p class="dnfl-status-error">Last Team Standing & Weekly High/Low Scores are disabled for this season.</p>`;
                }
                const matrixWrap = document.getElementById("dnfl_lts_matrix_wrapper");
                if (matrixWrap) matrixWrap.style.display = "none";
                const graveyardSec = document.getElementById("dnfl_lts_graveyardSection");
                if (graveyardSec) graveyardSec.style.display = "none";
                return;
            }

            // Hide loading text once ready
            if (statusEl) statusEl.style.display = "none";

            // Determine initial conference selection (prefer logged-in owner's conference)
            setupConferenceDropdown();
            setupToggleButtons();
            renderLtsModuleView();

        } catch (error) {
            console.error("[DNFL LTS Error]:", error);
            if (statusEl) {
                statusEl.className = "dnfl-status-error";
                statusEl.textContent = `Error loading Last Team Standing module: ${error.message}`;
            }
        }
    }

    /**
     * Sets up Conference Filter Dropdown and defaults to logged-in user's conference
     */
    function setupConferenceDropdown() {
        const selectEl = document.getElementById("dnfl_lts_confFilter");
        if (!selectEl) return;

        selectEl.innerHTML = "";

        let defaultConfId = cachedConferences[0]?.id || "00";

        // Find logged-in franchise's conference
        if (loggedInFranchiseId) {
            const userFranchise = cachedFranchises.find(f => f.id === loggedInFranchiseId);
            if (userFranchise && userFranchise.confId) {
                defaultConfId = userFranchise.confId;
            }
        }

        selectedConferenceId = defaultConfId;

        cachedConferences.forEach(conf => {
            const opt = document.createElement("option");
            opt.value = norm(conf.id);
            opt.textContent = conf.name || `Conference ${conf.id}`;
            if (norm(conf.id) === norm(defaultConfId)) {
                opt.selected = true;
            }
            selectEl.appendChild(opt);
        });

        selectEl.addEventListener("change", function(e) {
            selectedConferenceId = e.target.value;
            renderLtsModuleView();
        });
    }

    /**
     * Attaches event handlers for module view toggles
     */
    function setupToggleButtons() {
        const toggleBtn = document.getElementById("dnfl_lts_toggle_graveyard");
        const graveyardSec = document.getElementById("dnfl_lts_graveyardSection");

        if (toggleBtn && graveyardSec) {
            toggleBtn.addEventListener("click", function() {
                const isHidden = graveyardSec.style.display === "none";
                graveyardSec.style.display = isHidden ? "block" : "none";
                toggleBtn.setAttribute("aria-expanded", isHidden ? "true" : "false");
            });
        }
    }

    /**
     * Main Renderer for Cross-Grid Matrix and Graveyard Tables
     */
    function renderLtsModuleView() {
        const confId = selectedConferenceId || cachedConferences[0]?.id || "00";
        const yrRules = getYearRules();
        const confRules = getConfRules(yrRules, confId);

        const ltsEnabled = confRules.ltsEnabled !== false;
        const highLowEnabled = confRules.highLowEnabled !== false;

        // Filter franchises for target conference
        const confTeams = cachedFranchises.filter(f => norm(f.confId) === norm(confId));

        // Determine Start Week
        let startWeek = 1;
        if (typeof confRules.startWeek === 'number') {
            startWeek = confRules.startWeek;
        } else if (confRules.startWeek && confRules.startWeek !== 'auto') {
            const parsed = parseInt(confRules.startWeek, 10);
            if (!isNaN(parsed)) startWeek = parsed;
        } else {
            // Auto Calculation: regularSeasonEndWeek - (activeTeams - 1)
            startWeek = Math.max(1, cachedLastRegWeek - (confTeams.length - 1));
        }

        // Run Chronological Elimination & High/Low Engine Simulation
        const simulationResults = runLtsSimulation(confTeams, startWeek, ltsEnabled, highLowEnabled);

        // Render Component 1: Survival Timeline Cross-Grid Matrix
        renderCrossGridMatrix(confTeams, simulationResults, confRules);

        // Render Component 2: The Graveyard & Weekly High Scores
        renderGraveyardTable(simulationResults, confRules);
    }

    /**
     * Simulates chronological weekly scores, eliminations, and prize winners
     * @param {Array} confTeams 
     * @param {number} startWeek 
     * @param {boolean} ltsEnabled 
     * @param {boolean} highLowEnabled 
     * @returns {Object}
     */
    function runLtsSimulation(confTeams, startWeek, ltsEnabled, highLowEnabled) {
        // Track state per team: { eliminatedWeek: null, knockoutScore: null }
        const teamStates = {};
        confTeams.forEach(f => {
            teamStates[f.id] = {
                franchise: f,
                eliminatedWeek: null,
                knockoutScore: null
            };
        });

        const weeklyStats = {}; // { week: { highScorerId, highScore, lowScorerId, lowScore, knockoutId, knockoutScore, postElimLows: [] } }
        const maxSimWeek = Math.min(cachedCurrentWeek, cachedLastRegWeek);

        for (let w = 1; w <= maxSimWeek; w++) {
            const scoresThisWeek = cachedWeeklyScores[w] || {};

            // Collect scores for teams in this conference that played this week
            const confScoresThisWeek = [];
            confTeams.forEach(f => {
                const s = scoresThisWeek[f.id];
                if (s !== undefined && s !== null && !isNaN(s)) {
                    confScoresThisWeek.push({
                        franchiseId: f.id,
                        score: s,
                        isEliminatedBeforeWeek: teamStates[f.id].eliminatedWeek !== null && teamStates[f.id].eliminatedWeek < w
                    });
                }
            });

            if (confScoresThisWeek.length === 0) continue;

            // 1. Weekly High Scorer (All teams in conference eligible)
            let highScorer = confScoresThisWeek[0];
            confScoresThisWeek.forEach(item => {
                if (item.score > highScorer.score) {
                    highScorer = item;
                }
            });

            // 2. Weekly Low Scorer (All teams)
            let lowestOverall = confScoresThisWeek[0];
            confScoresThisWeek.forEach(item => {
                if (item.score < lowestOverall.score) {
                    lowestOverall = item;
                }
            });

            // 3. LTS Knockout Calculation (Active teams only)
            let knockedOutTeam = null;
            if (ltsEnabled && w >= startWeek) {
                const activeScores = confScoresThisWeek.filter(item => !item.isEliminatedBeforeWeek);
                if (activeScores.length > 1) {
                    // Find lowest among active teams
                    let lowestActive = activeScores[0];
                    activeScores.forEach(item => {
                        if (item.score < lowestActive.score) {
                            lowestActive = item;
                        }
                    });

                    knockedOutTeam = lowestActive;
                    teamStates[lowestActive.franchiseId].eliminatedWeek = w;
                    teamStates[lowestActive.franchiseId].knockoutScore = lowestActive.score;
                }
            }

            weeklyStats[w] = {
                highScorerId: highLowEnabled ? highScorer.franchiseId : null,
                highScore: highLowEnabled ? highScorer.score : null,
                lowestOverallId: lowestOverall.franchiseId,
                lowestOverallScore: lowestOverall.score,
                knockoutId: knockedOutTeam ? knockedOutTeam.franchiseId : null,
                knockoutScore: knockedOutTeam ? knockedOutTeam.score : null
            };
        }

        return {
            teamStates,
            weeklyStats,
            startWeek,
            maxSimWeek,
            ltsEnabled,
            highLowEnabled
        };
    }

    /**
     * Renders Table 1: Survival Timeline Cross-Grid Matrix
     */
    function renderCrossGridMatrix(confTeams, simulation, confRules) {
        const thead = document.getElementById("dnfl_lts_crossGridThead");
        const tbody = document.getElementById("dnfl_lts_crossGridTbody");
        if (!thead || !tbody) return;

        const { teamStates, weeklyStats, ltsEnabled, highLowEnabled } = simulation;

        // Build Header Row
        let headerHtml = `<tr><th>Franchise</th>`;
        for (let w = 1; w <= cachedLastRegWeek; w++) {
            headerHtml += `<th style="text-align: center;">W${w}</th>`;
        }
        headerHtml += `</tr>`;
        thead.innerHTML = headerHtml;

        // Build Body Rows
        let bodyHtml = "";

        confTeams.forEach(f => {
            const state = teamStates[f.id] || {};
            const isMyTeam = loggedInFranchiseId && normFranchiseId(f.id) === normFranchiseId(loggedInFranchiseId);
            const rowClass = isMyTeam ? "dnfl-my-team" : "";

            bodyHtml += `<tr class="${rowClass}">`;

            // Column 1: Franchise Info (Sticky)
            bodyHtml += `<td>${formatFranchiseCellHtml(f)}</td>`;

            // Week Columns 1..lastRegWeek
            for (let w = 1; w <= cachedLastRegWeek; w++) {
                const rawScore = cachedWeeklyScores[w]?.[f.id];
                const statsObj = weeklyStats[w];

                if (rawScore === undefined || rawScore === null) {
                    bodyHtml += `<td style="text-align: center; color: var(--dnfl-text-muted);">-</td>`;
                    continue;
                }

                const scoreStr = formatScore(rawScore);
                const wasEliminatedBeforeWeek = ltsEnabled && state.eliminatedWeek !== null && state.eliminatedWeek < w;
                const wasKnockedOutThisWeek = ltsEnabled && state.eliminatedWeek === w;
                const isHighScorer = highLowEnabled && statsObj && statsObj.highScorerId === f.id;
                const isLowestOverall = statsObj && statsObj.lowestOverallId === f.id;

                let cellStyle = "";
                let cellContent = scoreStr;

                if (wasEliminatedBeforeWeek) {
                    // Post-elimination slate gray shading
                    cellStyle = `background-color: ${confRules.cellEliminatedBg || "var(--dnfl-lts-bg-eliminated, #f1f5f9)"}; color: ${confRules.textEliminatedColor || "var(--dnfl-lts-text-eliminated, #64748b)"}; text-align: center;`;

                    if (isLowestOverall) {
                        // Post-elimination low score (red text, no badge, no bold)
                        cellContent = `<span class="${confRules.textPostElimLowClass || 'dnfl-lts-text-post-elim-low'}">${scoreStr}</span>`;
                    } else {
                        cellContent = scoreStr;
                    }
                } else if (wasKnockedOutThisWeek) {
                    // Knockout week cell: Red Badge with Skull Icon
                    cellStyle = `background-color: ${confRules.cellActiveBg || "var(--dnfl-bg-card, #ffffff)"}; text-align: center;`;
                    cellContent = `<span class="${confRules.badgeKnockoutClass || 'dnfl-lts-badge-knockout'}"><i class="fas fa-skull"></i> ${scoreStr}</span>`;
                } else if (isHighScorer) {
                    // High Scorer cell: Green Badge with Crown Icon
                    cellStyle = `background-color: ${confRules.cellActiveBg || "var(--dnfl-bg-card, #ffffff)"}; text-align: center;`;
                    cellContent = `<span class="${confRules.badgeHighScoreClass || 'dnfl-lts-badge-high-score'}"><i class="fas fa-crown"></i> ${scoreStr}</span>`;
                } else if (!ltsEnabled && highLowEnabled && isLowestOverall) {
                    // LTS Disabled, High/Low Enabled: Red Badge WITHOUT Skull Icon
                    cellStyle = `background-color: ${confRules.cellActiveBg || "var(--dnfl-bg-card, #ffffff)"}; text-align: center;`;
                    cellContent = `<span class="${confRules.badgeKnockoutClass || 'dnfl-lts-badge-knockout'}">${scoreStr}</span>`;
                } else {
                    // Standard Active Team Cell
                    cellStyle = `background-color: ${confRules.cellActiveBg || "var(--dnfl-bg-card, #ffffff)"}; text-align: center;`;
                    cellContent = scoreStr;
                }

                bodyHtml += `<td style="${cellStyle}">${cellContent}</td>`;
            }

            bodyHtml += `</tr>`;
        });

        tbody.innerHTML = bodyHtml;
    }

    /**
     * Renders Table 2: The Graveyard & Weekly High Scores Table
     */
    function renderGraveyardTable(simulation, confRules) {
        const tbody = document.getElementById("dnfl_lts_graveyardTbody");
        const thead = document.getElementById("dnfl_lts_graveyardThead");
        if (!tbody || !thead) return;

        const { weeklyStats, startWeek, maxSimWeek, ltsEnabled, highLowEnabled } = simulation;

        // Dynamic Table Header Labels depending on feature flags
        thead.innerHTML = `
            <tr>
                <th style="text-align: center;">Week</th>
                <th>${ltsEnabled ? 'Knocked Out Franchise' : 'Lowest Scorer'}</th>
                <th style="text-align: center;">${ltsEnabled ? 'Knockout Score' : 'Low Score'}</th>
                <th>Weekly High Scorer (Prize Winner)</th>
                <th style="text-align: center;">High Score</th>
            </tr>
        `;

        let bodyHtml = "";

        for (let w = 1; w <= maxSimWeek; w++) {
            const stats = weeklyStats[w];
            if (!stats) continue;

            const highTeam = cachedFranchises.find(f => f.id === stats.highScorerId);
            const lowTeamId = ltsEnabled ? stats.knockoutId : stats.lowestOverallId;
            const lowScoreVal = ltsEnabled ? stats.knockoutScore : stats.lowestOverallScore;
            const lowTeam = cachedFranchises.find(f => f.id === lowTeamId);

            bodyHtml += `<tr>`;

            // Col 1: Week
            bodyHtml += `<td style="text-align: center; font-weight: bold;">Week ${w}</td>`;

            // Col 2: Knocked Out / Lowest Scorer Franchise
            if (lowTeam) {
                bodyHtml += `<td>${formatFranchiseCellHtml(lowTeam)}</td>`;
            } else {
                bodyHtml += `<td><span class="dnfl-text-subtle">${w < startWeek && ltsEnabled ? 'LTS Starts W' + startWeek : 'No Knockout'}</span></td>`;
            }

            // Col 3: Knockout / Low Score Badge
            if (lowScoreVal !== null && lowScoreVal !== undefined) {
                const iconHtml = ltsEnabled ? `<i class="fas fa-skull"></i> ` : ``;
                bodyHtml += `<td style="text-align: center;"><span class="${confRules.badgeKnockoutClass || 'dnfl-lts-badge-knockout'}">${iconHtml}${formatScore(lowScoreVal)}</span></td>`;
            } else {
                bodyHtml += `<td style="text-align: center; color: var(--dnfl-text-muted);">-</td>`;
            }

            // Col 4: Weekly High Scorer (Prize Winner)
            if (highTeam && highLowEnabled) {
                bodyHtml += `<td>${formatFranchiseCellHtml(highTeam)}</td>`;
            } else {
                bodyHtml += `<td><span class="dnfl-text-subtle">N/A</span></td>`;
            }

            // Col 5: High Score Badge
            if (stats.highScore !== null && stats.highScore !== undefined && highLowEnabled) {
                bodyHtml += `<td style="text-align: center;"><span class="${confRules.badgeHighScoreClass || 'dnfl-lts-badge-high-score'}"><i class="fas fa-crown"></i> ${formatScore(stats.highScore)}</span></td>`;
            } else {
                bodyHtml += `<td style="text-align: center; color: var(--dnfl-text-muted);">-</td>`;
            }

            bodyHtml += `</tr>`;
        }

        if (!bodyHtml) {
            bodyHtml = `<tr><td colspan="5" style="text-align: center; color: var(--dnfl-text-muted); padding: 1.5rem;">No completed week scores available yet.</td></tr>`;
        }

        tbody.innerHTML = bodyHtml;
    }

    // Auto-Initialization Guard on DOMContentLoaded or immediate ready state
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(init, 10);
    } else {
        document.addEventListener("DOMContentLoaded", init);
    }

    // Export Public API Methods under window.DNFL.LTS
    window.DNFL.LTS = {
        init: init,
        updateLtsView: function(confId) {
            if (confId) selectedConferenceId = confId;
            renderLtsModuleView();
        },
        getLoggedInFranchiseId: getLoggedInFranchiseId,
        getRules: getYearRules
    };

})();
