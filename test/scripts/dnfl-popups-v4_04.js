/* ==========================================================================
   DNFL Popups & Modal Subsystem Engine v4.04
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
            throw new Error("[DNFL Popups] DNFL.Client API middleware is required but unavailable.");
        }
        return client;
    }

    /**
     * Inject Subsystem Dynamic CSS for Fallbacks
     */
    function injectSubsystemStyles() {
        if (document.getElementById('dnfl-popups-dynamic-css')) return;
        const style = document.createElement('style');
        style.id = 'dnfl-popups-dynamic-css';
        style.textContent = `
            /* DNFL Popups Dynamic Overlay Base Reset */
            .dnfl-modal-overlay {
                position: fixed !important;
                inset: 0 !important;
                background-color: rgba(15, 23, 42, 0.8) !important;
                backdrop-filter: blur(5px) !important;
                -webkit-backdrop-filter: blur(5px) !important;
                z-index: 999999 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 1rem !important;
                opacity: 1;
                transition: opacity 0.25s ease !important;
            }
            .dnfl-modal-overlay.dnfl-is-hidden {
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            .dnfl-modal-card {
                width: 100% !important;
                max-width: 44rem !important;
                max-height: 90vh !important;
                background: #ffffff !important;
                border-radius: 12px !important;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                border: 1px solid #cbd5e1 !important;
                color: #0f172a !important;
                font-family: Arial, Helvetica, sans-serif !important;
            }
            .dnfl-modal-header {
                padding: 1rem 1.25rem !important;
                background: #0f172a !important;
                color: #ffffff !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                border-bottom: 3px solid #0577B1 !important;
            }
            .dnfl-modal-header h3 {
                margin: 0 !important;
                font-size: 1.15rem !important;
                font-weight: 700 !important;
                color: #ffffff !important;
                display: flex !important;
                align-items: center !important;
                gap: 0.6rem !important;
            }
            .dnfl-modal-close {
                background: transparent !important;
                border: none !important;
                color: #94a3b8 !important;
                font-size: 1.25rem !important;
                cursor: pointer !important;
                padding: 0.25rem 0.5rem !important;
                border-radius: 4px !important;
                transition: color 0.2s ease !important;
            }
            .dnfl-modal-close:hover {
                color: #ffffff !important;
            }
            .dnfl-modal-body {
                padding: 1.25rem !important;
                overflow-y: auto !important;
                max-height: calc(90vh - 4.5rem) !important;
            }
            .dnfl-menu-bell-item {
                display: inline-flex !important;
                align-items: center !important;
            }
            .dnfl-notification-link {
                position: relative !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 0.5rem 0.75rem !important;
                color: #94a3b8 !important;
                text-decoration: none !important;
                font-size: 1.1rem !important;
                transition: color 0.2s ease !important;
            }
            .dnfl-notification-holder.has-unread .dnfl-notification-link {
                color: #f59e0b !important;
            }
            .dnfl-notification-badge {
                position: absolute !important;
                top: 2px !important;
                right: 2px !important;
                background-color: #ef4444 !important;
                color: #ffffff !important;
                font-size: 0.7rem !important;
                font-weight: 800 !important;
                padding: 0.1rem 0.35rem !important;
                border-radius: 9999px !important;
                line-height: 1 !important;
                box-shadow: 0 0 0 2px #0f172a !important;
            }
            .dnfl-notification-badge.dnfl-is-hidden {
                display: none !important;
            }
            
            /* Player Hero Card Styling */
            .dnfl-player-hero-card {
                position: relative !important;
                display: flex !important;
                align-items: center !important;
                gap: 1.25rem !important;
                padding: 1.25rem !important;
                margin-bottom: 1rem !important;
                border-radius: 8px !important;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
                color: #ffffff !important;
                overflow: hidden !important;
            }
            .dnfl-hero-watermark {
                position: absolute !important;
                right: -1rem !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                height: 140% !important;
                max-width: 14rem !important;
                opacity: 0.15 !important;
                pointer-events: none !important;
                z-index: 1 !important;
            }
            .dnfl-hero-avatar-wrapper {
                position: relative !important;
                z-index: 2 !important;
                flex-shrink: 0 !important;
            }
            .dnfl-hero-headshot {
                width: 5.5rem !important;
                height: 5.5rem !important;
                border-radius: 50% !important;
                object-fit: cover !important;
                border: 3px solid #0577B1 !important;
                background-color: #ffffff !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
            }
            .dnfl-position-badge {
                position: absolute !important;
                bottom: -2px !important;
                right: -2px !important;
                font-size: 0.75rem !important;
                font-weight: 800 !important;
                padding: 0.2rem 0.45rem !important;
                border-radius: 12px !important;
                color: #ffffff !important;
                background-color: #0577B1 !important;
            }
            .pos-qb { background-color: #0284c7 !important; }
            .pos-rb { background-color: #16a34a !important; }
            .pos-wr { background-color: #d97706 !important; }
            .pos-te { background-color: #9333ea !important; }
            .pos-def { background-color: #dc2626 !important; }
            
            .dnfl-hero-meta {
                position: relative !important;
                z-index: 2 !important;
            }
            .dnfl-hero-name {
                font-size: 1.35rem !important;
                font-weight: 800 !important;
                color: #ffffff !important;
                margin: 0 0 0.4rem 0 !important;
            }
            .dnfl-hero-tags {
                display: flex !important;
                gap: 0.5rem !important;
                flex-wrap: wrap !important;
            }
            
            /* Tabs Toolbar */
            .dnfl-modal-tabs {
                display: flex !important;
                gap: 0.5rem !important;
                margin-bottom: 1rem !important;
                border-bottom: 2px solid #e2e8f0 !important;
                padding-bottom: 0.5rem !important;
                overflow-x: auto !important;
            }
            .dnfl-modal-tab-btn {
                background: #f1f5f9 !important;
                color: #475569 !important;
                border: 1px solid #cbd5e1 !important;
                padding: 0.4rem 0.85rem !important;
                border-radius: 6px !important;
                font-weight: 700 !important;
                font-size: 0.85rem !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                white-space: nowrap !important;
            }
            .dnfl-modal-tab-btn.is-active {
                background: #0577B1 !important;
                color: #ffffff !important;
                border-color: #0577B1 !important;
            }

            /* Multi-Conference Grid */
            .dnfl-multi-conf-wrapper {
                margin-top: 1rem !important;
                padding-top: 1rem !important;
                border-top: 1px solid #e2e8f0 !important;
            }
            .dnfl-conf-teams-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important;
                gap: 0.75rem !important;
                margin-top: 0.5rem !important;
            }
            .dnfl-conf-team-chip {
                background: #f8fafc !important;
                border: 1px solid #cbd5e1 !important;
                padding: 0.6rem 0.8rem !important;
                border-radius: 6px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 0.25rem !important;
                cursor: pointer !important;
                transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
            }
            .dnfl-conf-team-chip:hover {
                border-color: #0577B1 !important;
                box-shadow: 0 2px 8px rgba(5, 119, 177, 0.15) !important;
            }
            .dnfl-pill-gray {
                display: inline-block !important;
                background: #e2e8f0 !important;
                color: #334155 !important;
                font-size: 0.7rem !important;
                font-weight: 700 !important;
                padding: 0.15rem 0.4rem !important;
                border-radius: 4px !important;
                width: fit-content !important;
            }
            .dnfl-pill-blue {
                display: inline-block !important;
                background: #0577B1 !important;
                color: #ffffff !important;
                font-size: 0.7rem !important;
                font-weight: 700 !important;
                padding: 0.15rem 0.4rem !important;
                border-radius: 4px !important;
            }
            .dnfl-pill-gold {
                display: inline-block !important;
                background: #d97706 !important;
                color: #ffffff !important;
                font-size: 0.7rem !important;
                font-weight: 700 !important;
                padding: 0.15rem 0.4rem !important;
                border-radius: 4px !important;
            }
            .dnfl-status-error {
                padding: 1rem !important;
                background: #fef2f2 !important;
                border: 1px solid #fca5a5 !important;
                color: #991b1b !important;
                border-radius: 6px !important;
            }
            .dnfl-status-loading {
                padding: 1.5rem !important;
                text-align: center !important;
                color: #64748b !important;
            }

            /* Homepage Message Notification Card */
            .dnfl-hpm-card {
                background: #f8fafc !important;
                border-left: 4px solid #0577B1 !important;
                padding: 0.85rem 1rem !important;
                margin-bottom: 0.85rem !important;
                border-radius: 0 6px 6px 0 !important;
                border-top: 1px solid #e2e8f0 !important;
                border-right: 1px solid #e2e8f0 !important;
                border-bottom: 1px solid #e2e8f0 !important;
            }
            .dnfl-hpm-title {
                font-size: 0.95rem !important;
                font-weight: 700 !important;
                color: #0f172a !important;
                margin: 0 0 0.4rem 0 !important;
                display: flex !important;
                align-items: center !important;
                gap: 0.5rem !important;
            }

            /* Auto-hide homepage message containers on page body */
            #body_home .homepagemessage,
            #league_reminders {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
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

            // 1. Intercept Player Links
            if (/player\?.*[?&]P=(\d+)/i.test(href) || /launch_player_modal/i.test(href)) {
                const match = href.match(/[?&]P=(\d+)/i) || href.match(/launch_player_modal\('?\d*'?,?'?(\d+)'?\)/i);
                if (match && match[1]) {
                    e.preventDefault();
                    e.stopPropagation();
                    openPlayerPopup(match[1]);
                }
            }

            // 2. Intercept Franchise Links
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
     * Open Player Modal
     */
    async function openPlayerPopup(playerId, activeTab) {
        activeTab = activeTab || 'overview';
        showModal("Player Intelligence", "fa-user-ninja");
        const content = document.getElementById('dnfl-modal-content-wrapper');

        content.innerHTML = `
            <div class="dnfl-status-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Loading player profile #${playerId}...
            </div>
        `;

        try {
            const client = getApiClient();
            
            const [playerMap, leagueData, rosterData] = await Promise.all([
                client.fetchData('players', { DETAILS: 1 }, { ttl: client.TTL.DAILY }),
                client.fetchData('league', {}, { ttl: client.TTL.HOURLY }),
                client.fetchData('rosters', {}, { ttl: client.TTL.FIVE_MIN })
            ]);

            const pData = (playerMap?.players?.player || []).find(p => String(p.id).replace(/^0+/, '') === String(playerId).replace(/^0+/, ''));
            if (!pData) throw new Error("Player data not found in league database.");

            const name = pData.name || `Player #${playerId}`;
            const pos = (pData.position || 'N/A').toUpperCase();
            const nflTeam = pData.team || 'FA';
            const espnId = pData.espn_id || pData.espn_id_full;

            const userFid = client.getLoggedInFranchiseId();
            const isCommish = !userFid || userFid === '0000';
            const userFranchise = client.getUserFranchise() || {};
            const userConfId = userFranchise.conference_id;

            const franchises = [].concat(leagueData?.league?.franchises?.franchise || []);
            const conferences = [].concat(leagueData?.league?.conferences?.conference || []);

            const owningFranchises = (rosterData?.rosters?.franchise || []).filter(r => {
                const playerList = [].concat(r.player || []).map(pl => String(pl.id).replace(/^0+/, ''));
                return playerList.includes(String(playerId).replace(/^0+/, ''));
            }).map(r => {
                const franMeta = franchises.find(f => String(f.id) === String(r.id)) || {};
                const confMeta = conferences.find(c => String(c.id) === String(franMeta.conference_id)) || {};
                return {
                    id: String(r.id),
                    name: franMeta.name || `Franchise #${r.id}`,
                    logo: franMeta.logo,
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

            document.getElementById('dnfl-modal-title-text').textContent = name;

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
     * Render Player Tab Inner HTML
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
                                <span style="font-size: 0.75rem; color: #64748b;">Owner: ${f.owner}</span>
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
                    <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 0.5rem 0;"><i class="fa-solid fa-sitemap"></i> Rostered Across Conferences (${owningFranchises.length})</h4>
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
     * Switch Player Popup Tab
     */
    function switchPlayerTab(playerId, tabName) {
        openPlayerPopup(playerId, tabName);
    }

    /**
     * Open Franchise Modal
     */
    async function openFranchisePopup(franchiseId) {
        showModal("Franchise Scouting Report", "fa-shield-halved");
        const content = document.getElementById('dnfl-modal-content-wrapper');

        content.innerHTML = `
            <div class="dnfl-status-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Loading franchise #${franchiseId}...
            </div>
        `;

        try {
            const client = getApiClient();
            const [leagueData, rosterData] = await Promise.all([
                client.fetchData('league', {}, { ttl: client.TTL.HOURLY }),
                client.fetchData('rosters', { FRANCHISE: franchiseId }, { ttl: client.TTL.FIVE_MIN }).catch(() => null)
            ]);

            const franchises = [].concat(leagueData?.league?.franchises?.franchise || []);
            const targetFran = franchises.find(f => String(f.id) === String(franchiseId));
            if (!targetFran) throw new Error("Franchise not found.");

            const name = targetFran.name || `Franchise #${franchiseId}`;
            const logo = targetFran.logo || targetFran.icon;

            document.getElementById('dnfl-modal-title-text').textContent = name;

            content.innerHTML = `
                <div class="dnfl-player-hero-card">
                    ${logo ? `<img src="${logo}" alt="${name}" class="dnfl-hero-watermark" onerror="this.style.display='none'" />` : ''}
                    <div class="dnfl-hero-avatar-wrapper">
                        <img src="${logo || 'https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/FA.svg'}" alt="${name}" class="dnfl-hero-headshot" onerror="this.src='https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/FA.svg'" />
                    </div>
                    <div class="dnfl-hero-meta">
                        <h3 class="dnfl-hero-name">${name}</h3>
                        <div class="dnfl-hero-tags">
                            <span class="dnfl-pill-blue">Owner: ${targetFran.owner_name || 'N/A'}</span>
                            <span class="dnfl-pill-gold">${targetFran.division ? `Division ${targetFran.division}` : 'League Member'}</span>
                        </div>
                    </div>
                </div>

                <table class="dnfl-table">
                    <tbody>
                        <tr class="dnfl-row-odd"><td><strong>Franchise ID</strong></td><td><code>${franchiseId}</code></td></tr>
                        <tr class="dnfl-row-even"><td><strong>Owner Name</strong></td><td>${targetFran.owner_name || 'N/A'}</td></tr>
                        <tr class="dnfl-row-odd"><td><strong>Division</strong></td><td>${targetFran.division || 'N/A'}</td></tr>
                    </tbody>
                </table>
            `;
        } catch (err) {
            content.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Error loading franchise profile.</div>`;
        }
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

        let html = '';

        if (capturedLeagueReminders.length > 0) {
            html += `
                <div style="margin-bottom: 1.25rem;">
                    <h4 style="font-size: 1rem; font-weight: 700; color: #0577B1; margin: 0 0 0.5rem 0;"><i class="fa-solid fa-triangle-exclamation"></i> League Reminders</h4>
                    ${capturedLeagueReminders.map(rem => `<div class="dnfl-hpm-card">${rem}</div>`).join('')}
                </div>
            `;
        }

        if (capturedHomepageMessages.length > 0) {
            html += `
                <div style="margin-bottom: 1.25rem;">
                    <h4 style="font-size: 1rem; font-weight: 700; color: #0577B1; margin: 0 0 0.5rem 0;"><i class="fa-solid fa-bullhorn"></i> Commissioner & Homepage Messages</h4>
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
                    <i class="fa-solid fa-bell-slash" style="font-size: 2rem; margin-bottom: 0.5rem; color: #94a3b8;"></i><br/>
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
            const userFid = client.getLoggedInFranchiseId();
            if (userFid) {
                const transData = await client.fetchData('transactions', { TRANS_TYPE: 'TRADE', W: '0' }, { ttl: client.TTL.FIVE_MIN }).catch(() => null);
                const pendingTrades = (transData?.transactions?.transaction || []).length;
                totalCount += pendingTrades;
            }
        } catch (err) {
            console.warn("[DNFL Popups] Non-fatal transaction check notice:", err);
        }

        totalCount += capturedHomepageMessages.length;
        totalCount += capturedLeagueReminders.length;

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

    function showModal(title, iconClass) {
        const overlay = document.getElementById('dnfl-modal-overlay');
        const titleEl = document.getElementById('dnfl-modal-title-text');
        const iconEl = document.getElementById('dnfl-modal-icon');

        if (titleEl) titleEl.textContent = title;
        if (iconEl) iconEl.className = `fa-solid ${iconClass}`;
        if (overlay) overlay.classList.remove('dnfl-is-hidden');
    }

    function closeModal() {
        const overlay = document.getElementById('dnfl-modal-overlay');
        if (overlay) overlay.classList.add('dnfl-is-hidden');
    }

    /**
     * Module Initialization
     */
    function init() {
        injectSubsystemStyles();
        captureHomepageMessages();

        let overlay = document.getElementById('dnfl-modal-overlay');
        if (!overlay) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        const closeBtn = document.getElementById('dnfl-modal-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
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
        swapWatermark: swapWatermark,
        openNotificationsModal: openNotificationsModal,
        checkNotifications: checkNotifications,
        closeModal: closeModal
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
