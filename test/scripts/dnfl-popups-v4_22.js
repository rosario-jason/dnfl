/* ==========================================================================
   DNFL Popups Subsystem v4.22
   Duke Networking Fantasy League (DNFL) Architecture
   ========================================================================== */

(function () {
    'use strict';

    if (window.DNFL && window.DNFL.Popups && window.DNFL.Popups.v22_ready) {
        return;
    }

    window.DNFL = window.DNFL || {};

    let isInitialized = false;
    const capturedHomepageMessages = [];
    const capturedLeagueReminders = [];

    function getApiClient() {
        if (window.DNFL && window.DNFL.Client) {
            return window.DNFL.Client;
        }
        return {
            fetchData: async function (endpoint, params) {
                const year = window.MFL_YEAR || new Date().getFullYear().toString();
                const leagueId = window.MFL_LEAGUE_ID || '00000';
                const baseUrl = window.MFL_BASE_URL || 'www.myfantasyleague.com';
                let url = `https://${baseUrl}/${year}/export?TYPE=${endpoint}&L=${leagueId}&JSON=1`;
                if (params) {
                    Object.keys(params).forEach(k => {
                        url += `&${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`;
                    });
                }
                const res = await fetch(url, { credentials: 'include' });
                return await res.json();
            },
            fetchRawText: async function (url) {
                const res = await fetch(url);
                return await res.text();
            },
            clearCache: function () {}
        };
    }

    function toArray(obj) {
        if (!obj) return [];
        return Array.isArray(obj) ? obj : [obj];
    }

    function norm(str) {
        if (str === null || str === undefined) return '';
        return String(str).padStart(4, '0').trim();
    }

    function getTtl(client, type, defaultVal) {
        if (client && client.TTL && client.TTL[type] !== undefined) {
            return client.TTL[type];
        }
        return defaultVal;
    }

    function getLoggedInFranchiseId(client) {
        if (client && typeof client.getUserFranchise === 'function') {
            const userFid = client.getUserFranchise();
            if (userFid) return norm(userFid);
        }
        if (window.MFL_USER_ID) return norm(window.MFL_USER_ID);
        if (window.franchise_id) return norm(window.franchise_id);
        return null;
    }

    function isUserCommish(client) {
        if (client && typeof client.isCommissioner === 'function') {
            return client.isCommissioner();
        }
        if (window.is_commissioner === '1' || window.is_commissioner === 1 || window.is_commissioner === true) {
            return true;
        }
        return false;
    }

    function escapeXml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function captureHomepageMessages() {
        try {
            const reminderEls = document.querySelectorAll('#league_reminders .tdalert, #league_reminders .alert, #league_reminders #warning');
            reminderEls.forEach(el => {
                const text = el.innerText || el.textContent;
                if (text && text.trim() && !capturedLeagueReminders.includes(text.trim())) {
                    capturedLeagueReminders.push(text.trim());
                }
            });

            const hpMsgContainer = document.querySelector('#body_home .homepagemessage');
            if (hpMsgContainer) {
                const cards = hpMsgContainer.querySelectorAll('.card, .card-body, table, .module');
                if (cards.length > 0) {
                    cards.forEach((card, idx) => {
                        const html = card.innerHTML;
                        if (html && html.trim()) {
                            capturedHomepageMessages.push({ id: idx + 1, html: html });
                        }
                    });
                } else {
                    const html = hpMsgContainer.innerHTML;
                    if (html && html.trim()) {
                        capturedHomepageMessages.push({ id: 1, html: html });
                    }
                }
            }
        } catch (e) {
            console.warn("[DNFL Popups] Error capturing homepage messages:", e);
        }
    }

    function attachLinkInterceptors() {
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a');
            if (!link || !link.href) return;

            const href = link.href;

            if (href.includes('options?L=') && href.includes('O=01') && !href.includes('PRINTER=1')) {
                const m = href.match(/F=(\d{4})/i) || href.match(/FRANCHISE=(\d{4})/i);
                const targetFid = m ? m[1] : (window.MFL_USER_ID || window.franchise_id);
                if (targetFid) {
                    e.preventDefault();
                    openFranchisePopup(targetFid, 'overview', true);
                    return;
                }
            }

            if (href.includes('options?L=') && href.includes('O=01') && href.includes('PRINTER=1')) {
                return;
            }

            const playerMatch = href.match(/player\?.*P=(\d+)/i) || href.match(/P=(\d{4,5})/i);
            if (playerMatch && !link.classList.contains('dnfl-no-popup')) {
                e.preventDefault();
                openPlayerPopup(playerMatch[1]);
                return;
            }

            const franMatch = href.match(/options\?.*O=01.*F=(\d{4})/i) || href.match(/F=(\d{4})/i);
            if (franMatch && !link.classList.contains('dnfl-no-popup')) {
                e.preventDefault();
                openFranchisePopup(franMatch[1], 'overview', false);
                return;
            }
        });
    }

    async function fetchPowerRankingsCsv(client) {
        const year = window.MFL_YEAR || new Date().getFullYear().toString();
        const manifestUrl = `https://dnfl.live/dnfl_rankings/${year}/weeks.json`;

        let targetCsv = null;
        try {
            const rawManifest = await client.fetchRawText(manifestUrl, { ttl: 3600000 });
            if (rawManifest && !rawManifest.startsWith('<')) {
                const manifest = JSON.parse(rawManifest);
                const weeksList = toArray(manifest?.weeks);
                if (weeksList.length > 0) {
                    const lastWeek = weeksList[weeksList.length - 1];
                    targetCsv = lastWeek.file || lastWeek.filename || lastWeek;
                }
            }
        } catch (e) {
            console.warn("[DNFL Popups] Error fetching weeks.json manifest:", e);
        }

        if (!targetCsv) {
            for (let w = 18; w >= 0; w--) {
                const testFile = w === 0 ? 'data_00_pre-season.csv' : `data_${String(w).padStart(2, '0')}.csv`;
                const testUrl = `https://dnfl.live/dnfl_rankings/${year}/${testFile}`;
                try {
                    const rawText = await client.fetchRawText(testUrl, { ttl: 1800000 });
                    if (rawText && !rawText.startsWith('<') && rawText.includes(',')) {
                        targetCsv = testFile;
                        break;
                    }
                } catch (err) {}
            }
        }

        if (!targetCsv) targetCsv = 'data_02.csv';

        const csvUrl = `https://dnfl.live/dnfl_rankings/${year}/${targetCsv}`;
        const map = {};
        try {
            const csvText = await client.fetchRawText(csvUrl, { ttl: 1800000 });
            if (csvText && csvText.includes(',')) {
                const lines = csvText.split(/\r?\n/);
                if (lines.length > 1) {
                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                    const fidIdx = headers.findIndex(h => h.includes('franchise') || h === 'fid' || h === 'id');
                    const rankIdx = headers.findIndex(h => h === 'rank' || h === 'overall_rank');
                    const powerIdx = headers.findIndex(h => h.includes('power') || h.includes('index') || h === 'pi');

                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                        if (fidIdx >= 0 && cols[fidIdx]) {
                            const fidPadded = norm(cols[fidIdx]);
                            map[fidPadded] = {
                                rank: rankIdx >= 0 ? cols[rankIdx] : String(i),
                                powerIndex: powerIdx >= 0 ? cols[powerIdx] : '85.00'
                            };
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("[DNFL Popups] Error parsing power rankings CSV:", e);
        }
        return map;
    }

    function showModal(titleText, headerHtml, showGear, gearFid, isGearActive) {
        let overlay = document.getElementById('dnfl-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'dnfl-modal-overlay';
            overlay.className = 'dnfl-modal-overlay dnfl-is-hidden';
            overlay.innerHTML = `
                <div id="dnfl-modal-container" class="dnfl-card dnfl-modal-card">
                    <div class="dnfl-card-header dnfl-modal-header">
                        <h3 id="dnfl-modal-title" class="dnfl-card-title"></h3>
                        <div class="dnfl-modal-header-actions">
                            <button id="dnfl-modal-gear-btn" class="dnfl-modal-header-btn dnfl-is-hidden" title="Franchise Settings">
                                <i class="fa-solid fa-gear"></i>
                            </button>
                            <button id="dnfl-modal-close-btn" class="dnfl-modal-header-btn" aria-label="Close Modal" title="Close">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                    <div id="dnfl-modal-content-wrapper" class="dnfl-card-body dnfl-modal-body"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        const titleEl = document.getElementById('dnfl-modal-title');
        titleEl.innerHTML = headerHtml || titleText;

        const gearBtn = document.getElementById('dnfl-modal-gear-btn');
        if (gearBtn) {
            if (showGear && gearFid) {
                gearBtn.classList.remove('dnfl-is-hidden');
                if (isGearActive) {
                    gearBtn.classList.add('is-active');
                    gearBtn.title = "Return to Overview";
                    gearBtn.onclick = function () {
                        openFranchisePopup(gearFid, 'overview', false);
                    };
                } else {
                    gearBtn.classList.remove('is-active');
                    gearBtn.title = "Franchise Settings";
                    gearBtn.onclick = function () {
                        openFranchisePopup(gearFid, 'overview', true);
                    };
                }
            } else {
                gearBtn.classList.add('dnfl-is-hidden');
                gearBtn.classList.remove('is-active');
                gearBtn.onclick = null;
            }
        }

        overlay.classList.remove('dnfl-is-hidden');
    }

    function closeModal() {
        const overlay = document.getElementById('dnfl-modal-overlay');
        if (overlay) {
            overlay.classList.add('dnfl-is-hidden');
        }
    }

    document.addEventListener('click', function (e) {
        const closeBtn = e.target.closest('#dnfl-modal-close-btn');
        if (closeBtn) {
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
            showModal(p.name, headerHtml, false, null, false);

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
                <div class="dnfl-modal-tabs dnfl-full-width-tabs">
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

    async function openFranchisePopup(franchiseId, activeTab, isSetupMode) {
        activeTab = activeTab || 'overview';
        isSetupMode = !!isSetupMode;

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
            const loggedInFid = getLoggedInFranchiseId(client);
            const isCommish = isUserCommish(client);
            const canEditSetup = loggedInFid && (loggedInFid === targetFidNorm || isCommish);

            const franchises = toArray(leagueData?.league?.franchises?.franchise);
            const conferences = toArray(leagueData?.league?.conferences?.conference);
            const divisions = toArray(leagueData?.league?.divisions?.division);

            const targetFran = franchises.find(f => norm(f.id) === targetFidNorm);
            if (!targetFran) throw new Error("Franchise not found in league database.");

            const name = targetFran.name || `Franchise #${franchiseId}`;
            const logo = targetFran.logo;
            const icon = targetFran.icon;

            const divObj = divisions.find(d => norm(d.id) === norm(targetFran.division));
            let confObj = conferences.find(c => norm(c.id) === norm(targetFran.conference_id));
            if (!confObj && divObj && divObj.conference_id) {
                confObj = conferences.find(c => norm(c.id) === norm(divObj.conference_id));
            }

            const confName = confObj ? confObj.name : '';
            const divName = divObj ? divObj.name : '';
            const fullLoc = [confName, divName].filter(Boolean).join(' • ');

            let headerHtml = '';
            if (isSetupMode) {
                headerHtml = `
                    <i class="fa-solid fa-gear" style="color: #f59e0b;"></i>
                    <span>Franchise ${targetFidNorm} Settings</span>
                `;
            } else {
                headerHtml = `
                    ${icon ? `<img src="${icon}" alt="Icon" class="franchise-icon-md dnfl-ficon-rounded" onerror="this.style.display='none'" />` : ''}
                    <span>${name}</span>
                `;
            }

            showModal(name, headerHtml, canEditSetup, targetFidNorm, isSetupMode);

            let tabButtonsHtml = `
                <div class="dnfl-modal-tabs dnfl-full-width-tabs">
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' && !isSetupMode ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'overview')"><i class="fa-solid fa-chart-line"></i> <span class="dnfl-tab-label">Overview</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'roster' && !isSetupMode ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'roster')"><i class="fa-solid fa-users"></i> <span class="dnfl-tab-label">Roster</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'schedule' && !isSetupMode ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'schedule')"><i class="fa-solid fa-calendar-days"></i> <span class="dnfl-tab-label">Schedule</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'history' && !isSetupMode ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'history')"><i class="fa-solid fa-trophy"></i> <span class="dnfl-tab-label">History</span></button>
                </div>
            `;

            if (isSetupMode) {
                if (!canEditSetup) {
                    content.innerHTML = tabButtonsHtml + `
                        <div class="dnfl-status-error">
                            <i class="fa-solid fa-lock"></i> Access Restricted: You can only edit settings for your own franchise.
                        </div>
                    `;
                    return;
                }

                content.innerHTML = tabButtonsHtml + renderSetupForm(targetFran, isCommish);
                return;
            }

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

            let rawBbid = franStandings.bbidAvailable || franStandings.bbid_balance || franStandings.bbid || targetFran.bbidAvailable;
            let bbidValStr = '$100.00';
            if (rawBbid !== undefined && rawBbid !== null && !isNaN(parseFloat(rawBbid))) {
                bbidValStr = `$${parseFloat(rawBbid).toFixed(2)}`;
            }

            let seedVal = franStandings.seed || franStandings.playoff_seed || franStandings.pseed;
            let seedTypeLabel = "Conf Seed";
            
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
                    seedTypeLabel = "Conf Seed";
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
            const prSubStr = `#${prRankNum} Overall`;

            const scoreCardHtml = `
                <div class="dnfl-scorecard-grid">
                    <div class="dnfl-stat-card card-record">
                        <div class="dnfl-stat-lbl">Record</div>
                        <div class="dnfl-stat-val-main">${recordStr}</div>
                        <div class="dnfl-stat-val-sub">${winPctStr}</div>
                    </div>
                    <div class="dnfl-stat-card card-pf">
                        <div class="dnfl-stat-lbl">PF</div>
                        <div class="dnfl-stat-val-main">${pfMainStr}</div>
                        <div class="dnfl-stat-val-sub">${pfTotalStr}</div>
                    </div>
                    <div class="dnfl-stat-card card-seed">
                        <div class="dnfl-stat-lbl">Seed</div>
                        <div class="dnfl-stat-val-main">#${seedVal}</div>
                        <div class="dnfl-stat-val-sub">${seedTypeLabel}</div>
                    </div>
                    <div class="dnfl-stat-card card-bbid">
                        <div class="dnfl-stat-lbl">BBID</div>
                        <div class="dnfl-stat-val-main">${bbidValStr}</div>
                        <div class="dnfl-stat-val-sub">Budget Available</div>
                    </div>
                    <div class="dnfl-stat-card card-pa">
                        <div class="dnfl-stat-lbl">PA</div>
                        <div class="dnfl-stat-val-main">${paMainStr}</div>
                        <div class="dnfl-stat-val-sub">${paTotalStr}</div>
                    </div>
                    <div class="dnfl-stat-card card-rank">
                        <div class="dnfl-stat-lbl">Rank</div>
                        <div class="dnfl-stat-val-main">${prVal}</div>
                        <div class="dnfl-stat-val-sub">${prSubStr}</div>
                    </div>
                </div>
            `;

            let heroHtml = `
                <div class="dnfl-franchise-hero-header">
                    <div class="dnfl-hero-left-meta">
                        <div class="dnfl-owner-details-card">
                            <div><strong>OWNER:</strong> <strong>${targetFran.owner_name || 'N/A'}</strong></div>
                            ${fullLoc ? `<div><strong>DIVISION:</strong> ${fullLoc}</div>` : ''}
                        </div>
                        ${scoreCardHtml}
                    </div>
                    ${logo ? `
                        <div class="dnfl-hero-logo-wrapper">
                            <img src="${logo}" alt="${name}" class="dnfl-hero-large-logo" onerror="this.style.display='none'" />
                        </div>
                    ` : ''}
                </div>
            `;

            content.innerHTML = tabButtonsHtml + heroHtml + renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, activeTab, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, seedVal, seedTypeLabel, prVal, prSubStr, completedWeeks, bbidValStr);

        } catch (e) {
            console.error("[DNFL Popups] Error opening franchise popup:", e);
            content.innerHTML = `
                <div class="dnfl-status-error">
                    <i class="fa-solid fa-triangle-exclamation"></i> Error loading franchise card: ${e.message}
                </div>
            `;
        }
    }

    const EMAIL_NOTIF_OPTIONS = [
        { id: 'DRAFT_STATUS', label: 'Draft Status Update' },
        { id: 'DRAFT_CLOCK', label: "When I'm On The Clock For My Draft" },
        { id: 'LINEUP_SUBMIT', label: "Opponent's/Own Lineup Submission" },
        { id: 'LINEUP_REMINDER', label: "Reminder at 6am ET Thursdays if you haven't submitted a lineup" },
        { id: 'TRADE_PROPOSAL', label: 'Trade Proposals/Results' },
        { id: 'TRADE_BAIT', label: 'Trade Bait Updates' },
        { id: 'WAIVER_RESULTS', label: 'Waivers/Free Agent Moves' },
        { id: 'WEEKLY_RESULTS', label: 'Weekly Results' },
        { id: 'INJURY_STATUS', label: 'Injury Status Report' },
        { id: 'PLAYER_NEWS', label: 'My Player News' },
        { id: 'SITE_NEWS', label: 'MyFantasyLeague.com Site News' }
    ];

    const SMS_NOTIF_OPTIONS = [
        { id: 'SMS_DRAFT_CLOCK', label: "When I'm on the clock in the draft (email drafts only)" },
        { id: 'SMS_TRADE_PROPOSAL', label: 'Trade proposals and responses' },
        { id: 'SMS_TRADE_COMPLETED', label: 'Completed Trades' },
        { id: 'SMS_LINEUP_REMINDER', label: "Reminder at 6am ET Thursdays if you haven't submitted a lineup" },
        { id: 'SMS_INACTIVES', label: 'Game-day inactives on my starting lineup at 12:30pm and 3:30pm ET Sundays' },
        { id: 'SMS_COMMISH_TRADE', label: 'Trades pending approval (commissioners only)', commishOnly: true }
    ];

    function renderSetupForm(targetFran, isCommish) {
        const mailEventsStr = String(targetFran.mail_event || targetFran.mail_events || targetFran.email_notifications || 'DRAFT_CLOCK,LINEUP_REMINDER,TRADE_PROPOSAL,WAIVER_RESULTS,INJURY_STATUS');
        const smsEventsStr = String(targetFran.sms_event || targetFran.sms_events || targetFran.sms_notifications || 'SMS_DRAFT_CLOCK,SMS_TRADE_PROPOSAL,SMS_INACTIVES');

        const activeMailList = mailEventsStr.split(',').map(s => s.trim());
        const activeSmsList = smsEventsStr.split(',').map(s => s.trim());

        let commishAdminHtml = '';
        if (isCommish) {
            const year = window.MFL_YEAR || new Date().getFullYear().toString();
            const leagueId = window.MFL_LEAGUE_ID || targetFran.league_id || '00000';
            const mflAdminUrl = `https://www.myfantasyleague.com/${year}/options?L=${leagueId}&O=01&FRANCHISE=${targetFran.id}`;
            commishAdminHtml = `
                <div class="dnfl-commish-admin-card">
                    <div><i class="fa-solid fa-user-shield"></i> <strong>Commissioner Controls</strong></div>
                    <a href="${mflAdminUrl}" target="_blank" class="dnfl-btn-secondary dnfl-btn-sm">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Full MFL Admin Setup Page
                    </a>
                </div>
            `;
        }

        return `
            <div class="dnfl-setup-container">
                ${commishAdminHtml}

                <form id="dnfl-setup-form" onsubmit="DNFL.Popups.submitFranchiseSetup(event, '${targetFran.id}')">
                    <div id="dnfl-setup-status" class="dnfl-is-hidden"></div>

                    <div class="dnfl-form-section">
                        <h5 class="dnfl-form-section-title"><i class="fa-solid fa-address-card"></i> Profile Info</h5>
                        <div class="dnfl-form-grid">
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-name">Franchise Name</label>
                                <input type="text" id="dnfl-inp-name" class="dnfl-input" value="${escapeXml(targetFran.name || '')}" required />
                            </div>
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-owner">Owner Name</label>
                                <input type="text" id="dnfl-inp-owner" class="dnfl-input" value="${escapeXml(targetFran.owner_name || '')}" required />
                            </div>
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-email">Contact Email</label>
                                <input type="email" id="dnfl-inp-email" class="dnfl-input" value="${escapeXml(targetFran.email || '')}" required />
                            </div>
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-cell">Mobile SMS Number</label>
                                <input type="tel" id="dnfl-inp-cell" class="dnfl-input" placeholder="e.g. 5551234567" value="${escapeXml(targetFran.cell_phone || targetFran.cellnumber || targetFran.cell || '')}" />
                            </div>
                        </div>
                    </div>

                    <div class="dnfl-form-section">
                        <div class="dnfl-section-header-flex">
                            <h5 class="dnfl-form-section-title"><i class="fa-solid fa-envelope"></i> Email Notifications</h5>
                            <div class="dnfl-toggle-actions">
                                <button type="button" class="dnfl-action-link" onclick="DNFL.Popups.toggleAllCheckboxes('email-notifs', true)">Select All</button>
                                <span class="dnfl-bullet">•</span>
                                <button type="button" class="dnfl-action-link" onclick="DNFL.Popups.toggleAllCheckboxes('email-notifs', false)">Clear All</button>
                            </div>
                        </div>
                        <div id="email-notifs" class="dnfl-checkbox-grid">
                            ${EMAIL_NOTIF_OPTIONS.map(opt => {
                                const isChecked = activeMailList.includes(opt.id) || mailEventsStr.includes(opt.id);
                                return `
                                    <label class="dnfl-checkbox-label">
                                        <input type="checkbox" name="mail_events" value="${opt.id}" ${isChecked ? 'checked' : ''} />
                                        <span>${opt.label}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="dnfl-form-section">
                        <div class="dnfl-section-header-flex">
                            <h5 class="dnfl-form-section-title"><i class="fa-solid fa-mobile-screen-button"></i> Mobile Text Notifications</h5>
                            <div class="dnfl-toggle-actions">
                                <button type="button" class="dnfl-action-link" onclick="DNFL.Popups.toggleAllCheckboxes('sms-notifs', true)">Select All</button>
                                <span class="dnfl-bullet">•</span>
                                <button type="button" class="dnfl-action-link" onclick="DNFL.Popups.toggleAllCheckboxes('sms-notifs', false)">Clear All</button>
                            </div>
                        </div>
                        <div id="sms-notifs" class="dnfl-checkbox-grid">
                            ${SMS_NOTIF_OPTIONS.map(opt => {
                                if (opt.commishOnly && !isCommish) return '';
                                const isChecked = activeSmsList.includes(opt.id) || smsEventsStr.includes(opt.id);
                                return `
                                    <label class="dnfl-checkbox-label">
                                        <input type="checkbox" name="sms_events" value="${opt.id}" ${isChecked ? 'checked' : ''} />
                                        <span>${opt.label}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="dnfl-form-actions">
                        <button type="submit" id="dnfl-btn-save-setup" class="dnfl-btn-primary">
                            <i class="fa-solid fa-floppy-disk"></i> Save Settings
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    function toggleAllCheckboxes(containerId, selectState) {
        const container = document.getElementById(containerId);
        if (container) {
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.checked = !!selectState;
            });
        }
    }

    async function submitFranchiseSetup(event, franchiseId) {
        event.preventDefault();

        const statusEl = document.getElementById('dnfl-setup-status');
        const saveBtn = document.getElementById('dnfl-btn-save-setup');

        statusEl.className = 'dnfl-status-loading';
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving settings to MFL...';
        statusEl.classList.remove('dnfl-is-hidden');
        if (saveBtn) saveBtn.disabled = true;

        try {
            const name = document.getElementById('dnfl-inp-name').value.trim();
            const ownerName = document.getElementById('dnfl-inp-owner').value.trim();
            const email = document.getElementById('dnfl-inp-email').value.trim();
            const cellPhone = document.getElementById('dnfl-inp-cell').value.trim();

            const mailCbs = document.querySelectorAll('#email-notifs input[name="mail_events"]:checked');
            const mailEvents = Array.from(mailCbs).map(cb => cb.value).join(',');

            const smsCbs = document.querySelectorAll('#sms-notifs input[name="sms_events"]:checked');
            const smsEvents = Array.from(smsCbs).map(cb => cb.value).join(',');

            const year = window.MFL_YEAR || new Date().getFullYear().toString();
            const leagueId = window.MFL_LEAGUE_ID || '00000';
            const mflBaseUrl = window.MFL_BASE_URL || 'www.myfantasyleague.com';

            const xmlPayload = `<franchises><franchise id="${franchiseId}" name="${escapeXml(name)}" owner_name="${escapeXml(ownerName)}" email="${escapeXml(email)}" cell_phone="${escapeXml(cellPhone)}" mail_event="${escapeXml(mailEvents)}" sms_event="${escapeXml(smsEvents)}" /></franchises>`;

            const importUrl = `https://${mflBaseUrl}/${year}/import?TYPE=franchiseSetup&L=${leagueId}&JSON=1`;

            const bodyParams = new URLSearchParams();
            bodyParams.append('DATA', xmlPayload);

            const response = await fetch(importUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: bodyParams.toString(),
                credentials: 'include'
            });

            const rawText = await response.text();

            let isSuccess = false;
            let errorMsg = 'Unknown error updating settings.';

            if (rawText.includes('<status>OK</status>') || rawText.includes('"status":"OK"') || rawText.includes('status="OK"')) {
                isSuccess = true;
            } else if (rawText.startsWith('{')) {
                try {
                    const jsonRes = JSON.parse(rawText);
                    if (jsonRes.status === 'OK' || jsonRes?.franchiseSetup?.status === 'OK') {
                        isSuccess = true;
                    } else if (jsonRes?.error) {
                        errorMsg = jsonRes.error.$t || jsonRes.error.message || JSON.stringify(jsonRes.error);
                    }
                } catch (e) {}
            } else {
                const matchErr = rawText.match(/<error>(.*?)<\/error>/i);
                if (matchErr) errorMsg = matchErr[1];
            }

            if (isSuccess) {
                statusEl.className = 'dnfl-status-success';
                statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Settings saved successfully! Refreshing view...';

                const client = getApiClient();
                if (client && typeof client.clearCache === 'function') {
                    client.clearCache('league');
                    client.clearCache('leagueStandings');
                }

                setTimeout(() => {
                    openFranchisePopup(franchiseId, 'overview', false);
                }, 1200);

            } else {
                throw new Error(errorMsg);
            }

        } catch (err) {
            console.error("[DNFL Popups] Save settings error:", err);
            statusEl.className = 'dnfl-status-error';
            statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Could not save settings: ${err.message}`;
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    function renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, tabName, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, seedVal, seedTypeLabel, prVal, prSubStr, completedWeeks, bbidValStr) {
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
            const flexSkill = rosterPlayers.filter(p => {
                const pos = String(p.position || '').toUpperCase();
                return ['RB', 'WR', 'TE'].includes(pos) && p !== topQb;
            }).slice(0, 3);

            const topPerformers = [];
            if (topQb) topPerformers.push(topQb);
            flexSkill.forEach(p => topPerformers.push(p));

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

            return starsHtml;

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
        openFranchisePopup(franchiseId, tabName, false);
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
        showModal("League Notifications & Messages", `<i class="fa-solid fa-bell"></i> <span>Notifications</span>`, false, null, false);
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

        console.log("DNFL Popups Subsystem v4.22 ready.");
    }

    window.DNFL.Popups = {
        v22_ready: true,
        init: init,
        openPlayerPopup: openPlayerPopup,
        openFranchisePopup: openFranchisePopup,
        switchPlayerTab: switchPlayerTab,
        switchFranchiseTab: switchFranchiseTab,
        openNotificationsModal: openNotificationsModal,
        closeModal: closeModal,
        toggleAllCheckboxes: toggleAllCheckboxes,
        submitFranchiseSetup: submitFranchiseSetup
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
