/* ==========================================================================
   DNFL Power Rankings Chart & Data Table Logic
   ========================================================================== */

let currentMflYear = '';
let masterData = [];
let chartInstance = null;

/* 🟢 MASTER CHRONOLOGICAL WEEKLY LOG
   Instructions for adding new weeks:
   1. Upload your new weekly data file (`.csv`) to the repository inside the correct year folder.
   2. Ensure your file is named following the pattern: `data_{id}.csv` (e.g., `data_01.csv`).
   3. Add a new object to the BOTTOM of this `publishedWeeks` array.
   4. The `id` must exactly match the suffix of your CSV file name. The `display` value is what users see in the dropdown.
   5. Note: Always use a comma to separate entries, but do NOT put a comma after the very last entry.
   The engine will automatically select and load the final item in this list as the default. */
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

function initDashboard(mflYear) {
    currentMflYear = mflYear;
    
    const selector = document.getElementById('dnfl_weekSelector');
    selector.innerHTML = ''; 

    publishedWeeks.forEach(week => {
        const opt = document.createElement('option');
        opt.value = week.id;
        opt.textContent = week.display;
        selector.appendChild(opt);
    });

    const mostRecentWeek = publishedWeeks[publishedWeeks.length - 1];
    selector.value = mostRecentWeek.id;
    loadWeeklyData();
}

function loadWeeklyData() {
    const selectedWeekFile = document.getElementById('dnfl_weekSelector').value;
    
    const filePath = `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_rankings/${currentMflYear}/data_${selectedWeekFile}.csv`;

    Papa.parse(filePath, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
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
        },
        error: function(err) {
            console.error("Data fetch error: ", err);
        }
    });
}

function renderChartAndTable(records) {
    const sortedData = [...records].sort((a, b) => a.rank - b.rank);
    const tableBody = document.getElementById('dnfl_tableBody');
    tableBody.innerHTML = ''; 

    sortedData.forEach(item => {
        const row = document.createElement('tr');
        const completeOwners = item.coOwner ? `${item.owner}, ${item.coOwner}` : item.owner;

        const confKey = String(item.conference).trim();
        const badgeColor = conferenceColors[confKey] || '#333333'; 
        const borderStyle = conferenceBorders[confKey] || '#444444';

        row.innerHTML = `
            <td>
                <span class="dnfl-rank-badge" style="background-color: ${badgeColor}; border: 1px solid ${borderStyle}; ">
                    ${item.rank}
                </span>
            </td>
            <td style="font-weight: 600; ">${item.franchise}</td>
            <td>${completeOwners}</td>
            <td style="text-align: center; font-weight: 600; ">${item.grade.toFixed(1)}</td>
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
    const displaySubtitle = weekDropdown.options[weekDropdown.selectedIndex] ? 
                            weekDropdown.options[weekDropdown.selectedIndex].text + " Ranking" : "Ranking";

    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const ctx = document.getElementById('dnfl_powerRankingChart').getContext('2d');

    if (chartInstance) { chartInstance.destroy(); }

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
                    color: '#121212',
                    font: { size: 0.8 * rootFontSize, weight: 'bold' },
                    padding: { bottom: 15 }
                },
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#eeeeee',
                    titleColor: '#121212',
                    bodyColor: '#121212',
                    borderColor: '#444',
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
                    ticks: { color: '#121212', font: { size: Math.round(0.813 * rootFontSize) } },
                    title: { display: true, text: 'Power Rank Grade', color: '#121212', font: { size: 14 }, padding: 15 }
                },
                y: {
                    grid: { display: false },
                    ticks: { align: 'center', color: '#121212', font: { size: Math.round(0.813 * rootFontSize) } }
                }
            }
        }
    });
}

function applyConferenceFilter() {
    const selected = document.getElementById('dnfl_confFilter').value;
    const wrapper = document.getElementById('dnfl_chartWrapperContainer');
    
    let filtered;
    if (selected === 'All') {
        filtered = masterData;
    } else {
        filtered = masterData.filter(d => d.conference.trim().toLowerCase() === selected.toLowerCase());
    }

    if (wrapper.style.display !== 'none') {
        const calculatedHeight = (filtered.length * 32) + 100;
        wrapper.style.height = calculatedHeight + 'px';
    }
    renderChartAndTable(filtered);
}

function toggleElementVisibility(sectionType) {
    if (sectionType === 'chart') {
        const wrapper = document.getElementById('dnfl_chartWrapperContainer');
        const button = document.getElementById('dnfl_chartToggleBtn');
        
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
        
        if (wrapper.style.display === 'none') {
            wrapper.style.display = 'block';
            button.textContent = 'Hide Table';
        } else {
            wrapper.style.display = 'none';
            button.textContent = 'Show Table';
        }
    }
}