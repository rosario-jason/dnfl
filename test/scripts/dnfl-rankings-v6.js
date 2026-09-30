/* ==========================================================================
   DNFL Power Rankings Engine v6.0 (Architecture Aligned)
   Duke Networking Fantasy League (DNFL)
   Fully aligned with _tables_v4.scss, _rankings_v8.scss, and hpm-rankings-embed-v7.
   Features Chart.js horizontal bar visualization, decoupled CSV weekly pipeline,
   always-rendered comment icon button, "Comment pending..." fallback,
   multi-property owner resolution, single-target DOM lookups,
   stepped-up bold index pills (.dnfl-pill-blue), and global comment toggling.
   ========================================================================== */
(function(window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};

    const activeHost = window.location.hostname || "myfantasyleague.com";

    let targetYear = window.current_year || null;
    if (!targetYear && window.location) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear().toString();
    }

    function norm(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    function normFranchiseId(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function getApiClient() {
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("[DNFL Rankings] DNFL.Client API middleware is required but unavailable.");
        }
        return client;
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
        if (!fid && window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.getLoggedInFranchiseId === 'function') {
            fid = window.DNFL.Client.getLoggedInFranchiseId();
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
        const normalized = normFranchiseId(fid);
        return (normalized && normalized !== '0000') ? normalized : null;
    }

    function resolveOwnerName(profile, normFid) {
        if (!profile) profile = {};
        const mapEntry = (window.DNFL && window.DNFL.franchiseMap && window.DNFL.franchiseMap[normFid]) || {};
        
        const candidate = profile.owner_name 
            || profile.owner 
            || profile.username 
            || mapEntry.owner 
            || mapEntry.owner_name 
            || '';

        return String(candidate).trim();
    }

    // State Caches
    let cachedLeagueDetails = [];
    let cachedConferences = [];
    let cachedStandingsFranchises = [];
    let weeksManifest = [];
    let currentWeeklyData = [];
    let confSlotMap = {};
    let chartInstance = null;
    let allCommentsExpanded = false;

    let retryCount = 0;
    const maxRetries = 50;

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
            const baseUrl = `https://dnfl.live/dnfl_rankings/${targetYear}`;

            const [weeksRaw, leagueResponse, standingsResponse] = await Promise.all([
                apiClient.fetchRawText(`${baseUrl}/weeks.json`).catch(err => {
                    console.warn("[DNFL Rankings] Could not load weeks.json manifest.", err);
                    return null;
                }),
                apiClient.fetchData("league"),
                apiClient.fetchData("leagueStandings")
            ]);

            if (!leagueResponse) {
                throw new Error("Missing league configuration payload from MFL.");
            }

            cachedLeagueDetails = toArray(leagueResponse.league?.franchises?.franchise);
            cachedConferences = toArray(leagueResponse.league?.conferences?.conference);
            cachedStandingsFranchises = toArray(standingsResponse?.leagueStandings?.franchise);

            confSlotMap = {};
            cachedConferences.forEach((conf, idx) => {
                confSlotMap[norm(conf.id)] = (idx % 6) + 1;
            });

            if (weeksRaw) {
                try {
                    weeksManifest = JSON.parse(weeksRaw);
                } catch (e) {
                    console.error("[DNFL Rankings] Error parsing weeks.json manifest:", e);
                }
            }

            setupFilters();
            renderLegend();
            await loadSelectedWeekData();
            setupChartToggleBtn();
        } catch (error) {
            console.error("[DNFL Rankings Error]:", error);
            tbody.innerHTML = `<tr><td colspan="6" class="dnfl-status-error">Error loading power rankings data.</td></tr>`;
        }
    }

    function setupFilters() {
        const weekSelect = document.getElementById("dnfl-rankings-select-week");
        const confSelect = document.getElementById("dnfl-rankings-select-conf");

        if (weekSelect) {
            weekSelect.innerHTML = '';
            if (weeksManifest && weeksManifest.length > 0) {
                weeksManifest.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item.file || item.filename || item.id;
                    opt.textContent = item.label || item.name || ("Week " + item.week);
                    weekSelect.appendChild(opt);
                });
                weekSelect.selectedIndex = weeksManifest.length - 1;
            } else {
                const opt = document.createElement('option');
                opt.value = "data_01.csv";
                opt.textContent = "Week 1";
                weekSelect.appendChild(opt);
            }
            weekSelect.onchange = loadSelectedWeekData;
        }

        if (confSelect) {
            confSelect.innerHTML = '';
            const allOpt = document.createElement('option');
            allOpt.value = "All";
            allOpt.textContent = "All Conferences";
            confSelect.appendChild(allOpt);

            cachedConferences.forEach(conf => {
                const opt = document.createElement('option');
                opt.value = norm(conf.id);
                opt.textContent = conf.name;
                confSelect.appendChild(opt);
            });

            const activeFranchiseId = getLoggedInFranchiseId();
            if (activeFranchiseId) {
                const userFranchise = cachedLeagueDetails.find(f => normFranchiseId(f.id) === activeFranchiseId);
                if (userFranchise && userFranchise.conference) {
                    confSelect.value = norm(userFranchise.conference);
                }
            }

            confSelect.onchange = updateDnflRankingsView;
        }
    }

    function renderLegend() {
        const legendContainer = document.getElementById("dnfl-rankings-legend");
        if (!legendContainer) return;

        let legendHtml = `<div class="dnfl-legend-items">`;
        cachedConferences.forEach(conf => {
            const slot = confSlotMap[norm(conf.id)] || 1;
            legendHtml += `<span class="dnfl-legend-item"><span class="dnfl-rank-badge color-${slot}">${slot}</span> ${conf.name}</span>`;
        });
        legendHtml += `<span class="dnfl-legend-item"><i class="fa-solid fa-comment-dots dnfl-icon-blue"></i> Click icon to show/hide Commissioner Comments</span>`;
        legendHtml += `</div>`;

        legendContainer.innerHTML = legendHtml;
    }

    function setupChartToggleBtn() {
        const btn = document.getElementById("dnfl-rankings-toggle-chart-btn");
        const wrapper = document.getElementById("dnfl-rankings-chart-wrapper");
        if (!btn || !wrapper) return;

        btn.onclick = () => {
            const isHidden = wrapper.classList.contains('dnfl-is-hidden');
            wrapper.classList.toggle('dnfl-is-hidden', !isHidden);
            btn.innerHTML = isHidden 
                ? `<i class="fa-solid fa-chart-bar"></i> Hide Chart` 
                : `<i class="fa-solid fa-chart-bar"></i> Show Chart`;
        };
    }

    async function loadSelectedWeekData() {
        const weekSelect = document.getElementById("dnfl-rankings-select-week");
        const tbody = document.getElementById("dnfl-rankings-tbody");
        if (!weekSelect || !tbody) return;

        const csvFileName = weekSelect.value || "data_01.csv";
        const apiClient = getApiClient();
        const csvUrl = `https://dnfl.live/dnfl_rankings/${targetYear}/${csvFileName}`;

        tbody.innerHTML = `<tr><td colspan="6" class="dnfl-status-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading Power Rankings Data...</td></tr>`;

        try {
            const csvText = await apiClient.fetchRawText(csvUrl);
            currentWeeklyData = parseRankingsCsv(csvText);
            updateDnflRankingsView();
        } catch (err) {
            console.error("[DNFL Rankings] Error fetching CSV data:", err);
            tbody.innerHTML = `<tr><td colspan="6" class="dnfl-status-error">Error loading week data.</td></tr>`;
        }
    }

    function parseRankingsCsv(csvText) {
        if (!csvText) return [];
        if (typeof Papa !== 'undefined') {
            const results = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            return results.data || [];
        }
        
        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const obj = {};
            headers.forEach((h, idx) => {
                obj[h] = values[idx] || '';
            });
            rows.push(obj);
        }
        return rows;
    }

    function buildTeamRowHtml(item, rank, confSlot, rowCounter) {
        const normFid = normFranchiseId(item.franchise_id || item.fid || item.id || item.team_id);
        const profile = cachedLeagueDetails.find(f => normFranchiseId(f.id) === normFid) || {};
        const stats = cachedStandingsFranchises.find(f => normFranchiseId(f.id) === normFid) || {};

        const teamName = profile.name || item.franchise_name || item.team_name || ("Franchise " + normFid);
        const ownerName = resolveOwnerName(profile, normFid);
        const ownerSubtextHtml = ownerName ? `<span class="dnfl-owner-name">${ownerName}</span>` : '';

        const logoUrl = profile.icon ? profile.icon.toString().trim() : "https://dnfl.live/images/ficon-dnfl.png";

        const rawIndex = parseFloat(item.power_index || item.index || item.score || 0);
        const indexFormatted = rawIndex.toFixed(1);

        const record = stats.h2hw !== undefined ? `${stats.h2hw}-${stats.h2hl || 0}-${stats.h2ht || 0}` : (item.record || '0-0-0');
        const rawPf = parseFloat(stats.pf || stats.h2hpf || item.pf || 0);
        const pfFormatted = rawPf.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const rankChangeVal = parseInt(item.change || item.rank_change || 0, 10);
        let changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-gray">—</span>`;
        if (rankChangeVal > 0) {
            changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-green">▲ +${rankChangeVal}</span>`;
        } else if (rankChangeVal < 0) {
            changeBadgeHtml = `<span class="dnfl-badge dnfl-badge-red">▼ ${rankChangeVal}</span>`;
        }

        const rawComment = (item.comment || item.notes || item.commentary || '').trim();
        const commentText = rawComment || 'Comment pending...';

        const stripeClass = (rowCounter % 2 === 1) ? "dnfl-row-even" : "dnfl-row-odd";
        const activeFranchiseId = getLoggedInFranchiseId();
        const myTeamClass = (activeFranchiseId && normFid === activeFranchiseId) ? " dnfl-my-team myfranchise" : "";

        const activeLeagueId = getLeagueId();
        const targetHref = `https://${activeHost}/${targetYear}/options?L=${activeLeagueId}&F=${normFid}&O=01`;

        const mainRowHtml = `
            <tr class="${stripeClass}${myTeamClass}">
                <td class="dnfl-col-rank">
                    <div class="dnfl-rank-cell-wrap">
                        <span class="dnfl-rank-badge color-${confSlot}">${rank}</span>
                        <button type="button" class="dnfl-comment-toggle-btn" onclick="DNFL.Rankings.toggleCommentary('${normFid}')" title="Toggle Commissioner Comment">
                            <i class="fa-solid fa-comment-dots dnfl-icon-blue"></i>
                        </button>
                    </div>
                </td>
                <td class="dnfl-col-change dnfl-hide-mobile">${changeBadgeHtml}</td>
                <td class="dnfl-col-franchise">
                    <div class="dnfl-franchise-cell">
                        <a href="${targetHref}" title="View Franchise Page">
                            <img src="${logoUrl}" alt="${teamName}" class="franchiseicon" id="franchiseicon_${normFid}" onError="this.onerror=null;this.src='https://dnfl.live/images/ficon-dnfl.png';" />
                        </a>
                        <div class="dnfl-franchise-info">
                            <a href="${targetHref}" class="dnfl-team-name">${teamName}</a>
                            ${ownerSubtextHtml}
                        </div>
                    </div>
                </td>
                <td class="dnfl-col-index">
                    <span class="dnfl-pill-blue dnfl-pill">${indexFormatted}</span>
                </td>
                <td class="dnfl-col-record dnfl-hide-mobile">${record}</td>
                <td class="dnfl-col-pf dnfl-hide-mobile">${pfFormatted}</td>
            </tr>
            <tr id="dnfl-comment-row-${normFid}" class="dnfl-comment-row dnfl-is-hidden">
                <td colspan="6">
                    <div class="dnfl-comment-box">
                        <i class="fa-solid fa-quote-left dnfl-icon-blue"></i> ${commentText}
                    </div>
                </td>
            </tr>
        `;

        return mainRowHtml;
    }

    function updateDnflRankingsView() {
        const confSelect = document.getElementById("dnfl-rankings-select-conf");
        const tbody = document.getElementById("dnfl-rankings-tbody");
        const titleEl = document.getElementById("dnfl-rankings-title");
        if (!confSelect || !tbody) return;

        const selectedConf = confSelect.value;
        let filteredData = [...currentWeeklyData];

        if (selectedConf !== "All") {
            filteredData = filteredData.filter(item => {
                const normFid = normFranchiseId(item.franchise_id || item.fid || item.id);
                const profile = cachedLeagueDetails.find(f => normFranchiseId(f.id) === normFid);
                return profile && norm(profile.conference) === norm(selectedConf);
            });
        }

        filteredData.sort((a, b) => {
            const scoreA = parseFloat(a.power_index || a.index || a.score || 0);
            const scoreB = parseFloat(b.power_index || b.index || b.score || 0);
            return scoreB - scoreA;
        });

        if (titleEl) {
            const confObj = cachedConferences.find(c => norm(c.id) === norm(selectedConf));
            const prefix = confObj ? confObj.name : "League";
            titleEl.innerHTML = `<i class="fa-solid fa-ranking-star"></i> ${prefix} Power Rankings`;
        }

        renderChart(filteredData);

        let tableHtml = `
            <tr class="dnfl-division-header">
                <td colspan="6" class="dnfl-division-header-cell">
                    <div class="dnfl-division-title-wrap">
                        <span>Power Rankings Standings</span>
                        <button id="dnfl-btn-toggle-all-comments" class="dnfl-division-toggle-btn" onclick="DNFL.Rankings.toggleAllComments()" title="Toggle All Commissioner Comments" aria-label="Toggle All Comments">
                            <i class="fa-solid fa-comment-dots"></i> <span id="dnfl-toggle-comments-text">${allCommentsExpanded ? 'Hide All Comments' : 'Show All Comments'}</span>
                        </button>
                    </div>
                </td>
            </tr>
            <tr class="dnfl-table-subheader">
                <th class="dnfl-col-rank">Rank</th>
                <th class="dnfl-col-change dnfl-hide-mobile">Change</th>
                <th class="dnfl-col-franchise">Franchise</th>
                <th class="dnfl-col-index">Power Index</th>
                <th class="dnfl-col-record dnfl-hide-mobile">Record</th>
                <th class="dnfl-col-pf dnfl-hide-mobile">Points For</th>
            </tr>
        `;

        let rowCounter = 0;
        filteredData.forEach((item, idx) => {
            const normFid = normFranchiseId(item.franchise_id || item.fid || item.id);
            const profile = cachedLeagueDetails.find(f => normFranchiseId(f.id) === normFid) || {};
            const confSlot = confSlotMap[norm(profile.conference)] || 1;
            const rank = idx + 1;

            tableHtml += buildTeamRowHtml(item, rank, confSlot, rowCounter);
            rowCounter++;
        });

        tbody.innerHTML = tableHtml;
    }

    function renderChart(data) {
        const canvas = document.getElementById("dnfl-rankings-chart");
        if (!canvas || typeof Chart === 'undefined') return;

        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        const labels = [];
        const scores = [];
        const bgColors = [];

        const slotCssVars = [
            '#0577B1', '#0284c7', '#0d9488', '#d97706', '#dc2626', '#4f46e5'
        ];

        data.forEach(item => {
            const normFid = normFranchiseId(item.franchise_id || item.fid || item.id);
            const profile = cachedLeagueDetails.find(f => normFranchiseId(f.id) === normFid) || {};
            const teamName = profile.name || item.franchise_name || ("Franchise " + normFid);
            const score = parseFloat(item.power_index || item.index || item.score || 0);

            const confSlot = confSlotMap[norm(profile.conference)] || 1;
            const color = slotCssVars[(confSlot - 1) % 6];

            labels.push(teamName);
            scores.push(score);
            bgColors.push(color);
        });

        const ctx = canvas.getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Power Index',
                    data: scores,
                    backgroundColor: bgColors,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Power Index: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: 50,
                        max: 100,
                        grid: { color: '#e2e8f0' }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function toggleCommentary(fid) {
        const normFid = normFranchiseId(fid);
        const commentRow = document.getElementById(`dnfl-comment-row-${normFid}`);
        if (commentRow) {
            commentRow.classList.toggle('dnfl-is-hidden');
        }
    }

    function toggleAllComments() {
        allCommentsExpanded = !allCommentsExpanded;
        const commentRows = document.querySelectorAll('#dnfl-rankings-tbody .dnfl-comment-row');
        const textSpan = document.getElementById('dnfl-toggle-comments-text');

        commentRows.forEach(row => {
            row.classList.toggle('dnfl-is-hidden', !allCommentsExpanded);
        });

        if (textSpan) {
            textSpan.textContent = allCommentsExpanded ? 'Hide All Comments' : 'Show All Comments';
        }
    }

    window.DNFL.Rankings = {
        init: init,
        updateView: updateDnflRankingsView,
        toggleCommentary: toggleCommentary,
        toggleAllComments: toggleAllComments
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window, document);
