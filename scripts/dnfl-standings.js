// dnfl-standings.js v2.01
(async function() { 
    console.log("[DNFL Standings] - Component file injected. Initiating matrix alignment...");

    const [standingsResponse, leagueResponse] = await Promise.all([
        DNFLClient.fetchData("leagueStandings"),
        DNFLClient.fetchData("league")
    ]);

    if (standingsResponse && leagueResponse) {
        renderDnflCustomStandings(standingsResponse, leagueResponse);
    } else {
        console.error("DNFL Standings Error: Failed to gather necessary cached data streams.");
        document.getElementById("dnfl-standings-container").innerHTML = `<p>Error loading standings.</p>`;
    }
})();

// Helper to calculate win percentage for sorting
function getWinPct(stats) {
    const w = parseInt(stats.h2hw || 0);
    const l = parseInt(stats.h2hl || 0);
    const t = parseInt(stats.h2ht || 0);
    const total = w + l + t;
    return total === 0 ? 0 : (w + (t / 2)) / total;
}

// Helper for toggling division visibility
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

function renderDnflCustomStandings(standingsData, leagueData) { 
    const container = document.getElementById("dnfl-standings-container"); 
    if (!container) return;

    try {
        const standingsFranchises = standingsData.leagueStandings.franchise;
        const leagueDetails = leagueData.league.franchises.franchise;
        const conferences = leagueData.league.conferences?.conference;
        const divisions = leagueData.league.divisions?.division;

        if (!standingsFranchises || !leagueDetails || !conferences || !divisions) {
            throw new Error("Missing structural configuration maps from MFL payload.");
        }

        const leagueId = window.league_id || null;
        const targetYear = window.current_year || new Date().getFullYear();
        const activeHost = window.location.hostname || "myfantasyleague.com";
        const loggedInFranchise = window.franchise_id || null; 

        // 1. CALCULATE SEEDS BY CONFERENCE
        const teamSeeds = {}; // Map of franchise.id -> seed
        const divLeaders = {}; // Map of division.id -> franchise.id

        conferences.forEach(conf => {
            // Get all teams in this conference and attach their stats
            const confTeams = leagueDetails
                .filter(f => f.conference === conf.id)
                .map(profile => {
                    return {
                        profile: profile,
                        stats: standingsFranchises.find(s => s.id === profile.id) || {}
                    };
                });

            // Sort dynamically: 1. Win Pct (DESC), 2. Points For (DESC)
            confTeams.sort((a, b) => {
                const pctA = getWinPct(a.stats);
                const pctB = getWinPct(b.stats);
                if (pctA !== pctB) return pctB - pctA; 
                
                const pfA = parseFloat(a.stats.pf || 0);
                const pfB = parseFloat(b.stats.pf || 0);
                return pfB - pfA;
            });

            // Assign Conference Seeds (1 to N)
            confTeams.forEach((team, index) => {
                teamSeeds[team.profile.id] = index + 1;
            });
            
            // Find Division Leaders
            const confDivisions = divisions.filter(d => d.conference === conf.id);
            confDivisions.forEach(div => {
                const teamsInDiv = confTeams.filter(t => t.profile.division === div.id);
                if (teamsInDiv.length > 0) {
                    divLeaders[div.id] = teamsInDiv[0].profile.id; // Team with highest conf rank in the div
                }
            });
        });

        // 2. GENERATE DOM STRUCTURE
        let allTablesHtml = '';

        conferences.forEach(conf => {
            const confDivisions = divisions.filter(div => div.conference === conf.id);
            const totalConfTeams = leagueDetails.filter(f => f.conference === conf.id).length;

            allTablesHtml += `
                <div class="mobile-wrapper dnfl-table-wrapper" style="margin-bottom: 2rem;">
                    <table class="dnfl-standings-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                        <caption><span>${conf.name} Standings</span></caption>
                        <thead>
                            <tr>
                                <th style="width: 10%;">Seed</th>
                                <th style="width: 40%;">Franchise</th>
                                <th class="dnfl-hide-mobile" style="text-align: center;">PF</th>
                                <th class="dnfl-hide-mobile" style="text-align: center;">PA</th>
                                <th style="text-align: center;">Record</th>
                                <th class="dnfl-hide-mobile" style="text-align: center;">BBID $</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            confDivisions.forEach(div => {
                // Division Header Row with Toggle Button
                allTablesHtml += `
                    <tr class="dnfl-division-header">
                        <td colspan="6" style="background-color: #f3f4f6; border-bottom: 2px solid #444; padding: 10px 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 1rem; color: #121212;">${div.name}</h3>
                                <button id="dnfl-btn-div-${div.id}" class="dnfl-visibility-toggle-btn" onclick="toggleDnflDivision('${div.id}')">Hide</button>
                            </div>
                        </td>
                    </tr>
                `;

                // Gather and sort teams belonging to this division by their calculated seed
                let divisionProfiles = leagueDetails.filter(f => f.division === div.id);
                divisionProfiles.sort((a, b) => teamSeeds[a.id] - teamSeeds[b.id]);

                divisionProfiles.forEach(profile => {
                    const stats = standingsFranchises.find(t => t.id === profile.id) || {};
                    const teamName = profile.name || "Franchise " + profile.id;
                    const ownerName = profile.owner_name || "Owner";
                    const logoUrl = profile.icon ? profile.icon.toString().trim() : "https://dnfl.live/images/ficon-dnfl.png";
                    
                    const rawBbid = parseFloat(profile.bbidBalance || 0);
                    const bbidFormatted = "$" + rawBbid.toFixed(2);
                    const pf = stats.pf || "0";
                    const pa = stats.pa || "0";
                    const record = `${stats.h2hw || 0}-${stats.h2hl || 0}-${stats.h2ht || 0}`;

                    const seed = teamSeeds[profile.id];
                    let seedIcon = '';
                    
                    // Visual Indicators
                    if (profile.id === divLeaders[div.id]) {
                        seedIcon = `<i class="fa-solid fa-crown" style="color: #3b82f6; margin-left: 5px;" title="Clinched 1st in Division"></i>`;
                    } else if (seed >= totalConfTeams - 1) {
                        seedIcon = `<i class="fa-solid fa-circle-down" style="color: #ef4444; margin-left: 5px;" title="Bottom 2 Seed"></i>`;
                    }

                    // Highlight user's franchise
                    const rowClass = (profile.id === loggedInFranchise) ? 'dnfl-my-team dnfl-div-row-' + div.id : 'dnfl-div-row-' + div.id;
                    const targetHref = `https://${activeHost}/${targetYear}/options?L=${leagueId}&F=${profile.id}&O=01`;

                    allTablesHtml += `
                        <tr class="${rowClass}">
                            <td style="font-weight: bold; font-size: 1.1rem;">
                                ${seed} ${seedIcon}
                            </td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <a href="${targetHref}">
                                        <img src="${logoUrl}" alt="${teamName}" class="franchiseicon" style="min-width: 3rem !important; width: 3rem !important; height: 3rem !important;">
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

            allTablesHtml += `
                        </tbody>
                    </table>
                </div>
            `;
        });

        container.innerHTML = allTablesHtml;

    } catch (error) {
        console.error("HTML Structural Matrix Generation Failed:", error);
        container.innerHTML = `<div class="reportwrapper"><p>Standings module could not compile structural data matrix configuration parameters.</p></div>`;
    }
}
