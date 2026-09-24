/* ==========================================================================
   DNFL Power Rankings Engine (dnfl-rankings-v4_16.js)
   Duke Networking Fantasy League (DNFL)
   v4.16 Framework Architecture Update:
   - Synchronized .dnfl-legend-panel utility class targeting for swatches
   - Fully integrated with DNFL.Client API middleware & Chart.js horizontal bars
   ========================================================================== */

(function (window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};
    window.DNFL.Rankings = window.DNFL.Rankings || {};

    const rankingsMFLYear = '2024';
    let chartInstance = null;
    let isChartVisible = true;
    let masterData = [];
    let isPreseasonWeek = false;
    let mflFranchiseMap = {};
    let mflStandingsMap = {};
    let prevWeekRankMap = {};

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

    function resolveConferenceColors(confName) {
        const key = String(confName || '').trim().toLowerCase();
        let slotIndex = 1;

        if (key.includes('crazies') || key.includes('blue')) slotIndex = 1;
        else if (key.includes('devils') || key.includes('red')) slotIndex = 2;
        else if (key.includes('camerone') || key.includes('teal')) slotIndex = 3;
        else if (key.includes('legacy') || key.includes('orange')) slotIndex = 4;
        else if (key.includes('gothic') || key.includes('purple')) slotIndex = 5;
        else if (key.includes('iron') || key.includes('green')) slotIndex = 6;
        else {
            let hash = 0;
            for (let i = 0; i < confName.length; i++) hash = confName.charCodeAt(i) + ((hash << 5) - hash);
            slotIndex = (Math.abs(hash) % 6) + 1;
        }

        const style = getComputedStyle(document.documentElement);
        const bgVar = style.getPropertyValue(`--dnfl-chart-bg-${slotIndex}`).trim() || 'rgba(54, 162, 235, 0.85)';
        const borderVar = style.getPropertyValue(`--dnfl-chart-border-${slotIndex}`).trim() || 'rgb(54, 162, 235)';

        return {
            bg: bgVar,
            border: borderVar,
            slotClass: `color-${slotIndex}`
        };
    }

    async function ensureLeagueMetadata() {
        if (Object.keys(mflFranchiseMap).length > 0) return;

        try {
            const leagueId = getLeagueId();
            const client = window.DNFLClient || (window.DNFL && window.DNFL.Client);
            if (!client) return;

            const leagueData = await client.fetchMFL('league', { L: leagueId, YEAR: rankingsMFLYear });
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
                        division: f.division || ''
                    };
                });
            }

            const standingsData = await client.fetchMFL('leagueStandings', { L: leagueId, YEAR: rankingsMFLYear });
            if (standingsData && standingsData.leagueStandings && standingsData.leagueStandings.franchise) {
                const stList = Array.isArray(standingsData.leagueStandings.franchise)
                    ? standingsData.leagueStandings.franchise
                    : [standingsData.leagueStandings.franchise];

                stList.forEach(sf => {
                    const sfid = normId(sf.id);
                    const wins = parseInt(sf.h2hw || sf.w || 0, 10);
                    const losses = parseInt(sf.h2hl || sf.l || 0, 10);
                    const ties = parseInt(sf.h2ht || sf.t || 0, 10);
                    const pf = parseFloat(sf.pf || 0).toFixed(2);

                    mflStandingsMap[sfid] = {
                        record: `${wins}-${losses}-${ties}`,
                        pf: pf
                    };
                });
            }
        } catch (err) {
            console.error("[DNFL Rankings] MFL Metadata Fetch Warning:", err);
        }
    }

    async function init() {
        try {
            await ensureLeagueMetadata();

            const response = await fetch('https://dnfl.live/data/weeks.json');
            const weeksData = await response.json();
            populateWeekSelect(weeksData);

            const defaultWeekObj = weeksData.find(w => w.default) || weeksData[weeksData.length - 1];
            if (defaultWeekObj) {
                const select = document.getElementById('dnfl_weekSelect');
                if (select) select.value = defaultWeekObj.file;
                await loadWeekData(defaultWeekObj.file, defaultWeekObj.isPreseason);
            }
        } catch (err) {
            console.error("[DNFL Rankings] Initialization Error:", err);
        }
    }

    function populateWeekSelect(weeks) {
        const select = document.getElementById('dnfl_weekSelect');
        if (!select) return;
        select.innerHTML = '';
        weeks.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.file;
            opt.textContent = w.name;
            select.appendChild(opt);
        });
    }

    async function handleWeekChange() {
        const select = document.getElementById('dnfl_weekSelect');
        if (!select) return;
        const selectedFile = select.value;

        const response = await fetch('https://dnfl.live/data/weeks.json');
        const weeksData = await response.json();
        const weekObj = weeksData.find(w => w.file === selectedFile);
        const isPre = weekObj ? Boolean(weekObj.isPreseason) : false;

        await loadWeekData(selectedFile, isPre);
    }

    async function loadWeekData(fileName, isPreseason) {
        isPreseasonWeek = isPreseason;
        try {
            const csvResponse = await fetch(`https://dnfl.live/data/${fileName}`);
            const rawCsv = await csvResponse.text();

            if (typeof Papa === 'undefined') {
                throw new Error("PapaParse library unavailable.");
            }

            const results = Papa.parse(rawCsv, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            });

            masterData = results.data.map(row => {
                const fId = normId(row['Franchise ID'] || row['FranchiseId'] || row['id']);
                const mflMeta = mflFranchiseMap[fId] || {};

                return {
                    overallRank: parseInt(row['Rank'] || 0, 10),
                    powerIndex: parseFloat(row['Power Index'] || 0),
                    tier: row['Tier'] || '',
                    franchiseId: fId,
                    franchiseName: mflMeta.name || row['Franchise Name'] || 'Unknown Team',
                    ownerName: mflMeta.owner || row['Owner'] || 'Owner',
                    iconUrl: mflMeta.icon || 'https://dnfl.live/images/ficon-dnfl.png',
                    conference: mflMeta.conference || 'Other',
                    division: mflMeta.division || '',
                    projectedRecord: row['Projected W-L'] || 'N/A',
                    comments: row['Comments'] || row['Rank Comments'] || row['Commentary'] || ''
                };
            });

            updateConferenceControls();
            applyConferenceFilter();
        } catch (err) {
            console.error("[DNFL Rankings] CSV Data fetch error:", err);
        }
    }

    function updateConferenceControls() {
        const confFilter = document.getElementById('dnfl_confFilter');
        if (!confFilter) return;

        const currentSelection = confFilter.value;
        const confSet = new Set();
        masterData.forEach(d => {
            if (d.conference) confSet.add(String(d.conference).trim());
        });

        confFilter.innerHTML = '<option value="All">All Conferences</option>';
        Array.from(confSet).sort().forEach(conf => {
            const opt = document.createElement('option');
            opt.value = conf;
            opt.textContent = conf;
            confFilter.appendChild(opt);
        });

        if (Array.from(confSet).includes(currentSelection)) {
            confFilter.value = currentSelection;
        } else {
            confFilter.value = 'All';
        }
    }

    function applyConferenceFilter() {
        const confFilter = document.getElementById('dnfl_confFilter');
        const selectedConf = confFilter ? confFilter.value : 'All';

        let filtered;
        if (!selectedConf || selectedConf === 'All') {
            filtered = [...masterData];
        } else {
            filtered = masterData.filter(d => String(d.conference).trim().toLowerCase() === selectedConf.trim().toLowerCase());
        }

        renderChartAndTable(filtered, selectedConf);
    }

    function renderChartAndTable(records, activeConfFilter = 'All') {
        const sortedData = [...records].sort((a, b) => a.overallRank - b.overallRank);
        const table = document.getElementById('dnfl_dataTable');
        const tableBody = document.getElementById('dnfl_tableBody');
        if (!table || !tableBody) return;

        const cardContainer = document.getElementById('dnfl-rankings-container');
        if (cardContainer) {
            if (isPreseasonWeek) {
                cardContainer.classList.add('dnfl-preseason');
            } else {
                cardContainer.classList.remove('dnfl-preseason');
            }
        }

        const isFiltered = activeConfFilter && activeConfFilter !== 'All';

        const thead = table.querySelector('thead');
        if (thead) {
            if (isPreseasonWeek) {
                thead.innerHTML = `
                    <tr>
                        <th class="dnfl-col-rank">Rank</th>
                        <th class="dnfl-col-franchise">Franchise</th>
                        <th class="dnfl-col-index">Power Index</th>
                        <th class="dnfl-col-comment" style="text-align: center;">Comments</th>
                        <th class="dnfl-col-record">Projected W-L</th>
                    </tr>
                `;
            } else {
                thead.innerHTML = `
                    <tr>
                        <th class="dnfl-col-rank">Rank</th>
                        <th class="dnfl-col-change dnfl-hide-mobile">Change</th>
                        <th class="dnfl-col-franchise">Franchise</th>
                        <th class="dnfl-col-index">Power Index</th>
                        <th class="dnfl-col-comment" style="text-align: center;">Comments</th>
                        <th class="dnfl-col-record dnfl-hide-mobile">Record</th>
                        <th class="dnfl-col-pf dnfl-hide-mobile">Points For</th>
                    </tr>
                `;
            }
        }

        tableBody.innerHTML = '';

        const activeLeagueId = getLeagueId();
        const activeHost = window.location.hostname || 'www48.myfantasyleague.com';
        const activeFranchiseId = getLoggedInFranchiseId();

        sortedData.forEach((item, index) => {
            const displayRank = isFiltered ? (index + 1) : item.overallRank;

            const confKey = String(item.conference).trim();
            const palette = resolveConferenceColors(confKey);

            const rankBadgeHtml = `
                <span class="dnfl-rank-badge" style="background-color: ${palette.bg}; border: 1px solid ${palette.border}; color: #ffffff;">
                    ${displayRank}
                </span>
            `;

            let changeBadgeHtml = '';
            if (!isPreseasonWeek) {
                const prevMeta = prevWeekRankMap[item.franchiseId];
                if (prevMeta) {
                    const prevRankToCompare = isFiltered ? prevMeta.confRank : prevMeta.overallRank;
                    if (prevRankToCompare && prevRankToCompare > 0) {
                        const diff = prevRankToCompare - displayRank;
                        if (diff > 0) {
                            changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-green">▲ +${diff}</span>`;
                        } else if (diff < 0) {
                            changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-red">▼ -${Math.abs(diff)}</span>`;
                        } else {
                            changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-gray">-</span>`;
                        }
                    } else {
                        changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-gray">-</span>`;
                    }
                } else {
                    changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-gray">-</span>`;
                }
            }

            const franchiseUrl = `https://${activeHost}/${rankingsMFLYear}/options?L=${activeLeagueId}&F=${item.franchiseId}&O=01`;

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

            const mflSt = mflStandingsMap[item.franchiseId] || {};
            const recordVal = isPreseasonWeek ? item.projectedRecord : (mflSt.record || '0-0-0');
            const pfVal = mflSt.pf || '0.00';

            const hasComment = Boolean(item.comments && item.comments.trim().length > 0);
            const commentBtnHtml = hasComment ? `
                <button class="dnfl-btn dnfl-btn-secondary dnfl-btn-icon" onclick="DNFL.Rankings.toggleCommentRow('${item.franchiseId}')" title="View Comments" aria-label="View Comments">
                    <i class="fa-solid fa-comment-dots"></i>
                </button>
            ` : '<span style="color: var(--dnfl-text-subtle, #94a3b8); font-size: 0.75rem;">—</span>';

            const isMyTeam = activeFranchiseId && activeFranchiseId !== '0000' && item.franchiseId === activeFranchiseId;
            const stripeClass = (index % 2 === 1) ? 'dnfl-row-even' : 'dnfl-row-odd';
            const myTeamClass = isMyTeam ? ' dnfl-my-team myfranchise' : '';

            const mainRow = document.createElement('tr');
            mainRow.className = `${stripeClass}${myTeamClass}`;

            if (isPreseasonWeek) {
                mainRow.innerHTML = `
                    <td class="dnfl-col-rank">${rankBadgeHtml}</td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-col-index"><span class="dnfl-pill-blue dnfl-pill">${item.powerIndex.toFixed(1)}</span></td>
                    <td class="dnfl-col-comment" style="text-align: center;">${commentBtnHtml}</td>
                    <td class="dnfl-col-record">${recordVal}</td>
                `;
            } else {
                mainRow.innerHTML = `
                    <td class="dnfl-col-rank">${rankBadgeHtml}</td>
                    <td class="dnfl-col-change dnfl-hide-mobile">${changeBadgeHtml}</td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-col-index"><span class="dnfl-pill-blue dnfl-pill">${item.powerIndex.toFixed(1)}</span></td>
                    <td class="dnfl-col-comment" style="text-align: center;">${commentBtnHtml}</td>
                    <td class="dnfl-col-record dnfl-hide-mobile">${recordVal}</td>
                    <td class="dnfl-col-pf dnfl-hide-mobile">${pfVal}</td>
                `;
            }

            tableBody.appendChild(mainRow);

            if (hasComment) {
                const subRow = document.createElement('tr');
                subRow.id = `dnfl-comment-row-${item.franchiseId}`;
                subRow.style.display = 'none';
                subRow.className = 'dnfl-comment-row';

                const colSpanCount = isPreseasonWeek ? 5 : 7;
                subRow.innerHTML = `
                    <td colspan="${colSpanCount}" class="dnfl-comment-cell">
                        <div class="dnfl-comment-box">
                            ${item.comments}
                        </div>
                    </td>
                `;
                tableBody.appendChild(subRow);
            }
        });

        renderChart(records);
        renderLegend(records);
    }

    function renderLegend(records) {
        const legendContainer = document.getElementById('dnfl_rankings_legend');
        if (!legendContainer) return;

        const confMap = {};
        records.forEach(r => {
            const conf = String(r.conference || 'Other').trim();
            if (!confMap[conf]) {
                confMap[conf] = resolveConferenceColors(conf);
            }
        });

        legendContainer.innerHTML = '';
        Object.keys(confMap).sort().forEach(conf => {
            const pal = confMap[conf];
            const itemEl = document.createElement('div');
            itemEl.className = 'dnfl-legend-item';
            itemEl.innerHTML = `
                <span class="dnfl-legend-swatch ${pal.slotClass}"></span>
                <span>${conf}</span>
            `;
            legendContainer.appendChild(itemEl);
        });
    }

    function renderChart(records) {
        const canvas = document.getElementById('dnfl_rankingsChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        const chartSorted = [...records].sort((a, b) => b.powerIndex - a.powerIndex);
        const labels = chartSorted.map(r => r.franchiseName);
        const dataValues = chartSorted.map(r => r.powerIndex);
        const backgroundColors = chartSorted.map(r => resolveConferenceColors(r.conference).bg);
        const borderColors = chartSorted.map(r => resolveConferenceColors(r.conference).border);

        const select = document.getElementById('dnfl_weekSelect');
        const weekName = select && select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : '';
        const displaySubtitle = `${weekName} Power Index Evaluation`;

        const style = getComputedStyle(document.documentElement);
        const getCssVar = (varName, fallback) => style.getPropertyValue(varName).trim() || fallback;

        const bgSubhead = getCssVar('--dnfl-bg-subhead', '#f1f5f9');
        const textMain = getCssVar('--dnfl-text-main', '#121212');
        const borderDark = getCssVar('--dnfl-border-dark', '#444444');

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4,      
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y', 
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: false },
                    subtitle: {
                        display: true,
                        text: displaySubtitle,
                        color: textMain,
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: bgSubhead,
                        titleColor: textMain,
                        bodyColor: textMain,
                        borderColor: borderDark,
                        borderWidth: 1,
                        padding: 12,
                        enabled: true,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0] ? context[0].label : '';
                            },
                            label: function(context) {
                                const franchiseName = context.label;
                                const item = chartSorted.find(r => r.franchiseName === franchiseName);
                                if (!item) return 'No data found';
                                
                                const confName = String(item.conference || '').trim();
                                const divName = String(item.division || '').trim();
                                let divDisplay = divName;
                                if (divName && !divName.toLowerCase().includes(confName.toLowerCase())) {
                                    divDisplay = `${confName} ${divName}`;
                                }
                                if (!divDisplay) divDisplay = confName;

                                return [
                                    `${item.ownerName}`,
                                    `${divDisplay}`,
                                    `${item.powerIndex.toFixed(1)}`,
                                    `Rank - ${item.overallRank}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function toggleChart() {
        const wrapper = document.getElementById('dnfl_chartWrapper');
        const btn = document.getElementById('dnfl_toggleChartBtn');
        if (!wrapper || !btn) return;

        isChartVisible = !isChartVisible;
        if (isChartVisible) {
            wrapper.style.display = 'block';
            btn.innerHTML = `
                <i class="fa-solid fa-chart-simple"></i>
                <span class="btn-text-full">Hide Chart</span>
                <span class="btn-text-short">Chart</span>
            `;
        } else {
            wrapper.style.display = 'none';
            btn.innerHTML = `
                <i class="fa-solid fa-chart-simple"></i>
                <span class="btn-text-full">Show Chart</span>
                <span class="btn-text-short">Chart</span>
            `;
        }
    }

    function toggleCommentRow(franchiseId) {
        const row = document.getElementById(`dnfl-comment-row-${franchiseId}`);
        if (!row) return;
        if (row.style.display === 'none' || !row.style.display) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    }

    window.DNFL.Rankings = {
        init: init,
        handleWeekChange: handleWeekChange,
        applyConferenceFilter: applyConferenceFilter,
        toggleChart: toggleChart,
        toggleCommentRow: toggleCommentRow
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

})(window, document);
