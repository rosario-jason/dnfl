/* ==========================================================================
   DNFL Power Rankings Dashboard Engine v4.18 (Architecture Aligned)
   Duke Networking Fantasy League (DNFL)
   Fully aligned with dnfl-global-v3_36.css & _test_v4_42.scss design tokens.
   ========================================================================== */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};

    const activeHost = window.location.hostname || "myfantasyleague.com";
    let targetYear = window.current_year || null;
    if (!targetYear) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(s => /^20\d{2}$/.test(s));
        targetYear = foundYear ? foundYear : new Date().getFullYear().toString();
    }

    function normId(id) {
        if (!id) return '';
        const s = String(id).trim();
        if (s === '0' || s === '0000') return '';
        return s.padStart(4, '0');
    }

    function normConfId(id) {
        if (!id) return '';
        const s = String(id).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function getApiClient() {
        return (window.DNFL && window.DNFL.Client) || window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
    }

    function getLeagueId() {
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.getContext === 'function') {
            return window.DNFL.Client.getContext().leagueId;
        }
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('L') || urlParams.get('l') || window.league_id || window.mflLeagueId || '22883';
    }

    function getLoggedInFranchiseId() {
        let fid = window.franchise_id || window.mflFranchiseId || window.login_franchise_id || window.current_franchise_id;
        if (!fid && window.DNFLClient && typeof window.DNFLClient.getFranchiseId === 'function') {
            fid = window.DNFLClient.getFranchiseId();
        }
        if (!fid && window.location && window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            fid = urlParams.get('F') || urlParams.get('FRANCHISE_ID') || urlParams.get('f');
        }
        if (!fid && document.cookie) {
            const cookieMatch = document.cookie.match(/(?:MFL_USER_ID|MFL_FRANCHISE_ID|franchise_id)=([^;]+)/i);
            if (cookieMatch && cookieMatch[1]) {
                const rawCookieVal = decodeURIComponent(cookieMatch[1]);
                const idMatch = rawCookieVal.match(/(?:u%3D|u=)?(\d{4})/i);
                if (idMatch && idMatch[1]) fid = idMatch[1];
            }
        }
        const normalized = normId(fid);
        return (normalized && normalized !== '0000') ? normalized : null;
    }

    let rawRankingsCsv = '';
    let weeksManifest = [];
    let leagueData = null;
    let standingsData = null;
    let mflStandingsMap = {};

    let chartInstance = null;
    let isChartVisible = true;
    let retryCount = 0;
    const maxRetries = 50;

    const confColorPalette = [
        { bg: 'var(--dnfl-chart-bg-1, rgba(54, 162, 235, 0.85))', border: 'var(--dnfl-chart-border-1, rgb(54, 162, 235))', swatchClass: 'color-1' },
        { bg: 'var(--dnfl-chart-bg-2, rgba(255, 99, 132, 0.85))', border: 'var(--dnfl-chart-border-2, rgb(255, 99, 132))', swatchClass: 'color-2' },
        { bg: 'var(--dnfl-chart-bg-3, rgba(75, 192, 192, 0.85))', border: 'var(--dnfl-chart-border-3, rgb(75, 192, 192))', swatchClass: 'color-3' },
        { bg: 'var(--dnfl-chart-bg-4, rgba(255, 159, 64, 0.85))', border: 'var(--dnfl-chart-border-4, rgb(255, 159, 64))', swatchClass: 'color-4' },
        { bg: 'var(--dnfl-chart-bg-5, rgba(153, 102, 255, 0.85))', border: 'var(--dnfl-chart-border-5, rgb(153, 102, 255))', swatchClass: 'color-5' },
        { bg: 'var(--dnfl-chart-bg-6, rgba(46, 204, 113, 0.85))', border: 'var(--dnfl-chart-border-6, rgb(46, 204, 113))', swatchClass: 'color-6' }
    ];

    async function init() {
        const tbody = document.getElementById("dnfl-rankings-tbody");
        if (!tbody) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        try {
            const apiClient = getApiClient();
            if (!apiClient) {
                throw new Error("DNFL API Middleware missing.");
            }

            const csvUrl = `https://dnfl.live/dnfl_rankings/data/${targetYear}_power_rankings.csv`;
            const weeksUrl = `https://dnfl.live/dnfl_rankings/data/weeks.json`;

            const [rawCsvText, rawWeeksJson, leagueResp, standingsResp] = await Promise.all([
                apiClient.fetchRawText(csvUrl),
                apiClient.fetchRawText(weeksUrl).catch(() => null),
                apiClient.fetchData("league"),
                apiClient.fetchData("leagueStandings").catch(() => null)
            ]);

            if (!rawCsvText) {
                throw new Error("Power Rankings CSV file unavailable.");
            }

            rawRankingsCsv = rawCsvText;
            leagueData = leagueResp?.league || {};
            standingsData = standingsResp?.leagueStandings || {};

            if (rawWeeksJson) {
                try { weeksManifest = JSON.parse(rawWeeksJson); } catch(e) { weeksManifest = []; }
            }

            // Build Standings Map
            mflStandingsMap = {};
            const franchiseList = toArray(standingsData?.franchise);
            franchiseList.forEach(f => {
                const fid = normId(f.id);
                mflStandingsMap[fid] = {
                    record: `${f.h2hw || 0}-${f.h2hl || 0}-${f.h2ht || 0}`,
                    pf: parseFloat(f.pf || 0).toFixed(2)
                };
            });

            setupFilters();
            renderView();
        } catch(err) {
            console.error("[DNFL Power Rankings Error]:", err);
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--dnfl-alert-red); padding: 2rem;">Error loading power rankings data.</td></tr>`;
        }
    }

    function parseCsvRows(csvText) {
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = [];
            let insideQuote = false;
            let currentVal = '';

            for (let ch of lines[i]) {
                if (ch === '"') {
                    insideQuote = !insideQuote;
                } else if (ch === ',' && !insideQuote) {
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));
                    currentVal = '';
                } else {
                    currentVal += ch;
                }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));

            if (values.length >= headers.length) {
                const rowObj = {};
                headers.forEach((h, idx) => {
                    rowObj[h] = values[idx] !== undefined ? values[idx] : '';
                });
                result.push(rowObj);
            }
        }
        return result;
    }

    function setupFilters() {
        const confSelect = document.getElementById("dnfl_rankings_confFilter");
        const weekSelect = document.getElementById("dnfl_rankings_weekFilter");
        if (!confSelect || !weekSelect) return;

        confSelect.innerHTML = '';
        weekSelect.innerHTML = '';

        const allConfsOpt = document.createElement('option');
        allConfsOpt.value = 'all';
        allConfsOpt.textContent = 'All Conferences';
        confSelect.appendChild(allConfsOpt);

        const confs = toArray(leagueData?.conferences?.conference);
        confs.forEach(c => {
            const opt = document.createElement('option');
            opt.value = normConfId(c.id);
            opt.textContent = c.name;
            confSelect.appendChild(opt);
        });

        const rows = parseCsvRows(rawRankingsCsv);
        const uniqueWeeks = [...new Set(rows.map(r => r.week || r.Week).filter(Boolean))];

        uniqueWeeks.sort((a, b) => {
            const numA = parseInt(a, 10);
            const numB = parseInt(b, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
            return b.localeCompare(a);
        });

        uniqueWeeks.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w;

            let label = `Week ${w}`;
            const foundWk = weeksManifest.find(m => String(m.week) === String(w));
            if (foundWk && foundWk.name) {
                label = foundWk.name;
            } else if (String(w) === '0' || String(w).toLowerCase() === 'preseason') {
                label = 'Preseason';
            }
            opt.textContent = label;
            weekSelect.appendChild(opt);
        });

        // Set logged-in owner's conference as default
        const activeFid = getLoggedInFranchiseId();
        if (activeFid) {
            const fList = toArray(leagueData?.franchises?.franchise);
            const userFranchise = fList.find(f => normId(f.id) === activeFid);
            if (userFranchise && userFranchise.conference) {
                const normUserConf = normConfId(userFranchise.conference);
                const matchingOpt = Array.from(confSelect.options).find(o => o.value === normUserConf);
                if (matchingOpt) confSelect.value = normUserConf;
            }
        }
    }

    function renderRankingsLegend(conferencesToDisplay, confMap) {
        const legendContainer = document.getElementById("dnfl_rankings_legend");
        if (!legendContainer) return;

        let itemsHtml = `<div class="dnfl-legend-items">`;
        conferencesToDisplay.forEach((confId, idx) => {
            const confObj = confMap[confId] || {};
            const confName = confObj.name || `Conference ${confId}`;
            const palette = confColorPalette[idx % confColorPalette.length];

            itemsHtml += `
                <div class="dnfl-legend-item">
                    <span class="dnfl-legend-swatch ${palette.swatchClass}"></span>
                    <span>${confName}</span>
                </div>
            `;
        });
        itemsHtml += `</div>`;

        const noteHtml = `<div class="dnfl-legend-note">*Power Index formula combines win %, points for z-score, and analyst evaluations.</div>`;
        legendContainer.innerHTML = itemsHtml + noteHtml;
    }

    function renderView() {
        const confSelect = document.getElementById("dnfl_rankings_confFilter");
        const weekSelect = document.getElementById("dnfl_rankings_weekFilter");
        const thead = document.getElementById("dnfl-rankings-thead");
        const tbody = document.getElementById("dnfl-rankings-tbody");
        const container = document.getElementById("dnfl-rankings-container");

        if (!confSelect || !weekSelect || !thead || !tbody) return;

        const selectedConf = confSelect.value;
        const selectedWeek = weekSelect.value;

        const allRows = parseCsvRows(rawRankingsCsv);
        let weekRows = allRows.filter(r => String(r.week || r.Week) === String(selectedWeek));

        const confList = toArray(leagueData?.conferences?.conference);
        const divList = toArray(leagueData?.divisions?.division);
        const franchiseList = toArray(leagueData?.franchises?.franchise);

        const divToConfMap = {};
        divList.forEach(d => divToConfMap[normConfId(d.id)] = normConfId(d.conference));

        const franchiseMap = {};
        franchiseList.forEach(f => {
            const fid = normId(f.id);
            let confId = normConfId(f.conference);
            if (!confId && f.division) {
                confId = divToConfMap[normConfId(f.division)] || '';
            }
            franchiseMap[fid] = {
                id: fid,
                name: f.name || `Franchise ${fid}`,
                ownerName: f.owner_name || 'Owner',
                icon: f.icon || 'https://dnfl.live/images/ficon-dnfl.png',
                conference: confId
            };
        });

        // Enrich weekRows
        let enriched = weekRows.map(r => {
            const fid = normId(r.franchise_id || r.Franchise_ID || r.id);
            const profile = franchiseMap[fid] || { id: fid, name: `Franchise ${fid}`, ownerName: 'Owner', icon: 'https://dnfl.live/images/ficon-dnfl.png', conference: '' };
            const powerIndex = parseFloat(r.power_index || r.powerIndex || r.PowerIndex || 0);

            return {
                ...r,
                franchiseId: fid,
                franchiseName: profile.name,
                ownerName: profile.ownerName,
                icon: profile.icon,
                conferenceId: profile.conference,
                powerIndex: powerIndex,
                rank: parseInt(r.rank || r.Rank || 0, 10),
                rankChange: parseInt(r.change || r.Change || r.rank_change || 0, 10),
                comments: r.comments || r.Comments || r.comment || '',
                projectedRecord: r.projected_record || r.proj_record || r.ProjectedRecord || '0-0-0'
            };
        });

        if (selectedConf !== 'all') {
            enriched = enriched.filter(item => item.conferenceId === selectedConf);
        }

        enriched.sort((a, b) => b.powerIndex - a.powerIndex);

        const isPreseasonWeek = String(selectedWeek) === '0' || String(selectedWeek).toLowerCase() === 'preseason';

        if (container) {
            if (isPreseasonWeek) {
                container.classList.add('dnfl-preseason');
            } else {
                container.classList.remove('dnfl-preseason');
            }
        }

        const activeLeagueId = getLeagueId();

        // Render Legend
        const confMap = {};
        confList.forEach(c => confMap[normConfId(c.id)] = c);
        const uniqueConfs = [...new Set(enriched.map(i => i.conferenceId).filter(Boolean))];
        renderRankingsLegend(uniqueConfs, confMap);

        // Render Chart
        renderChart(enriched, uniqueConfs, confMap, isPreseasonWeek);

        // Render Table Headers
        if (isPreseasonWeek) {
            thead.innerHTML = `
                <tr>
                    <th class="dnfl-col-rank">Rank</th>
                    <th class="dnfl-col-franchise">Franchise</th>
                    <th class="dnfl-col-index">Power Index</th>
                    <th class="dnfl-col-comment">Comments</th>
                    <th class="dnfl-col-record dnfl-hide-mobile">Proj. Record</th>
                </tr>
            `;
        } else {
            thead.innerHTML = `
                <tr>
                    <th class="dnfl-col-rank">Rank</th>
                    <th class="dnfl-col-change dnfl-hide-mobile">Change</th>
                    <th class="dnfl-col-franchise">Franchise</th>
                    <th class="dnfl-col-index">Power Index</th>
                    <th class="dnfl-col-comment">Comments</th>
                    <th class="dnfl-col-record dnfl-hide-mobile">Record</th>
                    <th class="dnfl-col-pf dnfl-hide-mobile">Points For</th>
                </tr>
            `;
        }

        // Render Table Body
        tbody.innerHTML = '';

        if (enriched.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No rankings data available for selected filter.</td></tr>`;
            return;
        }

        enriched.forEach((item, index) => {
            const displayRank = index + 1;
            const rankBadgeHtml = `<span class="dnfl-rank-badge" style="background-color: var(--dnfl-bg-subhead, #f1f5f9); color: var(--dnfl-text-main, #121212); border: 1px solid var(--dnfl-border-medium, #cbd5e1);">${displayRank}</span>`;

            let changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-neutral">—</span>`;
            if (item.rankChange > 0) {
                changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-green"><i class="fa-solid fa-caret-up"></i> +${item.rankChange}</span>`;
            } else if (item.rankChange < 0) {
                changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-red"><i class="fa-solid fa-caret-down"></i> ${item.rankChange}</span>`;
            }

            const targetHref = `https://${activeHost}/${targetYear}/options?L=${activeLeagueId}&F=${item.franchiseId}&O=01`;
            const franchiseColHtml = `
                <div class="dnfl-franchise-cell">
                    <a href="${targetHref}" title="View Franchise Page">
                        <img src="${item.icon}" alt="${item.franchiseName}" class="franchiseicon" id="franchiseicon_${item.franchiseId}" onError="this.onerror=null;this.src='https://dnfl.live/images/ficon-dnfl.png';" />
                    </a>
                    <div class="dnfl-franchise-info">
                        <a href="${targetHref}" class="dnfl-team-name">${item.franchiseName}</a>
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
                    <td class="dnfl-col-comment">${commentBtnHtml}</td>
                    <td class="dnfl-col-record dnfl-hide-mobile">${recordVal}</td>
                `;
            } else {
                mainRow.innerHTML = `
                    <td class="dnfl-col-rank">${rankBadgeHtml}</td>
                    <td class="dnfl-col-change dnfl-hide-mobile">${changeBadgeHtml}</td>
                    <td class="dnfl-col-franchise">${franchiseColHtml}</td>
                    <td class="dnfl-col-index"><span class="dnfl-pill-blue dnfl-pill">${item.powerIndex.toFixed(1)}</span></td>
                    <td class="dnfl-col-comment">${commentBtnHtml}</td>
                    <td class="dnfl-col-record dnfl-hide-mobile">${recordVal}</td>
                    <td class="dnfl-col-pf dnfl-hide-mobile">${pfVal}</td>
                `;
            }

            tbody.appendChild(mainRow);

            if (hasComment) {
                const subRow = document.createElement('tr');
                subRow.id = `dnfl-comment-row-${item.franchiseId}`;
                subRow.style.display = 'none';
                subRow.style.backgroundColor = 'var(--dnfl-bg-subhead, #f1f5f9)';

                const colSpanCount = isPreseasonWeek ? 5 : 7;
                subRow.className = 'dnfl-comment-row';
                subRow.innerHTML = `
                    <td colspan="${colSpanCount}" class="dnfl-comment-cell">
                        <div class="dnfl-comment-box" style="padding: 10px 14px; font-size: 0.85rem; line-height: 1.4; color: var(--dnfl-text-heading, #0f172a); background-color: #ffffff; border-radius: 6px; border: 1px solid var(--dnfl-border-subtle, #e2e8f0); margin: 6px 12px;">
                            <strong>Analyst Note:</strong> ${item.comments}
                        </div>
                    </td>
                `;
                tbody.appendChild(subRow);
            }
        });
    }

    function renderChart(data, uniqueConfs, confMap, isPreseason) {
        const canvas = document.getElementById("dnfl_powerRankingsChart");
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        const chartSorted = [...data].reverse();
        const labels = chartSorted.map(item => item.franchiseName);
        const dataValues = chartSorted.map(item => item.powerIndex);

        const backgroundColors = [];
        const borderColors = [];

        chartSorted.forEach(item => {
            const confIdx = uniqueConfs.indexOf(item.conferenceId);
            const palette = confColorPalette[confIdx >= 0 ? confIdx % confColorPalette.length : 0];
            backgroundColors.push(palette.bg);
            borderColors.push(palette.border);
        });

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
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(226, 232, 240, 0.6)' },
                        ticks: { font: { size: 11, weight: '600' } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: '600' } }
                    }
                }
            }
        });
    }

    function toggleRankingsChart() {
        const wrapper = document.getElementById("dnfl_chartWrapperContainer");
        const btn = document.getElementById("dnfl-btn-toggle-chart");
        if (!wrapper) return;

        isChartVisible = !isChartVisible;
        wrapper.style.display = isChartVisible ? 'block' : 'none';

        if (btn) {
            btn.innerHTML = isChartVisible 
                ? `<i class="fa-solid fa-chart-simple"></i> <span class="btn-text-full">Hide Chart</span><span class="btn-text-short">Chart</span>`
                : `<i class="fa-solid fa-chart-simple"></i> <span class="btn-text-full">Show Chart</span><span class="btn-text-short">Chart</span>`;
        }
    }

    function toggleCommentRow(franchiseId) {
        const row = document.getElementById(`dnfl-comment-row-${franchiseId}`);
        if (row) {
            row.style.display = (row.style.display === 'none') ? '' : 'none';
        }
    }

    window.DNFL.Rankings = {
        init: init,
        updateView: renderView,
        toggleChart: toggleRankingsChart,
        toggleCommentRow: toggleCommentRow
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
