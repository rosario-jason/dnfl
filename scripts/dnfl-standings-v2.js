/* ==========================================================================
   DNFL Dynamic Standings & Seeding Engine
   ========================================================================== */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    // Standings & Seeding Configuration (Loaded dynamically from standings_rules.json)
    let STANDINGS_RULES = {};

    // Global Context Engine Variables
    const activeHost = window.location.hostname || "myfantasyleague.com";
    let targetYear = window.current_year || null;
    if (!targetYear) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear();
    }
    const leagueId = window.league_id || null;
    const loggedInFranchiseId = window.franchise_id || null;

    // State Caches
    let cachedConferences = [];
    let cachedDivisions = [];
    let cachedLeagueDetails = [];
    let cachedStandingsFranchises = [];

    // Dynamic Week Trackers
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

    /**
     * Helper to normalize ID values (e.g. "0", 0, "00") into standard 2-digit format
     */
    function norm(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    /**
     * Resolves rule set for target season year from STANDINGS_RULES
     */
    function getYearRules() {
        const yr = parseInt(targetYear);
        if (STANDINGS_RULES[yr]) return STANDINGS_RULES[yr];

        for (const key in STANDINGS_RULES) {
            // Skip metadata/instructions blocks (e.g., _instructions, _comment, __README)
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
        if (!tbody) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        try {
            const rulesUrl = `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_standings/standings_rules.json`;

            const [standingsResponse, leagueResponse, rawRulesJson] = await Promise.all([
                DNFLClient.fetchData("leagueStandings"),
                DNFLClient.fetchData("league"),
                DNFLClient.fetchRawText(rulesUrl).catch(err => {
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

            cachedStandingsFranchises = standingsResponse.leagueStandings.franchise;
            cachedLeagueDetails = leagueResponse.league.franchises.franchise;
            cachedConferences = leagueResponse.league.conferences?.conference || [];
            cachedDivisions = leagueResponse.league.divisions?.division || [];
            
            cachedLastRegWeek = parseInt(leagueResponse.league.lastRegularSeasonWeek || 14);
            cachedCurrentWeek = parseInt(leagueResponse.league.currentWk) || 1;

            calculateSeedsAndBadges();
            setupDropdown();
            updateDnflStandingsView(); 

        } catch (error) {
            console.error("DNFL Standings Error:", error);
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

        const getMflIndex = (id) => cachedStandingsFranchises.findIndex(s => norm(s.id) === norm(id));
        
        const getPf = (id) => {
            const s = cachedStandingsFranchises.find(item => norm(item.id) === norm(id));
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

    /**
     * Configures conference selector dropdown options
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
            opt.value = norm(conf.id);
            opt.textContent = conf.name;
            confSelect.appendChild(opt);
        });

        let defaultConfId = null;
        if (loggedInFranchiseId) {
            const franchise = cachedLeagueDetails.find(f => norm(f.id) === norm(loggedInFranchiseId));
            if (franchise) defaultConfId = norm(franchise.conference);
        }

        if (!defaultConfId) {
            const fallbackConf = cachedConferences.find(c => c.name.toLowerCase().includes("cameron crazies"));
            defaultConfId = fallbackConf ? norm(fallbackConf.id) : (rules.seedingScope === 'league' ? 'playoffs' : norm(cachedConferences[0]?.id));
        }
        confSelect.value = defaultConfId;
    }

    /**
     * Builds individual team table row HTML string using global CSS classes
     */
    function buildTeamRowHtml(profile, divId, confRules, rowCounter) {
        const stats = cachedStandingsFranchises.find(t => norm(t.id) === norm(profile.id)) || {};
        const teamName = profile.name || "Franchise " + profile.id;
        const ownerName = profile.owner_name || "Owner";
        const logoUrl = profile.icon ? profile.icon.toString().trim() : "https://dnfl.live/images/ficon-dnfl.png"; 
        
        const rawBbid = parseFloat(profile.bbidAvailableBalance || profile.bbidBalance || 0);
        const bbidFormatted = "$" + rawBbid.toFixed(2);
        const rawPf = parseFloat(stats.pf || 0);
        const rawPa = parseFloat(stats.pa || 0);
        const pf = rawPf.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pa = rawPa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const record = `${stats.h2hw || 0}-${stats.h2hl || 0}-${stats.h2ht || 0}`;

        let seedCellContent = `<span class="dnfl-rank-circle">-</span>`;

        if (hasSeasonStarted) {
            const seed = teamSeeds[profile.id] || "-";
            let badgeIcons = '';

            const isDivWinner = profile.division && profile.id === divLeaders[norm(profile.division)];
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
        const myTeamClass = (norm(profile.id) === norm(loggedInFranchiseId)) ? " dnfl-my-team" : "";
        const divRowClass = divId ? ` dnfl-div-row-${divId}` : "";
        const rowClass = `${stripeClass}${myTeamClass}${divRowClass}`;
        const targetHref = `https://${activeHost}/${targetYear}/options?L=${leagueId}&F=${profile.id}&O=01`;

        return `
            <tr class="${rowClass}">
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
     * Updates table view based on selected dropdown option
     */
    function updateDnflStandingsView() {
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

            let allProfiles = [...cachedLeagueDetails];

            if (hasSeasonStarted) {
                allProfiles.sort((a, b) => {
                    const seedA = teamSeeds[a.id] || 999;
                    const seedB = teamSeeds[b.id] || 999;
                    return seedA - seedB;
                });
            } else {
                allProfiles.sort((a, b) => {
                    const idxA = cachedStandingsFranchises.findIndex(s => norm(s.id) === norm(a.id));
                    const idxB = cachedStandingsFranchises.findIndex(s => norm(s.id) === norm(b.id));
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

        const confRules = getConfRules(globalRules, norm(conf.id));
        renderStandingsKey(confRules);

        if (caption) caption.innerHTML = `<span>${conf.name} Standings</span>`;

        const confDivisions = cachedDivisions.filter(div => norm(div.conference) === norm(conf.id));
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

            let divisionProfiles = hasRealDivision 
                ? cachedLeagueDetails.filter(f => norm(f.division) === norm(div.id))
                : cachedLeagueDetails.filter(f => norm(f.conference) === norm(conf.id));

            divisionProfiles.sort((a, b) => {
                const idxA = cachedStandingsFranchises.findIndex(s => norm(s.id) === norm(a.id));
                const idxB = cachedStandingsFranchises.findIndex(s => norm(s.id) === norm(b.id));
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
     * Toggles visibility of division rows
     */
    function toggleDnflDivision(divId) {
        const rows = document.querySelectorAll('.dnfl-div-row-' + divId);
        const btn = document.getElementById('dnfl-btn-div-' + divId);
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

    // Export module onto the window.DNFL namespace
    window.DNFL.Standings = {
        init: init,
        updateView: updateDnflStandingsView,
        toggleDivision: toggleDnflDivision
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();