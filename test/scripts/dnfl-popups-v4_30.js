/* ==========================================================================
   Duke Networking Fantasy League (DNFL) - Popups Engine Subsystem
   File: dnfl-popups-v4_30.js
   Version: 4.30
   Description: Unified Modal & Popup Manager for Franchises, Players, and Notifications.
   ========================================================================== */

(function () {
    "use strict";

    window.DNFL = window.DNFL || {};
    window.DNFL.Popups = window.DNFL.Popups || {};

    let capturedHomepageMessages = [];

    function norm(id) {
        if (id === null || id === undefined) return '';
        const s = String(id).trim();
        return s.length < 4 ? s.padStart(4, '0') : s;
    }

    function toArray(obj) {
        if (!obj) return [];
        return Array.isArray(obj) ? obj : [obj];
    }

    function getTtl(client, level, defaultMs) {
        if (client && client.TTLS && client.TTLS[level]) {
            return client.TTLS[level];
        }
        return defaultMs;
    }

    function getApiClient() {
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.fetchData === 'function') {
            return window.DNFL.Client;
        }
        if (typeof window.getDNFLApiClient === 'function') {
            return window.getDNFLApiClient();
        }
        return {
            fetchData: async function (ENDPOINT, params) {
                const year = window.MFL_YEAR || new Date().getFullYear().toString();
                const leagueId = window.MFL_LEAGUE_ID || '00000';
                let queryStr = `TYPE=${ENDPOINT}&L=${leagueId}&JSON=1`;
                if (params) {
                    Object.keys(params).forEach(k => {
                        queryStr += `&${k}=${encodeURIComponent(params[k])}`;
                    });
                }
                const url = `https://www43.myfantasyleague.com/${year}/export?${queryStr}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            },
            fetchRawText: async function (url) {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.text();
            }
        };
    }

    function getLoggedInFranchiseId() {
        if (typeof franchise_id !== 'undefined' && franchise_id !== null && franchise_id !== '' && franchise_id !== '0000') {
            return norm(franchise_id);
        }
        if (window.franchise_id && window.franchise_id !== '0000') return norm(window.franchise_id);
        if (window.MFL_USER_ID && window.MFL_USER_ID !== '0000') return norm(window.MFL_USER_ID);
        const cookieMatch = document.cookie.match(/(?:MFL_USER_ID|FRANCHISE_ID|user_id)=([0-9]{4})/i);
        if (cookieMatch) return norm(cookieMatch[1]);
        const myFranEl = document.querySelector('.myfranchise[franchise_id], tr.myfranchise[data-fid]');
        if (myFranEl) {
            const fidAttr = myFranEl.getAttribute('franchise_id') || myFranEl.getAttribute('data-fid');
            if (fidAttr) return norm(fidAttr);
        }
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.getUserFranchise === 'function') {
            const u = window.DNFL.Client.getUserFranchise();
            if (u) return norm(u);
        }
        return null;
    }

    function isUserCommish() {
        if (typeof franchise_id !== 'undefined' && franchise_id !== null && norm(franchise_id) === '0000') {
            return true;
        }
        if (window.is_commissioner === '1' || window.is_commissioner === 1 || window.is_commissioner === true) {
            return true;
        }
        const commishCookie = document.cookie.match(/IS_COMMISSIONER=(1|true)/i);
        if (commishCookie) return true;
        return false;
    }

    function isAuthorizedForSetup(targetFid) {
        if (!targetFid) return false;
        const targetNorm = norm(targetFid);
        if (isUserCommish()) return true;
        const loggedFid = getLoggedInFranchiseId();
        if (loggedFid && norm(loggedFid) === targetNorm) return true;
        if (typeof franchise_id !== 'undefined' && norm(franchise_id) === targetNorm) return true;
        return false;
    }

    function formatPlayerName(name) {
        if (!name) return 'N/A';
        const str = String(name).trim();
        if (str.includes(',')) {
            const parts = str.split(',').map(s => s.trim());
            if (parts.length >= 2) {
                return `${parts[1]} ${parts[0]}`;
            }
        }
        return str;
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

    function captureHomepageMessages() {
        try {
            const reminderEls = document.querySelectorAll('#league_reminders .tdalert, #league_reminders .alert, #league_reminders #warning');
            reminderEls.forEach(el => {
                const text = el.innerText || el.textContent;
                if (text && text.trim() && !capturedLeagueReminders.includes(text.trim())) {
                    capturedLeagueReminders.push(text.trim());
                }
            });

            const hpMsgContainer = document.querySelector('#home_page_messages, .homepage-messages, #league_messages');
            if (hpMsgContainer) {
                const items = hpMsgContainer.querySelectorAll('.message_item, .hp_message, tr.message');
                if (items.length > 0) {
                    items.forEach((item, idx) => {
                        const titleEl = item.querySelector('.message_title, .title, th, h3');
                        const bodyEl = item.querySelector('.message_body, .body, td');
                        capturedHomepageMessages.push({
                            id: idx + 1,
                            title: titleEl ? titleEl.innerText.trim() : `Announcement #${idx + 1}`,
                            body: bodyEl ? bodyEl.innerText.trim() : item.innerText.trim()
                        });
                    });
                } else if (hpMsgContainer.innerHTML.trim()) {
                    capturedHomepageMessages.push({
                        id: 1,
                        html: hpMsgContainer.innerHTML.trim()
                    });
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

            if (href.includes('csetup?') && href.includes('C=FRANCHISE')) {
                const loggedInFid = getLoggedInFranchiseId();
                const isCommish = isUserCommish();
                if (loggedInFid || isCommish) {
                    e.preventDefault();
                    const targetFid = loggedInFid || '0001';
                    openFranchisePopup(targetFid, 'overview', true);
                    return;
                }
            }

            if (href.includes('options?L=') && href.includes('O=01') && !href.includes('PRINTER=1')) {
                const m = href.match(/F=(\d{4})/i) || href.match(/FRANCHISE=(\d{4})/i);
                const targetFid = m ? m[1] : getLoggedInFranchiseId();
                if (targetFid && !link.classList.contains('dnfl-no-popup')) {
                    e.preventDefault();
                    openFranchisePopup(targetFid, 'overview', false);
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
            targetCsv = 'data_02.csv';
        }

        const csvUrl = `https://dnfl.live/dnfl_rankings/${year}/${targetCsv}`;
        const map = {};

        try {
            const rawCsv = await client.fetchRawText(csvUrl, { ttl: 1800000 });
            if (rawCsv && !rawCsv.startsWith('<')) {
                const lines = rawCsv.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length > 1) {
                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    const fidIdx = headers.findIndex(h => h === 'fid' || h === 'id' || h === 'franchise_id');
                    const rankIdx = headers.findIndex(h => h === 'rank' || h === 'power_rank');
                    const scoreIdx = headers.findIndex(h => h === 'powerindex' || h === 'score' || h === 'points');

                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(',').map(c => c.trim());
                        if (cols.length > 1) {
                            const fid = fidIdx >= 0 ? norm(cols[fidIdx]) : norm(cols[0]);
                            const rank = rankIdx >= 0 ? cols[rankIdx] : (cols[1] || '--');
                            const powerIndex = scoreIdx >= 0 ? cols[scoreIdx] : (cols[2] || '--');
                            if (fid) {
                                map[fid] = { rank, powerIndex };
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.warn("[DNFL Popups] Error fetching power rankings CSV:", err);
        }

        return map;
    }

    function ensureModalCreated() {
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
        return overlay;
    }

    function showModal(titleText, headerHtml, showGear, gearFid, isGearActive) {
        ensureModalCreated();
        const overlay = document.getElementById('dnfl-modal-overlay');

        const titleEl = document.getElementById('dnfl-modal-title');
        if (titleEl) titleEl.innerHTML = headerHtml || titleText;

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

        if (overlay) overlay.classList.remove('dnfl-is-hidden');
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

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    async function openPlayerPopup(playerId, activeTab) {
        activeTab = activeTab || 'overview';
        ensureModalCreated();
        showModal("Player Card", '<i class="fa-solid fa-user"></i> <span>Player Profile</span>', false, null, false);

        const content = document.getElementById('dnfl-modal-content-wrapper');
        content.innerHTML = `
            <div class="dnfl-status-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Loading player #${playerId}...
            </div>
        `;

        try {
            const client = getApiClient();
            const dailyTtl = getTtl(client, 'DAILY', 86400000);
            const hourlyTtl = getTtl(client, 'HOURLY', 3600000);

            const [playerMap, leagueData, scoresData, newsData] = await Promise.all([
                client.fetchData('players', { DETAILS: 1, PLAYERS: playerId }, { ttl: dailyTtl }).catch(() => null),
                client.fetchData('league', {}, { ttl: dailyTtl }).catch(() => null),
                client.fetchData('playerScores', { PLAYERS: playerId, W: 'YTD' }, { ttl: hourlyTtl }).catch(() => null),
                client.fetchData('playerNews', { PLAYERS: playerId }, { ttl: hourlyTtl }).catch(() => null)
            ]);

            const playerList = toArray(playerMap?.players?.player);
            const p = playerList.find(x => norm(x.id) === norm(playerId)) || playerList[0] || { id: playerId, name: `Player #${playerId}` };

            const formattedName = formatPlayerName(p.name);

            const franchises = toArray(leagueData?.league?.franchises?.franchise);
            const ownerFran = franchises.find(f => {
                const roster = toArray(f.player || f.roster);
                return roster.some(pr => norm(pr.id) === norm(playerId));
            });

            const ownerName = ownerFran ? ownerFran.name : 'Free Agent';
            const espnId = p.espn_id || p.espn_id_full;
            const headshot = espnId 
                ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
                : `https://www.mflscripts.com/playerImages_96x96/mfl_${p.id}.png`;

            const pos = String(p.position || 'N/A').toUpperCase();

            const pScoreObj = toArray(scoresData?.playerScores?.playerScore).find(x => norm(x.id) === norm(playerId));
            const ytdPts = pScoreObj ? parseFloat(pScoreObj.score || 0).toFixed(2) : '0.00';

            const currentWk = parseInt(leagueData?.league?.currentWk || 1, 10);
            const completedWeeks = Math.max(1, currentWk - 1);
            const ppg = (parseFloat(ytdPts) / completedWeeks).toFixed(2);

            let heroHtml = `
                <div class="dnfl-player-hero-card">
                    <div class="dnfl-hero-avatar-wrapper">
                        <img src="${headshot}" alt="${formattedName}" class="dnfl-hero-headshot" onerror="this.src='https://www.mflscripts.com/playerImages_96x96/free_agent.png'" />
                        <span class="dnfl-position-badge pos-${pos.toLowerCase()}">${pos}</span>
                    </div>
                    <div class="dnfl-hero-meta">
                        <h3 class="dnfl-hero-name">${formattedName}</h3>
                        <div class="dnfl-hero-tags">
                            <span class="dnfl-pill dnfl-pill-blue">${p.team || 'FA'}</span>
                            <span class="dnfl-pill dnfl-pill-gray">Owner: ${ownerName}</span>
                            <span class="dnfl-pill dnfl-pill-gold">${ppg} PPG</span>
                            <span class="dnfl-pill dnfl-pill-blue">${ytdPts} YTD Pts</span>
                        </div>
                    </div>
                </div>
            `;

            let newsHtml = `
                <div class="dnfl-card">
                    <div class="dnfl-card-header"><h4 class="dnfl-card-title"><i class="fa-solid fa-newspaper"></i> Player News & Updates</h4></div>
                    <div class="dnfl-card-body">
            `;

            const newsItems = toArray(newsData?.playerNews?.news);
            if (newsItems.length > 0) {
                newsHtml += newsItems.map(item => `
                    <div class="dnfl-hpm-card">
                        <div class="dnfl-hpm-title">${item.headline || item.title || 'Update'}</div>
                        <p class="dnfl-news-body">${item.body || item.analysis || ''}</p>
                    </div>
                `).join('');
            } else {
                newsHtml += `
                    <div class="dnfl-status-loading">
                        <i class="fa-solid fa-newspaper"></i> No recent news updates found for ${formattedName}.
                    </div>
                `;
            }
            newsHtml += `</div></div>`;

            content.innerHTML = heroHtml + newsHtml;

        } catch (e) {
            console.error("[DNFL Popups] Error opening player popup:", e);
            content.innerHTML = `
                <div class="dnfl-status-error">
                    <i class="fa-solid fa-triangle-exclamation"></i> Error loading player details: ${e.message}
                </div>
            `;
        }
    }

    function switchPlayerTab(playerId, tabName) {
        openPlayerPopup(playerId, tabName);
    }

    async function openFranchisePopup(franchiseId, activeTab, isSetupMode) {
        activeTab = activeTab || 'overview';
        isSetupMode = !!isSetupMode;

        ensureModalCreated();

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
            const loggedInFid = getLoggedInFranchiseId();
            const isCommish = isUserCommish();
            const canEditSetup = isAuthorizedForSetup(targetFidNorm);

            const franchises = toArray(leagueData?.league?.franchises?.franchise);
            const conferences = toArray(leagueData?.league?.conferences?.conference);
            const divisions = toArray(leagueData?.league?.divisions?.division);

            const targetFran = franchises.find(f => norm(f.id) === targetFidNorm);
            if (!targetFran) throw new Error("Franchise not found in league database.");

            const name = targetFran.name || `Franchise #${franchiseId}`;
            const logo = targetFran.logo;
            const icon = targetFran.icon;

            const targetConfId = targetFran.conference_id || targetFran.conference;
            const targetDivId = targetFran.division;

            const divObj = divisions.find(d => norm(d.id) === norm(targetDivId));
            const divConfId = divObj ? (divObj.conference_id || divObj.conference) : null;

            const finalConfId = targetConfId || divConfId;
            const confObj = conferences.find(c => norm(c.id) === norm(finalConfId));

            const confName = confObj ? confObj.name : '';
            const divName = divObj ? divObj.name : '';
            const fullLoc = [confName, divName].filter(Boolean).join(' • ');

            let headerHtml = '';
            if (isSetupMode) {
                headerHtml = `
                    <i class="fa-solid fa-gear dnfl-icon-amber"></i>
                    <span>Franchise ${targetFidNorm} Settings</span>
                `;
            } else {
                headerHtml = `
                    ${icon ? `<img src="${icon}" alt="Icon" class="franchise-icon-md dnfl-ficon-rounded" onerror="this.classList.add('dnfl-is-hidden')" />` : ''}
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
                const confIdNorm = norm(targetFran.conference_id || targetFran.conference);
                if (confIdNorm && conferences.length > 0) {
                    const confTeams = standingsList.filter(s => {
                        const fObj = franchises.find(f => norm(f.id) === norm(s.id));
                        return fObj && norm(fObj.conference_id || fObj.conference) === confIdNorm;
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
            
            const prMainStr = `#${prRankNum}`;
            const prSubStr = `${prVal} Grade`;

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
                        <div class="dnfl-stat-val-main">${prMainStr}</div>
                        <div class="dnfl-stat-val-sub">${prSubStr}</div>
                    </div>
                </div>
            `;

            let heroHtml = `
                <div class="dnfl-franchise-hero-header">
                    <div class="dnfl-hero-left-meta">
                        <div class="dnfl-owner-details-card">
                            <div><span class="dnfl-stat-lbl">OWNER:</span> <strong class="dnfl-owner-val">${targetFran.owner_name || 'N/A'}</strong></div>
                            ${fullLoc ? `<div><span class="dnfl-stat-lbl">DIVISION:</span> <strong class="dnfl-div-val">${fullLoc}</strong></div>` : ''}
                        </div>
                        ${scoreCardHtml}
                    </div>
                    ${logo ? `
                        <div class="dnfl-hero-logo-wrapper">
                            <img src="${logo}" alt="${name}" class="dnfl-hero-large-logo" onerror="this.classList.add('dnfl-is-hidden')" />
                        </div>
                    ` : ''}
                </div>
            `;

            let bodyContentHtml = '';
            if (activeTab === 'overview') {
                bodyContentHtml = heroHtml + renderFranchiseOverviewTab(targetFran, franStandings, rosterData, playerMap, ytdScoresData, completedWeeks);
            } else {
                bodyContentHtml = renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, activeTab, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, seedVal, seedTypeLabel, prVal, prSubStr, completedWeeks, bbidValStr);
            }

            content.innerHTML = tabButtonsHtml + bodyContentHtml;

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

    function renderSetupForm(targetFran, isCommish) {
        const mailEventsStr = String(targetFran.mail_event || targetFran.mail_events || targetFran.email_events || '').toUpperCase();
        const smsEventsStr = String(targetFran.sms_event || targetFran.sms_events || targetFran.sms_notifications || '').toUpperCase();

        const commishAdminBox = isCommish ? `
            <div class="dnfl-commish-admin-card">
                <div>
                    <div class="dnfl-stat-lbl">COMMISSIONER ADMIN ACCESS</div>
                    <div class="dnfl-owner-val">You have elevated privileges to configure settings for Franchise #${targetFran.id}.</div>
                </div>
                ${(() => {
                    const year = window.MFL_YEAR || new Date().getFullYear().toString();
                    const leagueId = window.MFL_LEAGUE_ID || targetFran.league_id || '00000';
                    const mflAdminUrl = `https://www.myfantasyleague.com/${year}/options?L=${leagueId}&O=01&F=${targetFran.id}`;
                    return `<a href="${mflAdminUrl}" target="_blank" class="dnfl-btn-secondary dnfl-btn-sm"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open MFL Native Setup Page</a>`;
                })()}
            </div>
        ` : '';

        return `
            <div class="dnfl-setup-container">
                ${commishAdminBox}
                <form id="dnfl-setup-form" onsubmit="DNFL.Popups.submitFranchiseSetup(event, '${targetFran.id}')">
                    <div class="dnfl-form-section">
                        <h4 class="dnfl-form-section-title"><i class="fa-solid fa-address-card"></i> Franchise Profile Information</h4>
                        <div class="dnfl-form-grid">
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-name">Franchise Name</label>
                                <input type="text" id="dnfl-inp-name" class="dnfl-input" value="${escapeXml(targetFran.name || '')}" required />
                            </div>
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-owner">Owner Name</label>
                                <input type="text" id="dnfl-inp-owner" class="dnfl-input" value="${escapeXml(targetFran.owner_name || '')}" />
                            </div>
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-email">Email Address</label>
                                <input type="email" id="dnfl-inp-email" class="dnfl-input" value="${escapeXml(targetFran.email || '')}" />
                            </div>
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-cell">Cell Phone Number</label>
                                <input type="tel" id="dnfl-inp-cell" class="dnfl-input" placeholder="(555) 555-5555" value="${escapeXml(targetFran.cell_phone || targetFran.phone || '')}" />
                            </div>
                        </div>
                        <div class="dnfl-form-grid">
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-logo">Logo URL</label>
                                <input type="url" id="dnfl-inp-logo" class="dnfl-input" placeholder="https://..." value="${escapeXml(targetFran.logo || '')}" />
                            </div>
                            <div class="dnfl-form-group">
                                <label for="dnfl-inp-icon">Icon URL (Square)</label>
                                <input type="url" id="dnfl-inp-icon" class="dnfl-input" placeholder="https://..." value="${escapeXml(targetFran.icon || '')}" />
                            </div>
                        </div>
                    </div>

                    <div class="dnfl-form-section">
                        <div class="dnfl-section-header-flex">
                            <h4 class="dnfl-form-section-title"><i class="fa-solid fa-envelope"></i> Email Notification Preferences</h4>
                            <div class="dnfl-toggle-actions">
                                <button type="button" class="dnfl-action-link" onclick="DNFL.Popups.toggleCheckboxes('email', true)">Select All</button>
                                <span class="dnfl-bullet">•</span>
                                <button type="button" class="dnfl-action-link" onclick="DNFL.Popups.toggleCheckboxes('email', false)">Deselect All</button>
                            </div>
                        </div>
                        <div class="dnfl-checkbox-grid">
                            ${EMAIL_NOTIF_OPTIONS.map(opt => {
                                if (opt.commishOnly && !isCommish) return '';
                                const isChecked = mailEventsStr.includes(opt.id) || mailEventsStr === 'ALL';
                                return `
                                    <label class="dnfl-checkbox-label">
                                        <input type="checkbox" name="mail_event" value="${opt.id}" ${isChecked ? 'checked' : ''} />
                                        <span>${opt.label}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="dnfl-form-section">
                        <div class="dnfl-section-header-flex">
                            <h4 class="dnfl-form-section-title"><i class="fa-solid fa-mobile-screen-button"></i> SMS Text Message Alerts</h4>
                            <div class="dnfl-toggle-actions">
                                <button type="button" class="dnfl-action-link" onclick="DNFL.Popups.toggleCheckboxes('sms', true)">Select All</button>
                                <span class="dnfl-bullet">•</span>
                                <button type="button" class="dnfl-action-link" onclick="DNFL.Popups.toggleCheckboxes('sms', false)">Deselect All</button>
                            </div>
                        </div>
                        <div class="dnfl-checkbox-grid">
                            ${EMAIL_NOTIF_OPTIONS.map(opt => {
                                if (opt.commishOnly && !isCommish) return '';
                                const isChecked = smsEventsStr.includes(opt.id) || smsEventsStr === 'ALL';
                                return `
                                    <label class="dnfl-checkbox-label">
                                        <input type="checkbox" name="sms_event" value="${opt.id}" ${isChecked ? 'checked' : ''} />
                                        <span>${opt.label}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="dnfl-form-actions">
                        <button type="submit" class="dnfl-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Franchise Settings</button>
                        <button type="button" class="dnfl-btn-secondary" onclick="DNFL.Popups.switchFranchiseTab('${targetFran.id}', 'overview')">Cancel</button>
                    </div>
                </form>
            </div>
        `;
    }

    async function submitFranchiseSetup(event, franchiseId) {
        event.preventDefault();
        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        const origBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving Settings...`;

        try {
            const name = form.querySelector('#dnfl-inp-name').value.trim();
            const owner = form.querySelector('#dnfl-inp-owner').value.trim();
            const email = form.querySelector('#dnfl-inp-email').value.trim();
            const cell = form.querySelector('#dnfl-inp-cell').value.trim();
            const logo = form.querySelector('#dnfl-inp-logo').value.trim();
            const icon = form.querySelector('#dnfl-inp-icon').value.trim();

            const mailChecks = Array.from(form.querySelectorAll('input[name="mail_event"]:checked')).map(cb => cb.value);
            const smsChecks = Array.from(form.querySelectorAll('input[name="sms_event"]:checked')).map(cb => cb.value);

            const mailEventsVal = mailChecks.length === EMAIL_NOTIF_OPTIONS.length ? 'ALL' : mailChecks.join(',');
            const smsEventsVal = smsChecks.length === EMAIL_NOTIF_OPTIONS.length ? 'ALL' : smsChecks.join(',');

            const xmlPayload = `<franchises><franchise id="${franchiseId}" name="${escapeXml(name)}" owner_name="${escapeXml(owner)}" email="${escapeXml(email)}" cell_phone="${escapeXml(cell)}" logo="${escapeXml(logo)}" icon="${escapeXml(icon)}" mail_event="${mailEventsVal}" sms_event="${smsEventsVal}" /></franchises>`;

            const year = window.MFL_YEAR || new Date().getFullYear().toString();
            const leagueId = window.MFL_LEAGUE_ID || '00000';
            const importUrl = `https://www43.myfantasyleague.com/${year}/import?TYPE=franchiseSetup&L=${leagueId}`;

            const formData = new FormData();
            formData.append('XML', xmlPayload);

            const res = await fetch(importUrl, { method: 'POST', body: formData });
            const responseText = await res.text();

            if (responseText.includes('<status>OK</status>') || responseText.includes('SUCCESS') || res.ok) {
                alert("Franchise settings saved successfully!");
                openFranchisePopup(franchiseId, 'overview', false);
            } else {
                throw new Error("MFL import returned unexpected status.");
            }

        } catch (err) {
            console.error("[DNFL Popups] Error saving setup form:", err);
            alert(`Error saving setup: ${err.message}`);
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnHtml;
        }
    }

    function toggleCheckboxes(groupType, selectAll) {
        const selector = groupType === 'email' ? 'input[name="mail_event"]' : 'input[name="sms_event"]';
        const checkboxes = document.querySelectorAll(selector);
        checkboxes.forEach(cb => {
            cb.checked = !!selectAll;
        });
    }

    function renderFranchiseOverviewTab(targetFran, franStandings, rosterData, playerMap, ytdScoresData, completedWeeks) {
        const playerList = toArray(playerMap?.players?.player);
        const ytdScoreMap = {};
        const posRankMap = {};

        toArray(ytdScoresData?.playerScores?.playerScore).forEach(ps => {
            if (ps.id) {
                const normId = norm(ps.id);
                ytdScoreMap[ps.id] = parseFloat(ps.score || 0);
                ytdScoreMap[normId] = parseFloat(ps.score || 0);
            }
        });

        playerList.forEach(p => {
            const normId = norm(p.id);
            posRankMap[normId] = {
                pos: String(p.position || 'N/A').toUpperCase(),
                rank: p.rank || '--'
            };
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
                            const formattedName = formatPlayerName(p.name);
                            const espnId = p.espn_id || p.espn_id_full;
                            const headshot = espnId 
                                ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
                                : `https://www.mflscripts.com/playerImages_96x96/mfl_${p.id}.png`;
                            return `
                                <div class="dnfl-star-card" onclick="DNFL.Popups.openPlayerPopup('${p.id}')">
                                    <div class="dnfl-star-avatar-wrapper">
                                        <img src="${headshot}" alt="${formattedName}" class="dnfl-star-avatar" onerror="this.src='https://www.mflscripts.com/playerImages_96x96/free_agent.png'" />
                                        <span class="dnfl-position-badge pos-${pos.toLowerCase()}">${pos}</span>
                                    </div>
                                    <div class="dnfl-star-info">
                                        <div class="dnfl-star-name">${formattedName}</div>
                                        <div class="dnfl-star-main-metric">${p.ppg} <span class="dnfl-ppg-label">PPG</span></div>
                                        <div class="dnfl-star-sub-metric">${p.ytdScore.toFixed(2)} Total (${pos} #${p.posRank})</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            starsHtml = `
                <div class="dnfl-stars-wrapper">
                    <h4 class="dnfl-section-title"><i class="fa-solid fa-star"></i> Top Performers</h4>
                    <div class="dnfl-status-loading">
                        <i class="fa-solid fa-user-check"></i> Roster information loaded. Detailed scoring updates sync continuously.
                    </div>
                </div>
            `;
        }

        return starsHtml;
    }

    function renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, activeTab, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, seedVal, seedTypeLabel, prVal, prSubStr, completedWeeks, bbidValStr) {
        if (activeTab === 'roster') {
            return `
                <div class="dnfl-card">
                    <div class="dnfl-card-header"><h4 class="dnfl-card-title"><i class="fa-solid fa-users"></i> Franchise Roster Breakdown</h4></div>
                    <div class="dnfl-card-body">
                        <div class="dnfl-status-loading"><i class="fa-solid fa-football"></i> Detailed Roster & Depth Chart view syncing...</div>
                    </div>
                </div>
            `;
        }
        if (activeTab === 'schedule') {
            return `
                <div class="dnfl-card">
                    <div class="dnfl-card-header"><h4 class="dnfl-card-title"><i class="fa-solid fa-calendar-days"></i> Matchup Schedule & Results</h4></div>
                    <div class="dnfl-card-body">
                        <div class="dnfl-status-loading"><i class="fa-solid fa-list-ol"></i> Season Matchups & Head-to-Head Schedule loading...</div>
                    </div>
                </div>
            `;
        }
        if (activeTab === 'history') {
            return `
                <div class="dnfl-card">
                    <div class="dnfl-card-header"><h4 class="dnfl-card-title"><i class="fa-solid fa-trophy"></i> Franchise All-Time History</h4></div>
                    <div class="dnfl-card-body">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Metric</th><th>Details</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>Franchise ID</td><td><code>${targetFran.id}</code></td></tr>
                                <tr class="dnfl-row-even"><td>Owner Name</td><td>${targetFran.owner_name || 'N/A'}</td></tr>
                                <tr class="dnfl-row-odd"><td>Current Record</td><td>${recordStr} (${winPctStr})</td></tr>
                                <tr class="dnfl-row-even"><td>BBID Balance</td><td>${bbidValStr}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        return '';
    }

    function switchFranchiseTab(franchiseId, tabName) {
        openFranchisePopup(franchiseId, tabName, false);
    }

    function openNotificationsModal() {
        ensureModalCreated();
        showModal("League Notifications & Messages", `<i class="fa-solid fa-bell"></i> <span>Notifications</span>`, false, null, false);
        const content = document.getElementById('dnfl-modal-content-wrapper');

        content.innerHTML = `
            <div class="dnfl-status-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Loading league announcements...
            </div>
        `;

        try {
            captureHomepageMessages();

            let html = '';
            if (capturedHomepageMessages.length > 0) {
                html += `
                    <div class="dnfl-hpm-section">
                        <h4 class="dnfl-hpm-section-title"><i class="fa-solid fa-bullhorn"></i> Official League Announcements</h4>
                `;
                capturedHomepageMessages.forEach(msg => {
                    if (msg.html) {
                        html += `<div class="dnfl-hpm-card">${msg.html}</div>`;
                    } else {
                        html += `
                            <div class="dnfl-hpm-card">
                                <div class="dnfl-hpm-title">${msg.title}</div>
                                <p class="dnfl-news-body">${msg.body}</p>
                            </div>
                        `;
                    }
                });
                html += `</div>`;
            } else {
                html += `
                    <div class="dnfl-status-loading dnfl-empty-notifications">
                        <i class="fa-solid fa-bell-slash"></i> No unread league announcements or active reminders.
                    </div>
                `;
            }

            content.innerHTML = html;

        } catch (e) {
            console.error("[DNFL Popups] Error opening notifications modal:", e);
            content.innerHTML = `
                <div class="dnfl-status-error">
                    <i class="fa-solid fa-triangle-exclamation"></i> Error loading notifications: ${e.message}
                </div>
            `;
        }
    }

    function init() {
        captureHomepageMessages();
        attachLinkInterceptors();
        console.log("[DNFL Popups] v4.30 Subsystem Loaded & Ready.");
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.DNFL.Popups = {
        openFranchisePopup: openFranchisePopup,
        openPlayerPopup: openPlayerPopup,
        openNotificationsModal: openNotificationsModal,
        switchFranchiseTab: switchFranchiseTab,
        switchPlayerTab: switchPlayerTab,
        toggleCheckboxes: toggleCheckboxes,
        submitFranchiseSetup: submitFranchiseSetup,
        captureHomepageMessages: captureHomepageMessages
    };

})();
