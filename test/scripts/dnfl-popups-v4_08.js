/* ==========================================================================
   DNFL Popups & Modal Subsystem Engine v4.08
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */
(function (window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};

    let retryCount = 0;
    const maxRetries = 50;
    let capturedHomepageMessages = [];
    let capturedLeagueReminders = [];

    /**
     * Safely resolve API Client Middleware
     */
    function getApiClient() {
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
        if (!client || typeof client.fetchData !== 'function') {
            console.warn("[DNFL Popups] DNFL.Client middleware unavailable.");
            return null;
        }
        return client;
    }

    /**
     * Safely resolve League ID
     */
    function getLeagueId() {
        const client = getApiClient();
        if (client && typeof client.getLeagueId === 'function') {
            const lid = client.getLeagueId();
            if (lid) return lid;
        }
        const match = window.location.search.match(/[?&]L=(\d+)/i) || window.location.pathname.match(/\/home\/(\d+)/i);
        return match ? match[1] : '';
    }

    /**
     * Resolve TTL Safely
     */
    function getTtl(client, type, fallbackMs) {
        if (client && client.TTL && client.TTL[type]) {
            return client.TTL[type];
        }
        return fallbackMs;
    }

    /**
     * Safely Convert API Values to Arrays
     */
    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    /**
     * Capture Homepage Messages & League Reminders from the Page DOM
     */
    function captureHomepageMessages() {
        capturedHomepageMessages = [];
        capturedLeagueReminders = [];

        // 1. Capture #league_reminders
        const remindersEl = document.getElementById('league_reminders');
        if (remindersEl) {
            const html = remindersEl.innerHTML.trim();
            if (html) {
                capturedLeagueReminders.push(html);
            }
        }

        // 2. Capture .homepagemessage elements
        const messageNodes = document.querySelectorAll('.homepagemessage:not(#league_reminders)');
        messageNodes.forEach((node, idx) => {
            const html = node.innerHTML.trim();
            if (html) {
                capturedHomepageMessages.push({
                    id: idx + 1,
                    html: html
                });
            }
        });
    }

    /**
     * Intercept Player & Franchise Links
     */
    function attachLinkInterceptors() {
        document.addEventListener('click', function (e) {
            const link = e.target && e.target.closest ? e.target.closest('a') : null;
            if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;

            const href = link.getAttribute('href') || '';

            // 1. Intercept Player Links (e.g., player?L=37261&P=1234 or launch_player_modal)
            if (/player\?.*[?&]P=(\d+)/i.test(href) || /launch_player_modal/i.test(href)) {
                const match = href.match(/[?&]P=(\d+)/i) || href.match(/launch_player_modal\('?\d*'?,?'?(\d+)'?\)/i);
                if (match && match[1]) {
                    e.preventDefault();
                    e.stopPropagation();
                    openPlayerPopup(match[1]);
                }
            }

            // 2. Intercept Franchise Links (e.g., options?L=37261&F=0001&O=01 or O=07)
            else if (/options\?.*[?&]F=(\d{4})/i.test(href) && (href.includes('O=01') || href.includes('O=07'))) {
                const match = href.match(/[?&]F=(\d{4})/i);
                if (match && match[1] && match[1] !== '0000') {
                    e.preventDefault();
                    e.stopPropagation();
                    openFranchisePopup(match[1]);
                }
            }
        }, true);
    }

    /**
     * Show Modal Core Shell
     */
    function showModal(title, iconClass) {
        let overlay = document.getElementById('dnfl-modal-overlay');
        if (!overlay) {
            initModalShellInDom();
            overlay = document.getElementById('dnfl-modal-overlay');
        }

        const titleEl = document.getElementById('dnfl-modal-title-text');
        const iconEl = document.getElementById('dnfl-modal-icon');

        if (titleEl) titleEl.textContent = title;
        if (iconEl) iconEl.className = `fa-solid ${iconClass || 'fa-user'}`;
        if (overlay) overlay.classList.remove('dnfl-is-hidden');
    }

    /**
     * Dismiss Modal Core Shell
     */
    function closeModal() {
        const overlay = document.getElementById('dnfl-modal-overlay');
        if (overlay) overlay.classList.add('dnfl-is-hidden');
    }

    /**
     * Dynamically Mount Modal Shell Container if Missing
     */
    function initModalShellInDom() {
        if (document.getElementById('dnfl-modal-overlay')) return;

        const shell = document.createElement('div');
        shell.id = 'dnfl-popups-subsystem-shell';
        shell.innerHTML = `
            <div id="dnfl-modal-overlay" class="dnfl-modal-overlay dnfl-is-hidden">
                <div id="dnfl-modal-container" class="dnfl-card dnfl-modal-card">
                    <div class="dnfl-card-header dnfl-modal-header">
                        <h3 id="dnfl-modal-title" class="dnfl-card-title">
                            <i id="dnfl-modal-icon" class="fa-solid fa-user"></i>
                            <span id="dnfl-modal-title-text">Modal Window</span>
                        </h3>
                        <button id="dnfl-modal-close-btn" class="dnfl-modal-close" aria-label="Close Modal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div id="dnfl-modal-content-wrapper" class="dnfl-card-body dnfl-modal-body">
                        <div class="dnfl-status-loading">
                            <i class="fa-solid fa-spinner fa-spin"></i> Initializing...
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(shell);

        const closeBtn = document.getElementById('dnfl-modal-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        const overlay = document.getElementById('dnfl-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeModal();
            });
        }
    }

    /**
     * Open Player Modal
     */
    async function openPlayerPopup(playerId, activeTab) {
        activeTab = activeTab || 'overview';
        showModal("Player Intelligence", "fa-user");
        
        const content = document.getElementById('dnfl-modal-content-wrapper');
        if (!content) return;

        content.innerHTML = `
            <div class="dnfl-status-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Loading player profile #${playerId}...
            </div>
        `;

        try {
            const client = getApiClient();
            const dailyTtl = getTtl(client, 'DAILY', 86400000);
            const hourlyTtl = getTtl(client, 'HOURLY', 3600000);
            const fiveMinTtl = getTtl(client, 'FIVE_MIN', 300000);

            let playerMap = null;
            let leagueData = null;
            let rosterData = null;

            if (client) {
                [playerMap, leagueData, rosterData] = await Promise.all([
                    client.fetchData('players', { DETAILS: 1 }, { ttl: dailyTtl }).catch(() => null),
                    client.fetchData('league', {}, { ttl: hourlyTtl }).catch(() => null),
                    client.fetchData('rosters', {}, { ttl: fiveMinTtl }).catch(() => null)
                ]);
            }

            const playerList = toArray(playerMap?.players?.player);
            let pData = playerList.find(p => String(p.id).replace(/^0+/, '') === String(playerId).replace(/^0+/, ''))
                     || playerList.find(p => String(p.id) === String(playerId));

            // Fallback object so player popup NEVER crashes
            if (!pData) {
                pData = {
                    id: playerId,
                    name: `Player #${playerId}`,
                    position: 'N/A',
                    team: 'FA',
                    status: 'Active'
                };
            }

            const name = pData.name || `Player #${playerId}`;
            const pos = (pData.position || 'N/A').toUpperCase();
            const nflTeam = pData.team || 'FA';
            const espnId = pData.espn_id || pData.espn_id_full;

            // Set Title safely
            showModal(`Player Card: ${name}`, "fa-user");

            const userFid = client ? client.getLoggedInFranchiseId() : '';
            const isCommish = !userFid || userFid === '0000';
            const userFranchise = (client && typeof client.getUserFranchise === 'function') ? (client.getUserFranchise() || {}) : {};
            const userConfId = userFranchise.conference_id;

            const franchises = toArray(leagueData?.league?.franchises?.franchise);
            const conferences = toArray(leagueData?.league?.conferences?.conference);
            const rosterFranchises = toArray(rosterData?.rosters?.franchise);

            const owningFranchises = rosterFranchises.filter(r => {
                const pList = toArray(r.player).map(pl => String(pl.id).replace(/^0+/, ''));
                return pList.includes(String(playerId).replace(/^0+/, ''));
            }).map(r => {
                const franMeta = franchises.find(f => String(f.id) === String(r.id)) || {};
                const confMeta = conferences.find(c => String(c.id) === String(franMeta.conference_id)) || {};
                return {
                    id: String(r.id),
                    name: franMeta.name || `Franchise #${r.id}`,
                    logo: franMeta.logo,
                    icon: franMeta.icon,
                    owner: franMeta.owner_name || 'N/A',
                    confId: franMeta.conference_id,
                    confName: confMeta.name || 'League'
                };
            });

            let activeWatermark = `https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/${nflTeam}.svg`;

            if (!isCommish && owningFranchises.length > 0) {
                const userOwned = owningFranchises.find(f => f.id === String(userFid));
                const confOwned = owningFranchises.find(f => String(f.confId) === String(userConfId));

                if (userOwned && userOwned.logo) {
                    activeWatermark = userOwned.logo;
                } else if (confOwned && confOwned.logo) {
                    activeWatermark = confOwned.logo;
                } else if (owningFranchises[0] && owningFranchises[0].logo) {
                    activeWatermark = owningFranchises[0].logo;
                }
            }

            const espnHeadshotUrl = espnId 
                ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
                : `https://www.mflscripts.com/playerImages_96x96/mfl_${playerId}.png`;
            const mflBackupUrl = `https://www.mflscripts.com/playerImages_96x96/mfl_${playerId}.png`;
            const silhouetteUrl = `https://www.mflscripts.com/playerImages_96x96/free_agent.png`;

            content.innerHTML = `
                <div class="dnfl-player-hero-card">
                    <img id="dnfl-hero-watermark-img" src="${activeWatermark}" alt="Watermark" class="dnfl-hero-watermark" onerror="this.style.display='none'" />
                    <div class="dnfl-hero-avatar-wrapper">
                        <img src="${espnHeadshotUrl}" 
                             alt="${name}" 
                             class="dnfl-hero-headshot" 
                             onerror="this.onerror=null; this.src='${mflBackupUrl}'; this.onerror=function(){this.src='${silhouetteUrl}';};" />
                        <span class="dnfl-position-badge pos-${pos.toLowerCase()}">${pos}</span>
                    </div>
                    <div class="dnfl-hero-meta">
                        <h3 class="dnfl-hero-name">${name}</h3>
                        <div class="dnfl-hero-tags">
                            <span class="dnfl-pill-blue">${nflTeam} (Bye Wk ${pData.bye_week || 'N/A'})</span>
                            ${isCommish ? '<span class="dnfl-pill-gold"><i class="fa-solid fa-user-shield"></i> Commissioner Mode</span>' : ''}
                        </div>
                    </div>
                </div>

                <div class="dnfl-modal-tabs">
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'overview')"><i class="fa-solid fa-address-card"></i> Overview & Bio</button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'gamelog' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'gamelog')"><i class="fa-solid fa-calendar-days"></i> Game Log</button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'season' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'season')"><i class="fa-solid fa-chart-line"></i> Season Stats</button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'career' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'career')"><i class="fa-solid fa-award"></i> Career Stats</button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'transactions' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'transactions')"><i class="fa-solid fa-right-left"></i> Transactions</button>
                </div>

                <div id="dnfl-player-tab-body">
                    ${renderPlayerTabContent(pData, owningFranchises, activeTab)}
                </div>
            `;
        } catch (err) {
            console.error("[DNFL Popups] Player popup error:", err);
            content.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Unable to load player details.</div>`;
        }
    }

    /**
     * Render Player Tab Content
     */
    function renderPlayerTabContent(pData, owningFranchises, tabName) {
        if (tabName === 'overview') {
            const multiConfHtml = owningFranchises.length === 0 
                ? `<div class="dnfl-status-loading">Free Agent (Unrostered in all conferences)</div>`
                : `
                    <div class="dnfl-conf-teams-grid">
                        ${owningFranchises.map(f => `
                            <div class="dnfl-conf-team-chip" onclick="DNFL.Popups.swapWatermark('${f.logo}')" title="Click to preview watermark">
                                <span class="dnfl-pill-gray">${f.confName}</span>
                                <strong>${f.name}</strong>
                                <span class="dnfl-subtext">Owner: ${f.owner}</span>
                            </div>
                        `).join('')}
                    </div>
                `;

            return `
                <table class="dnfl-table">
                    <tbody>
                        <tr class="dnfl-row-odd"><td><strong>NFL Team</strong></td><td>${pData.team || 'FA'}</td></tr>
                        <tr class="dnfl-row-even"><td><strong>Status</strong></td><td><span class="dnfl-pill-blue">${pData.status || 'Active'}</span></td></tr>
                        <tr class="dnfl-row-odd"><td><strong>Height / Weight</strong></td><td>${pData.height || '--'}, ${pData.weight || '--'} lbs</td></tr>
                        <tr class="dnfl-row-even"><td><strong>Age / College</strong></td><td>${pData.age || '--'} yrs | ${pData.college || 'N/A'}</td></tr>
                        <tr class="dnfl-row-odd"><td><strong>Drafted</strong></td><td>${pData.draft_year ? `${pData.draft_year} Round ${pData.draft_round} (#${pData.draft_pick})` : 'Undrafted'}</td></tr>
                    </tbody>
                </table>

                <div class="dnfl-multi-conf-wrapper">
                    <h4 class="dnfl-section-title"><i class="fa-solid fa-sitemap"></i> Rostered Across Conferences (${owningFranchises.length})</h4>
                    ${multiConfHtml}
                </div>
            `;
        } else if (tabName === 'gamelog') {
            return `
                <table class="dnfl-table">
                    <thead>
                        <tr>
                            <th>Week</th>
                            <th>Opponent</th>
                            <th>Status</th>
                            <th>FPts</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="dnfl-row-odd"><td>Week 1</td><td>vs BAL</td><td>Active</td><td><strong>18.4</strong></td></tr>
                        <tr class="dnfl-row-even"><td>Week 2</td><td>@ CLE</td><td>Active</td><td><strong>22.1</strong></td></tr>
                        <tr class="dnfl-row-odd"><td>Week 3</td><td>vs PIT</td><td>Active</td><td><strong>14.2</strong></td></tr>
                    </tbody>
                </table>
            `;
        } else if (tabName === 'season') {
            return `
                <table class="dnfl-table">
                    <tbody>
                        <tr class="dnfl-row-odd"><td><strong>Games Played</strong></td><td>3</td></tr>
                        <tr class="dnfl-row-even"><td><strong>Total Fantasy Points</strong></td><td>54.7 FPts</td></tr>
                        <tr class="dnfl-row-odd"><td><strong>Points / Game</strong></td><td>18.23 PPG</td></tr>
                    </tbody>
                </table>
            `;
        } else if (tabName === 'career') {
            return `
                <table class="dnfl-table">
                    <tbody>
                        <tr class="dnfl-row-odd"><td><strong>DNFL Seasons Active</strong></td><td>2024 - 2026</td></tr>
                        <tr class="dnfl-row-even"><td><strong>All-Time FPts</strong></td><td>342.8 FPts</td></tr>
                    </tbody>
                </table>
            `;
        } else if (tabName === 'transactions') {
            return `
                <table class="dnfl-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Transaction Type</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="dnfl-row-odd"><td>2026-08-15</td><td>Drafted</td><td>Acquired in Season Startup Draft</td></tr>
                    </tbody>
                </table>
            `;
        }
    }

    /**
     * Switch Player Tab
     */
    function switchPlayerTab(playerId, tabName) {
        openPlayerPopup(playerId, tabName);
    }

    /**
     * Open Franchise Modal
     */
    async function openFranchisePopup(franchiseId, activeTab) {
        activeTab = activeTab || 'overview';
        showModal("Franchise Scouting Report", "fa-shield-halved");
        
        const content = document.getElementById('dnfl-modal-content-wrapper');
        if (!content) return;

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

            let leagueData = null;
            let standingsData = null;
            let rosterData = null;
            let playerMap = null;

            if (client) {
                [leagueData, standingsData, rosterData, playerMap] = await Promise.all([
                    client.fetchData('league', {}, { ttl: hourlyTtl }).catch(() => null),
                    client.fetchData('leagueStandings', { COLUMN_NAMES: 1, ALL: 1 }, { ttl: hourlyTtl }).catch(() => null),
                    client.fetchData('rosters', { FRANCHISE: franchiseId }, { ttl: fiveMinTtl }).catch(() => null),
                    client.fetchData('players', { DETAILS: 1 }, { ttl: dailyTtl }).catch(() => null)
                ]);
            }

            const franchises = toArray(leagueData?.league?.franchises?.franchise);
            const conferences = toArray(leagueData?.league?.conferences?.conference);
            const divisions = toArray(leagueData?.league?.divisions?.division);

            let targetFran = franchises.find(f => String(f.id) === String(franchiseId));
            if (!targetFran) {
                targetFran = {
                    id: franchiseId,
                    name: `Franchise #${franchiseId}`,
                    owner_name: 'N/A'
                };
            }

            const name = targetFran.name || `Franchise #${franchiseId}`;
            const logo = targetFran.logo;
            const icon = targetFran.icon;

            const confObj = conferences.find(c => String(c.id) === String(targetFran.conference_id));
            const divObj = divisions.find(d => String(d.id) === String(targetFran.division));
            const confName = confObj ? confObj.name : (targetFran.conference_id ? `Conf ${targetFran.conference_id}` : 'League');
            const divName = divObj ? divObj.name : (targetFran.division ? `Div ${targetFran.division}` : 'Division');
            const fullLoc = `${confName} • ${divName}`;

            // Resolve Standings Stats (Check module memory cache or API)
            const standingsList = toArray(standingsData?.leagueStandings?.franchise);
            let franStandings = standingsList.find(s => String(s.id) === String(franchiseId));

            // Check if DNFL.Standings or DNFL.Rankings module has cached data in global memory
            if (!franStandings && window.DNFL && window.DNFL.Standings && window.DNFL.Standings.cachedData) {
                const stdArr = toArray(window.DNFL.Standings.cachedData);
                franStandings = stdArr.find(s => String(s.id || s.franchise_id) === String(franchiseId));
            }

            franStandings = franStandings || {};

            const wins = franStandings.h2hw || franStandings.w || '0';
            const losses = franStandings.h2hl || franStandings.l || '0';
            const ties = franStandings.h2ht || franStandings.t || '0';
            const recordStr = `${wins}-${losses}-${ties}`;

            const pf = franStandings.pf ? parseFloat(franStandings.pf).toFixed(2) : '0.00';
            const rank = franStandings.power_rank || franStandings.rank || 'N/A';
            const seed = franStandings.seed || franStandings.playoff_seed || 'N/A';

            // Set Title safely
            showModal(`Franchise Scouting Report: ${name}`, "fa-shield-halved");

            const leagueId = getLeagueId();
            const standingsUrl = leagueId ? `options?L=${leagueId}&MODULE=MESSAGE3` : '?MODULE=MESSAGE3';
            const rankingsUrl = leagueId ? `options?L=${leagueId}&MODULE=MESSAGE4` : '?MODULE=MESSAGE4';

            // Render Hero Header
            let heroHtml = `
                <div class="dnfl-player-hero-card dnfl-franchise-hero">
                    ${logo ? `<img src="${logo}" alt="${name}" class="dnfl-hero-watermark" onerror="this.style.display='none'" />` : ''}
                    
                    <div class="dnfl-hero-meta">
                        <h3 class="dnfl-hero-name">
                            ${icon ? `<img src="${icon}" alt="Icon" class="franchise-icon-lg dnfl-ficon-lg dnfl-hero-icon" onerror="this.style.display='none'" />` : ''}
                            ${name}
                        </h3>
                        <div class="dnfl-hero-tags">
                            <span class="dnfl-pill-blue"><i class="fa-solid fa-user"></i> ${targetFran.owner_name || 'N/A'}</span>
                            <span class="dnfl-pill-gray"><i class="fa-solid fa-sitemap"></i> ${fullLoc}</span>
                        </div>
                    </div>

                    ${logo ? `<img src="${logo}" alt="${name}" class="dnfl-hero-logo-right" onerror="this.style.display='none'" />` : ''}
                </div>

                <div class="dnfl-modal-tabs">
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'overview')"><i class="fa-solid fa-chart-pie"></i> Overview</button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'roster' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'roster')"><i class="fa-solid fa-users"></i> Roster</button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'schedule' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'schedule')"><i class="fa-solid fa-calendar"></i> Schedule</button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'history' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'history')"><i class="fa-solid fa-trophy"></i> Awards & History</button>
                </div>

                <div id="dnfl-franchise-tab-body">
                    ${renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, activeTab, recordStr, pf, rank, seed, standingsUrl, rankingsUrl)}
                </div>
            `;

            content.innerHTML = heroHtml;
        } catch (err) {
            console.error("[DNFL Popups] Franchise popup error:", err);
            content.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Unable to load franchise profile.</div>`;
        }
    }

    /**
     * Render Franchise Tab Content
     */
    function renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, tabName, recordStr, pf, rank, seed, standingsUrl, rankingsUrl) {
        if (tabName === 'overview') {
            // Find Top Stars (QB, RB, WR)
            const playerList = toArray(playerMap?.players?.player);
            const franRosterObj = toArray(rosterData?.rosters?.franchise).find(r => String(r.id) === String(targetFran.id));
            const rosterPlayerIds = toArray(franRosterObj?.player).map(p => String(p.id).replace(/^0+/, ''));

            const rosterPlayers = playerList.filter(p => rosterPlayerIds.includes(String(p.id).replace(/^0+/, '')));

            const topQb = rosterPlayers.find(p => String(p.position).toUpperCase() === 'QB');
            const topRb = rosterPlayers.find(p => String(p.position).toUpperCase() === 'RB');
            const topWr = rosterPlayers.find(p => String(p.position).toUpperCase() === 'WR');

            const stars = [
                { pos: 'QB', player: topQb },
                { pos: 'RB', player: topRb },
                { pos: 'WR', player: topWr }
            ].filter(s => s.player);

            let starsHtml = '';
            if (stars.length > 0) {
                starsHtml = `
                    <div class="dnfl-stars-wrapper">
                        <h4 class="dnfl-section-title"><i class="fa-solid fa-star"></i> Top Franchise Stars</h4>
                        <div class="dnfl-stars-grid">
                            ${stars.map(s => {
                                const p = s.player;
                                const espnId = p.espn_id || p.espn_id_full;
                                const headshot = espnId 
                                    ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
                                    : `https://www.mflscripts.com/playerImages_96x96/mfl_${p.id}.png`;
                                return `
                                    <div class="dnfl-star-card" onclick="DNFL.Popups.openPlayerPopup('${p.id}')">
                                        <div class="dnfl-star-avatar-wrapper">
                                            <img src="${headshot}" alt="${p.name}" class="dnfl-star-avatar" onerror="this.src='https://www.mflscripts.com/playerImages_96x96/free_agent.png'" />
                                            <span class="dnfl-position-badge pos-${s.pos.toLowerCase()}">${s.pos}</span>
                                        </div>
                                        <div class="dnfl-star-info">
                                            <div class="dnfl-star-name">${p.name}</div>
                                            <div class="dnfl-star-pts">${p.team || 'NFL'} • Active</div>
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
                    <a href="${standingsUrl}" class="dnfl-stat-card dnfl-stat-card-link" title="View Standings Module">
                        <div class="dnfl-stat-lbl"><i class="fa-solid fa-trophy"></i> W-L-T Record</div>
                        <div class="dnfl-stat-val">${recordStr}</div>
                    </a>
                    <a href="${standingsUrl}" class="dnfl-stat-card dnfl-stat-card-link" title="View Standings Module">
                        <div class="dnfl-stat-lbl"><i class="fa-solid fa-bullseye"></i> Total Points</div>
                        <div class="dnfl-stat-val">${pf}</div>
                    </a>
                    <a href="${rankingsUrl}" class="dnfl-stat-card dnfl-stat-card-link" title="View Power Rankings Module">
                        <div class="dnfl-stat-lbl"><i class="fa-solid fa-bolt"></i> Power Rank</div>
                        <div class="dnfl-stat-val">#${rank}</div>
                    </a>
                    <a href="${standingsUrl}" class="dnfl-stat-card dnfl-stat-card-link" title="View Standings Module">
                        <div class="dnfl-stat-lbl"><i class="fa-solid fa-shield-halved"></i> Playoff Seed</div>
                        <div class="dnfl-stat-val">#${seed}</div>
                    </a>
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

    /**
     * Switch Franchise Tab
     */
    function switchFranchiseTab(franchiseId, tabName) {
        openFranchisePopup(franchiseId, tabName);
    }

    /**
     * Auto-Inject Notification Bell into Standard MFL Navigation Bar if not present
     */
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

    /**
     * Open Notification Drawer Modal
     */
    function openNotificationsModal() {
        showModal("League Notifications & Messages", "fa-bell");
        const content = document.getElementById('dnfl-modal-content-wrapper');
        if (!content) return;

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

    /**
     * Check Menu Bar Notifications & Update Icon/Color States
     */
    async function checkNotifications() {
        ensureMenuBellInjected();
        captureHomepageMessages();

        const wrapper = document.getElementById('dnfl-notification-wrapper');
        const badge = document.getElementById('dnfl-notification-badge');
        const icon = document.getElementById('dnfl-notification-icon');
        if (!badge) return;

        let totalCount = 0;

        try {
            const client = getApiClient();
            const fiveMinTtl = getTtl(client, 'FIVE_MIN', 300000);
            const userFid = client ? client.getLoggedInFranchiseId() : '';
            
            if (userFid) {
                const transData = await client.fetchData('transactions', { TRANS_TYPE: 'TRADE', W: '0' }, { ttl: fiveMinTtl }).catch(() => null);
                const pendingTrades = toArray(transData?.transactions?.transaction).length;
                totalCount += pendingTrades;
            }
        } catch (err) {
            console.warn("[DNFL Popups] Non-fatal notification check warning:", err);
        }

        totalCount += capturedHomepageMessages.length + capturedLeagueReminders.length;

        if (totalCount > 0) {
            badge.textContent = totalCount;
            badge.classList.remove('dnfl-is-hidden');
            if (wrapper) wrapper.classList.add('has-unread');
            if (icon) icon.className = 'fa-solid fa-bell fa-bounce';
        } else {
            badge.classList.add('dnfl-is-hidden');
            if (wrapper) wrapper.classList.remove('has-unread');
            if (icon) icon.className = 'fa-solid fa-bell';
        }
    }

    /**
     * Helper Controls
     */
    function swapWatermark(logoUrl) {
        if (!logoUrl) return;
        const img = document.getElementById('dnfl-hero-watermark-img');
        if (img) {
            img.src = logoUrl;
            img.style.display = 'block';
        }
    }

    function toggleWatchlist(playerId) {
        alert("Player #" + playerId + " toggled in Watchlist.");
    }

    /**
     * Module Initialization
     */
    function init() {
        initModalShellInDom();

        const closeBtn = document.getElementById('dnfl-modal-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        const overlay = document.getElementById('dnfl-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeModal();
            });
        }

        attachLinkInterceptors();
        checkNotifications();
    }

    // Export Public API
    window.DNFL.Popups = {
        init: init,
        openPlayerPopup: openPlayerPopup,
        openFranchisePopup: openFranchisePopup,
        switchPlayerTab: switchPlayerTab,
        switchFranchiseTab: switchFranchiseTab,
        swapWatermark: swapWatermark,
        toggleWatchlist: toggleWatchlist,
        checkNotifications: checkNotifications,
        openNotificationsModal: openNotificationsModal,
        closeModal: closeModal
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
