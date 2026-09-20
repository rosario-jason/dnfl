/* ==========================================================================
   DNFL Dynamic Standings & Seeding Engine (v3.00-TEST1)
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Streamlined standings module utilizing DNFL.Client middleware, cached 
   league metadata, and rules-based seeding logic.
   ========================================================================== */

(function (window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};
    const DNFL = window.DNFL;

    // Module State
    let standingsRules = {};
    let targetYear = '';
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
    const relegatedTeamIds = new Set();
    const promotedTeamIds = new Set();

    /**
     * Resolves rule set for target season year from standingsRules
     */
    function getYearRules() {
        const yr = parseInt(targetYear, 10);
        if (standingsRules[yr]) return standingsRules[yr];

        for (const key in standingsRules) {
            if (key.startsWith('_')) continue;
            if (key.includes('-')) {
                const [start, end] = key.split('-').map(s => parseInt(s.trim(), 10));
                if (yr >= start && yr <= end) return standingsRules[key];
            }
            if (key.includes(',')) {
                const yearList = key.split(',').map(s => parseInt(s.trim(), 10));
                if (yearList.includes(yr)) return standingsRules[key];
            }
        }
        return standingsRules['default'] || {};
    }

    /**
     * Merge conference-specific overrides
     */
    function getConfRules(baseRules, confId) {
        const normConfId = String(confId || '').padStart(2, '0');
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
     * Main Initialization Pipeline
     */
    async function init() {
        const tbody = document.getElementById("dnfl-standings-tbody");
        if (!tbody) return;

        try {
            targetYear = DNFL.Client ? DNFL.Client.getContext().year : new Date().getFullYear().toString();
            const rulesUrl = 'https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_standings/standings_rules.json';

            const [standingsResponse, rawRulesJson] = await Promise.all([
                DNFL.Client.fetchData('leagueStandings'),
                DNFL.Client.fetchRawText(rulesUrl).catch(() => null)
            ]);

            if (!standingsResponse) {
                throw new Error("leagueStandings data unavailable.");
            }

            if (rawRulesJson) {
                try {
                    standingsRules = JSON.parse(rawRulesJson);
                } catch (e) {
                    // Fallback to default rules on parse error
                }
            }

            if (!standingsRules || !standingsRules['default']) {
                standingsRules = {
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

            // Utilize cached league metadata if available from DNFL.leagueMetadata, else fetch league
            let leagueObj = DNFL.leagueMetadata;
            if (!leagueObj) {
                const leagueResp = await DNFL.Client.fetchData('league');
                leagueObj = leagueResp?.league || {};
            }

            const rawFranchiseList = standingsResponse.leagueStandings?.franchise;
            cachedStandingsFranchises = Array.isArray(rawFranchiseList) ? rawFranchiseList : (rawFranchiseList ? [rawFranchiseList] : []);

            const rawDetails = leagueObj?.franchises?.franchise;
            cachedLeagueDetails = Array.isArray(rawDetails) ? rawDetails : (rawDetails ? [rawDetails] : []);

            const rawConfs = leagueObj?.conferences?.conference;
            cachedConferences = Array.isArray(rawConfs) ? rawConfs : (rawConfs ? [rawConfs] : []);

            const rawDivs = leagueObj?.divisions?.division;
            cachedDivisions = Array.isArray(rawDivs) ? rawDivs : (rawDivs ? [rawDivs] : []);

            cachedLastRegWeek = parseInt(leagueObj.lastRegularSeasonWeek || 14, 10);
            cachedCurrentWeek = parseInt(leagueObj.currentWk || 1, 10);

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
                        weeklyPromises.push(DNFL.Client.fetchData('weeklyResults', { W: w }).catch(() => null));
                    }
                    const weeklyResults = await Promise.all(weeklyPromises);

                    weeklyResults.forEach(weeklyData => {
                        if (!weeklyData?.weeklyResults) return;
                        const rawMatchups = weeklyData.weeklyResults.matchup || weeklyData.weeklyResults.matchUp || weeklyData.weeklyResults.schedule?.matchup;
                        let matchups = Array.isArray(rawMatchups) ? rawMatchups : (rawMatchups ? [rawMatchups] : []);

                        if (matchups.length === 0 && weeklyData.weeklyResults.franchise) {
                            const fList = Array.isArray(weeklyData.weeklyResults.franchise) ? weeklyData.weeklyResults.franchise : [weeklyData.weeklyResults.franchise];
                            const processedFids = new Set();
                            fList.forEach(f => {
                                const fid = String(f.id).padStart(4, '0');
                                const oppId = f.opponent || f.opp || f.vs ? String(f.opponent || f.opp || f.vs).padStart(4, '0') : '';
                                if (!processedFids.has(fid)) {
                                    processedFids.add(fid);
                                    if (oppId) processedFids.add(oppId);
                                    const oppObj = fList.find(o => String(o.id).padStart(4, '0') === oppId) || {};
                                    matchups.push({ franchise: [f, oppObj] });
                                }
                            });
                        }

                        matchups.forEach(m => {
                            const franchises = Array.isArray(m.franchise) ? m.franchise : [m.franchise];
                            if (franchises.length >= 2) {
                                const f1Id = String(franchises[0].id).padStart(4, '0');
                                const f2Id = String(franchises[1].id).padStart(4, '0');
                                const f1Score = parseFloat(franchises[0].score || 0);
                                const f2Score = parseFloat(franchises[1].score || 0);

                                weeklyPaMap[f1Id] = (weeklyPaMap[f1Id] || 0) + f2Score;
                                weeklyPaMap[f2Id] = (weeklyPaMap[f2Id] || 0) + f1Score;
                            }
                        });
                    });
                } catch (e) {
                    console.error("[DNFL.Standings] Error during PA fallback calculation:", e);
                }
            }

            calculateSeedsAndBadges();
            setupDropdown();
            updateView();

        } catch (error) {
            console.error("[DNFL.Standings] Initialization error:", error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--dnfl-alert-red); padding: 2rem;">Error loading standings.</td></tr>`;
        }
    }

    /**
     * Render legend key and disclaimers
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
        const parsedTargetYear = parseInt(targetYear, 10);
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
     * Seeding & Qualification Calculation
     */
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
        cachedDivisions.forEach(d => {
            const dId = String(d.id).padStart(2, '0');
            divToConfMap[dId] = String(d.conference || '').padStart(2, '0');
        });

        const normFid = (id) => String(id).padStart(4, '0');
        const getMflIndex = (id) => cachedStandingsFranchises.findIndex(s => normFid(s.id) === normFid(id));
        const getPf = (id) => {
            const s = cachedStandingsFranchises.find(item => normFid(item.id) === normFid(id));
            return parseFloat(s?.pf || 0);
        };

        const sortByPfThenMfl = (a, b) => {
            const pfDiff = getPf(b) - getPf(a);
            if (pfDiff !== 0) return pfDiff;
            return getMflIndex(a) - getMflIndex(b);
        };

        cachedDivisions.forEach(div => {
            const divIdNorm = String(div.id).padStart(2, '0');
            const confIdNorm = String(div.conference || '').padStart(2, '0');
            const confRules = getConfRules(baseRules, confIdNorm);
            const teamsInDiv = cachedLeagueDetails.filter(f => String(f.division || '').padStart(2, '0') === divIdNorm).map(f => f.id);
            teamsInDiv.sort((a, b) => getMflIndex(a) - getMflIndex(b));

            if (teamsInDiv.length > 0) divLeaders[divIdNorm] = teamsInDiv[0];
            if (teamsInDiv.length > 1) divRunnerUps[divIdNorm] = teamsInDiv[1];

            if (confRules.relegation?.enabled && confRules.relegation.type === 'division') {
                const bottomCount = confRules.relegation.count || 1;
                const bottomTeams = teamsInDiv.slice(-bottomCount);
                bottomTeams.forEach(id => relegatedTeamIds.add(id));
            }
        });

        const scopesToProcess = [];

        if (baseRules.seedingScope === 'league') {
            scopesToProcess.push({
                scopeId: 'league',
                teams: cachedLeagueDetails.map(f => f.id),
                leaders: Object.values(divLeaders),
                runnersUp: Object.values(divRunnerUps)
            });
        } else {
            cachedConferences.forEach(conf => {
                const confIdNorm = String(conf.id).padStart(2, '0');
                const confTeams = cachedLeagueDetails.filter(f => 
                    String(f.conference || '').padStart(2, '0') === confIdNorm || 
                    divToConfMap[String(f.division || '').padStart(2, '0')] === confIdNorm
                ).map(f => f.id);

                const confDivs = cachedDivisions.filter(d => String(d.conference || '').padStart(2, '0') === confIdNorm).map(d => String(d.id).padStart(2, '0'));
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
                    const winners = [...scope.leaders];
                    winners.sort(sortByPfThenMfl);
                    winners.forEach((id, idx) => teamSeeds[id] = idx + 1);

                    const runners = [...scope.runnersUp];
                    runners.sort(sortByPfThenMfl);
                    runners.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length);

                    const assigned = new Set([...winners, ...runners]);
                    const remaining = scope.teams.filter(id => !assigned.has(id));
                    remaining.sort(sortByPfThenMfl);
                    remaining.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length + runners.length);

                } else if (confRules.seedingModel === 'standard_div_winners_first') {
                    const winners = [...scope.leaders];
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
            const confIdNorm = String(conf.id).padStart(2, '0');
            const confRules = getConfRules(baseRules, confIdNorm);
            const confTeams = cachedLeagueDetails.filter(f => 
                String(f.conference || '').padStart(2, '0') === confIdNorm || 
                divToConfMap[String(f.division || '').padStart(2, '0')] === confIdNorm
            ).map(f => f.id);

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

    /**
     * Configure Dropdown Options & Auto-Select User Conference
     */
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
            opt.value = String(conf.id).padStart(2, '0');
            opt.textContent = conf.name;
            confSelect.appendChild(opt);
        });

        // Resolve default conference based on logged in user or fallback
        let defaultConfId = null;
        const userFranchiseId = DNFL.currentFranchiseId;

        if (userFranchiseId) {
            const userFranchise = DNFL.Client ? DNFL.Client.getFranchise(userFranchiseId) : null;
            if (userFranchise) {
                if (userFranchise.conference) {
                    defaultConfId = String(userFranchise.conference).padStart(2, '0');
                } else if (userFranchise.division) {
                    const divNorm = String(userFranchise.division).padStart(2, '0');
                    const matchingDiv = cachedDivisions.find(d => String(d.id).padStart(2, '0') === divNorm);
                    if (matchingDiv && matchingDiv.conference) {
                        defaultConfId = String(matchingDiv.conference).padStart(2, '0');
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
            defaultConfId = fallbackConf ? String(fallbackConf.id).padStart(2, '0') : (rules.seedingScope === 'league' ? 'playoffs' : String(cachedConferences[0]?.id || '').padStart(2, '0'));
        }

        confSelect.value = defaultConfId;
    }

    /**
     * Build Team Row HTML
     */
    function buildTeamRowHtml(profile, divId, confRules, rowCounter) {
        const normFid = String(profile.id).padStart(4, '0');
        const stats = cachedStandingsFranchises.find(t => String(t.id).padStart(4, '0') === normFid) || {};
        const teamName = profile.name || `Franchise ${profile.id}`;
        const ownerName = profile.owner_name || profile.owner || "Owner";
        const logoUrl = profile.icon ? profile.icon.toString().trim() : "https://dnfl.live/images/ficon-dnfl.png";

        const rawBbid = parseFloat(profile.bbidAvailableBalance || profile.bbidBalance || 0);
        const bbidFormatted = `$${rawBbid.toFixed(2)}`;

        const rawPf = parseFloat(stats.pf || stats.h2hpf || stats.points_for || 0);
        let paVal = (stats.pa !== undefined && stats.pa !== "0" && stats.pa !== 0 && stats.pa !== "0.00")
            ? stats.pa
            : (stats.h2hpa || stats.points_against || stats.opp_pf || stats.opp_points || 0);
        let rawPa = parseFloat(paVal || 0);

        const gamesPlayed = parseInt(stats.h2hw || stats.w || 0, 10) + parseInt(stats.h2hl || stats.l || 0, 10) + parseInt(stats.h2ht || stats.t || 0, 10);

        if (rawPa === 0 && gamesPlayed > 0 && weeklyPaMap[normFid] !== undefined) {
            rawPa = weeklyPaMap[normFid];
        }

        const pf = rawPf.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pa = rawPa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const record = `${stats.h2hw || 0}-${stats.h2hl || 0}-${stats.h2ht || 0}`;

        let seedCellContent = `<span class="dnfl-rank-circle">-</span>`;

        if (hasSeasonStarted) {
            const seed = teamSeeds[profile.id] || "-";
            let badgeIcons = '';

            const divIdNorm = String(profile.division || '').padStart(2, '0');
            const isDivWinner = profile.division && profile.id === divLeaders[divIdNorm];
            
            if (confRules.hasDivisionCrown && isDivWinner) {
                badgeIcons += `<i class="fas fa-crown" style="color: var(--dnfl-badge-blue); margin-left: 5px;" title="Division Winner"></i>`;
            }
            if (seed !== "-" && confRules.playoffCutoff && seed <= confRules.playoffCutoff) {
                badgeIcons += `<i class="fas fa-trophy" style="color: var(--dnfl-badge-amber); margin-left: 5px;" title="Playoff Seed #${seed}"></i>`;
            }
            if (relegatedTeamIds.has(profile.id)) {
                badgeIcons += `<i class="fas fa-arrow-circle-down" style="color: var(--dnfl-alert-red); margin-left: 5px;" title="Relegation Zone"></i>`;
            }
            if (promotedTeamIds.has(profile.id)) {
                badgeIcons += `<i class="fas fa-arrow-circle-up" style="color: var(--dnfl-success-green); margin-left: 5px;" title="Promotion Zone"></i>`;
            }

            seedCellContent = `<span class="dnfl-rank-circle">${seed}</span>${badgeIcons}`;
        }

        const stripeClass = (rowCounter % 2 === 0) ? "dnfl-row-odd" : "dnfl-row-even";
        const myTeamClass = (DNFL.currentFranchiseId && normFid === DNFL.currentFranchiseId) ? " dnfl-my-team dnfl-myfranchise" : "";
        const divRowClass = divId ? ` dnfl-div-row-${divId}` : "";
        const rowClass = `${stripeClass}${myTeamClass}${divRowClass}`;
        
        const host = window.location.hostname || "myfantasyleague.com";
        const context = DNFL.Client ? DNFL.Client.getContext() : { leagueId: '22883', year: targetYear };
        const targetHref = `https://${host}/${context.year}/options?L=${context.leagueId}&F=${profile.id}&O=01`;

        return `
            <tr class="${rowClass}" data-franchise="${normFid}">
                <td style="text-align: left; white-space: nowrap;">
                    ${seedCellContent}
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
                        <a href="${targetHref}">
                            <img src="${logoUrl}" alt="${teamName}" class="franchiseicon" id="franchiseicon_${profile.id}" />
                        </a>
                        <div style="display: flex; flex-direction: column;">
                            <a href="${targetHref}" class="dnfl-team-name">${teamName}</a>
                            <span class="dnfl-owner-name">${ownerName}</span>
                        </div>
                    </div>
                </td>
                <td class="dnfl-hide-mobile dnfl-standings-pf">${pf}</td>
                <td class="dnfl-hide-mobile dnfl-standings-pa">${pa}</td>
                <td style="text-align: center;"><span class="dnfl-record-badge">${record}</span></td>
                <td class="dnfl-hide-mobile dnfl-standings-bbid">${bbidFormatted}</td>
            </tr>
        `;
    }

    /**
     * Update Standings Table View
     */
    function updateView() {
        const select = document.getElementById("dnfl_standings_confFilter");
        const tbody = document.getElementById("dnfl-standings-tbody");
        const caption = document.getElementById("dnfl-standings-caption");
        if (!select || !tbody) return;

        const selectedValue = select.value;
        const globalRules = getYearRules();

        let tableHtml = '';
        let rowCounter = 0;

        if (selectedValue === 'playoffs') {
            if (caption) caption.innerHTML = `<span>Playoff Standings</span>`;
            renderStandingsKey(globalRules);

            const allProfiles = [...cachedLeagueDetails];

            if (hasSeasonStarted) {
                allProfiles.sort((a, b) => {
                    const seedA = teamSeeds[a.id] || 999;
                    const seedB = teamSeeds[b.id] || 999;
                    return seedA - seedB;
                });
            } else {
                allProfiles.sort((a, b) => {
                    const idxA = cachedStandingsFranchises.findIndex(s => String(s.id).padStart(4, '0') === String(a.id).padStart(4, '0'));
                    const idxB = cachedStandingsFranchises.findIndex(s => String(s.id).padStart(4, '0') === String(b.id).padStart(4, '0'));
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

        const conf = cachedConferences.find(c => String(c.id).padStart(2, '0') === String(selectedValue).padStart(2, '0'));
        if (!conf) return;

        const confRules = getConfRules(globalRules, String(conf.id).padStart(2, '0'));
        renderStandingsKey(confRules);

        if (caption) caption.innerHTML = `<span>${conf.name} Standings</span>`;

        const confDivisions = cachedDivisions.filter(div => String(div.conference || '').padStart(2, '0') === String(conf.id).padStart(2, '0'));
        const divisionsToRender = confDivisions.length > 0 ? confDivisions : [{ id: 'none', name: conf.name }];

        divisionsToRender.forEach(div => {
            const hasRealDivision = div.id !== 'none';

            if (hasRealDivision) {
                tableHtml += `
                    <tr class="dnfl-division-header">
                        <td colspan="6" class="dnfl-division-header-cell">
                            <div class="dnfl-division-header-content">
                                <h3>${div.name}</h3>
                                <button id="dnfl-btn-div-${div.id}" class="dnfl-visibility-toggle-btn visibility-toggle-btn" onclick="DNFL.Standings.toggleDivision('${div.id}')">Hide</button>
                            </div>
                        </td>
                    </tr>
                `;
            }

            const divIdNorm = String(div.id).padStart(2, '0');
            const confIdNorm = String(conf.id).padStart(2, '0');

            const divisionProfiles = hasRealDivision 
                ? cachedLeagueDetails.filter(f => String(f.division || '').padStart(2, '0') === divIdNorm)
                : cachedLeagueDetails.filter(f => String(f.conference || '').padStart(2, '0') === confIdNorm);

            divisionProfiles.sort((a, b) => {
                const idxA = cachedStandingsFranchises.findIndex(s => String(s.id).padStart(4, '0') === String(a.id).padStart(4, '0'));
                const idxB = cachedStandingsFranchises.findIndex(s => String(s.id).padStart(4, '0') === String(b.id).padStart(4, '0'));
                return idxA - idxB;
            });

            divisionProfiles.forEach(profile => {
                tableHtml += buildTeamRowHtml(profile, div.id, confRules, rowCounter);
                rowCounter++;
            });
        });

        tbody.innerHTML = tableHtml;
    }

    /**
     * Toggle Division Row Visibility
     */
    function toggleDivision(divId) {
        const rows = document.querySelectorAll(`.dnfl-div-row-${divId}`);
        const btn = document.getElementById(`dnfl-btn-div-${divId}`);
        let isHidden = false;

        rows.forEach(row => {
            if (row.style.display === 'none') {
                row.style.display = '';
                isHidden = false;
            } else {
                row.style.display = 'none';
                isHidden = true;
            }
        });

        if (btn) btn.textContent = isHidden ? 'Show' : 'Hide';
    }

    // Export Module API
    DNFL.Standings = {
        init: init,
        updateView: updateView,
        toggleDivision: toggleDivision
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
