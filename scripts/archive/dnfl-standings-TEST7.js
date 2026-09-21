/* ==========================================================================
   DNFL Dynamic Standings & Seeding Engine (v3.00-TEST7)
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */

(function () {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    // Standings & Seeding Configuration (Loaded dynamically from standings_rules.json)
    let STANDINGS_RULES = {};

    /**
     * Normalizes 2-digit Conference and Division IDs ('01').
     * Safely returns '' for null, undefined, or empty values.
     */
    function norm(val) {
        if (val === null || val === undefined || String(val).trim() === '') return '';
        if (window.DNFL && window.DNFL.Utils && window.DNFL.Utils.pad2) {
            return window.DNFL.Utils.pad2(val);
        }
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    /**
     * Normalizes 4-digit Franchise IDs ('0001').
     * Safely returns '' for null, undefined, or empty values.
     */
    function normFranchiseId(val) {
        if (val === null || val === undefined || String(val).trim() === '') return '';
        if (window.DNFL && window.DNFL.Utils && window.DNFL.Utils.pad4) {
            return window.DNFL.Utils.pad4(val);
        }
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    /**
     * Helper to safely convert MFL payload values into Arrays.
     */
    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    /**
     * Dynamically resolves active season context (year & league ID).
     * Priority: URL param -> URL path -> window.current_year -> MFL globals -> API Middleware context.
     */
    function getActiveContext() {
        const urlParams = new URLSearchParams(window.location.search);
        const pathMatch = window.location.pathname.match(/\/(\d{4})\//);
        
        let yr = urlParams.get('YEAR') || 
                 (pathMatch ? pathMatch[1] : null) || 
                 window.current_year || 
                 window.mflYear || 
                 window.year;

        let lId = urlParams.get('L') || window.league_id || window.mflLeagueId;

        if (!yr || !lId) {
            if (window.DNFL && window.DNFL.Client && window.DNFL.Client.getContext) {
                const clientCtx = window.DNFL.Client.getContext();
                if (!yr) yr = clientCtx.year;
                if (!lId) lId = clientCtx.leagueId;
            }
        }

        const resolvedYear = yr || new Date().getFullYear().toString();
        const resolvedLeagueId = lId || '22883';

        // Keep global window.mflYear in sync so DNFL.Client fetches data for the correct season
        if (!window.mflYear) {
            window.mflYear = resolvedYear;
        }

        return {
            year: resolvedYear,
            leagueId: resolvedLeagueId
        };
    }

    // State Caches
    let cachedConferences = [];
    let cachedDivisions = [];
    let cachedLeagueDetails = [];
    let cachedStandingsFranchises = [];
    let weeklyPaMap = {};

    // Dynamic Week & Season Trackers
    let cachedLastRegWeek = 14;   
    let cachedCurrentWeek = 1;
    let hasSeasonStarted = false; 

    // Seeding Dictionaries & Sets
    let teamSeeds = {};
    let divLeaders = {};
    let divRunnerUps = {};
    let relegatedTeamIds = new Set();
    let promotedTeamIds = new Set();

    /**
     * Dynamically detects the logged-in franchise ID across all MFL environments.
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
     * Resolves rule set for target season year from STANDINGS_RULES configuration.
     */
    function getYearRules(targetYear) {
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
     * Deep merge resolver for conference-specific rule overrides.
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
     * Seeding & Qualification Engine with Exact ID Normalization.
     */
    function calculateSeedsAndBadges(targetYear) {
        teamSeeds = {};
        divLeaders = {};
        divRunnerUps = {};
        relegatedTeamIds.clear();
        promotedTeamIds.clear();

        const baseRules = getYearRules(targetYear);

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

        // Resolve Division Leaders and Division Runner-Ups
        cachedDivisions.forEach(div => {
            const divIdNorm = norm(div.id);
            const confIdNorm = norm(div.conference);
            const confRules = getConfRules(baseRules, confIdNorm);
            const teamsInDiv = cachedLeagueDetails.filter(f => norm(f.division) === divIdNorm).map(f => normFranchiseId(f.id));
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
                teams: cachedLeagueDetails.map(f => normFranchiseId(f.id)),
                leaders: Object.values(divLeaders),
                runnersUp: Object.values(divRunnerUps)
            });
        } else {
            cachedConferences.forEach(conf => {
                const confIdNorm = norm(conf.id);
                const confTeams = cachedLeagueDetails.filter(f => (norm(f.conference) === confIdNorm) || (divToConfMap[norm(f.division)] === confIdNorm)).map(f => normFranchiseId(f.id));
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
            Object.keys(baseRules.manualSeeds).forEach(rawId => {
                teamSeeds[normFranchiseId(rawId)] = baseRules.manualSeeds[rawId];
            });
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

        // Conference Promotion & Relegation Badging
        cachedConferences.forEach(conf => {
            const confIdNorm = norm(conf.id);
            const confRules = getConfRules(baseRules, confIdNorm);
            const confTeams = cachedLeagueDetails.filter(f => (norm(f.conference) === confIdNorm) || (divToConfMap[norm(f.division)] === confIdNorm)).map(f => normFranchiseId(f.id));
            
            confTeams.sort((a, b) => getMflIndex(a) - getMflIndex(b));

            if (confRules.relegation?.enabled && confRules.relegation.type === 'conference') {
                const count = confRules.relegation.count || 2;
                confTeams.slice(-count).forEach(id => relegatedTeamIds.add(normFranchiseId(id)));
            }
            if (confRules.promotion?.enabled) {
                const count = confRules.promotion.count || 4;
                confTeams.slice(0, count).forEach(id => promotedTeamIds.add(normFranchiseId(id)));
            }
        });
    }

    /**
     * Configures conference selector dropdown options and resolves default conference.
     */
    function setupDropdown(targetYear) {
        const confSelect = document.getElementById("dnfl_standings_confFilter");
        if (!confSelect) return;

        confSelect.innerHTML = ''; 
        const rules = getYearRules(targetYear);

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

        // Attach Event Listeners explicitly for smooth UI refreshes
        confSelect.onchange = updateDnflStandingsView;
        confSelect.removeEventListener('change', updateDnflStandingsView);
        confSelect.addEventListener('change', updateDnflStandingsView);
    }

    /**
     * Renders legend keys and disclaimers using CSS utility classes.
     */
    function renderStandingsKey(confRules, targetYear) {
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
     * Builds individual team table row HTML string preserving exact baseline columns and classes.
     */
    function buildTeamRowHtml(profile, divId, confRules, rowIdx, targetYear) {
        const normFid = normFranchiseId(profile.id);
        const standingsData = cachedStandingsFranchises.find(s => normFranchiseId(s.id) === normFid) || {};
        const activeHost = window.location.hostname || "myfantasyleague.com";
        const context = getActiveContext();

        const wins = parseInt(standingsData.h2hw || standingsData.w || 0);
        const losses = parseInt(standingsData.h2hl || standingsData.l || 0);
        const ties = parseInt(standingsData.h2ht || standingsData.t || 0);
        const recordStr = `${wins}-${losses}-${ties}`;

        const pf = parseFloat(standingsData.pf || standingsData.points_for || 0);
        
        let pa = parseFloat(standingsData.pa || standingsData.h2hpa || standingsData.points_against || standingsData.opp_pf || 0);
        if (pa === 0 && weeklyPaMap[normFid] !== undefined) {
            pa = weeklyPaMap[normFid];
        }

        const bbidStr = profile.bbidAvailableBalance 
            ? `$${parseFloat(profile.bbidAvailableBalance).toFixed(2)}` 
            : '$0.00';

        const rowClass = (rowIdx % 2 === 0) ? 'dnfl-row-even' : 'dnfl-row-odd';
        const loggedInFid = getLoggedInFranchiseId();
        const isMyTeam = (loggedInFid && loggedInFid === normFid);
        const myTeamClass = isMyTeam ? 'dnfl-my-team' : '';
        const divRowClass = divId ? `dnfl-div-row-${divId}` : '';

        const seedNum = teamSeeds[normFid];
        let badgesHtml = '';

        if (hasSeasonStarted && seedNum !== undefined) {
            const isDivWinner = Object.values(divLeaders).includes(normFid);
            if (confRules.hasDivisionCrown && isDivWinner) {
                badgesHtml += `<i class="fas fa-crown dnfl-crown-badge" title="Division Leader" style="color: var(--dnfl-badge-blue); margin-left: 6px;"></i>`;
            }
            if (confRules.playoffCutoff && seedNum <= confRules.playoffCutoff) {
                badgesHtml += `<i class="fas fa-trophy dnfl-trophy-badge" title="Playoff Seed #${seedNum}" style="color: var(--dnfl-badge-amber); margin-left: 6px;"></i>`;
            }
            if (confRules.promotion?.enabled && promotedTeamIds.has(normFid)) {
                badgesHtml += `<i class="fas fa-arrow-circle-up dnfl-promotion-badge" title="Promotion Position" style="color: var(--dnfl-success-green); margin-left: 6px;"></i>`;
            }
            if (confRules.relegation?.enabled && relegatedTeamIds.has(normFid)) {
                badgesHtml += `<i class="fas fa-arrow-circle-down dnfl-relegation-badge" title="Relegation Zone" style="color: var(--dnfl-alert-red); margin-left: 6px;"></i>`;
            }
        }

        const rankDisplay = hasSeasonStarted ? (seedNum || '-') : '-';
        const logoUrl = profile.icon || "https://mflscripts.github.io/dnfl/assets/default_logo.png";
        const teamName = profile.name || `Franchise ${normFid}`;
        const ownerName = profile.owner_name || "";
        const targetHref = `https://${activeHost}/${context.year}/options?L=${context.leagueId}&F=${normFid}&O=01`;

        return `
            <tr class="${rowClass} ${myTeamClass} ${divRowClass}">
                <td style="text-align: center; white-space: nowrap;">
                    <div class="dnfl-rank-container" style="display: flex; align-items: center; justify-content: center;">
                        <span class="dnfl-rank-circle">${rankDisplay}</span>
                        ${badgesHtml}
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
                        <img src="${logoUrl}" alt="${teamName}" class="franchiseicon" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='https://mflscripts.github.io/dnfl/assets/default_logo.png'">
                        <div>
                            <div style="font-weight: 600;"><a href="${targetHref}" target="_blank" style="color: inherit; text-decoration: none;">${teamName}</a></div>
                            ${ownerName ? `<div style="font-size: 0.8rem; opacity: 0.75;">${ownerName}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="dnfl-hide-mobile dnfl-standings-pf" style="text-align: right; font-weight: 500;">${pf.toFixed(2)}</td>
                <td class="dnfl-hide-mobile dnfl-standings-pa" style="text-align: right; font-weight: 500;">${pa.toFixed(2)}</td>
                <td style="text-align: center;"><span class="dnfl-record-badge">${recordStr}</span></td>
                <td class="dnfl-hide-mobile dnfl-standings-bbid" style="text-align: right; font-weight: 500;">${bbidStr}</td>
            </tr>
        `;
    }

    /**
     * Renders Standings view based on selected dropdown value.
     */
    function updateDnflStandingsView() {
        const select = document.getElementById("dnfl_standings_confFilter");
        const tbody = document.getElementById("dnfl-standings-tbody");
        const caption = document.getElementById("dnfl-standings-caption");
        if (!select || !tbody) return;

        const activeCtx = getActiveContext();
        const targetYear = activeCtx.year;
        const selectedValue = select.value;
        const globalRules = getYearRules(targetYear);
        
        let tableHtml = '';
        let rowCounter = 0;

        if (selectedValue === 'playoffs') {
            if (caption) caption.innerHTML = `<span>Playoff Standings</span>`;
            
            renderStandingsKey(globalRules, targetYear);

            let allProfiles = [...cachedLeagueDetails];

            if (hasSeasonStarted) {
                allProfiles.sort((a, b) => {
                    const seedA = teamSeeds[normFranchiseId(a.id)] || 999;
                    const seedB = teamSeeds[normFranchiseId(b.id)] || 999;
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
                tableHtml += buildTeamRowHtml(profile, null, globalRules, rowCounter, targetYear);
                rowCounter++;
            });

            tbody.innerHTML = tableHtml;
            return;
        }

        const conf = cachedConferences.find(c => norm(c.id) === norm(selectedValue));
        if (!conf) return;

        const confRules = getConfRules(globalRules, norm(conf.id));
        renderStandingsKey(confRules, targetYear);

        if (caption) caption.innerHTML = `<span>${conf.name} Standings</span>`;

        const divToConfMap = {};
        cachedDivisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

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
                : cachedLeagueDetails.filter(f => (norm(f.conference) === norm(conf.id)) || (divToConfMap[norm(f.division)] === norm(conf.id)));

            divisionProfiles.sort((a, b) => {
                const idxA = cachedStandingsFranchises.findIndex(s => normFranchiseId(s.id) === normFranchiseId(a.id));
                const idxB = cachedStandingsFranchises.findIndex(s => normFranchiseId(s.id) === normFranchiseId(b.id));
                return idxA - idxB;
            });

            divisionProfiles.forEach(profile => {
                tableHtml += buildTeamRowHtml(profile, div.id, confRules, rowCounter, targetYear);
                rowCounter++;
            });
        });

        tbody.innerHTML = tableHtml;
    }

    /**
     * Toggles visibility of division rows.
     */
    function toggleDnflDivision(divId) {
        const rows = document.querySelectorAll(`.dnfl-div-row-${divId}`);
        const btn = document.getElementById(`dnfl-btn-div-${divId}`);
        if (!rows.length) return;

        const isHidden = rows[0].style.display === 'none';
        rows.forEach(row => {
            row.style.display = isHidden ? '' : 'none';
        });

        if (btn) {
            btn.textContent = isHidden ? 'Hide' : 'Show';
        }
    }

    /**
     * Main Module Initialization Entrypoint.
     */
    async function init() {
        const tbody = document.getElementById("dnfl-standings-tbody");
        if (!tbody) return;

        const activeCtx = getActiveContext();
        const targetYear = activeCtx.year;

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

            // PA Fallback Calculation for active season
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

            calculateSeedsAndBadges(targetYear);
            setupDropdown(targetYear);
            updateDnflStandingsView(); 

        } catch (error) {
            console.error("[DNFL.Standings] Initialization Error:", error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--dnfl-alert-red); padding: 2rem;">Error loading standings.</td></tr>`;
        }
    }

    // Public API Attachment - exposing updateView for inline HTML onchange handlers
    window.DNFL.Standings = {
        init: init,
        updateView: updateDnflStandingsView,
        toggleDivision: toggleDnflDivision
    };

    /**
     * Event-driven Auto Initialization
     */
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

})();
