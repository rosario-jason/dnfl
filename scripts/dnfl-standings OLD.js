// dnfl-standings.js v1.02
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
    }
})();

function renderDnflCustomStandings(standingsData, leagueData) {
    const tableContainer = document.getElementById("dnfl-standings-table");
    if (!tableContainer) return;

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
        const activeHost = window.location.hostname || "://myfantasyleague.com";

        // 1. DYNAMIC CONFERENCE RANK CALCULATOR
        const conferenceRankings = {};
        
        conferences.forEach(conf => {
            // Filter out teams belonging strictly to this conference container block
            const confTeamProfiles = leagueDetails.filter(f => f.conference === conf.id);
            
            // Map profiles straight back into MFL's native pre-sorted standings records list
            const sortedConfTeams = standingsFranchises.filter(stats => 
                confTeamProfiles.some(profile => profile.id === stats.id)
            );
            
            // Assign sequential rank 1-12 across the entire conference list block
            sortedConfTeams.forEach((stats, conferenceIndex) => {
                conferenceRankings[stats.id] = conferenceIndex + 1;
            });
        });

        // 2. UNSTYLED NATIVE HTML GENERATOR 
        let tableHtml = `
            <div class="reportwrapper">
                <table align="center" cellspacing="1" class="homepagemodule report" id="standings">
                    <caption><span>League Standings</span></caption>
                    <tbody>
        `;

        let rowCounter = 0; // Independent counter to handle odd/even alternating CSS row toggles flawlessly

        // Loop top-down through conferences
        conferences.forEach(conf => {
            const confDivisions = divisions.filter(div => div.conference === conf.id);

            // Loop down through divisions inside this specific conference
            confDivisions.forEach(div => {
                
                // Print Sub-Header Row dividing line for the active division context block
                tableHtml += `
                    <tr>
                        <td id="division${div.id}" colspan="6">
                            <h3>${conf.name} - ${div.name}</h3>
                        </td>
                    </tr>
                    <tr>
                        <th class="rank" title="Conference Rank">Rank</th>
                        <th class="ficonname" title="Franchise Icon and Name">Franchise</th>
                        <th class="pf" title="Points For (Total Year-to-Date Point Scored)">PF</th>
                        <th class="pa" title="Points Against (Total Year-to-Date Opponent Points Scored)">PA</th>
                        <th class="h2hwlt" title="Overall Wins, Losses and Ties">W‑L‑T</th>
                        <th class="bbidbalance" title="Balance Available To Spend On Blind Bidding">BBID $ Bal</th>
                    </tr>
                `;

                // Gather team profiles belonging strictly to this division section
                const divisionProfiles = leagueDetails.filter(f => f.division === div.id);

                // Sort the division teams inline based on their ultimate pre-sorted standings index positions
                divisionProfiles.sort((a, b) => {
                    const idxA = standingsFranchises.findIndex(t => t.id === a.id);
                    const idxB = standingsFranchises.findIndex(t => t.id === b.id);
                    return idxA - idxB;
                });

                // Generate table row grids item-by-item
                divisionProfiles.forEach(profile => {
                    const stats = standingsFranchises.find(t => t.id === profile.id);
                    if (!stats) return;

                    const teamName = profile.name || "Franchise " + profile.id;
                    
                    // FALLBACK IMAGE LOOKUP ENGINE: Replaces blank parameters with your ficon-dnfl asset link
                    const logoUrl = profile.icon ? profile.icon.toString().trim() : "https://dnfl.live/images/ficon-dnfl.png";
                    
                    // Format currency inputs cleanly matching your target output parameters style
                    const rawBbid = parseFloat(profile.bbidBalance || 0);
                    const bbidFormatted = "$" + rawBbid.toFixed(2);

                    // Pull Total Accumulated Scores (Integers) out of the standings dataset object fields
                    const totalPf = stats.pf || "0";
                    const totalPa = stats.pa || "0";

                    const wins = stats.h2hw || "0";
                    const losses = stats.h2hl || "0";
                    const ties = stats.h2ht || "0";
                    
                    const confRank = conferenceRankings[profile.id] || "-";
                    const rowClass = (rowCounter % 2 === 0) ? "oddtablerow" : "eventablerow";
                    rowCounter++;

                    // Dynamically build your required interactive anchor link parameters
                    const targetHref = "https://" + activeHost + "/" + targetYear + "/options?L=" + leagueId + "&F=" + profile.id + "&O=01";
                    const tooltipText = "Owner: " + (profile.owner_name || "Owner") + ", Record: " + wins + "-" + losses + "-" + ties + ", PF: " + totalPf;

                    tableHtml += `
                        <tr class="${rowClass}">
                            <td class="rank"><span>${confRank}</span></td>
                            <td class="ficonname">
                                <a title="${tooltipText}" href="${targetHref}">
                                    <img align="middle" src="${logoUrl}" alt="${teamName}" id="franchiseicon_${profile.id}" class="franchiseicon" />
                                </a>
                                <b><a title="${tooltipText}" class="franchise_${profile.id}" href="${targetHref}">${teamName}</a></b>
                            </td>
                            <td class="pf">${totalPf}</td>
                            <td class="pa">${totalPa}</td>
                            <td class="h2hwlt">${wins}-${losses}-${ties}</td>
                            <td class="bbidbalance">${bbidFormatted}</td>
                        </tr>
                    `;
                });
            });
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        tableContainer.innerHTML = tableHtml;

    } catch (error) {
        console.error("HTML Structural Matrix Generation Failed:", error);
        tableContainer.innerHTML = `<div class="reportwrapper"><p>Standings module could not compile structural data matrix configuration parameters.</p></div>`;
    }
}
