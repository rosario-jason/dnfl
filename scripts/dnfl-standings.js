// dnfl-standings.js v8.0
(function() { 
    console.log("[DNFL Standings] - Component file injected. Generalized Scope Engine activated.");

    // =========================================================================
    // 📖 STANDINGS & SEEDING CONFIGURATION GUIDE (VARIABLE DICTIONARY)
    // =========================================================================
    // The engine checks if targetYear exists below. If not found, it uses 'default'.
    //
    // -------------------------------------------------------------------------
    // 1. seedingScope: (String)
    //    Defines the boundary for the Seed column numbering (1 to N).
    //    - 'conference' : Seeds 1 to N (total teams in the conference) within each conference.
    //    - 'league'     : Seeds 1 to N (total teams across the entire league).
    //
    // -------------------------------------------------------------------------
    // 2. seedingModel: (String)
    //    Determines the calculation formula applied to the Seed column.
    //    Models behave dynamically based on your seedingScope (e.g., if scope is 
    //    'league', it aggregates ALL Division Winners in the league into Tier 1).
    //    (Note: Physical row display order always respects native MFL rank).
    //
    //    - 'tiered_div_finish_pf':
    //         * Tier 1: ALL Division Winners ranked by Total PF.
    //         * Tier 2: ALL Division Runners-Up ranked by Total PF.
    //         * Tier 3: All remaining teams ranked by Total PF.
    //         * Ties broken by native MFL standings rank.
    //    - 'standard_div_winners_first':
    //         * ALL Division Winners get the top seeds.
    //         * All remaining teams get the remaining seeds based on MFL's native rank.
    //    - 'mfl_native':
    //         * Seeds strictly mirror MFL's built-in standings order (1 to N).
    //         * Inherits MFL Commissioner settings (e.g. if MFL splits by division).
    //    - 'manual':
    //         * Reads explicit custom seed overrides from a 'manualSeeds' object.
    //
    // -------------------------------------------------------------------------
    // 3. playoffCutoff: (Number | null)
    //    Controls the Gold Trophy (🏆) playoff qualification badge.
    //    - *Dependent on seedingScope*: 
    //      If scope is 'conference' and cutoff is 6, Top 6 PER conference get a trophy.
    //      If scope is 'league' and cutoff is 16, Top 16 LEAGUE-WIDE get a trophy.
    //    - Set to 0 or null to disable trophy badges.
    //
    // -------------------------------------------------------------------------
    // 4. hasDivisionCrown: (Boolean)
    //    Controls the Blue Crown (👑) badge for first place in each division.
    //
    // -------------------------------------------------------------------------
    // 5. relegation: (Object)
    //    Controls the Red Circle-Down (🔻) relegation badge.
    //    - type    : 'division'   -> Bottom N teams in each division get badge.
    //                'conference' -> Bottom N teams in the conference get badge.
    //    - count   : Number of relegated teams per division/conference (e.g., 1 or 2).
    //
    // -------------------------------------------------------------------------
    // 6. promotion: (Object)
    //    Controls the Green Circle-Up (🔺) promotion badge.
    //    - count   : Number of top teams that earn promotion (e.g., 4).
    //
    // -------------------------------------------------------------------------
    // 7. conferenceOverrides: (Object | Optional)
    //    Applies specific rules to individual conferences by their 2-digit ID
    //    ('00', '01', '02'). Overrides any global season settings.
    // =========================================================================

    const STANDINGS_RULES = {
        // =====================================================================
        // CURRENT SEASON: 2026 (League-wide PF Tiered)
        // =====================================================================
        2026: {
            seedingScope: 'league',
            seedingModel: 'tiered_div_finish_pf',
            playoffCutoff: 16,
            hasDivisionCrown: true,
            relegation: { enabled: true, type: 'division', count: 1 },
            promotion: { enabled: false, count: 0 }
        },

        // =====================================================================
        // UPCOMING SEASON: 2027 (Multi-Tier Promotion / Relegation Structure)
        // =====================================================================
        2027: {
            seedingScope: 'conference',
            seedingModel: 'standard_div_winners_first',
            playoffCutoff: 4,
            hasDivisionCrown: true,
            relegation: { enabled: false, type: 'conference', count: 0 },
            promotion: { enabled: false, count: 0 },
            conferenceOverrides: {
                '00': { relegation: { enabled: true, type: 'conference', count: 2 }, promotion: { enabled: false } },
                '01': { relegation: { enabled: true, type: 'conference', count: 2 }, promotion: { enabled: false } },
                '02': { relegation: { enabled: false }, promotion: { enabled: true, count: 4 } }
            }
        },

        // =====================================================================
        // 2025 Season
        // =====================================================================
        2025: {
            seedingScope: 'conference',
            seedingModel: 'standard_div_winners_first',
            playoffCutoff: 7,
            hasDivisionCrown: true,
            relegation: { enabled: false, type: 'conference', count: 0 },
            promotion: { enabled: false, count: 0 }
        },

        // =====================================================================
        // DEFAULT FALLBACK (Applies to all past seasons 2006–2024)
        // =====================================================================
        default: {
            seedingScope: 'conference',
            seedingModel: 'standard_div_winners_first',
            playoffCutoff: 6,
            hasDivisionCrown: true,
            relegation: { enabled: false, type: 'conference', count: 0 },
            promotion: { enabled: false, count: 0 }
        }
    };

    // --- 1. GLOBAL CONTEXT ENGINE ---
    const activeHost = window.location.hostname || "myfantasyleague.com";
    let targetYear = window.current_year || null;
    if (!targetYear) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear();
    }
    const leagueId = window.league_id || null;
    const loggedInFranchiseId = window.franchise_id || null;

    function getYearRules() {
        return STANDINGS_RULES[targetYear] || STANDINGS_RULES['default'];
    }

    // Global State Cache
    let cachedConferences = [];
    let cachedDivisions = [];
    let cachedLeagueDetails = [];
    let cachedStandingsFranchises = [];
    
    let teamSeeds = {};
    let divLeaders = {};
    let divRunnerUps = {};
    let relegatedTeamIds = new Set();
    let promotedTeamIds = new Set();
    
    let retryCount = 0;
    const maxRetries = 50; 

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
            const [standingsResponse, leagueResponse] = await Promise.all([
                DNFLClient.fetchData("leagueStandings"),
                DNFLClient.fetchData("league")
            ]);

            if (!standingsResponse || !leagueResponse) throw new Error("Missing structural configuration maps from MFL payload.");

            cachedStandingsFranchises = standingsResponse.leagueStandings.franchise;
            cachedLeagueDetails = leagueResponse.league.franchises.franchise;
            cachedConferences = leagueResponse.league.conferences?.conference || [];
            cachedDivisions = leagueResponse.league.divisions?.division || [];

            calculateSeedsAndBadges();
            setupDropdown();
            window.updateDnflStandingsView(); 

        } catch (error) {
            console.error("DNFL Standings Error:", error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading standings.</td></tr>`;
        }
    }

    // =========================================================================
    // 🧮 FULLY DYNAMIC SCOPED SEEDING ENGINE
    // =========================================================================
    function calculateSeedsAndBadges() {
        teamSeeds = {};
        divLeaders = {};
        divRunnerUps = {};
        relegatedTeamIds.clear();
        promotedTeamIds.clear();

        const rules = getYearRules();
        const divToConfMap = {};
        cachedDivisions.forEach(d => divToConfMap[d.id] = d.conference);

        const getMflIndex = (id) => cachedStandingsFranchises.findIndex(s => s.id === id);
        
        const getPf = (id) => {
            const s = cachedStandingsFranchises.find(item => item.id === id);
            return parseFloat(s?.pf || 0);
        };

        const sortByPfThenMfl = (a, b) => {
            const pfDiff = getPf(b) - getPf(a);
            if (pfDiff !== 0) return pfDiff;
            return getMflIndex(a) - getMflIndex(b);
        };

        // 1. DETERMINE DIVISION LEADERS & RUNNERS-UP (Strictly via MFL Native Order)
        cachedDivisions.forEach(div => {
            const teamsInDiv = cachedLeagueDetails.filter(f => f.division === div.id).map(f => f.id);
            teamsInDiv.sort((a, b) => getMflIndex(a) - getMflIndex(b));

            if (teamsInDiv.length > 0) divLeaders[div.id] = teamsInDiv[0];
            if (teamsInDiv.length > 1) divRunnerUps[div.id] = teamsInDiv[1];

            // Division-level Relegation
            if (rules.relegation?.enabled && rules.relegation.type === 'division') {
                const bottomCount = rules.relegation.count || 1;
                const bottomTeams = teamsInDiv.slice(-bottomCount);
                bottomTeams.forEach(id => relegatedTeamIds.add(id));
            }
        });

        // 2. DEFINE THE ACTIVE SCOPES (League-wide vs. Per-Conference)
        let scopesToProcess = [];
        
        if (rules.seedingScope === 'league') {
            scopesToProcess.push({
                scopeId: 'league',
                teams: cachedLeagueDetails.map(f => f.id),
                leaders: Object.values(divLeaders),
                runnersUp: Object.values(divRunnerUps)
            });
        } else {
            cachedConferences.forEach(conf => {
                const confTeams = cachedLeagueDetails.filter(f => (f.conference === conf.id) || (divToConfMap[f.division] === conf.id)).map(f => f.id);
                const confDivs = cachedDivisions.filter(d => d.conference === conf.id).map(d => d.id);
                const confLeaders = confDivs.map(dId => divLeaders[dId]).filter(id => id !== undefined);
                const confRunners = confDivs.map(dId => divRunnerUps[dId]).filter(id => id !== undefined);
                
                scopesToProcess.push({
                    scopeId: conf.id,
                    teams: confTeams,
                    leaders: confLeaders,
                    runnersUp: confRunners
                });
            });
        }

        // 3. RUN THE CHOSEN MODEL ACROSS THE SCOPES (Dynamically scales 1 to N teams)
        if (rules.seedingModel === 'manual' && rules.manualSeeds) {
            teamSeeds = rules.manualSeeds;
        } else {
            scopesToProcess.forEach(scope => {
                if (rules.seedingModel === 'tiered_div_finish_pf') {
                    // Tier 1: Winners
                    const winners = scope.leaders;
                    winners.sort(sortByPfThenMfl);
                    winners.forEach((id, idx) => teamSeeds[id] = idx + 1);

                    // Tier 2: Runners-up
                    const runners = scope.runnersUp;
                    runners.sort(sortByPfThenMfl);
                    runners.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length);

                    // Tier 3: Remaining Teams
                    const assigned = new Set([...winners, ...runners]);
                    const remaining = scope.teams.filter(id => !assigned.has(id));
                    remaining.sort(sortByPfThenMfl);
                    remaining.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length + runners.length);
                
                } else if (rules.seedingModel === 'standard_div_winners_first') {
                    // Tier 1: Winners (By MFL Rank)
                    const winners = scope.leaders;
                    winners.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    winners.forEach((id, idx) => teamSeeds[id] = idx + 1);

                    // Tier 2: Remaining Teams (By MFL Rank)
                    const remaining = scope.teams.filter(id => !winners.includes(id));
                    remaining.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    remaining.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length);
                
                } else if (rules.seedingModel === 'mfl_native') {
                    // Tier 1: Entire Scope (By MFL Rank)
                    const allTeams = scope.teams.slice();
                    allTeams.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    allTeams.forEach((id, idx) => teamSeeds[id] = idx + 1);
                }
            });
        }

        // 4. CONFERENCE-LEVEL RELEGATION & PROMOTION (Runs independently of seed model)
        cachedConferences.forEach(conf => {
            const confRule = rules.conferenceOverrides?.[conf.id] || rules;
            const confTeams = cachedLeagueDetails.filter(f => (f.conference === conf.id) || (divToConfMap[f.division] === conf.id)).map(f => f.id);
            
            confTeams.sort((a, b) => getMflIndex(a) - getMflIndex(b));

            if (confRule.relegation?.enabled && confRule.relegation.type === 'conference') {
                const count = confRule.relegation.count || 2;
                confTeams.slice(-count).forEach(id => relegatedTeamIds.add(id));
            }
            if (confRule.promotion?.enabled) {
                const count = confRule.promotion.count || 4;
                confTeams.slice(0, count).forEach(id => promotedTeamIds.add(id));
            }
        });
    }

    function setupDropdown() {
        const confSelect = document.getElementById("dnfl_standings_confFilter");
        if (!confSelect) return;

        confSelect.innerHTML = ''; 
        cachedConferences.forEach(conf => {
            const opt = document.createElement('option');
            opt.value = conf.id;
            opt.textContent = conf.name;
            confSelect.appendChild(opt);
        });

        let defaultConfId = null;
        if (loggedInFranchiseId) {
            const franchise = cachedLeagueDetails.find(f => f.id === loggedInFranchiseId);
            if (franchise) defaultConfId = franchise.conference;
        }

        if (!defaultConfId) {
            const fallbackConf = cachedConferences.find(c => c.name.toLowerCase().includes("cameron crazies"));
            defaultConfId = fallbackConf ? fallbackConf.id : cachedConferences[0]?.id;
        }
        confSelect.value = defaultConfId;
    }

    window.updateDnflStandingsView = function() {
        const select = document.getElementById("dnfl_standings_confFilter");
        const tbody = document.getElementById("dnfl-standings-tbody");
        if (!select || !tbody) return;

        const selectedConfId = select.value;
        const conf = cachedConferences.find(c => c.id === selectedConfId);
        if (!conf) return;

        const rules = getYearRules();
        const confDivisions = cachedDivisions.filter(div => div.conference === conf.id);
        
        let tableHtml = '';
        let rowCounter = 0; 

        // Groups under a single header if a conference has no divisions (e.g. 2027 Tier 3)
        const divisionsToRender = confDivisions.length > 0 ? confDivisions : [{ id: 'none', name: conf.name }];

        divisionsToRender.forEach(div => {
            const hasRealDivision = div.id !== 'none';

            if (hasRealDivision) {
                tableHtml += `
                    <tr class="dnfl-division-header">
                        <td colspan="6" style="background-color: #f3f4f6; border-bottom: 2px solid #444; padding: 10px 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 1rem; color: #121212;">${div.name}</h3>
                                <button id="dnfl-btn-div-${div.id}" class="dnfl-visibility-toggle-btn visibility-toggle-btn" onclick="toggleDnflDivision('${div.id}')">Hide</button>
                            </div>
                        </td>
                    </tr>
                `;
            }

            let divisionProfiles = hasRealDivision 
                ? cachedLeagueDetails.filter(f => f.division === div.id)
                : cachedLeagueDetails.filter(f => f.conference === conf.id);

            // Row display ALWAYS respects MFL native ranking order
            divisionProfiles.sort((a, b) => {
                const idxA = cachedStandingsFranchises.findIndex(s => s.id === a.id);
                const idxB = cachedStandingsFranchises.findIndex(s => s.id === b.id);
                return idxA - idxB;
            });

            divisionProfiles.forEach(profile => {
                const stats = cachedStandingsFranchises.find(t => t.id === profile.id) || {};
                const teamName = profile.name || "Franchise " + profile.id;
                const ownerName = profile.owner_name || "Owner";
                const logoUrl = profile.icon ? profile.icon.toString().trim() : "https://dnfl.live/images/ficon-dnfl.png"; 
                
                const rawBbid = parseFloat(profile.bbidAvailableBalance || profile.bbidBalance || 0);
                const bbidFormatted = "$" + rawBbid.toFixed(2);
                const pf = stats.pf || "0";
                const pa = stats.pa || "0";
                const record = `${stats.h2hw || 0}-${stats.h2hl || 0}-${stats.h2ht || 0}`;

                const seed = teamSeeds[profile.id] || "-";
                
                // --- VISUAL BADGES ENGINE ---
                let badgeIcons = '';

                if (rules.hasDivisionCrown && profile.id === divLeaders[div.id]) {
                    badgeIcons += `<i class="fa-solid fa-crown" style="color: #3b82f6; margin-left: 5px;" title="Division Winner"></i>`;
                }
                if (seed !== "-" && rules.playoffCutoff && seed <= rules.playoffCutoff) {
                    badgeIcons += `<i class="fa-solid fa-trophy" style="color: #f59e0b; margin-left: 5px;" title="Playoff Seed #${seed}"></i>`;
                }
                if (relegatedTeamIds.has(profile.id)) {
                    badgeIcons += `<i class="fa-solid fa-circle-down" style="color: #ef4444; margin-left: 5px;" title="Relegation Zone"></i>`;
                }
                if (promotedTeamIds.has(profile.id)) {
                    badgeIcons += `<i class="fa-solid fa-circle-up" style="color: #10b981; margin-left: 5px;" title="Promotion Zone"></i>`;
                }

                const stripeClass = (rowCounter % 2 === 0) ? "dnfl-row-odd" : "dnfl-row-even";
                rowCounter++;

                const myTeamClass = (profile.id === loggedInFranchiseId) ? " dnfl-my-team" : "";
                const rowClass = `${stripeClass}${myTeamClass} dnfl-div-row-${div.id}`;
                const targetHref = `https://${activeHost}/${targetYear}/options?L=${leagueId}&F=${profile.id}&O=01`;

                tableHtml += `
                    <tr class="${rowClass}">
                        <td style="font-weight: bold; font-size: 1.1rem; text-align: center; white-space: nowrap;">
                            ${seed} ${badgeIcons}
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
                                <a href="${targetHref}">
                                    <img src="${logoUrl}" alt="${teamName}" class="franchiseicon" id="franchiseicon_${profile.id}" />
                                </a>
                                <div style="display: flex; flex-direction: column;">
                                    <a href="${targetHref}" style="font-weight: 700; color: #121212; text-decoration: none;">${teamName}</a>
                                    <span style="font-size: 0.8rem; color: #555;">${ownerName}</span>
                                </div>
                            </div>
                        </td>
                        <td class="dnfl-hide-mobile" style="text-align: center;">${pf}</td>
                        <td class="dnfl-hide-mobile" style="text-align: center;">${pa}</td>
                        <td style="text-align: center; font-weight: 600;">${record}</td>
                        <td class="dnfl-hide-mobile" style="text-align: center;">${bbidFormatted}</td>
                    </tr>
                `;
            });
        });

        tbody.innerHTML = tableHtml;
    };

    window.toggleDnflDivision = function(divId) {
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

        if (btn) {
            btn.textContent = isHidden ? 'Show' : 'Hide';
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();