/* ==========================================================================
   DNFL Power Rankings Chart & Data Table Logic (v4)
   Compatible with dnfl-global-v2.css
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

    // Original Conference Brand Colors
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

            // Fetch League Franchise Metadata for Icons, Team Names, Owners, Conferences & Divisions
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
                            icon: f.icon || f.logo || 'https://dnfl.live/images/ficon-dnfl.png',
                            conference: f.conference || '',
                            division: f.division || ''
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
                    
                    // Filter previous week records by conference if needed for relative delta
                    prevParsed.data.forEach((r, idx) => {
                        const fId = normId(r['Franchise ID'] || r['FranchiseId'] || r['id']);
                        const rk = parseInt(r['Rank'] || (idx + 1), 10);
                        if (fId) {
                            prevWeekRankMap[fId] = {
                                overallRank: rk,
                                conference: r['Conference'] || (mflFranchiseMap[fId] ? mflFranchiseMap[fId].conference : '')
                            };
                        }
                    });

                    // Build previous week conference-specific ranks
                    const prevByConf = {};
                    prevParsed.data.forEach((r, idx) => {
                        const fId = normId(r['Franchise ID'] || r['FranchiseId'] || r['id']);
                        const conf = (r['Conference'] || (mflFranchiseMap[fId] ? mflFranchiseMap[fId].conference : '')).trim();
                        if (conf) {
                            if (!prevByConf[conf]) prevByConf[conf] = [];
                            prevByConf[conf].push({
                                fId: fId,
                                rank: parseInt(r['Rank'] || (idx + 1), 10)
                            });
                        }
                    });

                    Object.keys(prevByConf).forEach(conf => {
                        prevByConf[conf].sort((a, b) => a.rank - b.rank);
                        prevByConf[conf].forEach((item, confIdx) => {
                            if (prevWeekRankMap[item.fId]) {
                                prevWeekRankMap[item.fId].confRank = confIdx + 1;
                            }
                        });
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
                    overallRank: parseInt(row['Rank'] || 0, 10),
                    powerIndex: parseFloat(row['Power Index'] || row['Overall Grade'] || 0),
                    franchiseId: fId,
                    franchiseName: mflMeta.name || fallbackName,
                    ownerName: mflMeta.owner || row['Owner Name'] || 'Owner',
                    iconUrl: mflMeta.icon || 'https://dnfl.live/images/ficon-dnfl.png',
                    conference: row['Conference'] || mflMeta.conference || 'Other',
                    division: row['Conference - Division'] || mflMeta.division || '',
                    projectedRecord: row['Projected W-L'] || 'N/A',
                    comments: row['Rank Comments'] || ''
                };
            });

            applyConferenceFilter();
        } catch (err) {
            console.error("[DNFL Rankings] CSV/Data fetch error:", err);
        }
    }

    /**
     * Filters power rankings by selected conference and updates table & chart
     */
    function applyConferenceFilter() {
        const confFilter = document.getElementById('dnfl_confFilter');
        const selectedConf = confFilter ? confFilter.value : 'All';

        let filtered;
        if (!selectedConf || selectedConf === 'All') {
            filtered = [...masterData];
        } else {
            filtered = masterData.filter(d => String(d.conference).trim().toLowerCase() === selectedConf.toLowerCase());
        }

        renderChartAndTable(filtered, selectedConf);
    }

    /**
     * Renders both the bar chart and detailed data table
     */
    function renderChartAndTable(records, activeConfFilter = 'All') {
        const sortedData = [...records].sort((a, b) => a.overallRank - b.overallRank);
        const table = document.getElementById('dnfl_dataTable');
        const tableBody = document.getElementById('dnfl_tableBody');
        if (!table || !tableBody) return;

        const isFiltered = activeConfFilter && activeConfFilter !== 'All';

        // Render Table Header dynamically based on week type
        const thead = table.querySelector('thead');
        if (thead) {
            if (isPreseasonWeek) {
                thead.innerHTML = `
                    <tr>
                        <th class="dnfl-col-rank">Rank</th>
                        <th class="dnfl-col-franchise">Franchise</th>
                        <th class="dnfl-col-index">Power Index</th>
                        <th class="dnfl-col-record">Projected Record</th>
                        <th class="dnfl-col-comments">Rank Comments</th>
                    </tr>
                `;
            } else {
                thead.innerHTML = `
                    <tr>
                        <th class="dnfl-col-rank">Rank</th>
                        <th class="dnfl-col-change">Change</th>
                        <th class="dnfl-col-franchise">Franchise</th>
                        <th class="dnfl-col-index">Power Index</th>
                        <th class="dnfl-col-record">Record</th>
                        <th class="dnfl-col-pf">Points For</th>
                        <th class="dnfl-col-comments">Rank Comments</th>
                    </tr>
                `;
            }
        }

        tableBody.innerHTML = '';

        sortedData.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Recalculate display rank (1..12 for conference view, 1..36 for overall view)
            const displayRank = isFiltered ? (index + 1) : item.overallRank;

            // Conference badge colors
            const confKey = String(item.conference).trim();
            const badgeColor = conferenceColors[confKey] || 'var(--dnfl-border-dark)'; 
            const borderStyle = conferenceBorders[confKey] || 'var(--dnfl-border-dark)';

            const rankBadgeHtml = `
                <span class="dnfl-rank-badge" style="background-color: ${badgeColor}; border: 1px solid ${borderStyle};">
                    ${displayRank}
                </span>
            `;

            // Calculate Rank Change
            let changeBadgeHtml = '';
            if (!isPreseasonWeek) {
                const prevMeta = prevWeekRankMap[item.franchiseId];
                if (prevMeta) {
                    const prevRankToCompare = isFiltered ? prevMeta.confRank : prevMeta.overallRank;
                    if (prevRankToCompare && prevRankToCompare > 0) {
                        const diff = prevRankToCompare - displayRank; // Positive = Improved
                        if (diff > 0) {
                            changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-green">▲ ${diff}</span>`;
                        } else if (diff < 0) {
                            changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-red">▼ ${Math.abs(diff)}</span>`;
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
                    <td class="dnfl-col-rank">${rankBadgeHtml}</td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-col-index">${item.powerIndex.toFixed(1)}</td>
                    <td class="dnfl-col-record">${recordVal}</td>
                    <td class="dnfl-col-comments">${item.comments}</td>
                `;
            } else {
                row.innerHTML = `
                    <td class="dnfl-col-rank">${rankBadgeHtml}</td>
                    <td class="dnfl-col-change">${changeBadgeHtml}</td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-col-index">${item.powerIndex.toFixed(1)}</td>
                    <td class="dnfl-col-record">${recordVal}</td>
                    <td class="dnfl-col-pf">${pfVal}</td>
                    <td class="dnfl-col-comments">${item.comments}</td>
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
                        callbacks: {
                            label: function(context) {
                                const franchiseName = context.label;
                                const item = chartSorted.find(r => r.franchiseName === franchiseName);
                                if (!item) return 'No data found';
                                return [
                                    `Division: ${item.division}`,
                                    `Owner: ${item.ownerName}`,
                                    `Power Index: ${item.powerIndex.toFixed(1)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: 50, max: 100,
                        grid: { color: 'rgba(0, 0, 0, 0.1)' },
                        ticks: { color: textMain, font: { size: Math.round(0.813 * rootFontSize) } },
                        title: { display: true, text: 'Power Index', color: textMain, font: { size: 14, weight: 'bold' }, padding: 15 }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: textMain, font: { size: Math.round(0.813 * rootFontSize) } }
                    }
                }
            }
        });
    }

    /**
     * Toggles visibility of chart or table
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
