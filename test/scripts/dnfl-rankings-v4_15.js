/* ==========================================================================
   DNFL Power Rankings Dashboard Engine v4.15 (Architecture Aligned)
   Duke Networking Fantasy League (DNFL)
   Fully aligned with dnfl-global-v3_36.css & _test_v4_30.scss design tokens.
   Supports dynamic API metadata fetch via DNFL.Client, weeks.json loading,
   MFL API standings & points for, Chart.js horizontal bar graphs with dynamic
   palette mapping, and expandable commentary rows.
   ========================================================================== */
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

    // Palette Mapping Cache
    let conferenceColorMap = {};

    
    function getLoggedInFranchiseId() {
        let fid = window.franchise_id || window.mflFranchiseId || window.login_franchise_id || window.current_franchise_id;
        if (!fid && window.DNFLClient && typeof window.DNFLClient.getFranchiseId === 'function') {
            fid = window.DNFLClient.getFranchiseId();
        }
        return normId(fid);
    }

    function normId(id) {
        if (!id && id !== 0) return '';
        const s = String(id).trim();
        return s.padStart(4, '0');
    }

    function getApiClient() {
        return (window.DNFL && window.DNFL.Client) || window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
    }

    function getLeagueId() {
        return window.league_id || window.mfl_league_id || '22972';
    }

    /**
     * Resolves palette colors dynamically for any conference name
     */
    function resolveConferenceColors(confName) {
        if (!confName) confName = 'Default';
        
        if (conferenceColorMap[confName]) {
            return conferenceColorMap[confName];
        }

        const knownConfs = Object.keys(conferenceColorMap);
        const nextIndex = (knownConfs.length % 6) + 1; // 1-indexed (1 to 6)

        const style = getComputedStyle(document.documentElement);
        const getCssVar = (varName, fallback) => style.getPropertyValue(varName).trim() || fallback;

        const bg = getCssVar(`--dnfl-chart-bg-${nextIndex}`, 'rgba(54, 162, 235, 0.85)');
        const border = getCssVar(`--dnfl-chart-border-${nextIndex}`, 'rgb(54, 162, 235)');

        const entry = { bg: bg, border: border, slotClass: `color-${nextIndex}` };
        conferenceColorMap[confName] = entry;
        return entry;
    }

    /**
     * Dynamically loads league metadata via DNFL.Client API
     */
    async function ensureLeagueMetadata() {
        if (Object.keys(mflFranchiseMap).length > 0) return;
        const apiClient = getApiClient();
        if (!apiClient || typeof apiClient.fetchData !== 'function') return;

        try {
            const leagueData = await apiClient.fetchData('league');
            if (leagueData && leagueData.league) {
                const lg = leagueData.league;
                const confMap = {};
                if (lg.conferences && lg.conferences.conference) {
                    const cList = Array.isArray(lg.conferences.conference) 
                        ? lg.conferences.conference 
                        : [lg.conferences.conference];
                    cList.forEach(c => { 
                        confMap[String(c.id)] = c.name;
                        resolveConferenceColors(c.name);
                    });
                }
                const divConfMap = {};
                if (lg.divisions && lg.divisions.division) {
                    const dList = Array.isArray(lg.divisions.division) 
                        ? lg.divisions.division 
                        : [lg.divisions.division];
                    dList.forEach(d => {
                        const cName = confMap[String(d.conference)] || '';
                        divConfMap[String(d.id)] = { divName: d.name, confName: cName };
                    });
                }
                if (lg.franchises && lg.franchises.franchise) {
                    const franchiseList = Array.isArray(lg.franchises.franchise) 
                        ? lg.franchises.franchise 
                        : [lg.franchises.franchise];
                    
                    mflFranchiseMap = {};
                    franchiseList.forEach(f => {
                        const fId = normId(f.id);
                        const divInfo = divConfMap[String(f.division)] || {};
                        const cName = confMap[String(f.conference)] || divInfo.confName || f.conference || '';
                        mflFranchiseMap[fId] = {
                            name: f.name || 'Unknown Team',
                            owner: f.owner_name || 'Owner',
                            icon: f.icon || f.logo || 'https://dnfl.live/images/ficon-dnfl.png',
                            conference: cName,
                            division: divInfo.divName || ''
                        };
                    });
                }
            }
        } catch (lErr) {
            console.warn("[DNFL Rankings] League metadata fetch warning:", lErr);
        }
    }

    /**
     * Helper to fetch raw CSV with dual fallback
     */
    async function fetchCsvData(weekId) {
        const apiClient = getApiClient();
        const primaryUrl = `https://dnfl.live/dnfl_rankings/${rankingsMFLYear}/data_${weekId}.csv`;
        const backupUrl = `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_rankings/${rankingsMFLYear}/data_${weekId}.csv`;

        if (apiClient && typeof apiClient.fetchRawText === 'function') {
            try {
                return await apiClient.fetchRawText(primaryUrl);
            } catch (pErr) {
                console.warn(`[DNFL Rankings] Could not fetch ${primaryUrl}, trying backup...`, pErr);
                return await apiClient.fetchRawText(backupUrl);
            }
        } else {
            const resp = await fetch(primaryUrl).catch(() => fetch(backupUrl));
            return await resp.text();
        }
    }

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
        const apiClient = getApiClient();

        try {
            if (apiClient && typeof apiClient.fetchRawText === 'function') {
                const rawJson = await apiClient.fetchRawText(weeksUrl);
                publishedWeeks = JSON.parse(rawJson);
            } else {
                const resp = await fetch(weeksUrl);
                publishedWeeks = await resp.json();
            }
        } catch (err) {
            console.warn("[DNFL Rankings] Could not load weeks.json, applying fallback weeks.", err);
            publishedWeeks = [
                { id: "00_pre-season", display: "Pre-Season" },
                { id: "01", display: "Week 1" }
            ];
        }

        selector.innerHTML = '';
        publishedWeeks.forEach(week => {
            const opt = document.createElement('option');
            opt.value = week.id;
            opt.textContent = week.display;
            selector.appendChild(opt);
        });

        await ensureLeagueMetadata();
        updateConferenceControls();

        const mostRecentWeek = publishedWeeks[publishedWeeks.length - 1];
        if (mostRecentWeek) {
            selector.value = mostRecentWeek.id;
            loadWeeklyData();
        }
    }

    function updateConferenceControls() {
        const confFilter = document.getElementById('dnfl_confFilter');
        if (confFilter) {
            const activeVal = confFilter.value || 'All';
            confFilter.innerHTML = '<option value="All">All Conferences</option>';
            
            const confList = Object.keys(conferenceColorMap);
            confList.forEach(confName => {
                const opt = document.createElement('option');
                opt.value = confName;
                opt.textContent = confName;
                confFilter.appendChild(opt);
            });
            confFilter.value = activeVal;
        }

        const legendContainer = document.getElementById('dnfl_rankings_legend');
        if (legendContainer) {
            legendContainer.innerHTML = '';
            const confList = Object.keys(conferenceColorMap);
            confList.forEach(confName => {
                const palette = resolveConferenceColors(confName);
                const itemDiv = document.createElement('div');
                itemDiv.className = 'dnfl-legend-item';
                itemDiv.innerHTML = `
                    <span class="dnfl-legend-swatch ${palette.slotClass}"></span>
                    <span>${confName}</span>
                `;
                legendContainer.appendChild(itemDiv);
            });
        }
    }

    async function loadWeeklyData() {
        const weekSelector = document.getElementById('dnfl_weekSelector');
        if (!weekSelector) return;

        await ensureLeagueMetadata();

        const selectedWeekFile = weekSelector.value;
        isPreseasonWeek = selectedWeekFile.includes('00_pre-season') || selectedWeekFile.includes('pre-season');
        const apiClient = getApiClient();

        try {
            const currentIndex = publishedWeeks.findIndex(w => w.id === selectedWeekFile);
            const prevWeekFile = (!isPreseasonWeek && currentIndex > 0) ? publishedWeeks[currentIndex - 1].id : null;

            const weekNumMatch = selectedWeekFile.match(/(\d+)/);
            const weekNum = weekNumMatch ? parseInt(weekNumMatch[1], 10) : 1;

            const [rawCsv, prevCsvText, standingsDataRaw] = await Promise.all([
                fetchCsvData(selectedWeekFile),
                prevWeekFile ? fetchCsvData(prevWeekFile).catch(() => null) : Promise.resolve(null),
                (!isPreseasonWeek && apiClient && typeof apiClient.fetchData === 'function') 
                    ? apiClient.fetchData('leagueStandings', `&W=${weekNum}`).catch(() => null) 
                    : Promise.resolve(null)
            ]);

            // Process Previous Week CSV
            prevWeekRankMap = {};
            if (prevCsvText && window.Papa) {
                try {
                    const prevParsed = Papa.parse(prevCsvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
                    const prevList = prevParsed.data.map(r => {
                        const fId = normId(r['Franchise ID'] || r['FranchiseId'] || r['id']);
                        const mflMeta = mflFranchiseMap[fId] || {};
                        return {
                            franchiseId: fId,
                            overallRank: parseInt(r['Rank'] || 0, 10),
                            powerIndex: parseFloat(r['Power Index'] || 0),
                            conference: mflMeta.conference || 'Other'
                        };
                    }).sort((a, b) => a.overallRank - b.overallRank);

                    const confRankCounters = {};
                    prevList.forEach(item => {
                        const c = item.conference;
                        confRankCounters[c] = (confRankCounters[c] || 0) + 1;
                        prevWeekRankMap[item.franchiseId] = {
                            overallRank: item.overallRank,
                            confRank: confRankCounters[c]
                        };
                    });
                } catch (pErr) {
                    console.warn("[DNFL Rankings] Previous week CSV parse warning:", pErr);
                }
            }

            // Process Standings Data via API
            mflStandingsMap = {};
            if (!isPreseasonWeek) {
                const extractFranchises = (data) => {
                    if (!data || !data.leagueStandings) return null;
                    const ls = data.leagueStandings;
                    const raw = ls.franchise || (ls.franchises ? ls.franchises.franchise : null);
                    if (!raw) return null;
                    return Array.isArray(raw) ? raw : [raw];
                };

                let stList = extractFranchises(standingsDataRaw);
                if (stList && stList.length > 0) {
                    stList.forEach(s => {
                        const fId = normId(s.id);
                        const wins = (s.h2hw !== undefined && s.h2hw !== null) ? s.h2hw : (s.wins || s.w || 0);
                        const losses = (s.h2hl !== undefined && s.h2hl !== null) ? s.h2hl : (s.losses || s.l || 0);
                        const ties = (s.h2ht !== undefined && s.h2ht !== null) ? s.h2ht : (s.ties || s.t || 0);
                        const rawPf = parseFloat(s.pf !== undefined ? s.pf : (s.points || s.pts || 0));
                        mflStandingsMap[fId] = {
                            record: `${wins}-${losses}-${ties}`,
                            pf: isNaN(rawPf) ? '0.00' : rawPf.toFixed(2)
                        };
                    });
                }
            }

            // Process Current Week CSV
            if (!window.Papa) {
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
                    franchiseName: mflMeta.name || 'Unknown Team',
                    ownerName: mflMeta.owner || 'Owner',
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
            console.error("[DNFL Rankings] CSV/Data fetch error:", err);
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

            const activeFranchiseId = getLoggedInFranchiseId();
            const isMyTeam = activeFranchiseId && activeFranchiseId !== '0000' && normId(item.franchiseId) === activeFranchiseId;
            const myTeamClass = isMyTeam ? ' dnfl-my-team myfranchise' : '';

            const mainRow = document.createElement('tr');
            if (index % 2 === 1) {
                mainRow.className = 'dnfl-row-even' + myTeamClass;
            } else {
                mainRow.className = 'dnfl-row-odd' + myTeamClass;
            }
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
                subRow.style.backgroundColor = 'var(--dnfl-bg-subhead, #f1f5f9)';

                const colSpanCount = isPreseasonWeek ? 5 : 7;
                subRow.className = 'dnfl-comment-row';
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
    }

    function toggleCommentRow(franchiseId) {
        const subRow = document.getElementById(`dnfl-comment-row-${franchiseId}`);
        if (!subRow) return;
        if (subRow.style.display === 'none') {
            subRow.style.display = 'table-row';
        } else {
            subRow.style.display = 'none';
        }
    }

    function renderChart(records) {
        if (!window.Chart) {
            console.warn("[DNFL Rankings] Chart.js unavailable.");
            return;
        }

        const chartSorted = [...records].sort((a, b) => b.powerIndex - a.powerIndex);
        const labels = chartSorted.map(r => r.franchiseName);
        const dataValues = chartSorted.map(r => r.powerIndex);
        const backgroundColors = chartSorted.map(r => resolveConferenceColors(r.conference).bg);
        const borderColors = chartSorted.map(r => resolveConferenceColors(r.conference).border);

        const weekDropdown = document.getElementById('dnfl_weekSelector');
        const displaySubtitle = weekDropdown && weekDropdown.options[weekDropdown.selectedIndex] ? 
                                weekDropdown.options[weekDropdown.selectedIndex].text + " Power Index Grades" : "Power Index Grades";

        const chartCanvas = document.getElementById('dnfl_powerRankingChart');
        if (!chartCanvas) return;

        const wrapper = document.getElementById('dnfl_chartWrapperContainer');
        if (wrapper && wrapper.style.display !== 'none') {
            const calculatedHeight = (records.length * 32) + 100;
            wrapper.style.height = calculatedHeight + 'px';
        }

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
                                if (!context || !context.length) return '';
                                return context[0].label;
                            },
                            label: function(context) {
                                const franchiseName = context.label;
                                const item = chartSorted.find(r => r.franchiseName === franchiseName);
                                if (!item) return '';

                                const confStr = String(item.conference || '').trim();
                                const divStr = String(item.division || '').trim();
                                let confDivFormatted = confStr;
                                if (divStr) {
                                    if (divStr.toLowerCase().startsWith(confStr.toLowerCase())) {
                                        confDivFormatted = divStr;
                                    } else {
                                        confDivFormatted = `${confStr} ${divStr}`;
                                    }
                                }

                                return [
                                    `${item.ownerName}`,
                                    `${confDivFormatted}`,
                                    `${item.powerIndex.toFixed(1)}`,
                                    `Rank - ${item.overallRank}`
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
                        title: { display: true, text: 'Power Index Grade', color: textMain, font: { size: 14, weight: 'bold' }, padding: 15 }
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
                button.innerHTML = '<i class="fa-solid fa-chart-bar"></i> <span class="btn-text-full">Hide Chart</span><span class="btn-text-short">Chart</span>';
                applyConferenceFilter();
            } else {
                wrapper.style.display = 'none';
                button.innerHTML = '<i class="fa-solid fa-chart-bar"></i> <span class="btn-text-full">Show Chart</span><span class="btn-text-short">Chart</span>';
            }
        }
    }

    window.DNFL.Rankings = {
        init: init,
        loadWeeklyData: loadWeeklyData,
        renderChartAndTable: renderChartAndTable,
        applyConferenceFilter: applyConferenceFilter,
        toggleElementVisibility: toggleElementVisibility,
        toggleCommentRow: toggleCommentRow
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
