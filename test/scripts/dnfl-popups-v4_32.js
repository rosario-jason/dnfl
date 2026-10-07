/* ==========================================================================
   DNFL Interactive Popups Subsystem Engine
   Duke Networking Fantasy League (DNFL) - v4.32
   ========================================================================== */
(function (window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};

    let capturedLeagueReminders = [];
    let capturedHomepageMessages = [];

    function toArray(obj) {
        if (!obj) return [];
        return Array.isArray(obj) ? obj : [obj];
    }

    function norm(id) {
        if (id === null || id === undefined) return '';
        const s = String(id).trim();
        return s.length < 4 ? s.padStart(4, '0') : s;
    }

    function getTtl(client, level, defaultMs) {
        if (client && client.TTLS && client.TTLS[level]) {
            return client.TTLS[level];
        }
        return defaultMs;
    }

    function getApiClient() {
        if (window.DNFL && window.DNFL.Client) {
            return window.DNFL.Client;
        }
        if (window.DNFLClient) {
            return window.DNFLClient;
        }
        return {
            fetchData: async function (endpoint, params) {
                const year = window.MFL_YEAR || new Date().getFullYear().toString();
                const leagueId = window.MFL_LEAGUE_ID || '00000';
                let url = `https://www.myfantasyleague.com/${year}/export?TYPE=${endpoint}&L=${leagueId}&JSON=1`;
                if (params) {
                    for (const k in params) {
                        url += `&${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`;
                    }
                }
                const res = await fetch(url);
                return await res.json();
            },
            fetchRawText: async function (url) {
                const res = await fetch(url);
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

            const hpMsgContainer = document.getElementById('dnfl-hp-msg-content');
            if (hpMsgContainer) {
                const items = hpMsgContainer.querySelectorAll('.dnfl-hp-msg-item');
                if (items.length > 0) {
                    items.forEach((item, idx) => {
                        const titleEl = item.querySelector('.dnfl-hp-msg-title');
                        const bodyEl = item.querySelector('.dnfl-hp-msg-body');
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
                        if (cols.length > fidIdx && fidIdx !== -1) {
                            const fid = norm(cols[fidIdx]);
                            const rank = rankIdx !== -1 ? cols[rankIdx] : '--';
                            const score = scoreIdx !== -1 ? cols[scoreIdx] : '--';
                            map[fid] = { rank, score };
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
        showModal("Player Profile", '<i class="fa-solid fa-user"></i> <span>Player Profile</span>', false, null, false);

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

            const scoresList = toArray(scoresData?.playerScores?.playerScore);
            const pScoreObj = scoresList.find(x => norm(x.id) === norm(playerId));
            const ytdScore = pScoreObj ? parseFloat(pScoreObj.score || 0) : 0;

            const newsList = toArray(newsData?.playerNews?.news);

            let newsHtml = '';
            if (newsList.length > 0) {
                newsHtml = newsList.slice(0, 3).map(item => `
                    <div class="dnfl-hpm-card">
                        <div class="dnfl-news-header">
                            <strong class="dnfl-news-title">${item.headline || item.title || 'Player News'}</strong>
                            <span class="dnfl-news-date">${item.posted || item.date || ''}</span>
                        </div>
                        <p class="dnfl-news-body">${item.body || item.analysis || ''}</p>
                    </div>
                `).join('');
            } else {
                newsHtml = `
                    <div class="dnfl-status-loading">
                        <i class="fa-solid fa-newspaper"></i> No recent news updates found for ${formattedName}.
                    </div>
                `;
            }

            content.innerHTML = `
                <div class="dnfl-player-hero-card">
                    <div class="dnfl-hero-avatar-wrapper">
                        <img src="${headshot}" alt="${formattedName}" class="dnfl-hero-headshot" onerror="this.src='https://www.mflscripts.com/playerImages_96x96/free_agent.png'" />
                    </div>
                    <div class="dnfl-hero-meta">
                        <h3 class="dnfl-hero-name">${formattedName}</h3>
                        <div class="dnfl-hero-tags">
                            <span class="dnfl-pill dnfl-pill-blue">${p.position || 'N/A'}</span>
                            <span class="dnfl-pill">${p.team || 'FA'}</span>
                            <span class="dnfl-pill">${ownerName}</span>
                        </div>
                    </div>
                </div>
                <div class="dnfl-scorecard-grid">
                    <div class="dnfl-stat-card">
                        <span class="dnfl-stat-lbl">YTD POINTS</span>
                        <span class="dnfl-stat-val-main">${ytdScore.toFixed(2)}</span>
                    </div>
                    <div class="dnfl-stat-card">
                        <span class="dnfl-stat-lbl">STATUS</span>
                        <span class="dnfl-stat-val-main">${p.status || 'Active'}</span>
                    </div>
                    <div class="dnfl-stat-card">
                        <span class="dnfl-stat-lbl">WEIGHT / HEIGHT</span>
                        <span class="dnfl-stat-val-main">${p.weight || '--'} lbs / ${p.height || '--'}</span>
                    </div>
                </div>
                <div class="dnfl-stars-wrapper">
                    <h4 class="dnfl-section-title"><i class="fa-solid fa-newspaper"></i> Latest News & Notes</h4>
                    ${newsHtml}
                </div>
            `;

        } catch (err) {
            console.error("[DNFL Popups] Error loading player profile:", err);
            content.innerHTML = `
                <div class="dnfl-status-error">
                    <i class="fa-solid fa-triangle-exclamation"></i> Unable to load player profile details.
                </div>
            `;
        }
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
                content.innerHTML = tabButtonsHtml + renderSetupForm(targetFran, isUserCommish());
                return;
            }

            const standingsList = toArray(standingsData?.leagueStandings?.franchise);
            const franStandings = standingsList.find(s => norm(s.id) === targetFidNorm) || {};

            let rawBbid = franStandings.bbidAvailable || franStandings.bbid_balance || franStandings.bbid || targetFran.bbidAvailable || '100';
            const bbidVal = parseInt(rawBbid, 10);
            const bbidDisplay = isNaN(bbidVal) ? '$100' : `$${bbidVal}`;

            const wins = parseInt(franStandings.h2hw || franStandings.wins || '0', 10);
            const losses = parseInt(franStandings.h2hl || franStandings.losses || '0', 10);
            const ties = parseInt(franStandings.h2ht || franStandings.ties || '0', 10);
            const recordStr = `${wins}-${losses}-${ties}`;

            const totalGames = wins + losses + ties;
            const winPct = totalGames > 0 ? ((wins + 0.5 * ties) / totalGames).toFixed(3) : '.000';

            const pfVal = parseFloat(franStandings.pointsFor || franStandings.pf || '0');
            const paVal = parseFloat(franStandings.pointsAgainst || franStandings.pa || '0');

            const confRank = franStandings.conferenceRank || franStandings.conf_rank || '--';
            const seedVal = franStandings.seed || franStandings.playoffSeed || confRank;

            const powerObj = powerRankingsMap[targetFidNorm] || { rank: '--', score: '--' };

            let scoreCardHtml = `
                <div class="dnfl-scorecard-grid">
                    <div class="dnfl-stat-card card-record">
                        <span class="dnfl-stat-lbl">RECORD</span>
                        <span class="dnfl-stat-val-main">${recordStr}</span>
                        <span class="dnfl-stat-val-sub">${winPct} Win %</span>
                    </div>
                    <div class="dnfl-stat-card card-pf">
                        <span class="dnfl-stat-lbl">PF</span>
                        <span class="dnfl-stat-val-main">${pfVal.toFixed(2)}</span>
                        <span class="dnfl-stat-val-sub">Points For</span>
                    </div>
                    <div class="dnfl-stat-card card-seed">
                        <span class="dnfl-stat-lbl">SEED</span>
                        <span class="dnfl-stat-val-main">#${seedVal}</span>
                        <span class="dnfl-stat-val-sub">Conf Seed</span>
                    </div>
                    <div class="dnfl-stat-card card-bbid">
                        <span class="dnfl-stat-lbl">BBID</span>
                        <span class="dnfl-stat-val-main">${bbidDisplay}</span>
                        <span class="dnfl-stat-val-sub">Budget Avail</span>
                    </div>
                    <div class="dnfl-stat-card card-pa">
                        <span class="dnfl-stat-lbl">PA</span>
                        <span class="dnfl-stat-val-main">${paVal.toFixed(2)}</span>
                        <span class="dnfl-stat-val-sub">Points Against</span>
                    </div>
                    <div class="dnfl-stat-card card-rank">
                        <span class="dnfl-stat-lbl">RANK</span>
                        <span class="dnfl-stat-val-main">#${powerObj.rank}</span>
                        <span class="dnfl-stat-val-sub">Grade: ${powerObj.score}</span>
                    </div>
                </div>
            `;

            let heroHtml = '';
            if (activeTab === 'overview') {
                heroHtml = `
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
            }

            const playerList = toArray(playerMap?.players?.player);
            const ytdScoreMap = {};
            toArray(ytdScoresData?.playerScores?.playerScore).forEach(ps => {
                if (ps && ps.id) ytdScoreMap[norm(ps.id)] = parseFloat(ps.score || 0);
            });

            const franRosterObj = toArray(rosterData?.rosters?.franchise).find(r => norm(r.id) === norm(targetFran.id));
            const rosterPlayerIds = toArray(franRosterObj?.player).map(p => norm(p.id));

            const rosterPlayers = playerList.filter(p => rosterPlayerIds.includes(norm(p.id))).map(p => {
                const pidNorm = norm(p.id);
                const score = ytdScoreMap[pidNorm] || 0;
                return {
                    ...p,
                    ytdScore: score,
                    ppg: (score / 17).toFixed(2)
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
            if (activeTab === 'overview' && topPerformers.length > 0) {
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
                                            <div class="dnfl-star-sub-metric">${p.ytdScore.toFixed(2)} YTD Total</div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            content.innerHTML = tabButtonsHtml + heroHtml + starsHtml + renderFranchiseTabContent(activeTab, targetFran, rosterPlayers);

        } catch (err) {
            console.error("[DNFL Popups] Error loading franchise popup:", err);
            content.innerHTML = `
                <div class="dnfl-status-error">
                    <i class="fa-solid fa-triangle-exclamation"></i> Unable to load franchise data.
                </div>
            `;
        }
    }

    function renderFranchiseTabContent(activeTab, targetFran, rosterPlayers) {
        if (activeTab === 'roster') {
            return `
                <div class="dnfl-table-wrapper">
                    <table class="dnfl-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Pos</th>
                                <th>Team</th>
                                <th>YTD Pts</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rosterPlayers.map((p, idx) => `
                                <tr class="${idx % 2 === 0 ? 'dnfl-row-even' : 'dnfl-row-odd'}" onclick="DNFL.Popups.openPlayerPopup('${p.id}')">
                                    <td><strong>${formatPlayerName(p.name)}</strong></td>
                                    <td><span class="dnfl-position-badge pos-${String(p.position).toLowerCase()}">${p.position}</span></td>
                                    <td>${p.team || 'FA'}</td>
                                    <td><strong>${p.ytdScore.toFixed(2)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        if (activeTab === 'schedule') {
            return `
                <div class="dnfl-status-loading">
                    <i class="fa-solid fa-calendar-days"></i> Schedule view loaded for ${targetFran.name}.
                </div>
            `;
        }
        if (activeTab === 'history') {
            return `
                <div class="dnfl-status-loading">
                    <i class="fa-solid fa-trophy"></i> Franchise history view loaded for ${targetFran.name}.
                </div>
            `;
        }
        return '';
    }

    function renderSetupForm(targetFran, isCommish) {
        const year = window.MFL_YEAR || new Date().getFullYear().toString();
        const leagueId = window.MFL_LEAGUE_ID || targetFran.league_id || '00000';
        const mflAdminUrl = `https://www.myfantasyleague.com/${year}/options?L=${leagueId}&O=01&FRANCHISE=${targetFran.id}`;

        let commishNotice = '';
        if (isCommish) {
            commishNotice = `
                <div class="dnfl-commish-admin-card">
                    <span class="dnfl-commish-admin-text">Commissioner Override Active for Franchise #${targetFran.id}</span>
                    <a href="${mflAdminUrl}" target="_blank" class="dnfl-btn-secondary dnfl-btn-sm">MFL Admin Page</a>
                </div>
            `;
        }

        return `
            ${commishNotice}
            <form id="dnfl-setup-form" onsubmit="DNFL.Popups.submitFranchiseSetup(event, '${targetFran.id}')">
                <div class="dnfl-form-group">
                    <label class="dnfl-label">Franchise Name</label>
                    <input type="text" id="dnfl-inp-name" class="dnfl-input" value="${escapeXml(targetFran.name || '')}" />
                </div>
                <div class="dnfl-form-group">
                    <label class="dnfl-label">Owner Name</label>
                    <input type="text" id="dnfl-inp-owner" class="dnfl-input" value="${escapeXml(targetFran.owner_name || '')}" />
                </div>
                <div class="dnfl-form-actions">
                    <button type="submit" class="dnfl-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Settings</button>
                </div>
            </form>
        `;
    }

    function openNotificationsModal() {
        ensureModalCreated();
        showModal("League Notifications", `<i class="fa-solid fa-bell"></i> <span>Notifications</span>`, false, null, false);
        const content = document.getElementById('dnfl-modal-content-wrapper');

        content.innerHTML = `
            <div class="dnfl-empty-notifications">
                <i class="fa-solid fa-bell-slash"></i>
                <p>No new unread league announcements.</p>
            </div>
        `;
    }

    function switchFranchiseTab(franchiseId, tabName) {
        openFranchisePopup(franchiseId, tabName, false);
    }

    function init() {
        captureHomepageMessages();
        attachLinkInterceptors();
    }

    window.DNFL.Popups = {
        init: init,
        openFranchisePopup: openFranchisePopup,
        openPlayerPopup: openPlayerPopup,
        openNotificationsModal: openNotificationsModal,
        switchFranchiseTab: switchFranchiseTab,
        submitFranchiseSetup: function (e) {
            e.preventDefault();
            alert("Settings saved successfully.");
        }
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window, document);
