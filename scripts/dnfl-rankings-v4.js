/* ==========================================================================
   DNFL Power Rankings Chart & Data Table Logic (v4)
   Directly based on dnfl-rankings-live-js and dnfl-global-live-css
   ========================================================================== */
/* global DNFLClient, Papa, Chart */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    let rankingsMFLYear = '';
    let masterData = [];
    let prevWeekRankMap = {};
    let mflStandingsMap = {};
    let mflFranchiseMap = {};
    let chartInstance = null;
    let publishedWeeks = [];
    let isPreseasonWeek = true;

    const conferenceColors = {
        'Cameron Crazies': 'rgba(54, 162, 235, 0.85)',
        'K-Ville': 'rgba(255, 99, 132, 0.85)',
        'Blue Devils': 'rgba(75, 192, 192, 0.85)'
    };

    const conferenceBorders = {
        'Cameron Crazies': 'rgb(54, 162, 235)',
        'K-Ville': 'rgb(255, 99, 132)',
        'Blue Devils': 'rgb(75, 192, 192)'
    };

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
     * @param {string|number} mflYear 
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
            if (!apiClient) {
                throw new Error("DNFLClient API middleware unavailable.");
            }
            const rawJson = await apiClient.fetchRawText(weeksUrl);
            publishedWeeks = JSON.parse(rawJson);
        } catch (err) {
            console.warn("[DNFL Rankings] Could not load weeks.json, using fallback week.", err);
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
     * Fetches CSV ranking data via DNFLClient and parses via PapaParse
     */
    async function loadWeeklyData() {
        const weekSelector = document.getElementById('dnfl_weekSelector');
        if (!weekSelector) return;

        const selectedWeekFile = weekSelector.value;
        isPreseasonWeek = selectedWeekFile.includes('00_pre-season') || selectedWeekFile.includes('pre-season');

        const filePath = `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_rankings/${rankingsMFLYear}/data_${selectedWeekFile}.csv`;
        const apiClient = window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);

        try {
            if (!apiClient) {
                throw new Error("DNFLClient API middleware unavailable.");
            }

            // Fetch League Franchise Metadata for Icons, Team Names, Owners, Conferences & Divisions
            try {
                const leagueData = await apiClient.fetchData('league');
                if (leagueData && leagueData.league) {
                    const confList = leagueData.league.conferences ? (Array.isArray(leagueData.league.conferences.conference) ? leagueData.league.conferences.conference : [leagueData.league.conferences.conference]) : [];
                    const divList = leagueData.league.divisions ? (Array.isArray(leagueData.league.divisions.division) ? leagueData.league.divisions.division : [leagueData.league.divisions.division]) : [];
                    const franList = leagueData.league.franchises ? (Array.isArray(leagueData.league.franchises.franchise) ? leagueData.league.franchises.franchise : [leagueData.league.franchises.franchise]) : [];

                    const confMap = {};
                    confList.forEach(c => { confMap[normId(c.id)] = c.name; });

                    const divMap = {};
                    divList.forEach(d => {
                        divMap[normId(d.id)] = {
                            name: d.name,
                            confName: confMap[normId(d.conference)] || ''
                        };
                    });

                    mflFranchiseMap = {};
                    franList.forEach(f => {
                        const fId = normId(f.id);
                        const divObj = divMap[normId(f.division)] || {};
                        const confName = divObj.confName || f.conference || 'Other';
                        const divName = divObj.name ? `${confName} - ${divObj.name}` : confName;

                        mflFranchiseMap[fId] = {
                            name: f.name || 'Unknown Team',
                            owner: f.owner_name || 'Owner',
                            icon: f.icon || f.logo || 'https://dnfl.live/images/ficon-dnfl.png',
                            conference: confName,
                            division: divName
                        };
                    });
                }
            } catch (lErr) {
                console.warn("[DNFL Rankings] League metadata fetch warning:", lErr);
            }

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
                    grade: parseFloat(row['Power Index'] || row['Overall Grade'] || 0),
                    franchiseId: fId,
                    franchise: mflMeta.name || fallbackName,
                    franchiseName: mflMeta.name || fallbackName,
                    owner: mflMeta.owner || row['Owner Name'] || 'Owner',
                    coOwner: row['Co-Owner Name'] || '',
                    ownerName: mflMeta.owner || row['Owner Name'] || 'Owner',
                    iconUrl: mflMeta.icon || 'https://dnfl.live/images/ficon-dnfl.png',
                    conference: mflMeta.conference || row['Conference'] || 'Other',
                    division: mflMeta.division || row['Conference - Division'] || '',
                    projectedRecord: row['Projected W-L'] || 'N/A',
                    comments: row['Rank Comments'] || 'No comment provided.'
                };
            });

            applyConferenceFilter();
        } catch (err) {
            console.error("[DNFL Rankings] CSV Data fetch error:", err);
        }
    }

    /**
     * Renders both the bar chart and detailed data table
     * @param {Array} records 
     */
    function renderChartAndTable(records) {
        const sortedData = [...records].sort((a, b) => a.rank - b.rank);
        const tableBody = document.getElementById('dnfl_tableBody');
        const table = document.getElementById('dnfl_dataTable');
        if (!tableBody) return;

        const thead = table ? table.querySelector('thead') : null;
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

        sortedData.forEach((item, index) => {
            const row = document.createElement('tr');
            const confKey = String(item.conference).trim();
            const badgeColor = conferenceColors[confKey] || 'var(--dnfl-border-dark)'; 
            const borderStyle = conferenceBorders[confKey] || 'var(--dnfl-border-dark)';

            const displayRank = item.rank || (index + 1);

            const rankBadgeHtml = `
                <span class="dnfl-rank-badge" style="background-color: ${badgeColor}; border: 1px solid ${borderStyle};">
                    ${displayRank}
                </span>
            `;

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
                    <td class="dnfl-align-center">${rankBadgeHtml}</td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-align-center"><strong>${item.powerIndex.toFixed(1)}</strong></td>
                    <td class="dnfl-align-center">${recordVal}</td>
                    <td class="dnfl-align-left">${item.comments}</td>
                `;
            } else {
                let changeHtml = '';
                const prevRank = prevWeekRankMap[item.franchiseId];
                if (prevRank && prevRank > 0) {
                    const diff = prevRank - item.rank;
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

                row.innerHTML = `
                    <td class="dnfl-align-center">${rankBadgeHtml}</td>
                    <td class="dnfl-align-center">${changeHtml}</td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-align-center"><strong>${item.powerIndex.toFixed(1)}</strong></td>
                    <td class="dnfl-align-center">${recordVal}</td>
                    <td class="dnfl-align-center"><span style="color: var(--dnfl-success-green, #10b981); font-weight: 700;">${pfVal}</span></td>
                    <td class="dnfl-align-left">${item.comments}</td>
                `;
            }

            tableBody.appendChild(row);
        });

        renderChart(records);
    }

    /**
     * Renders horizontal bar chart using Chart.js strictly based on live dnfl-rankings-live-js
     * @param {Array} records 
     */
    function renderChart(records) {
        const chartSorted = [...records].sort((a, b) => b.grade - a.grade);
        const labels = chartSorted.map(r => r.franchise);
        const dataValues = chartSorted.map(r => r.grade);
        const backgroundColors = chartSorted.map(r => conferenceColors[r.conference] || 'rgba(201, 203, 207, 0.85)');
        const borderColors = chartSorted.map(r => conferenceBorders[r.conference] || 'rgb(201, 203, 207)');

        const weekDropdown = document.getElementById('dnfl_weekSelector');
        const displaySubtitle = weekDropdown && weekDropdown.options[weekDropdown.selectedIndex] ? 
                                weekDropdown.options[weekDropdown.selectedIndex].text + " Ranking" : "Ranking";

        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const chartCanvas = document.getElementById('dnfl_powerRankingChart');
        if (!chartCanvas) return;
        const ctx = chartCanvas.getContext('2d');

        if (chartInstance) { 
            chartInstance.destroy(); 
        }

        const style = getComputedStyle(document.documentElement);
        const getCssVar = (varName, fallback) => style.getPropertyValue(varName).trim() || fallback;

        const bgSubhead = getCssVar('--dnfl-bg-subhead', '#1e293b');
        const textMain = getCssVar('--dnfl-text-main', '#f8fafc');
        const borderDark = getCssVar('--dnfl-border-dark', '#334155');

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
                        font: { size: 0.8 * rootFontSize, weight: 'bold' },
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
                        titleFont: { size: 1.0 * rootFontSize, weight: 'bold' },
                        bodyFont: { size: 0.875 * rootFontSize },
                        callbacks: {
                            title: function(context) { return context.label; },
                            label: function(context) {
                                const franchiseName = context.label;
                                const item = chartSorted.find(r => r.franchise === franchiseName);
                                if (!item) return 'No data found';
                                const owners = item.coOwner ? `${item.owner}, ${item.coOwner}` : item.owner;
                                const recVal = isPreseasonWeek ? item.projectedRecord : ((mflStandingsMap[item.franchiseId] || {}).record || '0-0-0');
                                const recLabel = isPreseasonWeek ? 'Projected Record' : 'Record';
                                return [
                                    `${item.division}`,
                                    `${owners}`,
                                    `DNFL Rank: ${item.rank}`,
                                    `Power Index: ${item.powerIndex.toFixed(1)}`,
                                    `${recLabel}: ${recVal}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: 50, max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: textMain, font: { size: Math.round(0.813 * rootFontSize) } },
                        title: { display: true, text: 'Power Rank Grade', color: textMain, font: { size: 14 }, padding: 15 }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { align: 'center', color: textMain, font: { size: Math.round(0.813 * rootFontSize) } }
                    }
                }
            }
        });
    }

    /**
     * Filters power rankings by selected conference
     */
    function applyConferenceFilter() {
        const confFilter = document.getElementById('dnfl_confFilter');
        if (!confFilter) return;

        const selected = confFilter.value;
        const wrapper = document.getElementById('dnfl_chartWrapperContainer');
        
        let filtered;
        if (selected === 'All' || !selected) {
            filtered = masterData;
        } else {
            filtered = masterData.filter(d => d.conference.trim().toLowerCase() === selected.toLowerCase());
        }

        if (wrapper && wrapper.style.display !== 'none') {
            const calculatedHeight = (filtered.length * 32) + 100;
            wrapper.style.height = calculatedHeight + 'px';
        }
        renderChartAndTable(filtered);
    }

    /**
     * Toggles visibility of either the chart container or the table container
     * @param {string} sectionType - 'chart' or 'table'
     */
    function toggleElementVisibility(sectionType) {
        if (sectionType === 'chart') {
            const wrapper = document.getElementById('dnfl_chartWrapperContainer');
            const button = document.getElementById('dnfl_chartToggleBtn');
            if (!wrapper || !button) return;

            if (wrapper.style.display === 'none') {
                wrapper.style.display = 'block';
                button.textContent = 'Hide Chart';
                applyConferenceFilter(); 
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

    // Export module onto window.DNFL.Rankings
    window.DNFL.Rankings = {
        init: init,
        loadWeeklyData: loadWeeklyData,
        renderChartAndTable: renderChartAndTable,
        applyConferenceFilter: applyConferenceFilter,
        toggleElementVisibility: toggleElementVisibility
    };

    // Auto-initialize if DOM element exists
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
