/* ==========================================================================
   DNFL Power Rankings Chart & Data Table Logic (v4)
   ========================================================================== */
/* global DNFLClient, Papa, Chart */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};

    let rankingsMFLYear = '';
    let masterData = [];
    let prevWeekRankMap = {};
    let mflStandingsMap = {};
    let mflFranchiseMap = {};
    let chartInstance = null;
    let publishedWeeks = [];
    let isPreseasonWeek = true;

    /**
     * Normalizes MFL franchise ID to 4-digit string ('18' -> '0018')
     */
    function normId(id) {
        if (!id && id !== 0) return '';
        const s = String(id).trim();
        return s.padStart(4, '0');
    }

    /**
     * Initializes the rankings dashboard for a specific season year
     */
    async function init(mflYear) {
        if (!mflYear || mflYear === '%YEAR%') {
            mflYear = window.current_year;
            if (!mflYear) {
                const pathSegments = window.location.pathname.split('/');
                const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
                mflYear = foundYear ? foundYear : new Date().getFullYear();
            }
        }
        rankingsMFLYear = mflYear;

        const selector = document.getElementById('dnfl_weekSelector');
        if (!selector) return;

        const weeksUrl = `https://dnfl.live/dnfl_rankings/${rankingsMFLYear}/weeks.json`;
        const apiClient = window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);

        try {
            if (!apiClient) throw new Error("DNFLClient API middleware unavailable.");
            const rawJson = await apiClient.fetchRawText(weeksUrl);
            publishedWeeks = JSON.parse(rawJson);
        } catch (err) {
            console.warn("[DNFL Rankings] Could not load weeks.json, using fallback weeks.", err);
            publishedWeeks = [
                { id: "00_pre-season_NEW", display: "Pre-Season" },
                { id: "01_NEW", display: "Week 1" }
            ];
        }

        selector.innerHTML = ''; 
        publishedWeeks.forEach(week => {
            const opt = document.createElement('option');
            opt.value = week.id;
            opt.textContent = week.display;
            selector.appendChild(opt);
        });

        const mostRecentWeek = publishedWeeks[publishedWeeks.length - 1];
        if (mostRecentWeek) {
            selector.value = mostRecentWeek.id;
            loadWeeklyData();
        }
    }

    /**
     * Fetches CSV ranking data & MFL API data
     */
    async function loadWeeklyData() {
        const weekSelector = document.getElementById('dnfl_weekSelector');
        if (!weekSelector) return;

        const selectedWeekFile = weekSelector.value;
        isPreseasonWeek = selectedWeekFile.includes('00_pre-season') || selectedWeekFile.includes('pre-season');

        const filePath = `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_rankings/${rankingsMFLYear}/data_${selectedWeekFile}.csv`;
        const apiClient = window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);

        try {
            if (!apiClient) throw new Error("DNFLClient API middleware unavailable.");

            // Fetch League Franchise Metadata for Icons, Team Names & Owners
            try {
                const leagueData = await apiClient.fetchData('league');
                if (leagueData && leagueData.league && leagueData.league.franchises) {
                    const franchiseList = Array.isArray(leagueData.league.franchises.franchise) 
                        ? leagueData.league.franchises.franchise 
                        : [leagueData.league.franchises.franchise];
                    
                    mflFranchiseMap = {};
                    franchiseList.forEach(f => {
                        mflFranchiseMap[normId(f.id)] = {
                            name: f.name || 'Unknown Team',
                            owner: f.owner_name || 'Owner',
                            icon: f.icon || f.logo || 'https://dnfl.live/images/ficon-dnfl.png'
                        };
                    });
                }
            } catch (lErr) {
                console.warn("[DNFL Rankings] League metadata fetch warning:", lErr);
            }

            // If not pre-season, fetch previous week CSV and MFL weekly standings
            prevWeekRankMap = {};
            mflStandingsMap = {};

            const currentIndex = publishedWeeks.findIndex(w => w.id === selectedWeekFile);
            if (!isPreseasonWeek && currentIndex > 0) {
                const prevWeekFile = publishedWeeks[currentIndex - 1].id;
                const prevPath = `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_rankings/${rankingsMFLYear}/data_${prevWeekFile}.csv`;
                try {
                    const prevCsv = await apiClient.fetchRawText(prevPath);
                    const prevParsed = Papa.parse(prevCsv, { header: true, dynamicTyping: true, skipEmptyLines: true });
                    prevParsed.data.forEach(r => {
                        const fId = normId(r['Franchise ID'] || r['FranchiseId'] || r['id']);
                        const rk = parseInt(r['Rank'] || 0, 10);
                        if (fId) prevWeekRankMap[fId] = rk;
                    });
                } catch (pErr) {
                    console.warn("[DNFL Rankings] Could not fetch previous week rankings:", pErr);
                }

                // Parse week number (e.g., '01_NEW' -> 1)
                const weekNumMatch = selectedWeekFile.match(/(\d+)/);
                const weekNum = weekNumMatch ? parseInt(weekNumMatch[1], 10) : 1;

                try {
                    const standingsData = await apiClient.fetchData('leagueStandings', `&W=${weekNum}`);
                    if (standingsData && standingsData.leagueStandings && standingsData.leagueStandings.franchise) {
                        const stList = Array.isArray(standingsData.leagueStandings.franchise)
                            ? standingsData.leagueStandings.franchise
                            : [standingsData.leagueStandings.franchise];
                        
                        stList.forEach(s => {
                            const fId = normId(s.id);
                            const wins = s.h2hw || 0;
                            const losses = s.h2hl || 0;
                            const ties = s.h2ht || 0;
                            const pf = parseFloat(s.pf || 0);
                            mflStandingsMap[fId] = {
                                record: `${wins}-${losses}-${ties}`,
                                pf: pf.toFixed(2)
                            };
                        });
                    }
                } catch (sErr) {
                    console.warn("[DNFL Rankings] Standings API fetch warning:", sErr);
                }
            }

            // Fetch Current Week CSV
            const rawCsv = await apiClient.fetchRawText(filePath);
            const results = Papa.parse(rawCsv, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            });

            masterData = results.data.map(row => {
                const fId = normId(row['Franchise ID'] || row['FranchiseId'] || row['id']);
                const fallbackName = row['Franchise'] ? String(row['Franchise']).trim() : 'Unknown Team';
                const mflMeta = mflFranchiseMap[fId] || {};

                return {
                    rank: parseInt(row['Rank'] || 0, 10),
                    powerIndex: parseFloat(row['Power Index'] || row['Overall Grade'] || 0),
                    franchiseId: fId,
                    franchiseName: mflMeta.name || fallbackName,
                    ownerName: mflMeta.owner || row['Owner Name'] || 'Owner',
                    iconUrl: mflMeta.icon || 'https://dnfl.live/images/ficon-dnfl.png',
                    projectedRecord: row['Projected W-L'] || 'N/A',
                    comments: row['Rank Comments'] || ''
                };
            });

            renderChartAndTable(masterData);
        } catch (err) {
            console.error("[DNFL Rankings] CSV/Data fetch error:", err);
        }
    }

    /**
     * Renders both the bar chart and detailed data table
     */
    function renderChartAndTable(records) {
        const sortedData = [...records].sort((a, b) => a.rank - b.rank);
        const table = document.getElementById('dnfl_dataTable');
        const tableBody = document.getElementById('dnfl_tableBody');
        if (!table || !tableBody) return;

        // Render Table Header dynamically based on week type
        const thead = table.querySelector('thead');
        if (thead) {
            if (isPreseasonWeek) {
                thead.innerHTML = `
                    <tr>
                        <th class="dnfl-align-left">Rank</th>
                        <th class="dnfl-col-franchise dnfl-align-left">Franchise</th>
                        <th class="dnfl-align-center">Power Index</th>
                        <th class="dnfl-align-center">Projected Record</th>
                        <th class="dnfl-align-left">Rank Comments</th>
                    </tr>
                `;
            } else {
                thead.innerHTML = `
                    <tr>
                        <th class="dnfl-align-left">Rank</th>
                        <th class="dnfl-align-center">Change</th>
                        <th class="dnfl-col-franchise dnfl-align-left">Franchise</th>
                        <th class="dnfl-align-center">Power Index</th>
                        <th class="dnfl-align-center">Record</th>
                        <th class="dnfl-align-center">Points For</th>
                        <th class="dnfl-align-left">Rank Comments</th>
                    </tr>
                `;
            }
        }

        tableBody.innerHTML = '';

        sortedData.forEach(item => {
            const row = document.createElement('tr');
            
            // Calculate Rank Change
            let changeHtml = '';
            if (!isPreseasonWeek) {
                const prevRank = prevWeekRankMap[item.franchiseId];
                if (prevRank && prevRank > 0) {
                    const diff = prevRank - item.rank; // Positive = Improved Rank
                    if (diff > 0) {
                        changeHtml = `<span class="dnfl-badge dnfl-badge-green">▲ ${diff}</span>`;
                    } else if (diff < 0) {
                        changeHtml = `<span class="dnfl-badge dnfl-badge-red">▼ ${Math.abs(diff)}</span>`;
                    } else {
                        changeHtml = `<span class="dnfl-badge dnfl-badge-gray">-</span>`;
                    }
                } else {
                    changeHtml = `<span class="dnfl-badge dnfl-badge-gray">-</span>`;
                }
            }

            // Standings-style Franchise Column Formatting
            const franchiseColHtml = `
                <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
                    <img src="${item.iconUrl}" alt="${item.franchiseName}" class="franchiseicon" onError="this.onerror=null;this.src='https://dnfl.live/images/ficon-dnfl.png';" />
                    <div style="display: flex; flex-direction: column;">
                        <span class="dnfl-team-name">${item.franchiseName}</span>
                        <span class="dnfl-owner-name">${item.ownerName}</span>
                    </div>
                </div>
            `;

            const mflSt = mflStandingsMap[item.franchiseId] || {};
            const recordVal = isPreseasonWeek ? item.projectedRecord : (mflSt.record || '0-0-0');
            const pfVal = mflSt.pf || '0.00';

            if (isPreseasonWeek) {
                row.innerHTML = `
                    <td class="dnfl-align-left"><strong>${item.rank}</strong></td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-align-center"><strong>${item.powerIndex.toFixed(1)}</strong></td>
                    <td class="dnfl-align-center">${recordVal}</td>
                    <td class="dnfl-align-left">${item.comments}</td>
                `;
            } else {
                row.innerHTML = `
                    <td class="dnfl-align-left"><strong>${item.rank}</strong></td>
                    <td class="dnfl-align-center">${changeHtml}</td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-align-center"><strong>${item.powerIndex.toFixed(1)}</strong></td>
                    <td class="dnfl-align-center">${recordVal}</td>
                    <td class="dnfl-align-center"><span style="color: var(--dnfl-green-text, #15803d); font-weight: 700;">${pfVal}</span></td>
                    <td class="dnfl-align-left">${item.comments}</td>
                `;
            }

            tableBody.appendChild(row);
        });

        renderChart(records);
    }

    /**
     * Renders the horizontal bar chart
     */
    function renderChart(records) {
        const chartSorted = [...records].sort((a, b) => b.powerIndex - a.powerIndex);
        const labels = chartSorted.map(r => r.franchiseName);
        const dataValues = chartSorted.map(r => r.powerIndex);

        const weekDropdown = document.getElementById('dnfl_weekSelector');
        const displaySubtitle = weekDropdown && weekDropdown.options[weekDropdown.selectedIndex] ? 
                                weekDropdown.options[weekDropdown.selectedIndex].text + " Ranking" : "Ranking";

        const chartCanvas = document.getElementById('dnfl_powerRankingChart');
        if (!chartCanvas) return;
        const ctx = chartCanvas.getContext('2d');

        if (chartInstance) { 
            chartInstance.destroy(); 
        }

        const style = getComputedStyle(document.documentElement);
        const primaryDark = style.getPropertyValue('--dnfl-primary-dark').trim() || '#001A57';
        const primaryLight = style.getPropertyValue('--dnfl-primary-light').trim() || '#336699';
        const textMain = style.getPropertyValue('--dnfl-text-main').trim() || '#0f172a';

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: 'rgba(0, 83, 155, 0.85)', // Duke Royal Blue
                    borderColor: primaryDark,
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
                        color: primaryDark,
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: primaryDark,
                        bodyColor: textMain,
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        padding: 12,
                        enabled: true,
                        callbacks: {
                            label: function(context) {
                                const franchiseName = context.label;
                                const item = chartSorted.find(r => r.franchiseName === franchiseName);
                                if (!item) return 'No data found';
                                return [
                                    `Owner: ${item.ownerName}`,
                                    `Rank: #${item.rank}`,
                                    `Power Index: ${item.powerIndex.toFixed(1)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: 50, max: 100,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: { color: textMain },
                        title: { display: true, text: 'Power Index', color: primaryDark, font: { size: 14, weight: 'bold' }, padding: 15 }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: textMain }
                    }
                }
            }
        });
    }

    function toggleElementVisibility(sectionType) {
        if (sectionType === 'chart') {
            const wrapper = document.getElementById('dnfl_chartWrapperContainer');
            const button = document.getElementById('dnfl_chartToggleBtn');
            if (!wrapper || !button) return;

            if (wrapper.style.display === 'none') {
                wrapper.style.display = 'block';
                button.textContent = 'Hide Chart';
            } else {
                wrapper.style.display = 'none';
                button.textContent = 'Show Chart';
            }
        } else if (sectionType === 'table') {
            const wrapper = document.getElementById('dnfl_dataTable');
            const button = document.getElementById('dnfl_tableToggleBtn');
            if (!wrapper || !button) return;

            if (wrapper.style.display === 'none') {
                wrapper.style.display = 'table';
                button.textContent = 'Hide Table';
            } else {
                wrapper.style.display = 'none';
                button.textContent = 'Show Table';
            }
        }
    }

    window.DNFL.Rankings = {
        init: init,
        loadWeeklyData: loadWeeklyData,
        renderChartAndTable: renderChartAndTable,
        toggleElementVisibility: toggleElementVisibility
    };

    function autoInit() {
        if (document.getElementById('dnfl_weekSelector')) {
            init();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
})();
