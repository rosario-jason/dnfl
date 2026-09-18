/* ==========================================================================
   DNFL Last Team Standing (LTS) & Weekly High/Low Scores Engine
   ========================================================================== */
/* global DNFLClient, DNFL */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    // Module state flag
    let _initialized = false;

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

    // Dynamic Target Environment Variables
    let activeHost = 'www48.myfantasyleague.com';
    let targetYear = String(new Date().getFullYear());
    let leagueId = '00000';
    let loggedInFranchiseId = '0000';

    // State Caches
    let cachedConferences = [];
    let cachedDivisions = [];
    let cachedFranchises = [];
    let cachedWeeklyScores = {}; // { weekNum: { franchiseId: scoreFloat } }
    let cachedLastRegWeek = 14;
    let cachedCurrentWeek = 1;

    let selectedConferenceId = null;
    let retryCount = 0;
    const maxRetries = 50;

    /**
     * Helper to normalize 2-digit ID values (e.g. "0", 0, "00")
     */
    function norm(val) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
            val = val.id || val.code || val['$'] || val.val || '';
        }
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    /**
     * Helper to normalize 4-digit franchise IDs (e.g. "5", 5, "0005")
     */
    function normFranchiseId(val) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
            val = val.id || val.code || val['$'] || val.val || '';
        }
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    /**
     * Helper to safely convert MFL payload values into Arrays
     */
    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    /**
     * Dynamically detects the logged-in franchise ID
     */
    function getLoggedInFranchiseId() {
        if (window.DNFL && window.DNFL.getLoggedInFranchiseId) {
            const fid = window.DNFL.getLoggedInFranchiseId();
            if (fid && fid !== '0000') return fid;
        }

        let fid = window.franchise_id || window.mflFranchiseId || window.login_franchise_id || window.current_franchise_id;
        
        if (!fid && window.location && window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            fid = urlParams.get('F') || urlParams.get('FRANCHISE_ID') || urlParams.get('f');
        }

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

        const normalized = normFranchiseId(fid);
        return (normalized && normalized !== '0000') ? normalized : null;
    }

    /**
     * Resolves rule set for target season year from LTS_RULES
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
     */
    function parseWeeklyScores(data) {
        const scoresByWeek = {};
        if (!data) return scoresByWeek;

        const wr = data.weeklyResults || data.weeklyResult || data.weekly_results || data;
        if (!wr) return scoresByWeek;

        let rawWeeks = null;
        if (Array.isArray(wr)) {
            rawWeeks = wr;
        } else if (typeof wr === 'object' && wr !== null) {
            if (wr.weeklyResult) {
                rawWeeks = toArray(wr.weeklyResult);
            } else if (wr.weeklyResults) {
                rawWeeks = toArray(wr.weeklyResults);
            } else if (wr.weekly_result) {
                rawWeeks = toArray(wr.weekly_result);
            } else if (wr.week || wr.matchup || wr.franchise) {
                rawWeeks = [wr];
            }
        }

        if (!rawWeeks || rawWeeks.length === 0) return scoresByWeek;

        rawWeeks.forEach((wObj, index) => {
            if (!wObj || typeof wObj !== 'object') return;

            const rawWeekVal = wObj.week || wObj.w || wObj.wk || wObj.weekNum;
            const weekNum = rawWeekVal !== undefined ? parseInt(rawWeekVal, 10) : (index + 1);
            if (isNaN(weekNum) || weekNum <= 0) return;

            scoresByWeek[weekNum] = scoresByWeek[weekNum] || {};

            const franchiseEntries = [];

            if (wObj.franchise) {
                franchiseEntries.push(...toArray(wObj.franchise));
            }

            if (wObj.matchup) {
                toArray(wObj.matchup).forEach(m => {
                    if (m) {
                        if (m.franchise) franchiseEntries.push(...toArray(m.franchise));
                        if (m.team) franchiseEntries.push(...toArray(m.team));
                    }
                });
            }

            if (wObj.team) {
                franchiseEntries.push(...toArray(wObj.team));
            }

            franchiseEntries.forEach(f => {
                if (!f) return;
                const fid = normFranchiseId(f.id || f.franchise_id || f.teamId || f.team);
                const scoreRaw = f.score !== undefined ? f.score : (f.points !== undefined ? f.points : f.pts);
                const scoreVal = parseFloat(scoreRaw);

                if (fid && !isNaN(scoreVal)) {
                    scoresByWeek[weekNum][fid] = scoreVal;
                }
            });
        });

        return scoresByWeek;
    }

    /**
     * Format numbers to clean score string (e.g. 124.50)
     */
    function formatScore(score) {
        if (score === null || score === undefined || isNaN(score)) return '-';
        return Number(score).toFixed(2);
    }

    /**
     * Helper to construct team HTML layout block matching Standings
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
     * Iterates weeks 1..lastRegWeek and fetches weeklyResults for each week in parallel via DNFLClient
     */
    async function fetchAllWeeklyScores(apiClient, year, maxRegWk) {
        const aggregatedScores = {};
        const targetWks = Math.max(1, Math.min(maxRegWk || 14, 18));
        
        console.log(`[DNFL LTS] Iterating and fetching weekly results via DNFLClient for Weeks 1 through ${targetWks} (Year: ${year})...`);
        
        const weekPromises = [];
        for (let w = 1; w <= targetWks; w++) {
            weekPromises.push(
                apiClient.fetchData("weeklyResults", { YEAR: year, W: w })
                    .then(data => {
                        if (!data) return { week: w, scores: {} };
                        const parsed = parseWeeklyScores(data);
                        const weekScores = parsed[w] || (Object.values(parsed)[0] || {});
                        return { week: w, scores: weekScores };
                    })
                    .catch(err => {
                        console.warn(`[DNFL LTS] Exception fetching Week ${w}:`, err);
                        return { week: w, scores: {} };
                    })
            );
        }
        
        const weekResults = await Promise.all(weekPromises);
        weekResults.forEach(item => {
            if (item && item.week && item.scores && Object.keys(item.scores).length > 0) {
                aggregatedScores[item.week] = item.scores;
            }
        });
        
        console.log(`[DNFL LTS] Successfully aggregated scores for ${Object.keys(aggregatedScores).length} week(s).`);
        return aggregatedScores;
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

        if (_initialized) {
            renderLtsModuleView();
            return;
        }

        const statusEl = document.getElementById("dnfl_lts_status");
        if (statusEl) {
            statusEl.className = "dnfl-status-loading";
            statusEl.textContent = "Loading Last Team Standing & Weekly High Scores data...";
        }

        try {
            activeHost = (window.DNFL && window.DNFL.getHost) ? window.DNFL.getHost() : (window.location.host || 'www48.myfantasyleague.com');
            targetYear = (window.DNFL && window.DNFL.getYear) ? window.DNFL.getYear() : String(new Date().getFullYear());
            leagueId = (window.DNFL && window.DNFL.getLeagueId) ? window.DNFL.getLeagueId() : '00000';
            loggedInFranchiseId = getLoggedInFranchiseId();

            const apiClient = window.DNFLClient || (window.DNFL && window.DNFL.Client) || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
            if (!apiClient) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(init, 100);
                    return;
                }
                throw new Error("DNFLClient API middleware unavailable.");
            }

            // Fetch League details and Rules config in parallel
            const [leagueResponse, rawRulesJson] = await Promise.all([
                apiClient.fetchData("league", { YEAR: targetYear }),
                apiClient.fetchRawText(RULES_URL).catch(err => {
                    console.warn("[DNFL LTS] Could not load lts_rules.json, using fallback rules.", err);
                    return null;
                })
            ]);

            if (!leagueResponse) {
                throw new Error("Missing league configuration payload from MFL API.");
            }

            if (rawRulesJson) {
                if (typeof rawRulesJson === 'object') {
                    LTS_RULES = rawRulesJson;
                } else if (typeof rawRulesJson === 'string') {
                    try {
                        LTS_RULES = JSON.parse(rawRulesJson);
                    } catch (e) {
                        console.error("[DNFL LTS] Corrupted lts_rules.json format. Fallback engaged.", e);
                    }
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

            // Map franchises to normalized conference IDs
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

                const exists = cachedConferences.some(c => norm(c.id) === norm(f.confId));
                if (!exists && cachedConferences.length > 0) {
                    f.confId = norm(cachedConferences[0].id);
                }
            });

            // Iterate weeks 1 through cachedLastRegWeek and fetch all weekly scores concurrently via DNFLClient
            cachedWeeklyScores = await fetchAllWeeklyScores(apiClient, targetYear, cachedLastRegWeek);

            _initialized = true;

            console.log(`[DNFL LTS] Loaded ${cachedFranchises.length} franchises across ${cachedConferences.length} conference(s). Total scores parsed for ${Object.keys(cachedWeeklyScores).length} week(s).`);

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

    function setupConferenceDropdown() {
        const selectEl = document.getElementById("dnfl_lts_confFilter");
        if (!selectEl) return;

        selectEl.innerHTML = "";

        let defaultConfId = cachedConferences[0]?.id || "00";

        if (loggedInFranchiseId) {
            const userFranchise = cachedFranchises.find(f => f.id === loggedInFranchiseId);
            if (userFranchise && userFranchise.confId) {
                defaultConfId = userFranchise.confId;
            }
        }

        selectedConferenceId = norm(defaultConfId);

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

    function renderLtsModuleView() {
        let confId = selectedConferenceId || norm(cachedConferences[0]?.id) || "00";
        const yrRules = getYearRules();
        
        let confTeams = cachedFranchises.filter(f => norm(f.confId) === norm(confId));

        if (confTeams.length === 0 && cachedConferences.length > 0) {
            const validConf = cachedConferences.find(c => cachedFranchises.some(f => norm(f.confId) === norm(c.id)));
            if (validConf) {
                confId = norm(validConf.id);
                selectedConferenceId = confId;
                confTeams = cachedFranchises.filter(f => norm(f.confId) === norm(confId));
            } else {
                confTeams = cachedFranchises;
            }
        }

        const confRules = getConfRules(yrRules, confId);
        const ltsEnabled = confRules.ltsEnabled !== false;
        const highLowEnabled = confRules.highLowEnabled !== false;

        let startWeek = 1;
        if (typeof confRules.startWeek === 'number') {
            startWeek = confRules.startWeek;
        } else if (confRules.startWeek && confRules.startWeek !== 'auto') {
            const parsed = parseInt(confRules.startWeek, 10);
            if (!isNaN(parsed)) startWeek = parsed;
        } else {
            startWeek = Math.max(1, cachedLastRegWeek - Math.max(0, confTeams.length - 1));
        }

        const simulationResults = runLtsSimulation(confTeams, startWeek, ltsEnabled, highLowEnabled);

        renderCrossGridMatrix(confTeams, simulationResults, confRules);
        renderGraveyardTable(simulationResults, confRules);
    }

    function runLtsSimulation(confTeams, startWeek, ltsEnabled, highLowEnabled) {
        const teamStates = {};
        confTeams.forEach(f => {
            teamStates[f.id] = {
                franchise: f,
                eliminatedWeek: null,
                knockoutScore: null
            };
        });

        const weeklyStats = {};
        const availableWeeks = Object.keys(cachedWeeklyScores).map(w => parseInt(w, 10)).filter(w => !isNaN(w) && w > 0);
        const maxScoreWeek = availableWeeks.length > 0 ? Math.max(...availableWeeks) : 0;
        const effectiveCurrentWeek = Math.max(cachedCurrentWeek, maxScoreWeek);
        const maxSimWeek = Math.min(effectiveCurrentWeek, cachedLastRegWeek);

        for (let w = 1; w <= maxSimWeek; w++) {
            const scoresThisWeek = cachedWeeklyScores[w] || {};
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

            let highScorer = confScoresThisWeek[0];
            confScoresThisWeek.forEach(item => {
                if (item.score > highScorer.score) {
                    highScorer = item;
                }
            });

            let lowestOverall = confScoresThisWeek[0];
            confScoresThisWeek.forEach(item => {
                if (item.score < lowestOverall.score) {
                    lowestOverall = item;
                }
            });

            let knockedOutTeam = null;
            if (ltsEnabled && w >= startWeek) {
                const activeScores = confScoresThisWeek.filter(item => !item.isEliminatedBeforeWeek);
                if (activeScores.length > 1) {
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

    function renderCrossGridMatrix(confTeams, simulation, confRules) {
        const thead = document.getElementById("dnfl_lts_crossGridThead");
        const tbody = document.getElementById("dnfl_lts_crossGridTbody");
        if (!thead || !tbody) return;

        const { teamStates, weeklyStats, ltsEnabled, highLowEnabled } = simulation;

        let headerHtml = `<tr><th>Franchise</th>`;
        for (let w = 1; w <= cachedLastRegWeek; w++) {
            headerHtml += `<th style="text-align: center;">W${w}</th>`;
        }
        headerHtml += `</tr>`;
        thead.innerHTML = headerHtml;

        let bodyHtml = "";

        confTeams.forEach(f => {
            const state = teamStates[f.id] || {};
            const isMyTeam = loggedInFranchiseId && normFranchiseId(f.id) === normFranchiseId(loggedInFranchiseId);
            const rowClass = isMyTeam ? "dnfl-my-team" : "";

            bodyHtml += `<tr class="${rowClass}">`;
            bodyHtml += `<td>${formatFranchiseCellHtml(f)}</td>`;

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
                    cellStyle = `background-color: ${confRules.cellEliminatedBg || "var(--dnfl-lts-bg-eliminated, #f1f5f9)"}; color: ${confRules.textEliminatedColor || "var(--dnfl-lts-text-eliminated, #64748b)"}; text-align: center;`;

                    if (isLowestOverall) {
                        cellContent = `<span class="${confRules.textPostElimLowClass || 'dnfl-lts-text-post-elim-low'}">${scoreStr}</span>`;
                    } else {
                        cellContent = scoreStr;
                    }
                } else if (wasKnockedOutThisWeek) {
                    cellStyle = `background-color: ${confRules.cellActiveBg || "var(--dnfl-bg-card, #ffffff)"}; text-align: center;`;
                    cellContent = `<span class="${confRules.badgeKnockoutClass || 'dnfl-lts-badge-knockout'}"><i class="fas fa-skull"></i> ${scoreStr}</span>`;
                } else if (isHighScorer) {
                    cellStyle = `background-color: ${confRules.cellActiveBg || "var(--dnfl-bg-card, #ffffff)"}; text-align: center;`;
                    cellContent = `<span class="${confRules.badgeHighScoreClass || 'dnfl-lts-badge-high-score'}"><i class="fas fa-crown"></i> ${scoreStr}</span>`;
                } else if (!ltsEnabled && highLowEnabled && isLowestOverall) {
                    cellStyle = `background-color: ${confRules.cellActiveBg || "var(--dnfl-bg-card, #ffffff)"}; text-align: center;`;
                    cellContent = `<span class="${confRules.badgeKnockoutClass || 'dnfl-lts-badge-knockout'}">${scoreStr}</span>`;
                } else {
                    cellStyle = `background-color: ${confRules.cellActiveBg || "var(--dnfl-bg-card, #ffffff)"}; text-align: center;`;
                    cellContent = scoreStr;
                }

                bodyHtml += `<td style="${cellStyle}">${cellContent}</td>`;
            }

            bodyHtml += `</tr>`;
        });

        tbody.innerHTML = bodyHtml;
    }

    function renderGraveyardTable(simulation, confRules) {
        const tbody = document.getElementById("dnfl_lts_graveyardTbody");
        const thead = document.getElementById("dnfl_lts_graveyardThead");
        if (!tbody || !thead) return;

        const { weeklyStats, startWeek, maxSimWeek, ltsEnabled, highLowEnabled } = simulation;

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
            bodyHtml += `<td style="text-align: center; font-weight: bold;">Week ${w}</td>`;

            if (lowTeam) {
                bodyHtml += `<td>${formatFranchiseCellHtml(lowTeam)}</td>`;
            } else {
                bodyHtml += `<td><span class="dnfl-text-subtle">${w < startWeek && ltsEnabled ? 'LTS Starts W' + startWeek : 'No Knockout'}</span></td>`;
            }

            if (lowScoreVal !== null && lowScoreVal !== undefined) {
                const iconHtml = ltsEnabled ? `<i class="fas fa-skull"></i> ` : ``;
                bodyHtml += `<td style="text-align: center;"><span class="${confRules.badgeKnockoutClass || 'dnfl-lts-badge-knockout'}">${iconHtml}${formatScore(lowScoreVal)}</span></td>`;
            } else {
                bodyHtml += `<td style="text-align: center; color: var(--dnfl-text-muted);">-</td>`;
            }

            if (highTeam && highLowEnabled) {
                bodyHtml += `<td>${formatFranchiseCellHtml(highTeam)}</td>`;
            } else {
                bodyHtml += `<td><span class="dnfl-text-subtle">N/A</span></td>`;
            }

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

    // Export module onto the window.DNFL namespace
    const LTSModule = {
        init: init,
        updateLtsView: function(confId) {
            if (confId) selectedConferenceId = confId;
            renderLtsModuleView();
        },
        getLoggedInFranchiseId: getLoggedInFranchiseId,
        getRules: getYearRules
    };

    window.DNFL.LTS = LTSModule;

    // Register with master framework loader if available
    if (window.DNFL && window.DNFL.registerModule) {
        window.DNFL.registerModule('lts', LTSModule);
    } else if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(init, 10);
    } else {
        document.addEventListener("DOMContentLoaded", init);
    }
})();
