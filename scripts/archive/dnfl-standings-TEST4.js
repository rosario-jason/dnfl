/* ==========================================================================
   DNFL Dynamic Standings & Seeding Engine (v3.00-TEST4)
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */

(function () {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    // Standings & Seeding Configuration (Loaded dynamically from standings_rules.json)
    let STANDINGS_RULES = {};

    // Standardized ID Normalization Utilities (Delegating to DNFL.Utils framework helpers)
    function norm(val) {
        if (window.DNFL && window.DNFL.Utils && window.DNFL.Utils.pad2) {
            return window.DNFL.Utils.pad2(val);
        }
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    function normFranchiseId(val) {
        if (window.DNFL && window.DNFL.Utils && window.DNFL.Utils.pad4) {
            return window.DNFL.Utils.pad4(val);
        }
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    /**
     * Dynamic Season Year Resolution
     * Evaluates active season dynamically on execution rather than static script load.
     */
    function getActiveYear() {
        if (window.DNFL && window.DNFL.Client && window.DNFL.Client.getContext) {
            const ctx = window.DNFL.Client.getContext();
            if (ctx && ctx.year) return String(ctx.year);
        }
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        if (foundYear) return foundYear;

        const urlParams = new URLSearchParams(window.location.search);
        const qYear = urlParams.get('YEAR') || urlParams.get('year');
        if (qYear) return qYear;

        const winYear = window.current_year || window.mflYear || window.year;
        if (winYear) return String(winYear);

        return new Date().getFullYear().toString();
    }

    /**
     * Context Resolution Helper
     */
    function getContext() {
        if (window.DNFL && window.DNFL.Client && window.DNFL.Client.getContext) {
            return window.DNFL.Client.getContext();
        }
        const urlParams = new URLSearchParams(window.location.search);
        return {
            year: getActiveYear(),
            leagueId: urlParams.get('L') || window.league_id || '22883'
        };
    }

    let targetYear = getActiveYear();
    let leagueId = '22883';
    const activeHost = window.location.hostname || "myfantasyleague.com";

    // State Caches
    let cachedConferences = [];
    let cachedDivisions = [];
    let cachedLeagueDetails = [];
    let cachedStandingsFranchises = [];
    let weeklyPaMap = {};

    // Dynamic Week Trackers
    let cachedLastRegWeek = 14;   
    let cachedCurrentWeek = 1;
    let hasSeasonStarted = false; 

    let teamSeeds = {};
    let divLeaders = {};
    let divRunnerUps = {};
    let relegatedTeamIds = new Set();
    let promotedTeamIds = new Set();

    /**
     * Dynamically detects the logged-in franchise ID across all MFL environments
     */
    function getLoggedInFranchiseId() {
        if (window.DNFL && window.DNFL.currentFranchiseId) {
            return normFranchiseId(window.DNFL.currentFranchiseId);
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

        if (!fid) {
            const myTeamLink = document.querySelector('a[href*="O=01"], a[href*="O=02"], a[href*="F="]');
            if (myTeamLink && myTeamLink.href) {
                const hrefMatch = myTeamLink.href.match(/[?&]F=(\d{4})/i);
                if (hrefMatch && hrefMatch[1]) {
                    fid = hrefMatch[1];
                }
            }
        }

        if (!fid) {
            const inputEl = document.querySelector('input[name="FRANCHISE_ID"], select[name="FRANCHISE_ID"]');
            if (inputEl) fid = inputEl.value;
        }

        const normalized = normFranchiseId(fid);
        return (normalized && normalized !== '0000') ? normalized : null;
    }

    /**
     * Resolves rule set for target season year from STANDINGS_RULES
     */
    function getYearRules() {
        const yr = parseInt(targetYear);
        if (STANDINGS_RULES[yr]) return STANDINGS_RULES[yr];

        for (const key in STANDINGS_RULES) {
            if (key.startsWith('_')) continue;

            if (key.includes('-')) {
                const [start, end] = key.split('-').map(s => parseInt(s.trim()));
                if (yr >= start && yr <= end) return STANDINGS_RULES[key];
            }
            if (key.includes(',')) {
                const yearList = key.split(',').map(s => parseInt(s.trim()));
                if (yearList.includes(yr)) return STANDINGS_RULES[key];
            }
        }
        return STANDINGS_RULES['default'] || {};
    }

    /**
     * Deep merge resolver for conference-specific overrides
     */
    function getConfRules(baseRules, confId) {
        const normConfId = norm(confId);
        if (!normConfId || !baseRules.conferenceOverrides || !baseRules.conferenceOverrides[normConfId]) {
            return baseRules;
        }
        const override = baseRules.conferenceOverrides[normConfId];
        return {
            ...baseRules,
            ...override,
            relegation: override.relegation !== undefined 
                ? { ...baseRules.relegation, ...override.relegation } 
                : baseRules.relegation,
            promotion: override.promotion !== undefined 
                ? { ...baseRules.promotion, ...override.promotion } 
                : baseRules.promotion
        };
    }

    /**
     * Initializes standings data fetch, dynamic rules JSON, and DOM setup
     */
    async function init() {
        const tbody = document.getElementById("dnfl-standings-tbody");
        if (!tbody) return;

        // Dynamically resolve target year on execution
        targetYear = getActiveYear();
        const ctx = getContext();
        leagueId = ctx.leagueId || '22883';

        try {
            const rulesUrl = `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_standings/standings_rules.json`;
            const apiClient = (window.DNFL && window.DNFL.Client) || window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);

            if (!apiClient) {
                throw new Error("DNFL API middleware unavailable.");
            }

            const [standingsResponse, leagueResponse, rawRulesJson] = await Promise.all([
                apiClient.fetchData("leagueStandings"),
                apiClient.fetchData("league"),
                apiClient.fetchRawText(rulesUrl).catch(err => {
                    console.warn("[DNFL.Standings] Could not load standings_rules.json, using fallback rules.", err);
                    return null;
                })
            ]);

            if (!standingsResponse || !leagueResponse) {
                throw new Error("Missing structural configuration maps from MFL payload.");
            }

            if (rawRulesJson) {
                try {
                    STANDINGS_RULES = JSON.parse(rawRulesJson);
                } catch (e) {
                    console.error("[DNFL.Standings] Corrupted standings_rules.json format. Fallback engaged.", e);
                }
            }

            // Fallback default rules safety check
            if (!STANDINGS_RULES || !STANDINGS_RULES['default']) {
                STANDINGS_RULES = {
                    'default': {
                        seedingScope: 'conference',
                        seedingModel: 'standard_div_winners_first',
                        playoffCutoff: 6,
                        hasDivisionCrown: true,
                        relegation: { enabled: true, type: 'division', count: 1 },
                        promotion: { enabled: true, count: 4 }
                    }
                };
            }

            cachedStandingsFranchises = toArray(standingsResponse.leagueStandings?.franchise);
            cachedLeagueDetails = toArray(leagueResponse.league?.franchises?.franchise);
            cachedConferences = toArray(leagueResponse.league?.conferences?.conference);
            cachedDivisions = toArray(leagueResponse.league?.divisions?.division);
            
            cachedLastRegWeek = parseInt(leagueResponse.league?.lastRegularSeasonWeek || 14);
            cachedCurrentWeek = parseInt(leagueResponse.league?.currentWk) || 1;

            // Check if PA fallback calculation is needed for current season
            weeklyPaMap = {};
            const needsPaFallback = cachedStandingsFranchises.some(s => {
                const games = parseInt(s.h2hw || s.w || 0) + parseInt(s.h2hl || s.l || 0) + parseInt(s.h2ht || s.t || 0);
                const rawPaVal = parseFloat(s.pa || s.h2hpa || s.points_against || s.opp_pf || 0);
                return games > 0 && rawPaVal === 0;
            });

            if (needsPaFallback && cachedCurrentWeek >= 1) {
                try {
                    const maxWk = Math.min(cachedCurrentWeek, cachedLastRegWeek);
                    const weeklyPromises = [];
                    for (let w = 1; w <= maxWk; w++) {
                        weeklyPromises.push(apiClient.fetchData('weeklyResults', { W: w }).catch(() => null));
                    }
                    const weeklyResults = await Promise.all(weeklyPromises);

                    weeklyResults.forEach(weeklyData => {
                        if (!weeklyData?.weeklyResults) return;
                        const rawMatchups = weeklyData.weeklyResults.matchup || weeklyData.weeklyResults.matchUp || weeklyData.weeklyResults.schedule?.matchup;
                        let matchups = toArray(rawMatchups);

                        if (matchups.length === 0 && weeklyData.weeklyResults.franchise) {
                            const fList = toArray(weeklyData.weeklyResults.franchise);
                            const processedFids = new Set();
                            fList.forEach(f => {
                                const fid = normFranchiseId(f.id);
                                const oppId = normFranchiseId(f.opponent || f.opp || f.vs);
                                if (!processedFids.has(fid)) {
                                    processedFids.add(fid);
                                    if (oppId) processedFids.add(oppId);
                                    const oppObj = fList.find(o => normFranchiseId(o.id) === oppId) || {};
                                    matchups.push({ franchise: [f, oppObj] });
                                }
                            });
                        }

                        matchups.forEach(m => {
                            const franchises = toArray(m.franchise);
                            if (franchises.length >= 2) {
                                const f1Id = normFranchiseId(franchises[0].id);
                                const f2Id = normFranchiseId(franchises[1].id);
                                const f1Score = parseFloat(franchises[0].score || 0);
                                const f2Score = parseFloat(franchises[1].score || 0);

                                weeklyPaMap[f1Id] = (weeklyPaMap[f1Id] || 0) + f2Score;
                                weeklyPaMap[f2Id] = (weeklyPaMap[f2Id] || 0) + f1Score;
                            }
                        });
                    });
                } catch (e) {
                    console.warn("[DNFL.Standings] Exception during PA fallback calculation:", e);
                }
            }

            calculateSeedsAndBadges();
            setupDropdown();
            updateDnflStandingsView(); 

        } catch (error) {
            console.error("[DNFL.Standings] Initialization Error:", error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--dnfl-alert-red); padding: 2rem;">Error loading standings.</td></tr>`;
        }
    }

    /**
     * Renders legend keys and disclaimers using CSS utility classes
     */
    function renderStandingsKey(confRules) {
        const keyContainer = document.getElementById("dnfl-standings-key");
        if (!keyContainer) return;

        let iconHtml = `<div class="dnfl-key-icon-group">`;
        
        if (confRules.hasDivisionCrown) {
            iconHtml += `<span class="dnfl-key-item"><i class="fas fa-crown" style="color: var(--dnfl-badge-blue);"></i> Div Winner</span>`;
        }
        if (confRules.playoffCutoff) {
            iconHtml += `<span class="dnfl-key-item"><i class="fas fa-trophy" style="color: var(--dnfl-badge-amber);"></i> Playoffs</span>`;
        }
        if (confRules.promotion?.enabled) {
            iconHtml += `<span class="dnfl-key-item"><i class="fas fa-arrow-circle-up" style="color: var(--dnfl-success-green);"></i> Promotion</span>`;
        }
        if (confRules.relegation?.enabled) {
            iconHtml += `<span class="dnfl-key-item"><i class="fas fa-arrow-circle-down" style="color: var(--dnfl-alert-red);"></i> Relegation</span>`;
        }
        
        iconHtml += `</div>`;

        let disclaimerHtml = '';
        const currentYearNum = new Date().getFullYear();
        const parsedTargetYear = parseInt(targetYear);
        const isHistoric = parsedTargetYear < currentYearNum;
        const isEndOfSeason = cachedCurrentWeek > cachedLastRegWeek;

        if (!hasSeasonStarted) {
            disclaimerHtml = `<div class="dnfl-disclaimer-note">*Pre-season view. Seedings and icons will calculate after Week 1 games complete.</div>`;
        } else if (isHistoric || isEndOfSeason) {
            disclaimerHtml = `<div class="dnfl-disclaimer-note">*Final Regular Season Seedings.</div>`;
        } else {
            disclaimerHtml = `<div class="dnfl-disclaimer-note">*Preliminary seedings as of Week ${cachedCurrentWeek} standings. Subject to change until Week ${cachedLastRegWeek}.</div>`;
        }

        keyContainer.innerHTML = iconHtml + disclaimerHtml;
    }

    /**
     * Seeding & Qualification Engine with ID Normalization
     */
    function calculateSeedsAndBadges() {
        teamSeeds = {};
        divLeaders = {};
        divRunnerUps = {};
        relegatedTeamIds.clear();
        promotedTeamIds.clear();

        const baseRules = getYearRules();

        hasSeasonStarted = cachedStandingsFranchises.some(s => {
            const games = parseInt(s.h2hw || 0) + parseInt(s.h2hl || 0) + parseInt(s.h2ht || 0);
            const pf = parseFloat(s.pf || 0);
            return games > 0 || pf > 0;
        });

        if (!hasSeasonStarted) return;

        const divToConfMap = {};
        cachedDivisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

        const getMflIndex = (id) => cachedStandingsFranchises.findIndex(s => normFranchiseId(s.id) === normFranchiseId(id));
        
        const getPf = (id) => {
            const s = cachedStandingsFranchises.find(item => normFranchiseId(item.id) === normFranchiseId(id));
            return parseFloat(s?.pf || 0);
        };

        const sortByPfThenMfl = (a, b) => {
            const pfDiff = getPf(b) - getPf(a);
            if (pfDiff !== 0) return pfDiff;
            return getMflIndex(a) - getMflIndex(b);
        };

        cachedDivisions.forEach(div => {
            const divIdNorm = norm(div.id);
            const confIdNorm = norm(div.conference);
            const confRules = getConfRules(baseRules, confIdNorm);
            const teamsInDiv = cachedLeagueDetails.filter(f => norm(f.division) === divIdNorm).map(f => f.id);
            teamsInDiv.sort((a, b) => getMflIndex(a) - getMflIndex(b));

            if (teamsInDiv.length > 0) divLeaders[divIdNorm] = teamsInDiv[0];
            if (teamsInDiv.length > 1) divRunnerUps[divIdNorm] = teamsInDiv[1];

            if (confRules.relegation?.enabled && confRules.relegation.type === 'division') {
                const bottomCount = confRules.relegation.count || 1;
                const bottomTeams = teamsInDiv.slice(-bottomCount);
                bottomTeams.forEach(id => relegatedTeamIds.add(normFranchiseId(id)));
            }
        });

        let scopesToProcess = [];
        
        if (baseRules.seedingScope === 'league') {
            scopesToProcess.push({
                scopeId: 'league',
                teams: cachedLeagueDetails.map(f => f.id),
                leaders: Object.values(divLeaders),
                runnersUp: Object.values(divRunnerUps)
            });
        } else {
            cachedConferences.forEach(conf => {
                const confIdNorm = norm(conf.id);
                const confTeams = cachedLeagueDetails.filter(f => (norm(f.conference) === confIdNorm) || (divToConfMap[norm(f.division)] === confIdNorm)).map(f => f.id);
                const confDivs = cachedDivisions.filter(d => norm(d.conference) === confIdNorm).map(d => norm(d.id));
                const confLeaders = confDivs.map(dId => divLeaders[dId]).filter(id => id !== undefined);
                const confRunners = confDivs.map(dId => divRunnerUps[dId]).filter(id => id !== undefined);
                
                scopesToProcess.push({
                    scopeId: confIdNorm,
                    teams: confTeams,
                    leaders: confLeaders,
                    runnersUp: confRunners
                });
            });
        }

        if (baseRules.seedingModel === 'manual' && baseRules.manualSeeds) {
            teamSeeds = baseRules.manualSeeds;
        } else {
            scopesToProcess.forEach(scope => {
                const confRules = scope.scopeId !== 'league' ? getConfRules(baseRules, scope.scopeId) : baseRules;

                if (confRules.seedingModel === 'tiered_div_finish_pf') {
                    const winners = scope.leaders;
                    winners.sort(sortByPfThenMfl);
                    winners.forEach((id, idx) => teamSeeds[normFranchiseId(id)] = idx + 1);

                    const runners = scope.runnersUp;
                    runners.sort(sortByPfThenMfl);
                    runners.forEach((id, idx) => teamSeeds[normFranchiseId(id)] = idx + 1 + winners.length);

                    const assigned = new Set([...winners, ...runners]);
                    const remaining = scope.teams.filter(id => !assigned.has(id));
                    remaining.sort(sortByPfThenMfl);
                    remaining.forEach((id, idx) => teamSeeds[normFranchiseId(id)] = idx + 1 + winners.length + runners.length);
                
                } else if (confRules.seedingModel === 'standard_div_winners_first') {
                    const winners = scope.leaders;
                    winners.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    winners.forEach((id, idx) => teamSeeds[normFranchiseId(id)] = idx + 1);

                    const remaining = scope.teams.filter(id => !winners.includes(id));
                    remaining.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    remaining.forEach((id, idx) => teamSeeds[normFranchiseId(id)] = idx + 1 + winners.length);
                
                } else if (confRules.seedingModel === 'mfl_native') {
                    const allTeams = scope.teams.slice();
                    allTeams.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    allTeams.forEach((id, idx) => teamSeeds[normFranchiseId(id)] = idx + 1);
                }
            });
        }

        cachedConferences.forEach(conf => {
            const confIdNorm = norm(conf.id);
            const confRules = getConfRules(baseRules, confIdNorm);
            const confTeams = cachedLeagueDetails.filter(f => (norm(f.conference) === confIdNorm) || (divToConfMap[norm(f.division)] === confIdNorm)).map(f => f.id);
            
            confTeams.sort((a, b) => getMflIndex(a) - getMflIndex(b));

            if (confRules.relegation?.enabled && confRules.relegation.type === 'conference') {
                const bottomCount = confRules.relegation.count || 1;
                const bottomTeams = confTeams.slice(-bottomCount);
                bottomTeams.forEach(id => relegatedTeamIds.add(normFranchiseId(id)));
            }

            if (confRules.promotion?.enabled) {
                const topCount = confRules.promotion.count || 1;
                const topTeams = confTeams.slice(0, topCount);
                topTeams.forEach(id => promotedTeamIds.add(normFranchiseId(id)));
            }
        });
    }

    /**
     * Set up conference filter dropdown options
     */
    function setupDropdown() {
        const select = document.getElementById("dnfl_standings_confFilter");
        if (!select) return;

        select.innerHTML = '';

        const allOpt = document.createElement("option");
        allOpt.value = "all";
        allOpt.textContent = "All Conferences";
        select.appendChild(allOpt);

        cachedConferences.forEach(conf => {
            const opt = document.createElement("option");
            opt.value = norm(conf.id);
            opt.textContent = conf.name || `Conference ${conf.id}`;
            select.appendChild(opt);
        });

        // Auto-select user's conference if available
        const loggedInFid = getLoggedInFranchiseId();
        let targetConf = 'all';

        if (loggedInFid) {
            const userFranchise = cachedLeagueDetails.find(f => normFranchiseId(f.id) === loggedInFid);
            if (userFranchise) {
                if (userFranchise.conference) {
                    targetConf = norm(userFranchise.conference);
                } else if (userFranchise.division) {
                    const divObj = cachedDivisions.find(d => norm(d.id) === norm(userFranchise.division));
                    if (divObj) targetConf = norm(divObj.conference);
                }
            }
        }

        select.value = targetConf;
        select.onchange = () => updateDnflStandingsView();
    }

    /**
     * Constructs HTML row for an individual team
     */
    function buildTeamRowHtml(fDetails, standingsFranchise, isMyTeam, confRules) {
        const fId = normFranchiseId(fDetails.id);
        const seed = teamSeeds[fId];
        const isDivWinner = Object.values(divLeaders).map(id => normFranchiseId(id)).includes(fId);

        let badgeHtml = '';
        if (confRules.hasDivisionCrown && isDivWinner) {
            badgeHtml += `<i class="fas fa-crown dnfl-badge-crown" title="Division Winner"></i> `;
        }
        if (confRules.playoffCutoff && seed && seed <= confRules.playoffCutoff) {
            badgeHtml += `<i class="fas fa-trophy dnfl-badge-trophy" title="Playoff Qualifier"></i> `;
        }
        if (promotedTeamIds.has(fId)) {
            badgeHtml += `<i class="fas fa-arrow-circle-up dnfl-badge-promotion" title="Promoted"></i> `;
        }
        if (relegatedTeamIds.has(fId)) {
            badgeHtml += `<i class="fas fa-arrow-circle-down dnfl-badge-relegation" title="Relegated"></i> `;
        }

        const name = fDetails.name || `Franchise ${fDetails.id}`;
        const owner = fDetails.owner_name ? `<span class="dnfl-owner-subtitle">${fDetails.owner_name}</span>` : '';
        const logo = fDetails.icon ? `<img src="${fDetails.icon}" class="dnfl-team-logo" alt="">` : '';

        const pf = parseFloat(standingsFranchise?.pf || 0).toFixed(2);
        
        let paVal = parseFloat(standingsFranchise?.pa || standingsFranchise?.h2hpa || standingsFranchise?.points_against || standingsFranchise?.opp_pf || 0);
        if (paVal === 0 && weeklyPaMap[fId]) {
            paVal = weeklyPaMap[fId];
        }
        const pa = paVal.toFixed(2);

        const wins = standingsFranchise?.h2hw || standingsFranchise?.w || 0;
        const losses = standingsFranchise?.h2hl || standingsFranchise?.l || 0;
        const ties = standingsFranchise?.h2ht || standingsFranchise?.t || 0;
        const recordStr = `${wins}-${losses}-${ties}`;

        const bbid = parseFloat(fDetails.bbidAvailableAmount || fDetails.bbid || 0).toFixed(2);

        const myClass = isMyTeam ? 'dnfl-myfranchise dnfl-my-team' : '';
        const targetHref = `https://${activeHost}/${targetYear}/options?L=${leagueId}&F=${fDetails.id}&O=01`;

        return `
            <tr class="${myClass}">
                <td class="dnfl-rank-cell">
                    <span class="dnfl-rank-circle">${seed || '-'}</span>
                    ${badgeHtml}
                </td>
                <td class="dnfl-team-cell">
                    <div class="dnfl-team-info">
                        ${logo}
                        <div class="dnfl-team-names">
                            <a href="${targetHref}" target="_top" class="dnfl-team-title">${name}</a>
                            ${owner}
                        </div>
                    </div>
                </td>
                <td class="dnfl-num-cell">${pf}</td>
                <td class="dnfl-num-cell">${pa}</td>
                <td class="dnfl-record-cell">
                    <span class="dnfl-record-badge">${recordStr}</span>
                </td>
                <td class="dnfl-num-cell">$${bbid}</td>
            </tr>
        `;
    }

    /**
     * Updates the DOM table view based on conference/division filters
     */
    function updateDnflStandingsView() {
        const tbody = document.getElementById("dnfl-standings-tbody");
        const select = document.getElementById("dnfl_standings_confFilter");
        if (!tbody) return;

        const selectedConf = select ? select.value : 'all';
        const baseRules = getYearRules();
        const confRules = getConfRules(baseRules, selectedConf);

        renderStandingsKey(confRules);

        const loggedInFid = getLoggedInFranchiseId();
        let html = '';

        let targetConfs = cachedConferences;
        if (selectedConf !== 'all') {
            targetConfs = cachedConferences.filter(c => norm(c.id) === norm(selectedConf));
        }

        if (targetConfs.length === 0) {
            // If no explicit conferences defined, render overall flat view
            const sortedFranchises = cachedLeagueDetails.slice().sort((a, b) => {
                const sA = teamSeeds[normFranchiseId(a.id)] || 999;
                const sB = teamSeeds[normFranchiseId(b.id)] || 999;
                return sA - sB;
            });

            sortedFranchises.forEach(f => {
                const st = cachedStandingsFranchises.find(s => normFranchiseId(s.id) === normFranchiseId(f.id));
                const isMyTeam = normFranchiseId(f.id) === loggedInFid;
                html += buildTeamRowHtml(f, st, isMyTeam, baseRules);
            });
        } else {
            targetConfs.forEach(conf => {
                const confIdNorm = norm(conf.id);
                const confDivs = cachedDivisions.filter(d => norm(d.conference) === confIdNorm);

                if (confDivs.length > 0) {
                    confDivs.forEach(div => {
                        const divIdNorm = norm(div.id);
                        const teamsInDiv = cachedLeagueDetails.filter(f => norm(f.division) === divIdNorm);

                        teamsInDiv.sort((a, b) => {
                            const sA = teamSeeds[normFranchiseId(a.id)] || 999;
                            const sB = teamSeeds[normFranchiseId(b.id)] || 999;
                            return sA - sB;
                        });

                        html += `
                            <tr class="dnfl-division-header-row" data-div-id="${divIdNorm}">
                                <td colspan="6" class="dnfl-division-header-cell">
                                    <div class="dnfl-div-header-content">
                                        <span class="dnfl-div-title">${div.name || `Division ${div.id}`}</span>
                                        <button class="dnfl-div-toggle-btn" onclick="DNFL.Standings.toggleDivision('${divIdNorm}')">Hide</button>
                                    </div>
                                </td>
                            </tr>
                        `;

                        teamsInDiv.forEach(f => {
                            const st = cachedStandingsFranchises.find(s => normFranchiseId(s.id) === normFranchiseId(f.id));
                            const isMyTeam = normFranchiseId(f.id) === loggedInFid;
                            html += buildTeamRowHtml(f, st, isMyTeam, getConfRules(baseRules, confIdNorm));
                        });
                    });
                } else {
                    const teamsInConf = cachedLeagueDetails.filter(f => norm(f.conference) === confIdNorm);
                    teamsInConf.sort((a, b) => {
                        const sA = teamSeeds[normFranchiseId(a.id)] || 999;
                        const sB = teamSeeds[normFranchiseId(b.id)] || 999;
                        return sA - sB;
                    });

                    teamsInConf.forEach(f => {
                        const st = cachedStandingsFranchises.find(s => normFranchiseId(s.id) === normFranchiseId(f.id));
                        const isMyTeam = normFranchiseId(f.id) === loggedInFid;
                        html += buildTeamRowHtml(f, st, isMyTeam, getConfRules(baseRules, confIdNorm));
                    });
                }
            });
        }

        tbody.innerHTML = html;
    }

    /**
     * Toggles visibility of division rows
     */
    function toggleDivision(divId) {
        const normDivId = norm(divId);
        const headerRow = document.querySelector(`.dnfl-division-header-row[data-div-id="${normDivId}"]`);
        if (!headerRow) return;

        const btn = headerRow.querySelector('.dnfl-div-toggle-btn');
        let nextRow = headerRow.nextElementSibling;
        let isHiding = btn ? btn.textContent === 'Hide' : false;

        while (nextRow && !nextRow.classList.contains('dnfl-division-header-row')) {
            nextRow.style.display = isHiding ? 'none' : '';
            nextRow = nextRow.nextElementSibling;
        }

        if (btn) {
            btn.textContent = isHiding ? 'Show' : 'Hide';
        }
    }

    /**
     * Framework Auto-Init Lifecycle
     */
    function autoInit() {
        if (document.getElementById('dnfl-standings-tbody') || document.getElementById('dnfl_standings_confFilter')) {
            init();
        }
    }

    // Register Event Listeners
    window.addEventListener('dnfl:ready', autoInit);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

    // Export Module API to Global Scope
    window.DNFL.Standings = {
        init,
        updateView: updateDnflStandingsView,
        toggleDivision
    };

})();
