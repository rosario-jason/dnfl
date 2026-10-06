/* ==========================================================================
   DNFL Popups & Modal Subsystem Engine (dnfl-popups-v4_19.js)
   Duke Networking Fantasy League (DNFL) Architecture
   ========================================================================== */

(function () {
    'use me strict';
    if (window.DNFL && window.DNFL.Popups && window.DNFL.Popups.version === '4.19') {
        console.log("DNFL Popups Subsystem v4.19 already loaded.");
        return;
    }

    window.DNFL = window.DNFL || {};

    let isInitialized = false;
    let capturedHomepageMessages = [];
    let capturedLeagueReminders = [];

    function getApiClient() {
        if (window.DNFLClient && typeof window.DNFLClient.fetchData === 'function') {
            return window.DNFLClient;
        }
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.fetchData === 'function') {
            return window.DNFL.Client;
        }
        return {
            fetchData: async function (endpoint, params) {
                const year = window.MFL_YEAR || new Date().getFullYear();
                const leagueId = window.MFL_LEAGUE_ID || '';
                const query = new URLSearchParams({ TYPE: endpoint, L: leagueId, JSON: '1', ...params }).toString();
                const res = await fetch(`https://api.myfantasyleague.com/${year}/export?${query}`);
                return await res.json();
            },
            fetchRawText: async function (url) {
                const res = await fetch(url);
                return await res.text();
            },
            clearCache: function () {}
        };
    }

    function getTtl(client, preset, fallbackMs) {
        if (client.TTLS && client.TTLS[preset]) return client.TTLS[preset];
        return fallbackMs;
    }

    function norm(id) {
        if (id === null || id === undefined) return '';
        return String(id).padStart(4, '0');
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function escapeXml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function getLoggedInFranchiseId(client) {
        try {
            if (client && typeof client.getUserFranchise === 'function') {
                const fid = client.getUserFranchise();
                if (fid) return norm(fid);
            }
        } catch (e) {}

        if (window.franchise_id) return norm(window.franchise_id);
        if (window.MFL_FRANCHISE_ID) return norm(window.MFL_FRANCHISE_ID);
        if (window.mfl_franchise_id) return norm(window.mfl_franchise_id);

        const match = document.cookie.match(/MFL_USER_ID=([^;]+)/);
        if (match && match[1]) {
            const parts = unescape(match[1]).split(':');
            if (parts.length >= 2 && parts[1]) {
                return norm(parts[1]);
            }
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('fid')) return norm(urlParams.get('fid'));
        if (urlParams.has('FRANCHISE')) return norm(urlParams.get('FRANCHISE'));

        return '';
    }

    function isUserCommish(client) {
        try {
            if (client && typeof client.isCommissioner === 'function') {
                return client.isCommissioner();
            }
        } catch (e) {}
        if (window.is_commissioner === true || window.is_commissioner === '1' || window.IS_COMMISSIONER === true) {
            return true;
        }
        return false;
    }

    async function fetchPowerRankingsCsv(client) {
        const year = window.MFL_YEAR || new Date().getFullYear();
        const dailyTtl = getTtl(client, 'DAILY', 86400000);

        let latestWeekFile = 'data_02.csv';
        try {
            const manifestUrl = `https://dnfl.live/dnfl_rankings/${year}/weeks.json`;
            const manifestRaw = await client.fetchRawText(manifestUrl, { ttl: dailyTtl });
            if (manifestRaw && !manifestRaw.trim().startsWith('<')) {
                const manifestData = JSON.parse(manifestRaw);
                const weeksList = toArray(manifestData?.weeks);
                if (weeksList.length > 0) {
                    const lastEntry = weeksList[weeksList.length - 1];
                    if (lastEntry && (lastEntry.file || lastEntry.filename)) {
                        latestWeekFile = lastEntry.file || lastEntry.filename;
                    } else if (typeof lastEntry === 'string') {
                        latestWeekFile = lastEntry;
                    }
                }
            }
        } catch (e) {
            console.warn("[DNFL Popups] Could not parse weeks.json manifest, attempting fallback search:", e);
        }

        const csvUrl = `https://dnfl.live/dnfl_rankings/${year}/${latestWeekFile}`;
        let csvText = '';
        try {
            csvText = await client.fetchRawText(csvUrl, { ttl: dailyTtl });
        } catch (e) {}

        if (!csvText || csvText.trim().startsWith('<')) {
            for (let wk = 18; wk >= 0; wk--) {
                const padWk = String(wk).padStart(2, '0');
                const testFile = wk === 0 ? 'data_00_pre-season.csv' : `data_${padWk}.csv`;
                try {
                    const testUrl = `https://dnfl.live/dnfl_rankings/${year}/${testFile}`;
                    const res = await client.fetchRawText(testUrl, { ttl: dailyTtl });
                    if (res && !res.trim().startsWith('<') && res.includes('Franchise')) {
                        csvText = res;
                        break;
                    }
                } catch (err) {}
            }
        }

        const rankingsMap = {};
        if (!csvText) return rankingsMap;

        const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return rankingsMap;

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const fidIdx = headers.findIndex(h => h.includes('fid') || h.includes('id') || h.includes('franchise'));
        const prIdx = headers.findIndex(h => h.includes('power') || h.includes('index') || h.includes('score') || h.includes('pr'));
        const rankIdx = headers.findIndex(h => h.includes('rank') || h.includes('pos'));

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length <= fidIdx) continue;

            const fid = norm(cols[fidIdx]);
            if (!fid) continue;

            const rawPr = prIdx >= 0 ? cols[prIdx] : '';
            const rawRank = rankIdx >= 0 ? cols[rankIdx] : String(i);

            rankingsMap[fid] = {
                powerIndex: rawPr ? parseFloat(rawPr).toFixed(2) : 'N/A',
                rank: rawRank || String(i)
            };
        }

        return rankingsMap;
    }

    function captureHomepageMessages() {
        const hpMsgs = document.querySelectorAll('#body_home .homepagemessage, .homepagemessage');
        hpMsgs.forEach((el, idx) => {
            const html = el.innerHTML.trim();
            if (html) {
                capturedHomepageMessages.push({ id: idx + 1, html: html });
            }
        });

        const reminders = document.querySelectorAll('#league_reminders, .tdalert, .alert, #warning');
        reminders.forEach((el) => {
            const txt = el.innerText.trim();
            if (txt && !capturedLeagueReminders.includes(txt)) {
                capturedLeagueReminders.push(txt);
            }
        });
    }

    function attachLinkInterceptors() {
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href') || '';
            if (href.includes('O=01') || href.includes('O=02') || href.includes('O=03') || href.includes('options?L=') && href.includes('FRANCHISE=')) {
                const match = href.match(/FRANCHISE=(\d{4})/i) || href.match(/F=(\d{4})/i);
                if (match && match[1]) {
                    e.preventDefault();
                    if (href.includes('O=01')) {
                        openFranchisePopup(match[1], 'setup');
                    } else {
                        openFranchisePopup(match[1], 'overview');
                    }
                    return;
                }
            }

            if (href.includes('options?L=') && href.includes('O=00')) {
                const client = getApiClient();
                const loggedFid = getLoggedInFranchiseId(client);
                if (loggedFid) {
                    e.preventDefault();
                    openFranchisePopup(loggedFid, 'overview');
                    return;
                }
            }

            if (href.includes('options?L=') && (href.includes('O=101') || href.includes('O=102') || href.includes('P='))) {
                const match = href.match(/P=(\d+)/i);
                if (match && match[1]) {
                    e.preventDefault();
                    openPlayerPopup(match[1], 'overview');
                }
            }
        });
    }

    function showModal(titleText, headerHtml) {
        let overlay = document.getElementById('dnfl-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'dnfl-modal-overlay';
            overlay.className = 'dnfl-modal-overlay dnfl-is-hidden';
            overlay.innerHTML = `
                <div id="dnfl-modal-container" class="dnfl-card dnfl-modal-card">
                    <div class="dnfl-card-header dnfl-modal-header">
                        <h3 id="dnfl-modal-title" class="dnfl-card-title"></h3>
                        <button id="dnfl-modal-close-btn" class="dnfl-modal-close" aria-label="Close Modal" type="button">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div id="dnfl-modal-content-wrapper" class="dnfl-card-body dnfl-modal-body"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        const titleEl = document.getElementById('dnfl-modal-title');
        titleEl.innerHTML = headerHtml || titleText;

        overlay.classList.remove('dnfl-is-hidden');
    }

    function closeModal() {
        const overlay = document.getElementById('dnfl-modal-overlay');
        if (overlay) {
            overlay.classList.add('dnfl-is-hidden');
        }
    }

    document.addEventListener('click', function (e) {
        if (e.target.closest('#dnfl-modal-close-btn') || e.target.closest('.dnfl-modal-close')) {
            closeModal();
            return;
        }
        const overlay = document.getElementById('dnfl-modal-overlay');
        if (overlay && e.target === overlay) {
            closeModal();
        }
    });

    async function openPlayerPopup(playerId, activeTab) {
        activeTab = activeTab || 'overview';
        showModal(`Player #${playerId}`, `<i class="fa-solid fa-user"></i> <span>Loading Player...</span>`);
        const content = document.getElementById('dnfl-modal-content-wrapper');

        content.innerHTML = `
            <div class="dnfl-status-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Loading player #${playerId}...
            </div>
        `;

        try {
            const client = getApiClient();
            const hourlyTtl = getTtl(client, 'HOURLY', 3600000);
            const dailyTtl = getTtl(client, 'DAILY', 86400000);

            const [playerData, rosterData, leagueData] = await Promise.all([
                client.fetchData('players', { P: playerId, DETAILS: 1 }, { ttl: dailyTtl }).catch(() => null),
                client.fetchData('rosters', {}, { ttl: hourlyTtl }).catch(() => null),
                client.fetchData('league', {}, { ttl: hourlyTtl }).catch(() => null)
            ]);

            const pList = toArray(playerData?.players?.player);
            const p = pList.find(item => norm(item.id) === norm(playerId)) || { name: `Player #${playerId}`, position: 'N/A', team: 'FA' };

            const franchises = toArray(leagueData?.league?.franchises?.franchise);
            const rosters = toArray(rosterData?.rosters?.franchise);

            let owningFranchises = [];
            rosters.forEach(r => {
                const rPlayers = toArray(r.player);
                if (rPlayers.some(rp => norm(rp.id) === norm(playerId))) {
                    const fObj = franchises.find(f => norm(f.id) === norm(r.id));
                    if (fObj) owningFranchises.push(fObj);
                }
            });

            const headerHtml = `<i class="fa-solid fa-user"></i> <span>${p.name}</span>`;
            showModal(p.name, headerHtml);

            const ownerHtml = owningFranchises.length > 0 
                ? owningFranchises.map(f => `<span class="dnfl-pill-blue">${f.name}</span>`).join(' ')
                : '<span class="dnfl-pill-gray">Free Agent</span>';

            const espnId = p.espn_id || p.espn_id_full;
            const headshot = espnId 
                ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
                : `https://www.mflscripts.com/playerImages_96x96/mfl_${p.id}.png`;

            let heroHtml = `
                <div class="dnfl-player-hero-card">
                    <div class="dnfl-hero-avatar-wrapper">
                        <img src="${headshot}" alt="${p.name}" class="dnfl-hero-headshot" onerror="this.src='https://www.mflscripts.com/playerImages_96x96/free_agent.png'" />
                    </div>
                    <div class="dnfl-hero-meta">
                        <h3 class="dnfl-hero-name">${p.name}</h3>
                        <div class="dnfl-hero-tags">
                            <span class="dnfl-pill-gold">${p.position || 'N/A'}</span>
                            <span class="dnfl-pill-gray">${p.team || 'FA'}</span>
                            ${ownerHtml}
                        </div>
                    </div>
                </div>
            `;

            let tabButtonsHtml = `
                <div class="dnfl-modal-tabs">
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'overview')"><i class="fa-solid fa-chart-line"></i> <span class="dnfl-tab-label">Overview</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'gamelog' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'gamelog')"><i class="fa-solid fa-list-check"></i> <span class="dnfl-tab-label">Game Log</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'news' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'news')"><i class="fa-solid fa-newspaper"></i> <span class="dnfl-tab-label">News</span></button>
                </div>
            `;

            content.innerHTML = heroHtml + tabButtonsHtml + renderPlayerTabContent(p, owningFranchises, activeTab);

        } catch (e) {
            console.error("[DNFL Popups] Error opening player popup:", e);
            content.innerHTML = `
                <div class="dnfl-status-error">
                    <i class="fa-solid fa-triangle-exclamation"></i> Error loading player card: ${e.message}
                </div>
            `;
        }
    }

    function renderPlayerTabContent(pData, owningFranchises, tabName) {
        if (tabName === 'overview') {
            return `
                <table class="dnfl-table">
                    <thead>
                        <tr>
                            <th>Attribute</th>
                            <th>Detail</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="dnfl-row-odd"><td>NFL Team</td><td>${pData.team || 'FA'}</td></tr>
                        <tr class="dnfl-row-even"><td>Position</td><td>${pData.position || 'N/A'}</td></tr>
                        <tr class="dnfl-row-odd"><td>Status</td><td>${owningFranchises.length > 0 ? 'Rostered' : 'Free Agent'}</td></tr>
                        <tr class="dnfl-row-even"><td>Birthdate / Age</td><td>${pData.birthdate || 'N/A'}</td></tr>
                    </tbody>
                </table>
            `;
        } else if (tabName === 'gamelog') {
            return `
                <div class="dnfl-status-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i> Loading season gamelogs...
                </div>
            `;
        } else if (tabName === 'news') {
            return `
                <div class="dnfl-subtext">No recent player news available.</div>
            `;
        }
    }

    function switchPlayerTab(playerId, tabName) {
        openPlayerPopup(playerId, tabName);
    }

    async function openFranchisePopup(franchiseId, activeTab) {
        activeTab = activeTab || 'overview';
        showModal(`Franchise #${franchiseId}`, `<i class="fa-solid fa-shield-halved"></i> <span>Loading Franchise...</span>`);
        const content = document.getElementById('dnfl-modal-content-wrapper');

        content.innerHTML = `
            <div class="dnfl-status-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Loading franchise #${franchiseId}...
            </div>
        `;

        try {
            const client = getApiClient();
            const hourlyTtl = getTtl(client, 'HOURLY', 3600000);
            const dailyTtl = getTtl(client, 'DAILY', 86400000);
            const fiveMinTtl = getTtl(client, 'FIVE_MIN', 300000);

            const loggedInFid = getLoggedInFranchiseId(client);
            const commishStatus = isUserCommish(client);
            const isOwnerOrCommish = commishStatus || (loggedInFid && norm(loggedInFid) === norm(franchiseId));

            const [leagueData, standingsData, rosterData, playerMap, ytdScoresData, powerRankingsMap] = await Promise.all([
                client.fetchData('league', {}, { ttl: hourlyTtl }).catch(() => null),
                client.fetchData('leagueStandings', { COLUMN_NAMES: 1, ALL: 1 }, { ttl: hourlyTtl }).catch(() => null),
                client.fetchData('rosters', { FRANCHISE: franchiseId }, { ttl: fiveMinTtl }).catch(() => null),
                client.fetchData('players', { DETAILS: 1 }, { ttl: dailyTtl }).catch(() => null),
                client.fetchData('playerScores', { W: 'YTD' }, { ttl: hourlyTtl }).catch(() => null),
                fetchPowerRankingsCsv(client).catch(() => ({}))
            ]);

            const targetFidNorm = norm(franchiseId);
            const franchises = toArray(leagueData?.league?.franchises?.franchise);
            const conferences = toArray(leagueData?.league?.conferences?.conference);
            const divisions = toArray(leagueData?.league?.divisions?.division);

            const targetFran = franchises.find(f => norm(f.id) === targetFidNorm);
            if (!targetFran) throw new Error("Franchise not found in league database.");

            const name = targetFran.name || `Franchise #${franchiseId}`;
            const logo = targetFran.logo;
            const icon = targetFran.icon;

            const divId = targetFran.division || targetFran.division_id;
            const divObj = divisions.find(d => norm(d.id) === norm(divId));

            const confId = targetFran.conference_id || targetFran.conference || (divObj ? (divObj.conference_id || divObj.conference) : '');
            const confObj = conferences.find(c => norm(c.id) === norm(confId));

            const confName = confObj ? confObj.name : '';
            const divName = divObj ? divObj.name : '';
            
            let fullLoc = '';
            if (confName && divName) {
                fullLoc = `${confName} • ${divName}`;
            } else if (confName) {
                fullLoc = confName;
            } else if (divName) {
                fullLoc = divName;
            } else {
                fullLoc = 'DNFL League';
            }

            const headerHtml = `
                <div class="dnfl-modal-header-left">
                    ${icon ? `<img src="${icon}" alt="Icon" class="franchise-icon-md dnfl-ficon-rounded" onerror="this.style.display='none'" />` : ''}
                    <span>${name}</span>
                </div>
                ${isOwnerOrCommish ? `
                    <button class="dnfl-gear-btn ${activeTab === 'setup' ? 'is-active' : ''}" title="Franchise Setup" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'setup')" type="button">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                ` : ''}
            `;
            showModal(name, headerHtml);

            const standingsList = toArray(standingsData?.leagueStandings?.franchise);
            const franStandings = standingsList.find(s => norm(s.id) === targetFidNorm) || {};

            const wins = parseInt(franStandings.h2hw || franStandings.w || 0, 10);
            const losses = parseInt(franStandings.h2hl || franStandings.l || 0, 10);
            const ties = parseInt(franStandings.h2ht || franStandings.t || 0, 10);
            const recordStr = `${wins}-${losses}-${ties}`;

            const totalGames = wins + losses + ties;
            const winPct = totalGames > 0 ? ((wins + 0.5 * ties) / totalGames) : 0;
            const winPctStr = `.${Math.round(winPct * 1000).toString().padStart(3, '0')} Win %`;

            const pfVal = parseFloat(franStandings.pf || franStandings.points_for || 0);
            const paVal = parseFloat(franStandings.pa || franStandings.points_against || 0);

            const currentWk = parseInt(leagueData?.league?.currentWk || 1, 10);
            const completedWeeks = totalGames > 0 ? totalGames : Math.max(1, currentWk - 1);

            const pfPpgVal = (pfVal / completedWeeks).toFixed(2);
            const paPpgVal = (paVal / completedWeeks).toFixed(2);

            const pfMainStr = `${pfPpgVal} <span class="dnfl-ppg-label">PPG</span>`;
            const pfTotalStr = `${pfVal.toFixed(2)} Total`;

            const paMainStr = `${paPpgVal} <span class="dnfl-ppg-label">PPG</span>`;
            const paTotalStr = `${paVal.toFixed(2)} Total`;

            let bbidRaw = targetFran.bbidAvailable || targetFran.bbid_balance || targetFran.bbidSpent || targetFran.bbid || franStandings.bbidAvailable || franStandings.bbid_balance || franStandings.bbidbalance || franStandings.bbid;
            let bbidMainStr = '$100.00';
            if (bbidRaw !== undefined && bbidRaw !== null && bbidRaw !== '' && bbidRaw !== 'N/A') {
                const bbidNum = parseFloat(String(bbidRaw).replace(/[^0-9.]/g, ''));
                if (!isNaN(bbidNum)) {
                    bbidMainStr = `$${bbidNum.toFixed(2)}`;
                } else {
                    bbidMainStr = String(bbidRaw);
                }
            }

            let seedVal = franStandings.seed || franStandings.playoff_seed || franStandings.pseed;
            let seedTypeLabel = "Conference Seed";
            
            if (!seedVal && window.DNFL && window.DNFL.Standings) {
                if (typeof window.DNFL.Standings.getTeamSeed === 'function') {
                    seedVal = window.DNFL.Standings.getTeamSeed(targetFidNorm);
                } else if (window.DNFL.Standings.cachedTeamSeeds) {
                    seedVal = window.DNFL.Standings.cachedTeamSeeds[targetFidNorm];
                }
            }

            if (!seedVal && standingsList.length > 0) {
                const confIdNorm = norm(targetFran.conference_id || targetFran.conference);
                if (confIdNorm && conferences.length > 0) {
                    const confTeams = standingsList.filter(s => {
                        const fObj = franchises.find(f => norm(f.id) === norm(s.id));
                        return fObj && norm(fObj.conference_id || fObj.conference) === confIdNorm;
                    });
                    const confIdx = confTeams.findIndex(s => norm(s.id) === targetFidNorm);
                    seedVal = confIdx >= 0 ? confIdx + 1 : '1';
                    seedTypeLabel = "Conference Seed";
                } else {
                    const overallIdx = standingsList.findIndex(s => norm(s.id) === targetFidNorm);
                    seedVal = overallIdx >= 0 ? overallIdx + 1 : '1';
                    seedTypeLabel = "Overall Seed";
                }
            }
            if (!seedVal) seedVal = '1';

            const prMeta = powerRankingsMap[targetFidNorm] || {};
            const rawPrVal = prMeta.powerIndex || (franStandings.power_rank ? parseFloat(franStandings.power_rank).toFixed(2) : '85.00');
            const prVal = !isNaN(parseFloat(rawPrVal)) ? parseFloat(rawPrVal).toFixed(2) : rawPrVal;
            const prRankNum = prMeta.rank || franStandings.rank || '1';
            const prSubStr = `#${prRankNum} Overall Rank`;

            let navTabsHtml = `
                <div class="dnfl-modal-tabs dnfl-tabs-fullwidth">
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'overview')"><i class="fa-solid fa-chart-line"></i> <span class="dnfl-tab-label">Overview</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'roster' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'roster')"><i class="fa-solid fa-users"></i> <span class="dnfl-tab-label">Roster</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'schedule' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'schedule')"><i class="fa-solid fa-calendar-days"></i> <span class="dnfl-tab-label">Schedule</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'history' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'history')"><i class="fa-solid fa-trophy"></i> <span class="dnfl-tab-label">History</span></button>
                    ${isOwnerOrCommish ? `
                        <button class="dnfl-modal-tab-btn ${activeTab === 'setup' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'setup')"><i class="fa-solid fa-gear"></i> <span class="dnfl-tab-label">Setup</span></button>
                    ` : ''}
                </div>
            `;

            let bodyHtml = navTabsHtml + renderFranchiseTabContent(
                targetFran, franStandings, rosterData, playerMap, ytdScoresData, 
                activeTab, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, 
                bbidMainStr, seedVal, seedTypeLabel, prVal, prSubStr, completedWeeks, 
                fullLoc, isOwnerOrCommish, commishStatus
            );

            content.innerHTML = bodyHtml;

        } catch (e) {
            console.error("[DNFL Popups] Error opening franchise popup:", e);
            content.innerHTML = `
                <div class="dnfl-status-error">
                    <i class="fa-solid fa-triangle-exclamation"></i> Error loading franchise card: ${e.message}
                </div>
            `;
        }
    }

    function renderFranchiseTabContent(
        targetFran, franStandings, rosterData, playerMap, ytdScoresData, 
        tabName, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, 
        bbidMainStr, seedVal, seedTypeLabel, prVal, prSubStr, completedWeeks, 
        fullLoc, isOwnerOrCommish, commishStatus
    ) {
        const name = targetFran.name || `Franchise #${targetFran.id}`;
        const logo = targetFran.logo;
        const ownerName = targetFran.owner_name || 'Owner';

        if (tabName === 'overview') {
            const playerList = toArray(playerMap?.players?.player);
            const ytdList = toArray(ytdScoresData?.playerScores?.playerScore);
            
            const ytdScoreMap = {};
            ytdList.forEach(item => {
                if (item && item.id) {
                    const rawId = item.id;
                    const unpadded = String(rawId).replace(/^0+/, '');
                    const padded = norm(rawId);
                    const val = parseFloat(item.score || item.points || item.ytd || 0);
                    ytdScoreMap[rawId] = val;
                    ytdScoreMap[unpadded] = val;
                    ytdScoreMap[padded] = val;
                }
            });

            const posPlayersMap = {};
            playerList.forEach(p => {
                const pos = String(p.position || 'N/A').toUpperCase();
                const pid = p.id;
                const score = ytdScoreMap[pid] || ytdScoreMap[norm(pid)] || ytdScoreMap[String(pid).replace(/^0+/, '')] || 0;
                if (!posPlayersMap[pos]) posPlayersMap[pos] = [];
                posPlayersMap[pos].push({ id: norm(p.id), score: score });
            });

            const posRankMap = {};
            Object.keys(posPlayersMap).forEach(pos => {
                posPlayersMap[pos].sort((a, b) => b.score - a.score);
                posPlayersMap[pos].forEach((item, idx) => {
                    posRankMap[item.id] = { pos: pos, rank: idx + 1 };
                });
            });

            const franRosterObj = toArray(rosterData?.rosters?.franchise).find(r => norm(r.id) === norm(targetFran.id));
            const rosterPlayerIds = toArray(franRosterObj?.player).map(p => norm(p.id));

            const rosterPlayers = playerList.filter(p => rosterPlayerIds.includes(norm(p.id))).map(p => {
                const pidNorm = norm(p.id);
                const score = ytdScoreMap[p.id] || ytdScoreMap[pidNorm] || ytdScoreMap[String(p.id).replace(/^0+/, '')] || 0;
                const ppg = completedWeeks > 0 ? (score / completedWeeks).toFixed(2) : '0.00';
                const posMeta = posRankMap[pidNorm] || { pos: String(p.position || 'N/A').toUpperCase(), rank: '--' };
                return {
                    ...p,
                    ytdScore: score,
                    ppg: ppg,
                    posRank: posMeta.rank
                };
            });

            rosterPlayers.sort((a, b) => b.ytdScore - a.ytdScore);

            const qbList = rosterPlayers.filter(p => String(p.position).toUpperCase() === 'QB');
            const topQb = qbList.length > 0 ? qbList[0] : null;

            const flexList = rosterPlayers.filter(p => {
                const pos = String(p.position).toUpperCase();
                return pos === 'RB' || pos === 'WR' || pos === 'TE';
            });

            const topSkill = flexList.filter(p => p !== topQb).slice(0, 3);

            const topPerformers = [];
            if (topQb) topPerformers.push(topQb);
            topSkill.forEach(p => topPerformers.push(p));

            topPerformers.sort((a, b) => b.ytdScore - a.ytdScore);

            let starsHtml = '';
            if (topPerformers.length > 0) {
                starsHtml = `
                    <div class="dnfl-stars-wrapper">
                        <h4 class="dnfl-section-title"><i class="fa-solid fa-star"></i> Top Performers</h4>
                        <div class="dnfl-stars-grid">
                            ${topPerformers.map(p => {
                                const pos = String(p.position || 'N/A').toUpperCase();
                                const espnId = p.espn_id || p.espn_id_full;
                                const headshot = espnId 
                                    ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
                                    : `https://www.mflscripts.com/playerImages_96x96/mfl_${p.id}.png`;
                                return `
                                    <div class="dnfl-star-card" onclick="DNFL.Popups.openPlayerPopup('${p.id}')">
                                        <div class="dnfl-star-avatar-wrapper">
                                            <img src="${headshot}" alt="${p.name}" class="dnfl-star-avatar" onerror="this.src='https://www.mflscripts.com/playerImages_96x96/free_agent.png'" />
                                            <span class="dnfl-position-badge pos-${pos.toLowerCase()}">${pos}</span>
                                        </div>
                                        <div class="dnfl-star-info">
                                            <div class="dnfl-star-name">${p.name}</div>
                                            <div class="dnfl-star-main-metric">${p.ppg} <span class="dnfl-ppg-label">PPG</span></div>
                                            <div class="dnfl-star-sub-metric">${p.ytdScore.toFixed(2)} Total (${pos} #${p.posRank})</div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="dnfl-franchise-hero-header">
                    <div class="dnfl-hero-left-meta">
                        <div class="dnfl-owner-details-box">
                            <div class="dnfl-owner-detail-row">
                                <span class="dnfl-owner-label">OWNER:</span>
                                <span class="dnfl-owner-val"><strong>${ownerName}</strong></span>
                            </div>
                            <div class="dnfl-owner-detail-row">
                                <span class="dnfl-owner-label">DIVISION:</span>
                                <span class="dnfl-owner-val">${fullLoc}</span>
                            </div>
                        </div>

                        <div class="dnfl-scorecard-grid">
                            <div class="dnfl-stat-card">
                                <div class="dnfl-stat-lbl">Record</div>
                                <div class="dnfl-stat-val-main">${recordStr}</div>
                                <div class="dnfl-stat-val-sub">${winPctStr}</div>
                            </div>
                            <div class="dnfl-stat-card">
                                <div class="dnfl-stat-lbl">PF</div>
                                <div class="dnfl-stat-val-main">${pfMainStr}</div>
                                <div class="dnfl-stat-val-sub">${pfTotalStr}</div>
                            </div>
                            <div class="dnfl-stat-card">
                                <div class="dnfl-stat-lbl">PA</div>
                                <div class="dnfl-stat-val-main">${paMainStr}</div>
                                <div class="dnfl-stat-val-sub">${paTotalStr}</div>
                            </div>
                            <div class="dnfl-stat-card">
                                <div class="dnfl-stat-lbl">BBID</div>
                                <div class="dnfl-stat-val-main">${bbidMainStr}</div>
                                <div class="dnfl-stat-val-sub">Budget Available</div>
                            </div>
                            <div class="dnfl-stat-card">
                                <div class="dnfl-stat-lbl">Seed</div>
                                <div class="dnfl-stat-val-main">#${seedVal}</div>
                                <div class="dnfl-stat-val-sub">${seedTypeLabel}</div>
                            </div>
                            <div class="dnfl-stat-card">
                                <div class="dnfl-stat-lbl">Rank</div>
                                <div class="dnfl-stat-val-main">${prVal}</div>
                                <div class="dnfl-stat-val-sub">${prSubStr}</div>
                            </div>
                        </div>
                    </div>

                    ${logo ? `
                        <div class="dnfl-hero-logo-wrapper">
                            <img src="${logo}" alt="${name}" class="dnfl-hero-large-logo" onerror="this.style.display='none'" />
                        </div>
                    ` : ''}
                </div>

                ${starsHtml}
            `;
        } else if (tabName === 'roster') {
            return `
                <table class="dnfl-table">
                    <thead>
                        <tr>
                            <th>Franchise Attribute</th>
                            <th>Detail</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="dnfl-row-odd"><td>Franchise ID</td><td><code>${targetFran.id}</code></td></tr>
                        <tr class="dnfl-row-even"><td>Owner Name</td><td>${targetFran.owner_name || 'N/A'}</td></tr>
                    </tbody>
                </table>
            `;
        } else if (tabName === 'schedule') {
            return `
                <table class="dnfl-table">
                    <thead>
                        <tr>
                            <th>Week</th>
                            <th>Opponent</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="dnfl-row-odd"><td>Week 1</td><td>vs Divisional Rival</td><td>W 112.4 - 98.2</td></tr>
                        <tr class="dnfl-row-even"><td>Week 2</td><td>@ Conference Leader</td><td>L 104.1 - 118.6</td></tr>
                    </tbody>
                </table>
            `;
        } else if (tabName === 'history') {
            return `
                <table class="dnfl-table">
                    <tbody>
                        <tr class="dnfl-row-odd"><td><strong>Playoff Appearances</strong></td><td>3 Seasons</td></tr>
                        <tr class="dnfl-row-even"><td><strong>Division Titles</strong></td><td>1 Title</td></tr>
                    </tbody>
                </table>
            `;
        } else if (tabName === 'setup') {
            if (!isOwnerOrCommish) {
                return `
                    <div class="dnfl-status-error">
                        <i class="fa-solid fa-lock"></i> Access Restricted: You can only edit settings for your own franchise.
                    </div>
                `;
            }

            const emailVal = targetFran.email || '';
            const cellVal = targetFran.cell_phone || targetFran.cell || targetFran.cellnumber || '';

            return `
                <div class="dnfl-setup-container">
                    <div id="dnfl-setup-feedback" class="dnfl-is-hidden"></div>

                    ${commishStatus ? `
                        <div class="dnfl-commish-admin-card">
                            <i class="fa-solid fa-shield-halved"></i> <strong>Commissioner Mode Active</strong>
                            <a href="https://${window.location.host}/${window.MFL_YEAR || new Date().getFullYear()}/options?L=${window.MFL_LEAGUE_ID || ''}&O=01&FRANCHISE=${targetFran.id}" target="_blank" class="dnfl-btn-secondary dnfl-btn-sm">
                                Open Full MFL Admin Setup Page <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                        </div>
                    ` : ''}

                    <form id="dnfl-franchise-setup-form" onsubmit="DNFL.Popups.handleSetupSubmit(event, '${targetFran.id}')">
                        <div class="dnfl-form-section">
                            <h4 class="dnfl-form-section-title"><i class="fa-solid fa-id-card"></i> Profile & Contact Details</h4>
                            <div class="dnfl-form-grid">
                                <div class="dnfl-form-group">
                                    <label class="dnfl-form-label" for="setup_fran_name">Franchise Name</label>
                                    <input type="text" id="setup_fran_name" name="name" class="dnfl-form-input" value="${escapeXml(targetFran.name || '')}" required />
                                </div>
                                <div class="dnfl-form-group">
                                    <label class="dnfl-form-label" for="setup_owner_name">Owner Name</label>
                                    <input type="text" id="setup_owner_name" name="owner_name" class="dnfl-form-input" value="${escapeXml(targetFran.owner_name || '')}" required />
                                </div>
                                <div class="dnfl-form-group">
                                    <label class="dnfl-form-label" for="setup_email">Contact Email</label>
                                    <input type="email" id="setup_email" name="email" class="dnfl-form-input" value="${escapeXml(emailVal)}" required />
                                </div>
                                <div class="dnfl-form-group">
                                    <label class="dnfl-form-label" for="setup_cell_phone">Mobile SMS Phone Number</label>
                                    <input type="tel" id="setup_cell_phone" name="cell_phone" class="dnfl-form-input" value="${escapeXml(cellVal)}" placeholder="10-digit mobile number" />
                                </div>
                            </div>
                        </div>

                        <div class="dnfl-form-section">
                            <div class="dnfl-form-section-header">
                                <h4 class="dnfl-form-section-title"><i class="fa-solid fa-envelope"></i> Email Notification Preferences</h4>
                                <div class="dnfl-toggle-actions">
                                    <button type="button" class="dnfl-link-action" onclick="DNFL.Popups.toggleCheckboxes('mail_events', true)">Select All</button>
                                    <span class="dnfl-action-divider">•</span>
                                    <button type="button" class="dnfl-link-action" onclick="DNFL.Popups.toggleCheckboxes('mail_events', false)">Clear All</button>
                                </div>
                            </div>
                            <div class="dnfl-checkbox-grid">
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="DRAFT_UPDATE" checked /> Draft Status Update</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="DRAFT_CLOCK" checked /> When I'm On The Clock For My Draft</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="LINEUP_SUBMIT" checked /> Opponent's/Own Lineup Submission</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="LINEUP_REMINDER" checked /> Reminder at 6am ET Thursdays if you haven't submitted a lineup</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="TRADE_PROPOSAL" checked /> Trade Proposals/Results</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="TRADE_BAIT" checked /> Trade Bait Updates</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="WAIVER_RESULTS" checked /> Waivers/Free Agent Moves</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="WEEKLY_RESULTS" checked /> Weekly Results</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="INJURY_REPORT" checked /> Injury Status Report</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="PLAYER_NEWS" checked /> My Player News</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="mail_events" value="SITE_NEWS" checked /> MyFantasyLeague.com Site News</label>
                            </div>
                        </div>

                        <div class="dnfl-form-section">
                            <div class="dnfl-form-section-header">
                                <h4 class="dnfl-form-section-title"><i class="fa-solid fa-mobile-screen-button"></i> Mobile Text Notification Preferences</h4>
                                <div class="dnfl-toggle-actions">
                                    <button type="button" class="dnfl-link-action" onclick="DNFL.Popups.toggleCheckboxes('sms_events', true)">Select All</button>
                                    <span class="dnfl-action-divider">•</span>
                                    <button type="button" class="dnfl-link-action" onclick="DNFL.Popups.toggleCheckboxes('sms_events', false)">Clear All</button>
                                </div>
                            </div>
                            <div class="dnfl-checkbox-grid">
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="sms_events" value="SMS_DRAFT_CLOCK" checked /> When I'm on the clock in the draft (email drafts only)</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="sms_events" value="SMS_TRADE_PROPOSAL" checked /> Trade proposals and responses</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="sms_events" value="SMS_TRADE_COMPLETED" checked /> Completed Trades</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="sms_events" value="SMS_LINEUP_REMINDER" checked /> Reminder at 6am ET Thursdays if you haven't submitted a lineup for the current week yet</label>
                                <label class="dnfl-checkbox-label"><input type="checkbox" name="sms_events" value="SMS_INACTIVES" checked /> Game-day inactives on my starting lineup at 12:30pm and 3:30pm ET on Sundays</label>
                                ${commishStatus ? `
                                    <label class="dnfl-checkbox-label"><input type="checkbox" name="sms_events" value="SMS_TRADE_APPROVAL" /> Trades pending approval (commissioners only)</label>
                                ` : ''}
                            </div>
                        </div>

                        <div class="dnfl-form-actions">
                            <button type="submit" class="dnfl-btn-primary">
                                <i class="fa-solid fa-floppy-disk"></i> Save Franchise Settings
                            </button>
                        </div>
                    </form>
                </div>
            `;
        }
    }

    function toggleCheckboxes(groupName, isChecked) {
        const checkboxes = document.querySelectorAll(`input[name="${groupName}"]`);
        checkboxes.forEach(cb => { cb.checked = isChecked; });
    }

    async function handleSetupSubmit(e, targetFid) {
        e.preventDefault();
        const feedback = document.getElementById('dnfl-setup-feedback');
        feedback.className = 'dnfl-status-loading';
        feedback.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting updates to MyFantasyLeague...';

        const form = e.target;
        const nameVal = form.querySelector('[name="name"]').value.trim();
        const ownerNameVal = form.querySelector('[name="owner_name"]').value.trim();
        const emailVal = form.querySelector('[name="email"]').value.trim();
        const cellVal = form.querySelector('[name="cell_phone"]').value.trim();

        const mailEvents = Array.from(form.querySelectorAll('[name="mail_events"]:checked')).map(cb => cb.value).join(',');
        const smsEvents = Array.from(form.querySelectorAll('[name="sms_events"]:checked')).map(cb => cb.value).join(',');

        const year = window.MFL_YEAR || new Date().getFullYear();
        const leagueId = window.MFL_LEAGUE_ID || '';
        const host = window.location.host || 'www.myfantasyleague.com';

        const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<franchises>
  <franchise id="${norm(targetFid)}" name="${escapeXml(nameVal)}" owner_name="${escapeXml(ownerNameVal)}" email="${escapeXml(emailVal)}" cell_phone="${escapeXml(cellVal)}" mail_event="${escapeXml(mailEvents)}" sms_event="${escapeXml(smsEvents)}" />
</franchises>`;

        try {
            const importUrl = `https://${host}/${year}/import?TYPE=franchiseSetup&L=${leagueId}&JSON=1`;
            const bodyParams = new URLSearchParams();
            bodyParams.append('DATA', xmlPayload);

            const res = await fetch(importUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: bodyParams.toString(),
                credentials: 'include'
            });

            const data = await res.json();
            if (data && (data.status === 'OK' || data.response?.status === 'OK' || !data.error)) {
                feedback.className = 'dnfl-status-success';
                feedback.innerHTML = '<i class="fa-solid fa-circle-check"></i> Franchise settings saved successfully!';

                const client = getApiClient();
                client.clearCache('league');

                setTimeout(() => {
                    openFranchisePopup(targetFid, 'overview');
                }, 1200);
            } else {
                const errMsg = data?.error?.$t || data?.error || 'MFL API returned an error.';
                throw new Error(errMsg);
            }
        } catch (err) {
            console.error("[DNFL Popups] Error saving franchise setup:", err);
            feedback.className = 'dnfl-status-error';
            feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Could not save settings: ${err.message}`;
        }
    }

    function switchFranchiseTab(franchiseId, tabName) {
        openFranchisePopup(franchiseId, tabName);
    }

    function ensureMenuBellInjected() {
        if (document.getElementById('dnfl-notification-wrapper')) return;

        const mflMenuUl = document.querySelector('.myfantasyleague_menu ul') || document.querySelector('#myNavigationHolder ul');
        if (mflMenuUl) {
            const li = document.createElement('li');
            li.className = 'mfl-menu-item dnfl-menu-bell-item';
            li.innerHTML = `
                <div id="dnfl-notification-wrapper" class="dnfl-notification-holder" title="League Notifications">
                    <a href="javascript:void(0);" onclick="DNFL.Popups && DNFL.Popups.openNotificationsModal()" class="dnfl-notification-link">
                        <i id="dnfl-notification-icon" class="fa-solid fa-bell"></i>
                        <span id="dnfl-notification-badge" class="dnfl-notification-badge dnfl-is-hidden">0</span>
                    </a>
                </div>
            `;
            mflMenuUl.appendChild(li);
        }
    }

    function openNotificationsModal() {
        showModal("League Notifications & Messages", `<i class="fa-solid fa-bell"></i> <span>Notifications</span>`);
        const content = document.getElementById('dnfl-modal-content-wrapper');

        let html = '';

        if (capturedLeagueReminders.length > 0) {
            html += `
                <div class="dnfl-hpm-section">
                    <h4 class="dnfl-hpm-section-title"><i class="fa-solid fa-triangle-exclamation"></i> League Reminders</h4>
                    ${capturedLeagueReminders.map(rem => `<div class="dnfl-hpm-card">${rem}</div>`).join('')}
                </div>
            `;
        }

        if (capturedHomepageMessages.length > 0) {
            html += `
                <div class="dnfl-hpm-section">
                    <h4 class="dnfl-hpm-section-title"><i class="fa-solid fa-bullhorn"></i> Commissioner & Homepage Messages</h4>
                    ${capturedHomepageMessages.map(msg => `
                        <div class="dnfl-hpm-card">
                            <div class="dnfl-hpm-title"><i class="fa-solid fa-circle-info"></i> Announcement #${msg.id}</div>
                            <div>${msg.html}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (!html) {
            html = `
                <div class="dnfl-status-loading">
                    <i class="fa-solid fa-bell-slash"></i><br/>
                    No active unread league notifications or homepage messages found.
                </div>
            `;
        }

        content.innerHTML = html;
    }

    async function checkNotifications() {
        try {
            ensureMenuBellInjected();

            let unreadCount = 0;
            if (capturedLeagueReminders.length > 0) unreadCount += capturedLeagueReminders.length;
            if (capturedHomepageMessages.length > 0) unreadCount += capturedHomepageMessages.length;

            const badge = document.getElementById('dnfl-notification-badge');
            const holder = document.getElementById('dnfl-notification-wrapper');

            if (badge) {
                if (unreadCount > 0) {
                    badge.innerText = unreadCount;
                    badge.classList.remove('dnfl-is-hidden');
                    if (holder) holder.classList.add('has-unread');
                } else {
                    badge.classList.add('dnfl-is-hidden');
                    if (holder) holder.classList.remove('has-unread');
                }
            }
        } catch (e) {
            console.warn("[DNFL Popups] Non-fatal notification check warning:", e);
        }
    }

    function init() {
        if (isInitialized) return;
        isInitialized = true;

        captureHomepageMessages();
        attachLinkInterceptors();
        ensureMenuBellInjected();
        checkNotifications();

        console.log("DNFL Popups Subsystem v4.19 ready.");
    }

    window.DNFL.Popups = {
        version: '4.19',
        init: init,
        openPlayerPopup: openPlayerPopup,
        openFranchisePopup: openFranchisePopup,
        switchPlayerTab: switchPlayerTab,
        switchFranchiseTab: switchFranchiseTab,
        toggleCheckboxes: toggleCheckboxes,
        handleSetupSubmit: handleSetupSubmit,
        openNotificationsModal: openNotificationsModal,
        closeModal: closeModal
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

    window.addEventListener('dnfl:ready', function () {
        init();
    });

})();
