/* ==========================================================================
   DNFL Popups Subsystem (dnfl-popups-v4_16.js)
   Duke Networking Fantasy League (DNFL) Architecture
   ========================================================================== */

(function (window, document) {
    'use strict';

    if (window.DNFL && window.DNFL.Popups) {
        console.warn("[DNFL Popups] Subsystem already initialized.");
        return;
    }

    window.DNFL = window.DNFL || {};

    const activeSubscriptions = [];
    let isInitialized = false;
    let capturedHomepageMessages = [];
    let capturedLeagueReminders = [];

    function getApiClient() {
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("[DNFL Popups] Central API Client (DNFL.Client) middleware is required but unavailable.");
        }
        return client;
    }

    function getLoggedInFranchiseId(client) {
        if (client && typeof client.getUserFranchise === 'function') {
            const userFran = client.getUserFranchise();
            if (userFran && userFran.id) return norm(userFran.id);
        }
        if (typeof window.franchise_id !== 'undefined' && window.franchise_id) return norm(window.franchise_id);
        if (typeof globalThis.franchise_id !== 'undefined' && globalThis.franchise_id) return norm(globalThis.franchise_id);
        if (client && typeof client.getLoggedInFranchiseId === 'function') {
            try { return norm(client.getLoggedInFranchiseId()); } catch (e) { }
        }
        return '';
    }

    function getTtl(client, type, fallbackMs) {
        if (client && client.TTL && typeof client.TTL[type] === 'number') {
            return client.TTL[type];
        }
        return fallbackMs;
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function norm(id) {
        if (id === null || id === undefined) return '';
        const s = String(id).trim();
        if (!s) return '';
        return s.padStart(4, '0');
    }

    function parseCsvLine(text) {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '"') {
                inQuotes = !inQuotes;
            } else if (c === ',' && !inQuotes) {
                result.push(cur.trim());
                cur = '';
            } else {
                cur += c;
            }
        }
        result.push(cur.trim());
        return result;
    }

    async function fetchPowerRankingsCsv(client) {
        const dailyTtl = getTtl(client, 'DAILY', 86400000);
        const year = (client && typeof client.getContext === 'function' && client.getContext().year) || window.year || '2026';
        
        let targetCsv = 'data_02.csv';
        try {
            const manifestUrl = `https://dnfl.live/dnfl_rankings/${year}/weeks.json`;
            const manifestText = await client.fetchRawText(manifestUrl, { ttl: dailyTtl });
            if (manifestText) {
                const manifest = JSON.parse(manifestText);
                if (manifest && manifest.active_week_csv) {
                    targetCsv = manifest.active_week_csv;
                } else if (manifest && Array.isArray(manifest.weeks) && manifest.weeks.length > 0) {
                    targetCsv = manifest.weeks[manifest.weeks.length - 1].file || targetCsv;
                }
            }
        } catch (e) { }

        const urls = [
            `https://dnfl.live/dnfl_rankings/${year}/${targetCsv}`,
            `https://dnfl.live/dnfl_rankings/${targetCsv}`,
            `/dnfl_rankings/${year}/${targetCsv}`,
            `/dnfl_rankings/${targetCsv}`
        ];

        for (const url of urls) {
            try {
                const text = await client.fetchRawText(url, { ttl: dailyTtl });
                if (text && (text.includes('Power Index') || text.includes('Rank'))) {
                    return parsePowerRankingsCsv(text);
                }
            } catch (e) { }
        }
        return {};
    }

    function parsePowerRankingsCsv(csvText) {
        const map = {};
        if (!csvText) return map;

        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return map;

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
        const idIdx = headers.findIndex(h => h.includes('franchise id') || h.includes('id'));
        const rankIdx = headers.findIndex(h => h === 'rank');
        const piIdx = headers.findIndex(h => h.includes('power index') || h.includes('power_index'));

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = parseCsvLine(lines[i]);
            if (cols.length > idIdx && idIdx !== -1) {
                const fid = norm(cols[idIdx]);
                if (fid) {
                    map[fid] = {
                        rank: cols[rankIdx] || 'N/A',
                        powerIndex: cols[piIdx] || 'N/A'
                    };
                }
            }
        }
        return map;
    }

    function captureHomepageMessages() {
        try {
            const hpmElements = document.querySelectorAll('.homepagemessage, #league_reminders, .tdalert, .alert');
            hpmElements.forEach((el, idx) => {
                const text = el.innerText || el.textContent || '';
                if (!text.trim()) return;
                if (el.id === 'league_reminders') {
                    capturedLeagueReminders.push(el.innerHTML);
                } else {
                    capturedHomepageMessages.push({ id: idx + 1, html: el.innerHTML });
                }
            });
        } catch (e) {
            console.warn("[DNFL Popups] Error capturing homepage messages:", e);
        }
    }

    function attachLinkInterceptors() {
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href') || '';
            const onclickAttr = link.getAttribute('onclick') || '';

            const playerMatch = href.match(/options\?L=\d+&O=07&P=(\d+)/i) || onclickAttr.match(/mflPlayerPopup\([^,]+,\s*['"]?(\d+)['"]?/i);
            if (playerMatch) {
                e.preventDefault();
                e.stopPropagation();
                openPlayerPopup(playerMatch[1]);
                return;
            }

            const franchiseMatch = href.match(/options\?L=\d+&F=(\d+)&O=01/i) || onclickAttr.match(/mflFranchisePopup\([^,]+,\s*['"]?(\d+)['"]?/i);
            if (franchiseMatch) {
                e.preventDefault();
                e.stopPropagation();
                openFranchisePopup(franchiseMatch[1]);
            }
        }, true);
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
                        <button id="dnfl-modal-close-btn" class="dnfl-modal-close" aria-label="Close Modal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div id="dnfl-modal-content-wrapper" class="dnfl-card-body dnfl-modal-body"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('dnfl-modal-close-btn').addEventListener('click', closeModal);
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeModal();
            });
        }

        const titleEl = document.getElementById('dnfl-modal-title');
        titleEl.innerHTML = headerHtml || titleText;

        overlay.classList.remove('dnfl-is-hidden');
    }

    function setCardWatermark(logoUrl) {
        const modalContainer = document.getElementById('dnfl-modal-container');
        if (!modalContainer) return;

        let wmImg = modalContainer.querySelector('.dnfl-persistent-watermark');
        if (!logoUrl) {
            if (wmImg) wmImg.remove();
            return;
        }

        if (!wmImg) {
            wmImg = document.createElement('img');
            wmImg.className = 'dnfl-persistent-watermark';
            modalContainer.insertBefore(wmImg, modalContainer.firstChild);
        }
        wmImg.src = logoUrl;
    }

    async function openPlayerPopup(playerId, activeTab) {
        activeTab = activeTab || 'overview';
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

            const headerHtml = `
                <i class="fa-solid fa-user"></i>
                <span>${p.name}</span>
            `;
            showModal(p.name, headerHtml);

            setCardWatermark(p.team ? `https://a.espncdn.com/i/teamlogos/nfl/500/${p.team.toLowerCase()}.png` : '');

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

            const confObj = conferences.find(c => norm(c.id) === norm(targetFran.conference_id));
            const divObj = divisions.find(d => norm(d.id) === norm(targetFran.division));
            
            const confName = confObj ? confObj.name : '';
            const divName = divObj ? divObj.name : '';
            const fullLoc = [confName, divName].filter(Boolean).join(' ');

            const headerHtml = `
                ${icon ? `<img src="${icon}" alt="Icon" class="franchise-icon-md dnfl-ficon-rounded" onerror="this.style.display='none'" />` : ''}
                <span>${name}</span>
            `;
            showModal(name, headerHtml);

            setCardWatermark(logo || icon || '');

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
                const confIdNorm = norm(targetFran.conference_id);
                if (confIdNorm && conferences.length > 0) {
                    const confTeams = standingsList.filter(s => {
                        const fObj = franchises.find(f => norm(f.id) === norm(s.id));
                        return fObj && norm(fObj.conference_id) === confIdNorm;
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

            let heroHtml = `
                <div class="dnfl-franchise-hero-header">
                    <div class="dnfl-hero-left-meta">
                        <div class="dnfl-hero-tags">
                            <span class="dnfl-chip-flat">${targetFran.owner_name || 'Owner'}</span>
                            ${fullLoc ? `<span class="dnfl-chip-flat">${fullLoc}</span>` : ''}
                        </div>
                        <div class="dnfl-modal-tabs dnfl-tabs-pushed">
                            <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'overview')"><i class="fa-solid fa-chart-line"></i> <span class="dnfl-tab-label">Overview</span></button>
                            <button class="dnfl-modal-tab-btn ${activeTab === 'roster' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'roster')"><i class="fa-solid fa-users"></i> <span class="dnfl-tab-label">Roster</span></button>
                            <button class="dnfl-modal-tab-btn ${activeTab === 'schedule' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'schedule')"><i class="fa-solid fa-calendar-days"></i> <span class="dnfl-tab-label">Schedule</span></button>
                            <button class="dnfl-modal-tab-btn ${activeTab === 'history' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'history')"><i class="fa-solid fa-trophy"></i> <span class="dnfl-tab-label">History</span></button>
                        </div>
                    </div>
                    ${logo ? `
                        <div class="dnfl-hero-logo-wrapper">
                            <img src="${logo}" alt="${name}" class="dnfl-hero-large-logo" onerror="this.style.display='none'" />
                        </div>
                    ` : ''}
                </div>
            `;

            content.innerHTML = heroHtml + renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, activeTab, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, seedVal, seedTypeLabel, prVal, prSubStr, completedWeeks);

        } catch (e) {
            console.error("[DNFL Popups] Error opening franchise popup:", e);
            content.innerHTML = `
                <div class="dnfl-status-error">
                    <i class="fa-solid fa-triangle-exclamation"></i> Error loading franchise card: ${e.message}
                </div>
            `;
        }
    }

    function renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, tabName, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, seedVal, seedTypeLabel, prVal, prSubStr, completedWeeks) {
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

            const topQb = rosterPlayers.find(p => String(p.position).toUpperCase() === 'QB');
            const topSkill = rosterPlayers.filter(p => p !== topQb).slice(0, 3);

            const topPerformers = [];
            if (topQb) topPerformers.push(topQb);
            topSkill.forEach(p => topPerformers.push(p));

            if (topPerformers.length < 4) {
                const remaining = rosterPlayers.filter(p => !topPerformers.includes(p));
                for (let i = 0; i < remaining.length && topPerformers.length < 4; i++) {
                    topPerformers.push(remaining[i]);
                }
            }

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
                <div class="dnfl-scorecard-grid">
                    <div class="dnfl-stat-card">
                        <div class="dnfl-stat-lbl">Record</div>
                        <div class="dnfl-stat-val-main">${recordStr}</div>
                        <div class="dnfl-stat-val-sub">${winPctStr}</div>
                    </div>
                    <div class="dnfl-stat-card">
                        <div class="dnfl-stat-lbl">Points For</div>
                        <div class="dnfl-stat-val-main">${pfMainStr}</div>
                        <div class="dnfl-stat-val-sub">${pfTotalStr}</div>
                    </div>
                    <div class="dnfl-stat-card">
                        <div class="dnfl-stat-lbl">Points Against</div>
                        <div class="dnfl-stat-val-main">${paMainStr}</div>
                        <div class="dnfl-stat-val-sub">${paTotalStr}</div>
                    </div>
                    <div class="dnfl-stat-card">
                        <div class="dnfl-stat-lbl">Playoff Seed</div>
                        <div class="dnfl-stat-val-main">#${seedVal}</div>
                        <div class="dnfl-stat-val-sub">${seedTypeLabel}</div>
                    </div>
                    <div class="dnfl-stat-card">
                        <div class="dnfl-stat-lbl">Power Rank</div>
                        <div class="dnfl-stat-val-main">${prVal}</div>
                        <div class="dnfl-stat-val-sub">${prSubStr}</div>
                    </div>
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
            const client = getApiClient();
            const fid = getLoggedInFranchiseId(client);

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

    function closeModal() {
        const overlay = document.getElementById('dnfl-modal-overlay');
        if (overlay) {
            overlay.classList.add('dnfl-is-hidden');
        }
    }

    function init() {
        if (isInitialized) return;
        isInitialized = true;

        captureHomepageMessages();
        attachLinkInterceptors();
        ensureMenuBellInjected();
        checkNotifications();

        console.log("DNFL Popups Subsystem v4.15 ready.");
    }

    window.DNFL.Popups = {
        init: init,
        openPlayerPopup: openPlayerPopup,
        openFranchisePopup: openFranchisePopup,
        switchPlayerTab: switchPlayerTab,
        switchFranchiseTab: switchFranchiseTab,
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

})(window, document);
