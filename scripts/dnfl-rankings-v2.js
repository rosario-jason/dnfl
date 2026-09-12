/* ==========================================================================
   DNFL Power Rankings Chart & Data Table Logic
   ========================================================================== */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    let rankingsMFLYear = '';
    let masterData = [];
    let chartInstance = null;

    const publishedWeeks = [
        { id: "00_pre-season", display: "Pre-Season" }
    ];

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
     * Initializes the rankings dashboard for a specific season year
     * @param {string|number} mflYear 
     */
    function init(mflYear) {
        rankingsMFLYear = mflYear;
        const selector = document.getElementById('dnfl_weekSelector');
        if (!selector) return;

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
        const filePath = `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_rankings/${rankingsMFLYear}/data_${selectedWeekFile}.csv`;

        try {
            const rawCsv = await DNFLClient.fetchRawText(filePath);
            const results = Papa.parse(rawCsv, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            });

            masterData = results.data.map(row => {
                return {
                    rank: parseInt(row['Rank'] || 0),
                    franchise: row['Franchise'] ? String(row['Franchise']).trim() : 'Unknown Team',
                    conference: row['Conference'] || 'Other',
                    division: row['Conference - Division'] || '',
                    owner: row['Owner Name'] || 'N/A',
                    coOwner: row['Co-Owner Name'] || '',
                    grade: parseFloat(row['Overall Grade'] || 0),
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
     * Renders both the bar chart and the detailed data table
     * @param {Array} records 
     */
    function renderChartAndTable(records) {
        const sortedData = [...records].sort((a, b) => a.rank - b.rank);
        const tableBody = document.getElementById('dnfl_tableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        sortedData.forEach(item => {
            const row = document.createElement('tr');
            const completeOwners = item.coOwner ? `${item.owner}, ${item.coOwner}` : item.owner;

            const confKey = String(item.conference).trim();
            const badgeColor = conferenceColors[confKey] || 'var(--dnfl-border-dark)'; 
            const borderStyle = conferenceBorders[confKey] || 'var(--dnfl-border-dark)';

            row.innerHTML = `
                <td>
                    <span class="dnfl-rank-badge" style="background-color: ${badgeColor}; border: 1px solid ${borderStyle};">
                        ${item.rank}
                    </span>
                </td>
                <td style="font-weight: 600;">${item.franchise}</td>
                <td>${completeOwners}</td>
                <td style="text-align: center; font-weight: 600;">${item.grade.toFixed(1)}</td>
                <td style="text-align: center;">${item.projectedRecord}</td>
                <td>${item.comments}</td>
            `;
            tableBody.appendChild(row);
        });

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
                        color: 'var(--dnfl-text-main)',
                        font: { size: 0.8 * rootFontSize, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'var(--dnfl-bg-subhead)',
                        titleColor: 'var(--dnfl-text-main)',
                        bodyColor: 'var(--dnfl-text-main)',
                        borderColor: 'var(--dnfl-border-dark)',
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
                                return [
                                    `${item.division}`,
                                    `${owners}`,
                                    `DNFL Rank: ${item.rank}`,
                                    `Overall Grade: ${item.grade}`,
                                    `Projected Record: ${item.projectedRecord}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: 50, max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'var(--dnfl-text-main)', font: { size: Math.round(0.813 * rootFontSize) } },
                        title: { display: true, text: 'Power Rank Grade', color: 'var(--dnfl-text-main)', font: { size: 14 }, padding: 15 }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { align: 'center', color: 'var(--dnfl-text-main)', font: { size: Math.round(0.813 * rootFontSize) } }
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
        if (selected === 'All') {
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
})();