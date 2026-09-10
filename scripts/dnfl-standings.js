// dnfl-standings.js v2.07
(function() { 
    console.log("[DNFL Standings] - Component file injected. Initiating matrix alignment...");

    let retryCount = 0;
    const maxRetries = 50; // Allows up to 5 seconds for the HTML stub to render

    async function initializeStandings() {
        const container = document.getElementById("dnfl-standings-container");
        
        if (!container) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(initializeStandings, 100);
            } else {
                console.error("DNFL Standings: Could not find HTML container <div id='dnfl-standings-container'>.");
            }
            return;
        }

        try {
            const [standingsResponse, leagueResponse] = await Promise.all([
                DNFLClient.fetchData("leagueStandings"),
                DNFLClient.fetchData("league")
            ]);

            if (standingsResponse && leagueResponse) {
                renderDnflCustomStandings(standingsResponse, leagueResponse);
            } else {
                throw new Error("Failed to gather necessary cached data streams.");
            }
        } catch (error) {
            console.error("DNFL Standings Error:", error);
            container.innerHTML = `<div class="reportwrapper"><p>Error loading standings.</p></div>`;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeStandings);
    } else {
        initializeStandings();
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

        // Map division IDs to conference IDs as a fallback safety net
        const divToConfMap = {};
        divisions.forEach(d => divToConfMap[d.id] = d.conference);

        // 1. CALCULATE SEEDS BY CONFERENCE
        const teamSeeds = {}; 
        const divLeaders = {}; 

        conferences.forEach(conf => {
            const confTeams = leagueDetails
                .filter(f => (f.conference === conf.id) || (divToConfMap[f.division] === conf.id))
                .map(profile => {
                    return {
                        profile: profile,
                        stats: standingsFranchises.find(s => s.id === profile.id) || {}
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
            
            const confDivisions = divisions.filter(d => d.conference === conf.id);
            confDivisions.forEach(div => {
                const teamsInDiv = confTeams.filter(t => t.profile.division === div.id);
                if (teamsInDiv.length > 0) {
                    divLeaders[div.id] = teamsInDiv[0].profile.id;
                }
            });
        });

        // 2. GENERATE DOM STRUCTURE
        let allTablesHtml = '';

        conferences.forEach(conf => {
            const confDivisions = divisions.filter(div => div.conference === conf.id);
            const totalConfTeams = leagueDetails.filter(f => (f.conference === conf.id) || (divToConfMap[f.division] === conf.id)).length;
            
            // Generic conference wrapper ID
            const wrapperId = `dnfl_conf_${conf.id}_standings`;

            allTablesHtml += `
                <div id="${wrapperId}" class="mobile-wrap" style="margin-bottom: 2rem;">
                    <table class="homepagemodule report" cellspacing="1" align="center">
                        <caption>${conf.name} Standings</caption>
                    </table>
                    <div class="toggle_tabs">
                        <!-- Dedicated container inheriting global module styling -->
                        <div class="dnfl-module-container" style="overflow-x: auto;">
                            <table class="dnfl-standings-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr>
                                        <th style="width: 10%; text-align: center;">Seed</th>
                                        <th style="width: 40%; text-align: left;">Franchise</th>
                                        <th class="dnfl-hide-mobile" style="text-align: center;">PF</th>
                                        <th class="dnfl-hide-mobile" style="text-align: center;">PA</th>
                                        <th style="text-align: center;">Record</th>
                                        <th class="dnfl-hide-mobile" style="text-align: center;">BBID $</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            confDivisions.forEach(div => {
                allTablesHtml += `
                    <tr class="dnfl-division-header">
                        <td colspan="6" style="background-color: #f3f4f6; border-bottom: 2px solid #444; padding: 10px 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 1rem; color: #121212;">${div.name}</h3>
                                <button id="dnfl-btn-div-${div.id}" class="dnfl-visibility-toggle-btn visibility-toggle-btn" onclick="toggleDnflDivision('${div.id}')">Hide</button>
                            </div>
                        </td>
                    </tr>
                `;

                let divisionProfiles = leagueDetails.filter(f => f.division === div.id);
                divisionProfiles.sort((a, b) => {
                    const seedA = teamSeeds[a.id] || 999;
                    const seedB = teamSeeds[b.id] || 999;
                    return seedA - seedB;
                });

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

                    const seed = teamSeeds[profile.id] || "-";
                    let seedIcon = '';
                    
                    if (seed !== "-" && profile.id === divLeaders[div.id]) {
                        seedIcon = `<i class="fa-solid fa-crown" style="color: #3b82f6; margin-left: 5px;" title="Clinched 1st in Division"></i>`;
                    } else if (seed !== "-" && seed >= totalConfTeams - 1) {
                        seedIcon = `<i class="fa-solid fa-circle-down" style="color: #ef4444; margin-left: 5px;" title="Bottom 2 Seed"></i>`;
                    }

                    const rowClass = (profile.id === loggedInFranchise) ? 'dnfl-my-team dnfl-div-row-' + div.id : 'dnfl-div-row-' + div.id;
                    const targetHref = `https://${activeHost}/${targetYear}/options?L=${leagueId}&F=${profile.id}&O=01`;

                    allTablesHtml += `
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

            allTablesHtml += `
                                </tbody>
                            </table>
                        </div> <!-- close dnfl-module-container div -->
                    </div> <!-- close toggle_tabs div -->
                </div> <!-- close mobile-wrap div -->
            `;
        });

        container.innerHTML = allTablesHtml;

    } catch (error) {
        console.error("HTML Structural Matrix Generation Failed:", error);
        container.innerHTML = `<div class="reportwrapper"><p>Standings module could not compile structural data matrix configuration parameters.</p></div>`;
    }
}