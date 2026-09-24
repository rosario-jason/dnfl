/* ==========================================================================
   DNFL Standings & Seeding Engine (dnfl-standings-v4_02.js)
   Duke Networking Fantasy League (DNFL)
   v4.02 Framework Architecture Update:
   - Full alignment with Level 3 Card Shell & .dnfl-legend-panel architecture
   - Repeats table subheader per division with division header placed above
   - Concatenates Title Case {Conference} {Division} names
   - Standardizes Points For (PF) & Points Against (PA) with .dnfl-badge-green and .dnfl-badge-red
   - Uses .dnfl-row-even / .dnfl-row-odd data-index striping and .dnfl-my-team session highlighting
   ========================================================================== */

(function (window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};
    window.DNFL.Standings = window.DNFL.Standings || {};

    const standingsMFLYear = '2024';
    let masterStandingsData = [];
    let standingsRules = null;
    let mflFranchiseMap = {};
    let collapsedDivisions = {};

    function normId(id) {
        if (!id) return '';
        let str = String(id).trim();
        while (str.length < 4) str = '0' + str;
        return str;
    }

    function getLoggedInFranchiseId() {
        if (window.franchise_id && String(window.franchise_id).trim() !== '') return normId(window.franchise_id);
        if (window.mflFranchiseId && String(window.mflFranchiseId).trim() !== '') return normId(window.mflFranchiseId);
        if (window.login_franchise_id && String(window.login_franchise_id).trim() !== '') return normId(window.login_franchise_id);
        if (window.current_franchise_id && String(window.current_franchise_id).trim() !== '') return normId(window.current_franchise_id);
        if (window.DNFLClient && typeof window.DNFLClient.getFranchiseId === 'function') {
            const fid = window.DNFLClient.getFranchiseId();
            if (fid) return normId(fid);
        }
        return '';
    }

    function getLeagueId() {
        if (window.DNFLClient && typeof window.DNFLClient.getLeagueId === 'function') {
            return window.DNFLClient.getLeagueId() || '23426';
        }
        return window.league_id || '23426';
    }

    function toTitleCase(str) {
        if (!str) return '';
        return String(str).toLowerCase().replace(/(?:^|\s|-)\w/g, function (match) {
            return match.toUpperCase();
        });
    }

    async function init() {
        try {
            const client = window.DNFLClient || (window.DNFL && window.DNFL.Client);
            const leagueId = getLeagueId();

            if (client) {
                try {
                    const rulesResp = await fetch('https://dnfl.live/data/standings_rules.json');
                    standingsRules = await rulesResp.json();
                } catch (e) {
                    console.warn("[DNFL Standings] Rules JSON fetch fallback:", e);
                }

                const leagueData = await client.fetchMFL('league', { L: leagueId, YEAR: standingsMFLYear });
                if (leagueData && leagueData.league && leagueData.league.franchises && leagueData.league.franchises.franchise) {
                    const list = Array.isArray(leagueData.league.franchises.franchise)
                        ? leagueData.league.franchises.franchise
                        : [leagueData.league.franchises.franchise];

                    list.forEach(f => {
                        const fid = normId(f.id);
                        mflFranchiseMap[fid] = {
                            name: f.name || 'Unknown Team',
                            owner: f.owner_name || 'Owner',
                            icon: f.icon || 'https://dnfl.live/images/ficon-dnfl.png',
                            conference: f.conference || 'Other',
                            division: f.division || '',
                            bbid: f.bbidAvailableBalance || f.bbid || '100'
                        };
                    });
                }

                const standingsData = await client.fetchMFL('leagueStandings', { L: leagueId, YEAR: standingsMFLYear });
                if (standingsData && standingsData.leagueStandings && standingsData.leagueStandings.franchise) {
                    const stList = Array.isArray(standingsData.leagueStandings.franchise)
                        ? standingsData.leagueStandings.franchise
                        : [standingsData.leagueStandings.franchise];

                    masterStandingsData = stList.map((sf, index) => {
                        const sfid = normId(sf.id);
                        const mflMeta = mflFranchiseMap[sfid] || {};
                        const wins = parseInt(sf.h2hw || sf.w || 0, 10);
                        const losses = parseInt(sf.h2hl || sf.l || 0, 10);
                        const ties = parseInt(sf.h2ht || sf.t || 0, 10);
                        const pf = parseFloat(sf.pf || 0);
                        const pa = parseFloat(sf.pa || 0);
                        const seed = parseInt(sf.seed || (index + 1), 10);

                        return {
                            seed: seed,
                            franchiseId: sfid,
                            franchiseName: mflMeta.name || sf.name || 'Unknown Team',
                            ownerName: mflMeta.owner || 'Owner',
                            iconUrl: mflMeta.icon || 'https://dnfl.live/images/ficon-dnfl.png',
                            conference: mflMeta.conference || 'Other',
                            division: mflMeta.division || 'Division',
                            record: `${wins}-${losses}-${ties}`,
                            pf: pf,
                            pa: pa,
                            bbid: mflMeta.bbid || '100',
                            isChampion: seed === 1,
                            isPlayoffs: seed <= 6,
                            isPromotion: false,
                            isRelegation: false
                        };
                    });
                }
            }

            updateConferenceFilter();
            renderStandings();
            renderStandingsLegend();
        } catch (err) {
            console.error("[DNFL Standings] Initialization Error:", err);
        }
    }

    function updateConferenceFilter() {
        const select = document.getElementById('dnfl_standings_confFilter');
        if (!select) return;

        const confSet = new Set();
        masterStandingsData.forEach(d => {
            if (d.conference) confSet.add(String(d.conference).trim());
        });

        select.innerHTML = '<option value="All">All Conferences</option>';
        Array.from(confSet).sort().forEach(conf => {
            const opt = document.createElement('option');
            opt.value = conf;
            opt.textContent = conf;
            select.appendChild(opt);
        });
    }

    function applyConferenceFilter() {
        renderStandings();
    }

    function renderStandingsLegend() {
        const legendContainer = document.getElementById('dnfl-standings-legend');
        if (!legendContainer) return;

        legendContainer.innerHTML = `
            <div class="dnfl-legend-item">
                <span>👑 Overall Champion</span>
            </div>
            <div class="dnfl-legend-item">
                <span>🏆 Playoff Qualifier</span>
            </div>
            <div class="dnfl-legend-item">
                <span>🟢 Promotion Zone</span>
            </div>
            <div class="dnfl-legend-item">
                <span>🔴 Relegation Zone</span>
            </div>
        `;
    }

    function renderStandings() {
        const tableBody = document.getElementById('dnfl_standings_tableBody');
        const filterSelect = document.getElementById('dnfl_standings_confFilter');
        if (!tableBody) return;

        const selectedConf = filterSelect ? filterSelect.value : 'All';

        let filteredData = [...masterStandingsData];
        if (selectedConf && selectedConf !== 'All') {
            filteredData = masterStandingsData.filter(d => String(d.conference).trim().toLowerCase() === selectedConf.trim().toLowerCase());
        }

        const divisionsMap = {};
        filteredData.forEach(item => {
            const confName = String(item.conference || '').trim();
            const divName = String(item.division || 'General').trim();
            
            let fullDivTitle = divName;
            if (divName && !divName.toLowerCase().includes(confName.toLowerCase())) {
                fullDivTitle = `${confName} ${divName}`;
            }
            fullDivTitle = toTitleCase(fullDivTitle);

            if (!divisionsMap[fullDivTitle]) {
                divisionsMap[fullDivTitle] = [];
            }
            divisionsMap[fullDivTitle].push(item);
        });

        tableBody.innerHTML = '';

        const activeLeagueId = getLeagueId();
        const activeHost = window.location.hostname || 'www48.myfantasyleague.com';
        const activeFranchiseId = getLoggedInFranchiseId();

        let globalTeamIndex = 0;

        Object.keys(divisionsMap).forEach(divTitle => {
            const teamList = divisionsMap[divTitle].sort((a, b) => a.seed - b.seed);
            const divSlug = divTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const isCollapsed = Boolean(collapsedDivisions[divSlug]);

            // 1. Division Header Row (Placed ABOVE table header)
            const divHeaderRow = document.createElement('tr');
            divHeaderRow.className = 'dnfl-division-header';
            divHeaderRow.innerHTML = `
                <td colspan="6" class="dnfl-division-header-cell">
                    <div class="dnfl-division-header-content">
                        <h3>${divTitle}</h3>
                        <button class="dnfl-btn dnfl-btn-secondary dnfl-btn-icon" onclick="DNFL.Standings.toggleDivision('${divSlug}')" title="Toggle Division Visibility">
                            <i class="fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i>
                            <span>${isCollapsed ? 'Show' : 'Hide'}</span>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(divHeaderRow);

            // 2. Table Column Subheader Row (Repeated per division)
            const subHeaderRow = document.createElement('tr');
            subHeaderRow.className = `dnfl-table-subheader dnfl-div-group-${divSlug}`;
            if (isCollapsed) subHeaderRow.style.display = 'none';
            subHeaderRow.innerHTML = `
                <th class="dnfl-col-seed">Seed</th>
                <th class="dnfl-col-franchise">Franchise</th>
                <th class="dnfl-col-pf dnfl-hide-mobile">Points For</th>
                <th class="dnfl-col-pa dnfl-hide-mobile">Points Against</th>
                <th class="dnfl-col-record">Record</th>
                <th class="dnfl-col-bbid dnfl-hide-mobile">BBID $</th>
            `;
            tableBody.appendChild(subHeaderRow);

            // 3. Division Team Rows
            teamList.forEach((item) => {
                const franchiseUrl = `https://${activeHost}/${standingsMFLYear}/options?L=${activeLeagueId}&F=${item.franchiseId}&O=01`;

                let iconStatus = '';
                if (item.isChampion) iconStatus = ' 👑';
                else if (item.isPlayoffs) iconStatus = ' 🏆';

                const seedBadgeHtml = `
                    <span class="dnfl-rank-badge" style="background-color: var(--dnfl-primary, #0577B1); color: #ffffff;">
                        ${item.seed}${iconStatus}
                    </span>
                `;

                const franchiseColHtml = `
                    <div class="dnfl-franchise-cell">
                        <a href="${franchiseUrl}" title="View Franchise Page">
                            <img src="${item.iconUrl}" alt="${item.franchiseName}" class="franchiseicon" onError="this.onerror=null;this.src='https://dnfl.live/images/ficon-dnfl.png';" />
                        </a>
                        <div class="dnfl-franchise-info">
                            <a href="${franchiseUrl}" class="dnfl-team-name">${item.franchiseName}</a>
                            <span class="dnfl-owner-name">${item.ownerName}</span>
                        </div>
                    </div>
                `;

                const formattedPf = item.pf.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const formattedPa = item.pa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                const pfBadgeHtml = `<span class="dnfl-badge dnfl-badge-green">${formattedPf}</span>`;
                const paBadgeHtml = `<span class="dnfl-badge dnfl-badge-red">${formattedPa}</span>`;
                const recordBadgeHtml = `<span class="dnfl-pill-blue dnfl-pill">${item.record}</span>`;

                const isMyTeam = activeFranchiseId && activeFranchiseId !== '0000' && item.franchiseId === activeFranchiseId;
                const stripeClass = (globalTeamIndex % 2 === 1) ? 'dnfl-row-even' : 'dnfl-row-odd';
                const myTeamClass = isMyTeam ? ' dnfl-my-team myfranchise' : '';

                const teamRow = document.createElement('tr');
                teamRow.className = `${stripeClass}${myTeamClass} dnfl-div-group-${divSlug}`;
                if (isCollapsed) teamRow.style.display = 'none';

                teamRow.innerHTML = `
                    <td class="dnfl-col-seed">${seedBadgeHtml}</td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-col-pf dnfl-hide-mobile">${pfBadgeHtml}</td>
                    <td class="dnfl-col-pa dnfl-hide-mobile">${paBadgeHtml}</td>
                    <td class="dnfl-col-record">${recordBadgeHtml}</td>
                    <td class="dnfl-col-bbid dnfl-hide-mobile">$${item.bbid}</td>
                `;

                tableBody.appendChild(teamRow);
                globalTeamIndex++;
            });
        });
    }

    function toggleDivision(divSlug) {
        collapsedDivisions[divSlug] = !collapsedDivisions[divSlug];
        renderStandings();
    }

    window.DNFL.Standings = {
        init: init,
        applyConferenceFilter: applyConferenceFilter,
        toggleDivision: toggleDivision
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

})(window, document);
