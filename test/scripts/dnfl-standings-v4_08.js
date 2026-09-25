/* ==========================================================================
   DNFL Dynamic Standings & Seeding Engine v4.08 (Architecture Aligned)
   Duke Networking Fantasy League (DNFL)
   Fully aligned with dnfl-global-v3_36.css & _test_v4_42.scss design tokens.
   Supports dynamic API metadata fetch via DNFL.Client, standings_rules.json,
   auto logged-in owner highlight, resilient data-index zebra striping,
   uniform square rank badges, green/red PF/PA badges, dynamic titles, and repeating subheaders.
   ========================================================================== */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};

    let STANDINGS_RULES = {};
    const activeHost = window.location.hostname || "myfantasyleague.com";

    let targetYear = window.current_year || null;
    if (!targetYear) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear().toString();
    }

    function norm(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    function normFranchiseId(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function getApiClient() {
        return (window.DNFL && window.DNFL.Client) || window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
    }

    function getLeagueId() {
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.getContext === 'function') {
            return window.DNFL.Client.getContext().leagueId;
        }
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('L') || urlParams.get('l') || window.league_id || window.mflLeagueId || '22883';
    }

    function getLoggedInFranchiseId() {
        let fid = window.franchise_id || window.mflFranchiseId || window.login_franchise_id || window.current_franchise_id;
        if (!fid && window.DNFLClient && typeof window.DNFLClient.getFranchiseId === 'function') {
            fid = window.DNFLClient.getFranchiseId();
        }
        if (!fid && window.location && window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            fid = urlParams.get('F') || urlParams.get('FRANCHISE_ID') || urlParams.get('f');
        }
        if (!fid && document.cookie) {
            const cookieMatch = document.cookie.match(/(?:MFL_USER_ID|MFL_FRANCHISE_ID|franchise_id)=([^;]+)/i);
            if (cookieMatch && cookieMatch[1]) {
                const rawCookieVal = decodeURIComponent(cookieMatch[1]);
                const idMatch = rawCookieVal.match(/(?:u%3D|u=)?(\d{4})/i);
                if (idMatch && idMatch[1]) fid = idMatch[1];
            }
        }
        if (!fid) {
            const myTeamLink = document.querySelector('a[href*="O=01"], a[href*="O=02"], a[href*="F="]');
            if (myTeamLink && myTeamLink.href) {
                const hrefMatch = myTeamLink.href.match(/[?&]F=(\d{4})/i);
                if (hrefMatch && hrefMatch[1]) fid = hrefMatch[1];
            }
        }
        if (!fid) {
            const inputEl = document.querySelector('input[name="FRANCHISE_ID"], select[name="FRANCHISE_ID"]');
            if (inputEl) fid = inputEl.value;
        }
        const normalized = normFranchiseId(fid);
        return (normalized && normalized !== '0000') ? normalized : null;
    }

    // State Caches
    let cachedConferences = [];
    let cachedDivisions = [];
    let cachedLeagueDetails = [];
    let cachedStandingsFranchises = [];
    let weeklyPaMap = {};
    let cachedLastRegWeek = 14;
    let cachedCurrentWeek = 1;
    let hasSeasonStarted = false;

    let teamSeeds = {};
    let divLeaders = {};
    let divRunnerUps = {};
    let relegatedTeamIds = new Set();
    let promotedTeamIds = new Set();

    let retryCount = 0;
    const maxRetries = 50;

    function getYearRules() {
        const yr = parseInt(targetYear, 10);
        if (STANDINGS_RULES[yr]) return STANDINGS_RULES[yr];

        for (const key in STANDINGS_RULES) {
            if (key.startsWith('_')) continue;
            if (key.includes('-')) {
                const [start, end] = key.split('-').map(s => parseInt(s.trim(), 10));
                if (yr >= start && yr <= end) return STANDINGS_RULES[key];
            }
            if (key.includes(',')) {
                const yearList = key.split(',').map(s => parseInt(s.trim(), 10));
                if (yearList.includes(yr)) return STANDINGS_RULES[key];
            }
        }
        return STANDINGS_RULES['default'] || {};
    }

    function getConfRules(baseRules, confId) {
        const normConfId = norm(confId);
        if (!normConfId || !baseRules.conferenceOverrides || !baseRules.conferenceOverrides[normConfId]) {
            return baseRules;
        }
        const override = baseRules.conferenceOverrides[normConfId];
        return {
            ...baseRules,
            ...override,
            relegation: override.relegation !== undefined ? { ...baseRules.relegation, ...override.relegation } : baseRules.relegation,
            promotion: override.promotion !== undefined ? { ...baseRules.promotion, ...override.promotion } : baseRules.promotion
        };
    }

    async function init() {
        const tbody = document.getElementById("dnfl-standings-tbody");
        if (!tbody) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        try {
            const rulesUrl = "https://dnfl.live/dnfl_standings/standings_rules.json";
            const apiClient = getApiClient();
            if (!apiClient) {
                throw new Error("DNFL API middleware unavailable.");
            }

            const [standingsResponse, leagueResponse, rawRulesJson] = await Promise.all([
                apiClient.fetchData("leagueStandings"),
                apiClient.fetchData("league"),
                apiClient.fetchRawText(rulesUrl).catch(err => {
                    console.warn("[DNFL Standings] Could not load standings_rules.json, using fallback rules.", err);
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
                    console.error("[DNFL Standings] Corrupted standings_rules.json format. Fallback engaged.", e);
                }
            }

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

            cachedLastRegWeek = parseInt(leagueResponse.league?.lastRegularSeasonWeek || 14, 10);
            cachedCurrentWeek = parseInt(leagueResponse.league?.currentWk, 10) || 1;

            // PA Fallback Calculation
            weeklyPaMap = {};
            const needsPaFallback = cachedStandingsFranchises.some(s => {
                const games = parseInt(s.h2hw || s.w || 0, 10) + parseInt(s.h2hl || s.l || 0, 10) + parseInt(s.h2ht || s.t || 0, 10);
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
                    console.warn("[DNFL Standings] Exception during PA fallback calculation:", e);
                }
            }

            calculateSeedsAndBadges();
            setupDropdown();
            updateDnflStandingsView();
        } catch (error) {
            console.error("[DNFL Standings Error]:", error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--dnfl-alert-red); padding: 2rem;">Error loading standings.</td></tr>`;
        }
    }

    function renderStandingsKey(confRules) {
        const keyContainer = document.getElementById("dnfl-standings-key");
        if (!keyContainer) return;

        let iconHtml = `<div class="dnfl-legend-items">`;
        if (confRules.hasDivisionCrown) {
            iconHtml += `<span class="dnfl-legend-item"><i class="fa-solid fa-crown" style="color: var(--dnfl-badge-blue);"></i> Div Winner</span>`;
        }
        if (confRules.playoffCutoff) {
            iconHtml += `<span class="dnfl-legend-item"><i class="fa-solid fa-trophy" style="color: var(--dnfl-badge-amber);"></i> Playoffs</span>`;
        }
        if (confRules.promotion?.enabled) {
            iconHtml += `<span class="dnfl-legend-item"><i class="fa-solid fa-circle-arrow-up" style="color: var(--dnfl-success-green);"></i> Promotion</span>`;
        }
        if (confRules.relegation?.enabled) {
            iconHtml += `<span class="dnfl-legend-item"><i class="fa-solid fa-circle-arrow-down" style="color: var(--dnfl-alert-red);"></i> Relegation</span>`;
        }
        iconHtml += `</div>`;

        let disclaimerHtml = '';
        const currentYearNum = new Date().getFullYear();
        const parsedTargetYear = parseInt(targetYear, 10);
        const isHistoric = parsedTargetYear < currentYearNum;
        const isEndOfSeason = cachedCurrentWeek > cachedLastRegWeek;

        if (!hasSeasonStarted) {
            disclaimerHtml = `<div class="dnfl-legend-note">*Pre-season view. Seedings and icons will calculate after Week 1 games complete.</div>`;
        } else if (isHistoric || isEndOfSeason) {
            disclaimerHtml = `<div class="dnfl-legend-note">*Final Regular Season Seedings.</div>`;
        } else {
            disclaimerHtml = `<div class="dnfl-legend-note">*Preliminary seedings as of Week ${cachedCurrentWeek} standings. Subject to change until Week ${cachedLastRegWeek}.</div>`;
        }

        keyContainer.innerHTML = iconHtml + disclaimerHtml;
    }

    function calculateSeedsAndBadges() {
        teamSeeds = {};
        divLeaders = {};
        divRunnerUps = {};
        relegatedTeamIds.clear();
        promotedTeamIds.clear();

        const baseRules = getYearRules();
        hasSeasonStarted = cachedStandingsFranchises.some(s => {
            const games = parseInt(s.h2hw || 0, 10) + parseInt(s.h2hl || 0, 10) + parseInt(s.h2ht || 0, 10);
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
                bottomTeams.forEach(id => relegatedTeamIds.add(id));
            }
        });

        let scopesToProcess = [];
        if (baseRules.seedingScope === 'league') {
            scopesToProcess.push({ scopeId: 'league', teams: cachedLeagueDetails.map(f => f.id), leaders: Object.values(divLeaders), runnersUp: Object.values(divRunnerUps) });
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
                    winners.forEach((id, idx) => teamSeeds[id] = idx + 1);

                    const runners = scope.runnersUp;
                    runners.sort(sortByPfThenMfl);
                    runners.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length);

                    const assigned = new Set([...winners, ...runners]);
                    const remaining = scope.teams.filter(id => !assigned.has(id));
                    remaining.sort(sortByPfThenMfl);
                    remaining.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length + runners.length);

                } else if (confRules.seedingModel === 'standard_div_winners_first') {
                    const winners = scope.leaders;
                    winners.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    winners.forEach((id, idx) => teamSeeds[id] = idx + 1);

                    const remaining = scope.teams.filter(id => !winners.includes(id));
                    remaining.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    remaining.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length);

                } else if (confRules.seedingModel === 'mfl_native') {
                    const allTeams = scope.teams.slice();
                    allTeams.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    allTeams.forEach((id, idx) => teamSeeds[id] = idx + 1);
                }
            });
        }

        cachedConferences.forEach(conf => {
            const confIdNorm = norm(conf.id);
            const confRules = getConfRules(baseRules, confIdNorm);
            const confTeams = cachedLeagueDetails.filter(f => (norm(f.conference) === confIdNorm) || (divToConfMap[norm(f.division)] === confIdNorm)).map(f => f.id);

            confTeams.sort((a, b) => getMflIndex(a) - getMflIndex(b));

            if (confRules.relegation?.enabled && confRules.relegation.type === 'conference') {
                const count = confRules.relegation.count || 2;
                confTeams.slice(-count).forEach(id => relegatedTeamIds.add(id));
            }
            if (confRules.promotion?.enabled) {
                const count = confRules.promotion.count || 4;
                confTeams.slice(0, count).forEach(id => promotedTeamIds.add(id));
            }
        });
    }

    function setupDropdown() {
        const confSelect = document.getElementById("dnfl_standings_confFilter");
        if (!confSelect) return;

        confSelect.innerHTML = '';
        const rules = getYearRules();

        if (rules.seedingScope === 'league') {
            const playoffOpt = document.createElement('option');
            playoffOpt.value = 'playoffs';
            playoffOpt.textContent = 'Playoffs';
            confSelect.appendChild(playoffOpt);
        }

        cachedConferences.forEach(conf => {
            const opt = document.createElement('option');
            opt.value = norm(conf.id);
            opt.textContent = conf.name;
            confSelect.appendChild(opt);
        });

        const activeFranchiseId = getLoggedInFranchiseId();
        let defaultConfId = null;

        if (activeFranchiseId) {
            const userFranchise = cachedLeagueDetails.find(f => normFranchiseId(f.id) === activeFranchiseId);
            if (userFranchise) {
                if (userFranchise.conference) {
                    defaultConfId = norm(userFranchise.conference);
                }
                if (!defaultConfId && userFranchise.division) {
                    const divNorm = norm(userFranchise.division);
                    const matchingDiv = cachedDivisions.find(d => norm(d.id) === divNorm);
                    if (matchingDiv && matchingDiv.conference) {
                        defaultConfId = norm(matchingDiv.conference);
                    }
                }
            }
        }

        let validOption = null;
        if (defaultConfId) {
            validOption = Array.from(confSelect.options).find(opt => opt.value === defaultConfId);
        }

        if (!validOption) {
            const fallbackConf = cachedConferences.find(c => c.name && c.name.toLowerCase().includes("cameron crazies"));
            defaultConfId = fallbackConf ? norm(fallbackConf.id) : (rules.seedingScope === 'league' ? 'playoffs' : norm(cachedConferences[0]?.id));
        }

        confSelect.value = defaultConfId;
        confSelect.onchange = updateDnflStandingsView;
    }

    function buildTeamRowHtml(profile, divId, confRules, rowCounter) {
        const stats = cachedStandingsFranchises.find(t => normFranchiseId(t.id) === normFranchiseId(profile.id)) || {};
        const teamName = profile.name || "Franchise " + profile.id;
        const ownerName = profile.owner_name || "Owner";
        const logoUrl = profile.icon ? profile.icon.toString().trim() : "https://dnfl.live/images/ficon-dnfl.png";

        const rawBbid = parseFloat(profile.bbidAvailableBalance || profile.bbidBalance || 0);
        const bbidFormatted = "$" + rawBbid.toFixed(2);

        const rawPf = parseFloat(stats.pf || stats.h2hpf || stats.points_for || 0);
        let paVal = (stats.pa !== undefined && stats.pa !== "0" && stats.pa !== 0 && stats.pa !== "0.00") ? stats.pa : (stats.h2hpa || stats.points_against || stats.opp_pf || stats.opp_points || stats.pa_pts || stats.opp_pts || 0);
        let rawPa = parseFloat(paVal || 0);

        const gamesPlayed = parseInt(stats.h2hw || stats.w || 0, 10) + parseInt(stats.h2hl || stats.l || 0, 10) + parseInt(stats.h2ht || stats.t || 0, 10);
        const normFid = normFranchiseId(profile.id);

        if (rawPa === 0 && gamesPlayed > 0 && weeklyPaMap[normFid] !== undefined) {
            rawPa = weeklyPaMap[normFid];
        }

        const pfFormatted = rawPf.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const paFormatted = rawPa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const record = `${stats.h2hw || 0}-${stats.h2hl || 0}-${stats.h2ht || 0}`;

        let seedCellContent = `<span class="dnfl-rank-badge" style="background-color: var(--dnfl-bg-subhead, #f1f5f9); color: var(--dnfl-text-main, #121212); border: 1px solid var(--dnfl-border-medium, #cbd5e1);">-</span>`;
        if (hasSeasonStarted) {
            const seed = teamSeeds[profile.id] || "-";
            let badgeIcons = '';

            const isDivWinner = profile.division && profile.id === divLeaders[norm(profile.division)];
            if (confRules.hasDivisionCrown && isDivWinner) {
                badgeIcons += `<i class="fa-solid fa-crown" style="color: var(--dnfl-badge-blue, #3b82f6); margin-left: 6px;" title="Division Winner"></i>`;
            }
            if (seed !== "-" && confRules.playoffCutoff && seed <= confRules.playoffCutoff) {
                badgeIcons += `<i class="fa-solid fa-trophy" style="color: var(--dnfl-badge-amber, #f59e0b); margin-left: 6px;" title="Playoff Seed #${seed}"></i>`;
            }
            if (relegatedTeamIds.has(profile.id)) {
                badgeIcons += `<i class="fa-solid fa-circle-arrow-down" style="color: var(--dnfl-alert-red, #ef4444); margin-left: 6px;" title="Relegation Zone"></i>`;
            }
            if (promotedTeamIds.has(profile.id)) {
                badgeIcons += `<i class="fa-solid fa-circle-arrow-up" style="color: var(--dnfl-success-green, #10b981); margin-left: 6px;" title="Promotion Zone"></i>`;
            }

            seedCellContent = `<span class="dnfl-rank-badge" style="background-color: var(--dnfl-bg-subhead, #f1f5f9); color: var(--dnfl-text-main, #121212); border: 1px solid var(--dnfl-border-medium, #cbd5e1);">${seed}</span>${badgeIcons}`;
        }

        const stripeClass = (rowCounter % 2 === 1) ? "dnfl-row-even" : "dnfl-row-odd";
        const activeFranchiseId = getLoggedInFranchiseId();
        const myTeamClass = (activeFranchiseId && normFranchiseId(profile.id) === activeFranchiseId) ? " dnfl-my-team myfranchise" : "";
        const divRowClass = divId ? ` dnfl-div-row-${divId}` : "";
        const rowClass = `${stripeClass}${myTeamClass}${divRowClass}`;

        const activeLeagueId = getLeagueId();
        const targetHref = `https://${activeHost}/${targetYear}/options?L=${activeLeagueId}&F=${profile.id}&O=01`;

        const pfBadgeHtml = `<span class="dnfl-badge dnfl-badge-green">${pfFormatted}</span>`;
        const paBadgeHtml = `<span class="dnfl-badge dnfl-badge-red">${paFormatted}</span>`;

        return `
            <tr class="${rowClass}">
                <td class="dnfl-col-seed">
                    ${seedCellContent}
                </td>
                <td class="dnfl-col-franchise">
                    <div class="dnfl-franchise-cell">
                        <a href="${targetHref}" title="View Franchise Page">
                            <img src="${logoUrl}" alt="${teamName}" class="franchiseicon" id="franchiseicon_${profile.id}" onError="this.onerror=null;this.src='https://dnfl.live/images/ficon-dnfl.png';" />
                        </a>
                        <div class="dnfl-franchise-info">
                            <a href="${targetHref}" class="dnfl-team-name">${teamName}</a>
                            <span class="dnfl-owner-name">${ownerName}</span>
                        </div>
                    </div>
                </td>
                <td class="dnfl-col-pf dnfl-hide-mobile">${pfBadgeHtml}</td>
                <td class="dnfl-col-pa dnfl-hide-mobile">${paBadgeHtml}</td>
                <td class="dnfl-col-record">
                    <span class="dnfl-pill-blue dnfl-pill">${record}</span>
                </td>
                <td class="dnfl-col-bbid dnfl-hide-mobile dnfl-standings-bbid">${bbidFormatted}</td>
            </tr>
        `;
    }

    function updateDnflStandingsView() {
        const select = document.getElementById("dnfl_standings_confFilter");
        const tbody = document.getElementById("dnfl-standings-tbody");
        const titleEl = document.querySelector("#dnfl-standings-container .dnfl-card-title");
        if (!select || !tbody) return;

        const selectedValue = select.value;
        const globalRules = getYearRules();

        let tableHtml = '';
        let rowCounter = 0;

        const subheaderRowHtml = `
            <tr class="dnfl-table-subheader">
                <th class="dnfl-col-seed">Seed</th>
                <th class="dnfl-col-franchise">Franchise</th>
                <th class="dnfl-col-pf dnfl-hide-mobile">Points For</th>
                <th class="dnfl-col-pa dnfl-hide-mobile">Points Against</th>
                <th class="dnfl-col-record">Record</th>
                <th class="dnfl-col-bbid dnfl-hide-mobile">BBID $</th>
            </tr>
        `;

        if (selectedValue === 'playoffs') {
            if (titleEl) {
                titleEl.innerHTML = `<i class="fa-solid fa-trophy"></i> DNFL Playoff Seeding`;
            }
            renderStandingsKey(globalRules);
            tableHtml += subheaderRowHtml;

            let allProfiles = [...cachedLeagueDetails];

            if (hasSeasonStarted) {
                allProfiles.sort((a, b) => {
                    const seedA = teamSeeds[a.id] || 999;
                    const seedB = teamSeeds[b.id] || 999;
                    return seedA - seedB;
                });
            } else {
                allProfiles.sort((a, b) => {
                    const idxA = cachedStandingsFranchises.findIndex(s => normFranchiseId(s.id) === normFranchiseId(a.id));
                    const idxB = cachedStandingsFranchises.findIndex(s => normFranchiseId(s.id) === normFranchiseId(b.id));
                    return idxA - idxB;
                });
            }

            allProfiles.forEach(profile => {
                tableHtml += buildTeamRowHtml(profile, null, globalRules, rowCounter);
                rowCounter++;
            });

            tbody.innerHTML = tableHtml;
            return;
        }

        const conf = cachedConferences.find(c => norm(c.id) === norm(selectedValue));
        if (!conf) return;

        if (titleEl) {
            titleEl.innerHTML = `<i class="fa-solid fa-trophy"></i> ${conf.name} Standings`;
        }

        const confRules = getConfRules(globalRules, norm(conf.id));
        renderStandingsKey(confRules);

        const divToConfMap = {};
        cachedDivisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

        const confDivisions = cachedDivisions.filter(div => norm(div.conference) === norm(conf.id));
        const divisionsToRender = confDivisions.length > 0 ? confDivisions : [{ id: 'none', name: conf.name }];

        divisionsToRender.forEach(div => {
            const hasRealDivision = div.id !== 'none';

            let fullDivTitle = div.name;
            if (hasRealDivision && conf.name && !div.name.toLowerCase().includes(conf.name.toLowerCase())) {
                fullDivTitle = `${conf.name} ${div.name}`;
            }

            if (hasRealDivision) {
                tableHtml += `
                    <tr class="dnfl-division-header">
                        <td colspan="6" class="dnfl-division-header-cell">
                            <div class="dnfl-division-header-content">
                                <h3>${fullDivTitle}</h3>
                                <button id="dnfl-btn-div-${div.id}" class="dnfl-btn dnfl-btn-secondary dnfl-btn-icon" onclick="DNFL.Standings.toggleDivision('${div.id}')" title="Toggle Division Rows" aria-label="Toggle Division">
                                    <i class="fa-solid fa-eye-slash"></i>
                                    <span class="btn-text-full">Hide</span>
                                    <span class="btn-text-short">Hide</span>
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr class="dnfl-table-subheader dnfl-div-row-${div.id}">
                        <th class="dnfl-col-seed">Seed</th>
                        <th class="dnfl-col-franchise">Franchise</th>
                        <th class="dnfl-col-pf dnfl-hide-mobile">Points For</th>
                        <th class="dnfl-col-pa dnfl-hide-mobile">Points Against</th>
                        <th class="dnfl-col-record">Record</th>
                        <th class="dnfl-col-bbid dnfl-hide-mobile">BBID $</th>
                    </tr>
                `;
            } else {
                tableHtml += subheaderRowHtml;
            }

            let divisionProfiles = hasRealDivision 
                ? cachedLeagueDetails.filter(f => norm(f.division) === norm(div.id))
                : cachedLeagueDetails.filter(f => (norm(f.conference) === norm(conf.id)) || (divToConfMap[norm(f.division)] === norm(conf.id)));

            divisionProfiles.sort((a, b) => {
                const idxA = cachedStandingsFranchises.findIndex(s => normFranchiseId(s.id) === normFranchiseId(a.id));
                const idxB = cachedStandingsFranchises.findIndex(s => normFranchiseId(s.id) === normFranchiseId(b.id));
                return idxA - idxB;
            });

            divisionProfiles.forEach(profile => {
                tableHtml += buildTeamRowHtml(profile, div.id, confRules, rowCounter);
                rowCounter++;
            });
        });

        tbody.innerHTML = tableHtml;
    }

    function toggleDnflDivision(divId) {
        const rows = document.querySelectorAll('.dnfl-div-row-' + divId);
        const btn = document.getElementById('dnfl-btn-div-' + divId);
        if (!rows.length) return;

        const currentlyHidden = rows[0].style.display === 'none';

        rows.forEach(row => {
            row.style.display = currentlyHidden ? '' : 'none';
        });

        if (btn) {
            btn.innerHTML = currentlyHidden 
                ? `<i class="fa-solid fa-eye-slash"></i> <span class="btn-text-full">Hide</span><span class="btn-text-short">Hide</span>`
                : `<i class="fa-solid fa-eye"></i> <span class="btn-text-full">Show</span><span class="btn-text-short">Show</span>`;
        }
    }

    window.DNFL.Standings = {
        init: init,
        updateView: updateDnflStandingsView,
        toggleDivision: toggleDnflDivision
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
