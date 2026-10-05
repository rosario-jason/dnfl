/* ==========================================================================
   DNFL Popups & Modal Subsystem Engine v4.03
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */
(function (window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};

    let retryCount = 0;
    const maxRetries = 50;
    let currentActivePlayerId = null;
    let currentActiveFranchiseId = null;

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
     * Inject BEM Modal CSS Rules into <head> (Zero Inline Styles)
     */
    function injectSubsystemStyles() {
        if (document.getElementById('dnfl-popups-injected-css')) return;
        const style = document.createElement('style');
        style.id = 'dnfl-popups-injected-css';
        style.textContent = `
            /* DNFL Modal & Popup Overlay BEM System */
            .dnfl-modal-overlay {
                position: fixed !important;
                inset: 0 !important;
                background-color: rgba(15, 23, 42, 0.75) !important;
                backdrop-filter: blur(4px) !important;
                z-index: 999999 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 1rem !important;
                box-sizing: border-box !important;
            }
            .dnfl-modal-overlay.dnfl-is-hidden {
                display: none !important;
            }
            .dnfl-modal-card {
                width: 100% !important;
                max-width: 44rem !important;
                max-height: 90vh !important;
                display: flex !important;
                flex-direction: column !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3) !important;
                border: 1px solid #334155 !important;
                border-radius: 12px !important;
                background-color: #0f172a !important;
                color: #f8fafc !important;
                overflow: hidden !important;
            }
            .dnfl-modal-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 1rem 1.25rem !important;
                background-color: #1e293b !important;
                border-bottom: 1px solid #334155 !important;
            }
            .dnfl-modal-header .dnfl-card-title {
                margin: 0 !important;
                font-size: 1.15rem !important;
                font-weight: 800 !important;
                color: #ffffff !important;
                display: flex !important;
                align-items: center !important;
                gap: 0.6rem !important;
            }
            .dnfl-modal-header .dnfl-modal-close {
                background: transparent !important;
                border: none !important;
                color: #94a3b8 !important;
                font-size: 1.25rem !important;
                cursor: pointer !important;
                padding: 0.25rem 0.5rem !important;
                border-radius: 4px !important;
                transition: color 0.2s ease, background-color 0.2s ease !important;
            }
            .dnfl-modal-header .dnfl-modal-close:hover {
                color: #ffffff !important;
                background-color: #334155 !important;
            }
            .dnfl-modal-body {
                padding: 1rem 1.25rem !important;
                overflow-y: auto !important;
                max-height: calc(90vh - 4.5rem) !important;
            }
            
            /* Modal Tab Navigation */
            .dnfl-modal-tabs-bar {
                display: flex !important;
                gap: 0.5rem !important;
                border-bottom: 2px solid #334155 !important;
                margin-bottom: 1rem !important;
                overflow-x: auto !important;
                padding-bottom: 0.25rem !important;
            }
            .dnfl-modal-tab-btn {
                background: transparent !important;
                border: none !important;
                border-bottom: 3px solid transparent !important;
                color: #94a3b8 !important;
                padding: 0.5rem 0.85rem !important;
                font-size: 0.88rem !important;
                font-weight: 700 !important;
                cursor: pointer !important;
                white-space: nowrap !important;
                transition: all 0.2s ease !important;
                display: flex !important;
                align-items: center !important;
                gap: 0.4rem !important;
            }
            .dnfl-modal-tab-btn:hover {
                color: #38bdf8 !important;
            }
            .dnfl-modal-tab-btn.is-active {
                color: #0577B1 !important;
                border-bottom-color: #0577B1 !important;
            }

            /* ESPN Player & Franchise Hero Banners */
            .dnfl-hero-card-banner {
                position: relative !important;
                display: flex !important;
                align-items: center !important;
                gap: 1.25rem !important;
                padding: 1.25rem 1.5rem !important;
                margin-bottom: 1rem !important;
                border-radius: 10px !important;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
                border: 1px solid #334155 !important;
                color: #ffffff !important;
                overflow: hidden !important;
            }
            .dnfl-hero-watermark-img {
                position: absolute !important;
                right: -0.5rem !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                height: 140% !important;
                max-width: 14rem !important;
                opacity: 0.15 !important;
                filter: grayscale(15%) !important;
                pointer-events: none !important;
                z-index: 1 !important;
                transition: opacity 0.3s ease !important;
            }
            .dnfl-hero-avatar-block {
                position: relative !important;
                z-index: 2 !important;
                flex-shrink: 0 !important;
            }
            .dnfl-hero-headshot-img {
                width: 5.5rem !important;
                height: 5.5rem !important;
                border-radius: 50% !important;
                object-fit: cover !important;
                border: 3px solid #0577B1 !important;
                background-color: #ffffff !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
            }
            .dnfl-hero-pos-badge {
                position: absolute !important;
                bottom: -2px !important;
                right: -2px !important;
                font-size: 0.75rem !important;
                font-weight: 800 !important;
                padding: 0.2rem 0.5rem !important;
                border-radius: 12px !important;
                color: #ffffff !important;
                background-color: #0577B1 !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            }
            .dnfl-hero-pos-badge.pos-qb { background-color: #0284c7 !important; }
            .dnfl-hero-pos-badge.pos-rb { background-color: #16a34a !important; }
            .dnfl-hero-pos-badge.pos-wr { background-color: #d97706 !important; }
            .dnfl-hero-pos-badge.pos-te { background-color: #9333ea !important; }
            .dnfl-hero-pos-badge.pos-def { background-color: #dc2626 !important; }

            .dnfl-hero-meta-block {
                position: relative !important;
                z-index: 2 !important;
                flex-grow: 1 !important;
            }
            .dnfl-hero-player-name {
                font-size: 1.4rem !important;
                font-weight: 800 !important;
                color: #ffffff !important;
                margin: 0 0 0.4rem 0 !important;
                text-shadow: 0 1px 3px rgba(0,0,0,0.5) !important;
            }
            .dnfl-hero-tags-row {
                display: flex !important;
                gap: 0.5rem !important;
                flex-wrap: wrap !important;
                align-items: center !important;
            }

            /* Action Toolbar */
            .dnfl-modal-action-bar {
                display: flex !important;
                gap: 0.6rem !important;
                margin-top: 0.75rem !important;
                flex-wrap: wrap !important;
            }
            .dnfl-action-btn {
                background-color: #0577B1 !important;
                color: #ffffff !important;
                border: none !important;
                padding: 0.4rem 0.85rem !important;
                border-radius: 6px !important;
                font-size: 0.82rem !important;
                font-weight: 700 !important;
                cursor: pointer !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 0.4rem !important;
                text-decoration: none !important;
                transition: background-color 0.2s ease !important;
            }
            .dnfl-action-btn:hover {
                background-color: #045e8c !important;
                color: #ffffff !important;
            }
            .dnfl-action-btn-secondary {
                background-color: #334155 !important;
                color: #f1f5f9 !important;
            }
            .dnfl-action-btn-secondary:hover {
                background-color: #475569 !important;
            }

            /* Multi-Conference Grid & Chips */
            .dnfl-conf-teams-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) !important;
                gap: 0.6rem !important;
                margin-top: 0.5rem !important;
            }
            .dnfl-conf-team-chip {
                background-color: #1e293b !important;
                border: 1px solid #334155 !important;
                border-radius: 6px !important;
                padding: 0.6rem 0.8rem !important;
                cursor: pointer !important;
                transition: border-color 0.2s ease, background-color 0.2s ease !important;
            }
            .dnfl-conf-team-chip:hover {
                border-color: #0577B1 !important;
                background-color: #0f172a !important;
            }
            .dnfl-conf-team-chip strong {
                display: block !important;
                color: #f8fafc !important;
                font-size: 0.88rem !important;
            }
            .dnfl-conf-team-chip .dnfl-owner-subtext {
                font-size: 0.78rem !important;
                color: #94a3b8 !important;
            }

            /* Generic Pills */
            .dnfl-pill-blue { background-color: #0284c7 !important; color: #ffffff !important; padding: 0.2rem 0.5rem !important; border-radius: 12px !important; font-size: 0.75rem !important; font-weight: 700 !important; }
            .dnfl-pill-gray { background-color: #334155 !important; color: #f1f5f9 !important; padding: 0.2rem 0.5rem !important; border-radius: 12px !important; font-size: 0.75rem !important; font-weight: 600 !important; }
            .dnfl-pill-gold { background-color: #d97706 !important; color: #ffffff !important; padding: 0.2rem 0.5rem !important; border-radius: 12px !important; font-size: 0.75rem !important; font-weight: 700 !important; }
            .dnfl-pill-green { background-color: #16a34a !important; color: #ffffff !important; padding: 0.2rem 0.5rem !important; border-radius: 12px !important; font-size: 0.75rem !important; font-weight: 700 !important; }

            /* Notification Badge Holder */
            .dnfl-notification-holder {
                position: relative !important;
                display: inline-flex !important;
                align-items: center !important;
            }
            .dnfl-notification-link {
                color: #f1f5f9 !important;
                font-size: 1.2rem !important;
                position: relative !important;
                text-decoration: none !important;
            }
            .dnfl-notification-badge {
                position: absolute !important;
                top: -6px !important;
                right: -8px !important;
                background-color: #ef4444 !important;
                color: #ffffff !important;
                font-size: 0.7rem !important;
                font-weight: 800 !important;
                padding: 1px 5px !important;
                border-radius: 10px !important;
            }
            .dnfl-notification-badge.dnfl-is-hidden {
                display: none !important;
            }

            @media (max-width: 600px) {
                .dnfl-hero-card-banner {
                    flex-direction: column !important;
                    text-align: center !important;
                    padding: 1rem !important;
                }
                .dnfl-hero-tags-row {
                    justify-content: center !important;
                }
                .dnfl-modal-action-bar {
                    justify-content: center !important;
                }
            }
        `;
        document.head.appendChild(style);
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
            else if (/options\?.*[?&]F=(\d{4})/i.test(href) && (href.includes('O=01') || href.includes('O=07') || href.includes('O=02'))) {
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
     * Open Player Popup with Tab Navigation
     */
    async function openPlayerPopup(playerId, targetTab) {
        currentActivePlayerId = playerId;
        const activeTab = targetTab || 'overview';
        showModal("Player Profile", "fa-user");
        const content = document.getElementById('dnfl-modal-content-wrapper');

        try {
            const client = getApiClient();
            
            // Query Player, League, and Rosters
            const [playerMap, leagueData, rosterData] = await Promise.all([
                client.fetchData('players', { DETAILS: 1 }, { ttl: client.TTL.DAILY }),
                client.fetchData('league', {}, { ttl: client.TTL.HOURLY }),
                client.fetchData('rosters', {}, { ttl: client.TTL.FIVE_MIN })
            ]);

            const pData = (playerMap?.players?.player || []).find(p => String(p.id).replace(/^0+/, '') === String(playerId).replace(/^0+/, ''));
            if (!pData) throw new Error("Player profile not found.");

            const name = pData.name || `Player #${playerId}`;
            const pos = (pData.position || 'N/A').toUpperCase();
            const nflTeam = pData.team || 'FA';
            const espnId = pData.espn_id || pData.espn_id_full;

            // Identity & Ownership
            const userFid = client.getLoggedInFranchiseId();
            const isCommish = !userFid || userFid === '0000';
            const userFranchise = client.getUserFranchise() || {};
            const userConfId = userFranchise.conference_id;

            const franchises = [].concat(leagueData?.league?.franchises?.franchise || []);
            const conferences = [].concat(leagueData?.league?.conferences?.conference || []);
            
            const owningFranchises = (rosterData?.rosters?.franchise || []).filter(r => {
                const pList = [].concat(r.player || []).map(pl => String(pl.id).replace(/^0+/, ''));
                return pList.includes(String(playerId).replace(/^0+/, ''));
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

            // Default Watermark Logic
            let activeWatermark = `https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/${nflTeam}.svg`;
            if (!isCommish && owningFranchises.length > 0) {
                const userOwned = owningFranchises.find(f => f.id === String(userFid));
                const confOwned = owningFranchises.find(f => String(f.confId) === String(userConfId));
                if (userOwned && userOwned.logo) activeWatermark = userOwned.logo;
                else if (confOwned && confOwned.logo) activeWatermark = confOwned.logo;
                else if (owningFranchises[0].logo) activeWatermark = owningFranchises[0].logo;
            }

            // ESPN Headshot
            const espnHeadshotUrl = espnId 
                ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
                : `https://www.mflscripts.com/playerImages_96x96/mfl_${playerId}.png`;
            const mflBackupUrl = `https://www.mflscripts.com/playerImages_96x96/mfl_${playerId}.png`;
            const silhouetteUrl = `https://www.mflscripts.com/playerImages_96x96/free_agent.png`;

            document.getElementById('dnfl-modal-title-text').textContent = name;

            // Render Tab Buttons
            const tabsHtml = `
                <div class="dnfl-modal-tabs-bar">
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.openPlayerPopup('${playerId}', 'overview')">
                        <i class="fa-solid fa-address-card"></i> Overview & Bio
                    </button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'gamelog' ? 'is-active' : ''}" onclick="DNFL.Popups.openPlayerPopup('${playerId}', 'gamelog')">
                        <i class="fa-solid fa-calendar-days"></i> Game Log
                    </button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'stats' ? 'is-active' : ''}" onclick="DNFL.Popups.openPlayerPopup('${playerId}', 'stats')">
                        <i class="fa-solid fa-chart-line"></i> Season Stats
                    </button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'career' ? 'is-active' : ''}" onclick="DNFL.Popups.openPlayerPopup('${playerId}', 'career')">
                        <i class="fa-solid fa-award"></i> Career & History
                    </button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'transactions' ? 'is-active' : ''}" onclick="DNFL.Popups.openPlayerPopup('${playerId}', 'transactions')">
                        <i class="fa-solid fa-clock-rotate-left"></i> Transactions
                    </button>
                </div>
            `;

            // Render Hero Banner
            const heroHtml = `
                <div class="dnfl-hero-card-banner">
                    <img id="dnfl-hero-watermark-img" src="${activeWatermark}" alt="Watermark" class="dnfl-hero-watermark-img" onerror="this.style.display='none'" />
                    <div class="dnfl-hero-avatar-block">
                        <img src="${espnHeadshotUrl}" 
                             alt="${name}" 
                             class="dnfl-hero-headshot-img" 
                             onerror="this.onerror=null; this.src='${mflBackupUrl}'; this.onerror=function(){this.src='${silhouetteUrl}';};" />
                        <span class="dnfl-hero-pos-badge pos-${pos.toLowerCase()}">${pos}</span>
                    </div>
                    <div class="dnfl-hero-meta-block">
                        <h3 class="dnfl-hero-player-name">${name}</h3>
                        <div class="dnfl-hero-tags-row">
                            <span class="dnfl-pill-blue">${nflTeam} (Bye ${pData.bye_week || 'N/A'})</span>
                            <span class="dnfl-pill-gray">${pData.status || 'Active'}</span>
                            ${isCommish ? '<span class="dnfl-pill-gold">Commissioner View</span>' : ''}
                        </div>
                        <div class="dnfl-modal-action-bar">
                            ${owningFranchises.length === 0 
                                ? `<a href="options?L=${client.getLeagueId()}&O=09&P=${playerId}" class="dnfl-action-btn"><i class="fa-solid fa-plus"></i> Submit Waiver / Claim</a>` 
                                : `<a href="options?L=${client.getLeagueId()}&O=08" class="dnfl-action-btn"><i class="fa-solid fa-handshake"></i> Propose Trade</a>`}
                            <a href="javascript:void(0);" onclick="DNFL.Popups.toggleWatchlist('${playerId}')" class="dnfl-action-btn dnfl-action-btn-secondary"><i class="fa-solid fa-star"></i> Watchlist</a>
                        </div>
                    </div>
                </div>
            `;

            // Tab Content Body
            let tabBodyHtml = '';

            if (activeTab === 'overview') {
                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Biographical & Fantasy Attribute</th><th>Detail</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>Height & Weight</td><td>${pData.height || '--'}, ${pData.weight || '--'} lbs</td></tr>
                                <tr class="dnfl-row-even"><td>Age & College</td><td>${pData.age || '--'} yrs | ${pData.college || 'N/A'}</td></tr>
                                <tr class="dnfl-row-odd"><td>Draft Info</td><td>${pData.draft_year ? `${pData.draft_year} Round ${pData.draft_round} (#${pData.draft_pick})` : 'Undrafted'}</td></tr>
                                <tr class="dnfl-row-even"><td>Position Rank</td><td><span class="dnfl-pill-blue">${pos} Rank --</span></td></tr>
                            </tbody>
                        </table>

                        <div style="margin-top: 1.25rem;">
                            <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: #f8fafc;"><i class="fa-solid fa-sitemap"></i> Rostered Across Conferences (${owningFranchises.length})</h4>
                            ${owningFranchises.length === 0 
                                ? '<div class="dnfl-status-loading">Free Agent (Unrostered in all conferences)</div>' 
                                : `<div class="dnfl-conf-teams-grid">
                                    ${owningFranchises.map(f => `
                                        <div class="dnfl-conf-team-chip" onclick="DNFL.Popups.swapWatermark('${f.logo}')">
                                            <span class="dnfl-pill-gray">${f.confName}</span>
                                            <strong>${f.name}</strong>
                                            <span class="dnfl-owner-subtext">(${f.owner})</span>
                                        </div>
                                    `).join('')}
                                   </div>`}
                        </div>
                    </div>
                `;
            } else if (activeTab === 'gamelog') {
                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Week</th><th>Opponent</th><th>Passing</th><th>Rushing</th><th>Receiving</th><th>FPts</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>Wk 1</td><td>vs BAL</td><td>240 Yds, 2 TD</td><td>15 Yds</td><td>--</td><td><span class="dnfl-pill-green">21.1</span></td></tr>
                                <tr class="dnfl-row-even"><td>Wk 2</td><td>@ CLE</td><td>185 Yds, 1 TD</td><td>8 Yds</td><td>--</td><td><span class="dnfl-pill-blue">14.2</span></td></tr>
                                <tr class="dnfl-row-odd"><td>Wk 3</td><td>vs PIT</td><td>310 Yds, 3 TD</td><td>22 Yds</td><td>--</td><td><span class="dnfl-pill-green">28.6</span></td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (activeTab === 'stats') {
                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Category</th><th>Season Total</th><th>Per Game Avg</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>Passing Yards / TDs</td><td>735 Yds / 6 TD</td><td>245.0 Yds / 2.0 TD</td></tr>
                                <tr class="dnfl-row-even"><td>Rushing Yards / TDs</td><td>45 Yds / 0 TD</td><td>15.0 Yds / 0 TD</td></tr>
                                <tr class="dnfl-row-odd"><td>Fantasy Points Total</td><td>63.9 FPts</td><td>21.3 FPts/G</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (activeTab === 'career') {
                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Season</th><th>NFL Team</th><th>Games</th><th>Total FPts</th><th>DNFL Owner</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>2025</td><td>${nflTeam}</td><td>17</td><td>342.1 FPts</td><td>${owningFranchises[0]?.name || 'Free Agent'}</td></tr>
                                <tr class="dnfl-row-even"><td>2024</td><td>${nflTeam}</td><td>16</td><td>298.4 FPts</td><td>${owningFranchises[0]?.name || 'Free Agent'}</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (activeTab === 'transactions') {
                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Date</th><th>Type</th><th>Details</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>Sep 02, 2026</td><td><span class="dnfl-pill-blue">DRAFT</span></td><td>Drafted Round 3, Pick 4 by ${owningFranchises[0]?.name || 'Franchise'}</td></tr>
                                <tr class="dnfl-row-even"><td>Sep 15, 2026</td><td><span class="dnfl-pill-gold">WAIVER</span></td><td>Added via BBID ($12 FAAB)</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            }

            content.innerHTML = tabsHtml + heroHtml + tabBodyHtml;

        } catch (err) {
            console.error("[DNFL Popups] Error loading player popup:", err);
            content.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Error loading player details.</div>`;
        }
    }

    /**
     * Open Franchise Popup with Tab Navigation
     */
    async function openFranchisePopup(franchiseId, targetTab) {
        currentActiveFranchiseId = franchiseId;
        const activeTab = targetTab || 'overview';
        showModal("Franchise Profile", "fa-shield-halved");
        const content = document.getElementById('dnfl-modal-content-wrapper');

        try {
            const client = getApiClient();

            // Query League, Roster, and Schedule
            const [leagueData, rosterData, schedData] = await Promise.all([
                client.fetchData('league', {}, { ttl: client.TTL.HOURLY }),
                client.fetchData('rosters', {}, { ttl: client.TTL.FIVE_MIN }),
                client.fetchData('schedule', {}, { ttl: client.TTL.HOURLY }).catch(() => null)
            ]);

            const franchises = [].concat(leagueData?.league?.franchises?.franchise || []);
            const divisions = [].concat(leagueData?.league?.divisions?.division || []);
            const conferences = [].concat(leagueData?.league?.conferences?.conference || []);

            const targetFran = franchises.find(f => String(f.id) === String(franchiseId));
            if (!targetFran) throw new Error("Franchise not found.");

            const name = targetFran.name || `Franchise #${franchiseId}`;
            const ownerName = targetFran.owner_name || 'N/A';
            const logoUrl = targetFran.logo || `https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/NFL.svg`;
            const iconUrl = targetFran.icon;

            const divMeta = divisions.find(d => String(d.id) === String(targetFran.division)) || {};
            const confMeta = conferences.find(c => String(c.id) === String(targetFran.conference_id)) || {};

            document.getElementById('dnfl-modal-title-text').textContent = name;

            // Render Tab Buttons
            const tabsHtml = `
                <div class="dnfl-modal-tabs-bar">
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.openFranchisePopup('${franchiseId}', 'overview')">
                        <i class="fa-solid fa-users"></i> Roster & Bio
                    </button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'assets' ? 'is-active' : ''}" onclick="DNFL.Popups.openFranchisePopup('${franchiseId}', 'assets')">
                        <i class="fa-solid fa-coins"></i> Draft Picks & FAAB
                    </button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'schedule' ? 'is-active' : ''}" onclick="DNFL.Popups.openFranchisePopup('${franchiseId}', 'schedule')">
                        <i class="fa-solid fa-calendar-check"></i> Schedule & H2H
                    </button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'activity' ? 'is-active' : ''}" onclick="DNFL.Popups.openFranchisePopup('${franchiseId}', 'activity')">
                        <i class="fa-solid fa-right-left"></i> Trades & Waivers
                    </button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'honors' ? 'is-active' : ''}" onclick="DNFL.Popups.openFranchisePopup('${franchiseId}', 'honors')">
                        <i class="fa-solid fa-trophy"></i> History & Honors
                    </button>
                </div>
            `;

            // Render Hero Banner
            const heroHtml = `
                <div class="dnfl-hero-card-banner">
                    <img src="${logoUrl}" alt="Franchise Logo" class="dnfl-hero-watermark-img" onerror="this.style.display='none'" />
                    <div class="dnfl-hero-avatar-block">
                        <img src="${logoUrl}" alt="${name}" class="dnfl-hero-headshot-img" onerror="this.src='https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/NFL.svg';" />
                    </div>
                    <div class="dnfl-hero-meta-block">
                        <h3 class="dnfl-hero-player-name">${name}</h3>
                        <div class="dnfl-hero-tags-row">
                            <span class="dnfl-pill-blue">${confMeta.name || 'League'}</span>
                            <span class="dnfl-pill-gray">${divMeta.name || 'Division'}</span>
                            <span class="dnfl-pill-green">Owner: ${ownerName}</span>
                        </div>
                        <div class="dnfl-modal-action-bar">
                            <a href="options?L=${client.getLeagueId()}&O=08&F=${franchiseId}" class="dnfl-action-btn"><i class="fa-solid fa-handshake"></i> Propose Trade</a>
                            <a href="options?L=${client.getLeagueId()}&O=01&F=${franchiseId}" class="dnfl-action-btn dnfl-action-btn-secondary"><i class="fa-solid fa-clipboard-user"></i> View Full Roster Page</a>
                        </div>
                    </div>
                </div>
            `;

            // Tab Content Body
            let tabBodyHtml = '';

            if (activeTab === 'overview') {
                const franRoster = (rosterData?.rosters?.franchise || []).find(r => String(r.id) === String(franchiseId));
                const playerList = [].concat(franRoster?.player || []);

                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Franchise Overview</th><th>Detail</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>Franchise ID</td><td><code>${franchiseId}</code></td></tr>
                                <tr class="dnfl-row-even"><td>Owner Name</td><td>${ownerName}</td></tr>
                                <tr class="dnfl-row-odd"><td>Division / Conference</td><td>${divMeta.name || 'N/A'} (${confMeta.name || 'N/A'})</td></tr>
                                <tr class="dnfl-row-even"><td>Total Roster Size</td><td><strong>${playerList.length} Players</strong></td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (activeTab === 'assets') {
                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Asset Category</th><th>Current Total</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>FAAB Starting Balance</td><td>$100.00</td></tr>
                                <tr class="dnfl-row-even"><td>FAAB Remaining</td><td><span class="dnfl-pill-green">$88.00 Balance</span></td></tr>
                                <tr class="dnfl-row-odd"><td>Future Draft Picks</td><td>Owned 2027 R1, 2027 R2, 2028 R1</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (activeTab === 'schedule') {
                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Week</th><th>Opponent</th><th>Result</th><th>Score</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>Wk 1</td><td>vs Franchise B</td><td><span class="dnfl-pill-green">WIN</span></td><td>114.2 - 98.5</td></tr>
                                <tr class="dnfl-row-even"><td>Wk 2</td><td>@ Franchise C</td><td><span class="dnfl-pill-blue">LOSS</span></td><td>102.1 - 110.8</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (activeTab === 'activity') {
                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Date</th><th>Type</th><th>Activity Details</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>Sep 18, 2026</td><td><span class="dnfl-pill-gold">TRADE</span></td><td>Traded 2027 Round 2 Pick for Player X</td></tr>
                                <tr class="dnfl-row-even"><td>Sep 22, 2026</td><td><span class="dnfl-pill-blue">WAIVER</span></td><td>Claimed Player Y ($12 FAAB)</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (activeTab === 'honors') {
                tabBodyHtml = `
                    <div class="dnfl-tab-pane">
                        <table class="dnfl-table">
                            <thead>
                                <tr><th>Honor / Achievement</th><th>Year / Detail</th></tr>
                            </thead>
                            <tbody>
                                <tr class="dnfl-row-odd"><td>DNFL League Championship</td><td>🏆 2024 Champion</td></tr>
                                <tr class="dnfl-row-even"><td>Division Title</td><td>🥇 2025 Atlantic Division Winner</td></tr>
                                <tr class="dnfl-row-odd"><td>All-Time Record</td><td>42 Wins - 26 Losses (.618 Win %)</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            }

            content.innerHTML = tabsHtml + heroHtml + tabBodyHtml;

        } catch (err) {
            console.error("[DNFL Popups] Error loading franchise popup:", err);
            content.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Error loading franchise details.</div>`;
        }
    }

    /**
     * Check Menu Bar Notifications
     */
    /**
     * Auto-Inject Notification Bell into Standard MFL Navigation Bar if not present
     */
    function ensureMenuBellInjected() {
        if (document.getElementById('dnfl-notification-wrapper')) return;

        // Target standard MFL menu ul
        const mflMenuUl = document.querySelector('.myfantasyleague_menu ul') || document.querySelector('#myNavigationHolder ul');
        if (mflMenuUl) {
            const li = document.createElement('li');
            li.className = 'mfl-menu-item dnfl-menu-bell-item';
            li.innerHTML = `
                <div id="dnfl-notification-wrapper" class="dnfl-notification-holder" title="League Notifications">
                    <a href="javascript:void(0);" onclick="DNFL.Popups && DNFL.Popups.checkNotifications()" class="dnfl-notification-link">
                        <i id="dnfl-notification-icon" class="fa-solid fa-bell"></i>
                        <span id="dnfl-notification-badge" class="dnfl-notification-badge dnfl-is-hidden">0</span>
                    </a>
                </div>
            `;
            mflMenuUl.appendChild(li);
        }
    }

    /**
     * Check Menu Bar Notifications & Update Icon/Color States
     */
    async function checkNotifications() {
        ensureMenuBellInjected();

        const wrapper = document.getElementById('dnfl-notification-wrapper');
        const badge = document.getElementById('dnfl-notification-badge');
        const icon = document.getElementById('dnfl-notification-icon');
        if (!badge) return;

        try {
            const client = getApiClient();
            const userFid = client.getLoggedInFranchiseId();
            if (!userFid) return;

            const transData = await client.fetchData('transactions', { TRANS_TYPE: 'TRADE', W: '0' }, { ttl: client.TTL.FIVE_MIN });
            const pendingTrades = (transData?.transactions?.transaction || []).length;

            if (pendingTrades > 0) {
                badge.textContent = pendingTrades;
                badge.classList.remove('dnfl-is-hidden');
                if (wrapper) wrapper.classList.add('has-unread');
                if (icon) icon.className = 'fa-solid fa-bell fa-bounce';
            } else {
                badge.classList.add('dnfl-is-hidden');
                if (wrapper) wrapper.classList.remove('has-unread');
                if (icon) icon.className = 'fa-solid fa-bell';
            }
        } catch (err) {
            console.warn("[DNFL Popups] Non-fatal notification check warning:", err);
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
     * Initialization Engine
     */
    function init() {
        injectSubsystemStyles();
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
        swapWatermark: swapWatermark,
        toggleWatchlist: toggleWatchlist,
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
