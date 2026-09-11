// dnfl-standings.js v5.01
(function() { 
    console.log("[DNFL Standings] - Component file injected. Automated live layout activated.");

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

    // Global State Cache
    let cachedConferences = [];
    let cachedDivisions = [];
    let cachedLeagueDetails = [];
    let cachedStandingsFranchises = [];
    
    let teamSeeds = {};
    let divLeaders = {};
    
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
            // Let the API Client handle the heavy lifting (It already contains the URL Year extractors)
            const [standingsResponse, leagueResponse] = await Promise.all([
                DNFLClient.fetchData("leagueStandings"),
                DNFLClient.fetchData("league")
            ]);

            if (!standingsResponse || !leagueResponse) throw new Error("Missing structural configuration maps from MFL payload.");

            cachedStandingsFranchises = standingsResponse.leagueStandings.franchise;
            cachedLeagueDetails = leagueResponse.league.franchises.franchise;
            cachedConferences = leagueResponse.league.conferences?.conference;
            cachedDivisions = leagueResponse.league.divisions?.division;

            calculateSeeds();
            setupDropdown();
            window.updateDnflStandingsView(); 

        } catch (error) {
            console.error("DNFL Standings Error:", error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading standings.</td></tr>`;
        }
    }

    function getWinPct(stats) {
        const w = parseInt(stats.h2hw || 0);
        const l = parseInt(stats.h2hl || 0);
        const t = parseInt(stats.h2ht || 0);
        const total = w + l + t;
        return total === 0 ? 0 : (w + (t / 2)) / total;
    }

    function calculateSeeds() {
        teamSeeds = {};
        divLeaders = {};

        const divToConfMap = {};
        cachedDivisions.forEach(d => divToConfMap[d.id] = d.conference);

        cachedConferences.forEach(conf => {
            const confTeams = cachedLeagueDetails
                .filter(f => (f.conference === conf.id) || (divToConfMap[f.division] === conf.id))
                .map(profile => {
                    return {
                        profile: profile,
                        stats: cachedStandingsFranchises.find(s => s.id === profile.id) || {}
                    };
                });

            confTeams.sort((a, b) => {
                const pctA = getWinPct(a.stats);
                const pctB = getWinPct(b.stats);
                if (pctA !== pctB) return pctB - pctA; 
                
                const pfA = parseFloat(a.stats.pf || 0);
                const pfB = parseFloat(b.stats.pf || 0);
                return pfB - pfA;
            });

            confTeams.forEach((team, index) => {
                teamSeeds[team.profile.id] = index + 1;
            });
            
            const confDivisions = cachedDivisions.filter(d => d.conference === conf.id);
            confDivisions.forEach(div => {
                const teamsInDiv = confTeams.filter(t => t.profile.division === div.id);
                if (teamsInDiv.length > 0) {
                    divLeaders[div.id] = teamsInDiv[0].profile.id;
                }
            });
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
            if (franchise) {
                defaultConfId = franchise.conference;
            }
        }

        // Fallback
        if (!defaultConfId) {
            const fallbackConf = cachedConferences.find(c => c.name.toLowerCase().includes("cameron crazies"));
            defaultConfId = fallbackConf ? fallbackConf.id : cachedConferences[0].id;
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

        const confDivisions = cachedDivisions.filter(div => div.conference === conf.id);
        const totalConfTeams = cachedLeagueDetails.filter(f => f.conference === conf.id).length;
        
        let tableHtml = '';
        let rowCounter = 0; 

        confDivisions.forEach(div => {
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

            let divisionProfiles = cachedLeagueDetails.filter(f => f.division === div.id);
            divisionProfiles.sort((a, b) => {
                const seedA = teamSeeds[a.id] || 999;
                const seedB = teamSeeds[b.id] || 999;
                return seedA - seedB;
            });

            divisionProfiles.forEach(profile => {
                const stats = cachedStandingsFranchises.find(t => t.id === profile.id) || {};
                const teamName = profile.name || "Franchise " + profile.id;
                const ownerName = profile.owner_name || "Owner";
                const logoUrl = profile.icon ? profile.icon.toString().trim() : "https://dnfl.live/images/ficon-dnfl.png"; 
                
                // FIXED: Changed profile.bbidBalance to profile.bbidAvailableBalance to correctly pull from MFL API
                const rawBbid = parseFloat(profile.bbidAvailableBalance || profile.bbidBalance || 0);
                const bbidFormatted = "$" + rawBbid.toFixed(2);
                
                const pf = stats.pf || "0";
                const pa = stats.pa || "0";
                const record = `${stats.h2hw || 0}-${stats.h2hl || 0}-${stats.h2ht || 0}`;

                const seed = teamSeeds[profile.id] || "-";
                let seedIcon = '';
                
                if (seed !== "-" && profile.id === divLeaders[div.id]) {
                    seedIcon = `<i class="fa-solid fa-crown" style="color: #3b82f6; margin-left: 5px;" title="Clinched 1st in Division"></i>`;
                } else if (seed !== "-" && seed >= totalConfTeams - 1) {
                    seedIcon = `<i class="fa-solid fa-circle-down" style="color: #ef4444; margin-left: 5px;" title="Bottom 2 Seed"></i>`;
                }

                const stripeClass = (rowCounter % 2 === 0) ? "dnfl-row-odd" : "dnfl-row-even";
                rowCounter++;

                const myTeamClass = (profile.id === loggedInFranchiseId) ? " dnfl-my-team" : "";
                const rowClass = `${stripeClass}${myTeamClass} dnfl-div-row-${div.id}`;
                const targetHref = `https://${activeHost}/${targetYear}/options?L=${leagueId}&F=${profile.id}&O=01`;

                tableHtml += `
                    <tr class="${rowClass}">
                        <td style="font-weight: bold; font-size: 1.1rem; text-align: center;">
                            ${seed} ${seedIcon}
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