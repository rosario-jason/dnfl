/* ==========================================================================
   DNFL Popups Subsystem v4.18
   Duke Networking Fantasy League (DNFL) Architecture
   ========================================================================== */

(function () {
    'use strict';

    window.DNFL = window.DNFL || {};

    let isInitialized = false; // will be JS boolean below
    let capturedLeagueReminders = [];
    let capturedHomepageMessages = [];

    function getApiClient() {
        if (window.DNFLClient) return window.DNFLClient;
        if (window.DNFL && window.DNFL.Client) return window.DNFL.Client;
        return {
            fetchData: async function (type, params, opts) {
                const year = window.DNFL_YEAR || new Date().getFullYear();
                const leagueId = window.DNFL_LEAGUE_ID || (window.mflEnv ? window.mflEnv.league_id : '');
                let url = `https://${window.location.hostname}/${year}/export?TYPE=${type}&L=${leagueId}&JSON=1`;
                if (params) {
                    Object.keys(params).forEach(k => {
                        url += `&${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`;
                    });
                }
                const res = await fetch(url, { credentials: 'include' });
                return await res.json();
            },
            fetchRawText: async function (url) {
                const res = await fetch(url, { credentials: 'include' });
                return await res.text();
            },
            clearCache: function () {}
        };
    }

    function getTtl(client, presetName, defaultMs) {
        if (client && client.TTLS && client.TTLS[presetName]) {
            return client.TTLS[presetName];
        }
        return defaultMs;
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
        if (client && typeof client.getUserFranchise === 'function') {
            const fid = client.getUserFranchise();
            if (fid) return norm(fid);
        }
        if (window.mflEnv && window.mflEnv.franchise_id) {
            return norm(window.mflEnv.franchise_id);
        }
        if (window.mflUserFranchiseId) {
            return norm(window.mflUserFranchiseId);
        }
        return '';
    }

    function isCommissioner(loggedInFid) {
        if (loggedInFid === '0000') return true;
        if (window.mflEnv && (window.mflEnv.is_commissioner || window.mflEnv.is_commish)) return true;
        if (window.isMFLCommissioner) return true;
        return false;
    }

    async function fetchPowerRankingsCsv(client) {
        const year = window.DNFL_YEAR || new Date().getFullYear();
        const manifestUrl = `https://dnfl.live/dnfl_rankings/${year}/weeks.json`;
        
        try {
            const manifestText = await client.fetchRawText(manifestUrl);
            const manifestData = JSON.parse(manifestText);
            const weeksArr = toArray(manifestData?.weeks || manifestData);
            
            let targetFile = 'data_02.csv';
            if (weeksArr.length > 0) {
                const lastItem = weeksArr[weeksArr.length - 1];
                if (typeof lastItem === 'string') {
                    targetFile = lastItem;
                } else if (lastItem && lastItem.file) {
                    targetFile = lastItem.file;
                } else if (lastItem && lastItem.filename) {
                    targetFile = lastItem.filename;
                }
            }

            const csvUrl = `https://dnfl.live/dnfl_rankings/${year}/${targetFile}`;
            const csvText = await client.fetchRawText(csvUrl);
            return parseRankingsCsv(csvText);
        } catch (e) {
            console.warn("[DNFL Popups] Primary power rankings manifest fetch failed, attempting fallback loop:", e);
            
            for (let w = 18; w >= 0; w--) {
                const padW = String(w).padStart(2, '0');
                const fileCandidate = w === 0 ? 'data_00_pre-season.csv' : `data_${padW}.csv`;
                try {
                    const fallbackUrl = `https://dnfl.live/dnfl_rankings/${year}/${fileCandidate}`;
                    const text = await client.fetchRawText(fallbackUrl);
                    if (text && text.includes('Franchise') && !text.includes('<!DOCTYPE')) {
                        return parseRankingsCsv(text);
                    }
                } catch (err) {}
            }
            return {};
        }
    }

    function parseRankingsCsv(csvText) {
        if (!csvText) return {};
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return {};

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const fidIdx = headers.findIndex(h => h.includes('id') || h.includes('franchise'));
        const prIdx = headers.findIndex(h => h.includes('power') || h.includes('index') || h.includes('score'));
        const rankIdx = headers.findIndex(h => h.includes('rank') || h.includes('pos'));

        const map = {};
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(c => c.trim());
            if (row.length <= 1) continue;

            let fid = fidIdx >= 0 ? norm(row[fidIdx]) : norm(row[0]);
            let pr = prIdx >= 0 ? row[prIdx] : (row[2] || '85.00');
            let rank = rankIdx >= 0 ? row[rankIdx] : String(i);

            map[fid] = {
                powerIndex: pr,
                rank: rank
            };
        }
        return map;
    }

    function captureHomepageMessages() {
        const reminderEls = document.querySelectorAll('#league_reminders .tdalert, #league_reminders .alert, #warning');
        reminderEls.forEach(el => {
            if (el.innerText.trim()) {
                capturedLeagueReminders.push(el.innerHTML.trim());
            }
        });

        const hpMsgs = document.querySelectorAll('#body_home .homepagemessage');
        hpMsgs.forEach((el, idx) => {
            if (el.innerText.trim()) {
                capturedHomepageMessages.push({
                    id: idx + 1,
                    html: el.innerHTML.trim()
                });
            }
        });
    }

    function attachLinkInterceptors() {
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href') || '';
            
            // Intercept Player Popup Links
            if (href.includes('DISPLAY_TYPE=projections') || href.includes('P=') && href.includes('player')) {
                const match = href.match(/P=(\d+)/);
                if (match) {
                    e.preventDefault();
                    openPlayerPopup(match[1]);
                    return;
                }
            }

            // Intercept Franchise Popup Links
            if (href.includes('options?L=') && href.includes('O=01') || href.includes('F=') && href.includes('franchise')) {
                const match = href.match(/F=(\d+)/) || href.match(/FRANCHISE=(\d+)/);
                if (match) {
                    e.preventDefault();
                    openFranchisePopup(match[1]);
                    return;
                }
            }

            // Intercept Franchise Setup Links
            if (href.includes('options?L=') && href.includes('O=01')) {
                const client = getApiClient();
                const myFid = getLoggedInFranchiseId(client);
                if (myFid) {
                    e.preventDefault();
                    openFranchisePopup(myFid, 'setup');
                    return;
                }
            }
        });
    }

    function showModal(titleText, headerHtml, gearAction) {
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
                            <button id="dnfl-modal-gear-btn" class="dnfl-modal-gear dnfl-is-hidden" title="Franchise Settings">
                                <i class="fa-solid fa-gear"></i>
                            </button>
                            <button id="dnfl-modal-close-btn" class="dnfl-modal-close" aria-label="Close Modal">
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
            if (gearAction) {
                gearBtn.classList.remove('dnfl-is-hidden');
                gearBtn.onclick = gearAction;
            } else {
                gearBtn.classList.add('dnfl-is-hidden');
                gearBtn.onclick = null;
            }
        }

        overlay.classList.remove('dnfl-is-hidden');
    }

    // Document-level event delegation for closing modal
    document.addEventListener('click', function(e) {
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
            const myFidNorm = getLoggedInFranchiseId(client);
            const isCommishUser = isCommissioner(myFidNorm);
            const canEdit = (myFidNorm && myFidNorm === targetFidNorm) || isCommishUser;

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

            const gearAction = canEdit ? function() { openFranchisePopup(franchiseId, 'setup'); } : null;
            showModal(name, headerHtml, gearAction);

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

            const pfMainStr = `${pfPpgVal} <span class="dnfl-ppg-label">${pfPpgVal ? 'PPG' : ''}</span>`;
            const pfTotalStr = `${pfVal.toFixed(2)} Total`;

            const paMainStr = `${paPpgVal} <span class="dnfl-ppg-label">${paPpgVal ? 'PPG' : ''}</span>`;
            const paTotalStr = `${paVal.toFixed(2)} Total`;

            const bbidVal = franStandings.bbidAvailable || franStandings.bbid_available || franStandings.bbidbalance || '100.00';
            const bbidMainStr = `$${parseFloat(bbidVal).toFixed(2)}`;
            const bbidSubStr = `Budget Available`;

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

            let topBarTabsHtml = `
                <div class="dnfl-modal-tabs dnfl-tabs-fullwidth">
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'overview')"><i class="fa-solid fa-chart-line"></i> <span class="dnfl-tab-label">Overview</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'roster' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'roster')"><i class="fa-solid fa-users"></i> <span class="dnfl-tab-label">Roster</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'schedule' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'schedule')"><i class="fa-solid fa-calendar-days"></i> <span class="dnfl-tab-label">Schedule</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'history' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'history')"><i class="fa-solid fa-trophy"></i> <span class="dnfl-tab-label">History</span></button>
                    ${canEdit ? `<button class="dnfl-modal-tab-btn ${activeTab === 'setup' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'setup')"><i class="fa-solid fa-gear"></i> <span class="dnfl-tab-label">Setup</span></button>` : ''}
                </div>
            `;

            let heroHtml = '';
            if (activeTab === 'overview') {
                heroHtml = `
                    <div class="dnfl-franchise-hero-header">
                        <div class="dnfl-hero-left-meta">
                            <div class="dnfl-owner-details-card">
                                <div class="dnfl-owner-detail-row"><strong>OWNER:</strong> ${targetFran.owner_name || 'N/A'}</div>
                                <div class="dnfl-owner-detail-row"><strong>DIVISION:</strong> ${fullLoc || 'N/A'}</div>
                                <div class="dnfl-owner-detail-row"><strong>CONTACT:</strong> ${targetFran.email || 'N/A'}</div>
                            </div>
                            <div class="dnfl-scorecard-grid dnfl-grid-3x2">
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
                                    <div class="dnfl-stat-lbl">BBID Budget</div>
                                    <div class="dnfl-stat-val-main">${bbidMainStr}</div>
                                    <div class="dnfl-stat-val-sub">${bbidSubStr}</div>
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
                        </div>
                        ${logo ? `
                            <div class="dnfl-hero-logo-wrapper">
                                <img src="${logo}" alt="${name}" class="dnfl-hero-large-logo" onerror="this.style.display='none'" />
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            content.innerHTML = topBarTabsHtml + heroHtml + renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, activeTab, completedWeeks, isCommishUser, canEdit);

        } catch (e) {
            console.error("[DNFL Popups] Error opening franchise popup:", e);
            content.innerHTML = `
                <div class="dnfl-status-error">
                    <i class="fa-solid fa-triangle-exclamation"></i> Error loading franchise card: ${e.message}
                </div>
            `;
        }
    }

    function renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, tabName, completedWeeks, isCommishUser, canEdit) {
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

            // Sort all roster players strictly by YTD Score descending
            rosterPlayers.sort((a, b) => b.ytdScore - a.ytdScore);

            // Select 1 QB max + Top 3 Skill (RB, WR, TE only)
            const topQb = rosterPlayers.find(p => String(p.position).toUpperCase() === 'QB');
            const skillPlayers = rosterPlayers.filter(p => ['RB', 'WR', 'TE'].includes(String(p.position).toUpperCase()));

            const topPerformers = [];
            if (topQb) topPerformers.push(topQb);
            
            skillPlayers.forEach(p => {
                if (topPerformers.length < 4 && !topPerformers.includes(p)) {
                    topPerformers.push(p);
                }
            });

            // Sort final 4 by YTD score descending
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
                                            <div class="dnfl-star-main-metric">${p.ppg} <span class="dnfl-ppg-label-blue">PPG</span></div>
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

        } else if (tabName === 'setup') {
            const leagueId = window.DNFL_LEAGUE_ID || (window.mflEnv ? window.mflEnv.league_id : '');
            const fid = targetFran.id;

            const emailEventsList = [
                { id: 'DRAFT_STATUS', label: 'Draft Status Update' },
                { id: 'DRAFT_CLOCK', label: "When I'm On The Clock For My Draft" },
                { id: 'LINEUP_SUBMISSION', label: "Opponent's/Own Lineup Submission" },
                { id: 'LINEUP_REMINDER', label: "Reminder at 6am ET Thursdays if you haven't submitted a lineup" },
                { id: 'TRADE_PROPOSAL', label: 'Trade Proposals/Results' },
                { id: 'TRADE_BAIT', label: 'Trade Bait Updates' },
                { id: 'WAIVER_RESULTS', label: 'Waivers/Free Agent Moves' },
                { id: 'WEEKLY_RESULTS', label: 'Weekly Results' },
                { id: 'INJURY_REPORT', label: 'Injury Status Report' },
                { id: 'PLAYER_NEWS', label: 'My Player News' },
                { id: 'SITE_NEWS', label: 'MyFantasyLeague.com Site News' }
            ];

            const smsEventsList = [
                { id: 'SMS_DRAFT_CLOCK', label: "When I'm on the clock in the draft (email drafts only)" },
                { id: 'SMS_TRADE_PROPOSAL', label: 'Trade proposals and responses' },
                { id: 'SMS_TRADE_COMPLETED', label: 'Completed Trades' },
                { id: 'SMS_LINEUP_REMINDER', label: "Reminder at 6am ET Thursdays if you haven't submitted a lineup for the current week yet" },
                { id: 'SMS_GAME_INACTIVES', label: 'Game-day inactives on my starting lineup at 12:30pm and 3:30pm ET on Sundays' },
                { id: 'SMS_TRADE_APPROVAL', label: 'Trades pending approval - commissioners only' }
            ];

            return `
                <div class="dnfl-setup-tab-container">
                    ${isCommishUser ? `
                        <div class="dnfl-admin-shortcut-card">
                            <i class="fa-solid fa-user-gear"></i> Commissioner Access Mode
                            <a href="options?L=${leagueId}&O=01&FRANCHISE=${fid}" target="_blank" class="dnfl-btn-admin">
                                Open Full MFL Admin Setup Page <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                        </div>
                    ` : ''}

                    <div id="dnfl-setup-feedback" class="dnfl-feedback-banner dnfl-is-hidden"></div>

                    <form id="dnfl-franchise-setup-form" onsubmit="DNFL.Popups.saveFranchiseSetup(event, '${fid}')">
                        <div class="dnfl-form-section">
                            <h4 class="dnfl-form-section-title"><i class="fa-solid fa-id-card"></i> Franchise Profile</h4>
                            <div class="dnfl-form-grid">
                                <div class="dnfl-form-group">
                                    <label>Franchise Name</label>
                                    <input type="text" name="name" value="${escapeXml(targetFran.name || '')}" class="dnfl-input" required />
                                </div>
                                <div class="dnfl-form-group">
                                    <label>Owner Name</label>
                                    <input type="text" name="owner_name" value="${escapeXml(targetFran.owner_name || '')}" class="dnfl-input" required />
                                </div>
                                <div class="dnfl-form-group">
                                    <label>Contact Email</label>
                                    <input type="email" name="email" value="${escapeXml(targetFran.email || '')}" class="dnfl-input" required />
                                </div>
                                <div class="dnfl-form-group">
                                    <label>Cellular / Mobile SMS Phone</label>
                                    <input type="tel" name="cell_phone" value="${escapeXml(targetFran.cell_phone || targetFran.cellnumber || '')}" class="dnfl-input" placeholder="e.g. 5551234567" />
                                </div>
                            </div>
                        </div>

                        <div class="dnfl-form-section">
                            <div class="dnfl-section-header-row">
                                <h4 class="dnfl-form-section-title"><i class="fa-solid fa-envelope"></i> Email Notifications</h4>
                                <div class="dnfl-toggle-actions">
                                    <button type="button" class="dnfl-link-btn" onclick="DNFL.Popups.toggleCheckboxes('email-group', true)">Select All</button>
                                    <span class="dnfl-divider">•</span>
                                    <button type="button" class="dnfl-link-btn" onclick="DNFL.Popups.toggleCheckboxes('email-group', false)">Clear All</button>
                                </div>
                            </div>
                            <div class="dnfl-checkbox-grid email-group">
                                ${emailEventsList.map(item => `
                                    <label class="dnfl-checkbox-label">
                                        <input type="checkbox" name="mail_event" value="${item.id}" checked />
                                        <span>${item.label}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="dnfl-form-section">
                            <div class="dnfl-section-header-row">
                                <h4 class="dnfl-form-section-title"><i class="fa-solid fa-mobile-screen-button"></i> Mobile Text Notifications</h4>
                                <div class="dnfl-toggle-actions">
                                    <button type="button" class="dnfl-link-btn" onclick="DNFL.Popups.toggleCheckboxes('sms-group', true)">Select All</button>
                                    <span class="dnfl-divider">•</span>
                                    <button type="button" class="dnfl-link-btn" onclick="DNFL.Popups.toggleCheckboxes('sms-group', false)">Clear All</button>
                                </div>
                            </div>
                            <div class="dnfl-checkbox-grid sms-group">
                                ${smsEventsList.map(item => `
                                    <label class="dnfl-checkbox-label">
                                        <input type="checkbox" name="sms_event" value="${item.id}" checked />
                                        <span>${item.label}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="dnfl-form-actions">
                            <button type="submit" class="dnfl-btn-submit">
                                <i class="fa-solid fa-floppy-disk"></i> Save Settings
                            </button>
                        </div>
                    </form>
                </div>
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

    function toggleCheckboxes(groupClass, checkAll) {
        const container = document.querySelector(`.${groupClass}`);
        if (!container) return;
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = checkAll);
    }

    async function saveFranchiseSetup(e, franchiseId) {
        e.preventDefault();
        const form = e.target;
        const feedback = document.getElementById('dnfl-setup-feedback');

        if (feedback) {
            feedback.className = 'dnfl-feedback-banner dnfl-status-loading';
            feedback.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving changes to MyFantasyLeague...';
            feedback.classList.remove('dnfl-is-hidden');
        }

        try {
            const formData = new FormData(form);
            const name = formData.get('name') || '';
            const owner_name = formData.get('owner_name') || '';
            const email = formData.get('email') || '';
            const cell_phone = formData.get('cell_phone') || '';

            const mailEvents = formData.getAll('mail_event').join(',');
            const smsEvents = formData.getAll('sms_event').join(',');

            const xmlData = `
                <franchises>
                    <franchise 
                        id="${franchiseId}" 
                        name="${escapeXml(name)}" 
                        owner_name="${escapeXml(owner_name)}" 
                        email="${escapeXml(email)}" 
                        cell_phone="${escapeXml(cell_phone)}" 
                        mail_event="${escapeXml(mailEvents)}" 
                        sms_event="${escapeXml(smsEvents)}" 
                    />
                </franchises>
            `.trim();

            const year = window.DNFL_YEAR || new Date().getFullYear();
            const leagueId = window.DNFL_LEAGUE_ID || (window.mflEnv ? window.mflEnv.league_id : '');
            const postUrl = `https://${window.location.hostname}/${year}/import?TYPE=franchiseSetup&L=${leagueId}&JSON=1`;

            const params = new URLSearchParams();
            params.append('DATA', xmlData);

            const response = await fetch(postUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
                credentials: 'include'
            });

            const result = await response.json();

            if (result && (result.status === 'OK' || result.status === '0' || !result.error)) {
                if (feedback) {
                    feedback.className = 'dnfl-feedback-banner dnfl-status-success';
                    feedback.innerHTML = '<i class="fa-solid fa-circle-check"></i> Franchise settings saved successfully!';
                }

                const client = getApiClient();
                if (client && typeof client.clearCache === 'function') {
                    client.clearCache('league');
                    client.clearCache('leagueStandings');
                }

                setTimeout(() => {
                    openFranchisePopup(franchiseId, 'overview');
                }, 1200);

            } else {
                const errText = result?.error?.$t || result?.error || 'Server rejected franchise import payload.';
                throw new Error(errText);
            }

        } catch (err) {
            console.error("[DNFL Popups] Error saving franchise setup:", err);
            if (feedback) {
                feedback.className = 'dnfl-feedback-banner dnfl-status-error';
                feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error saving settings: ${err.message}`;
            }
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

        console.log("DNFL Popups Subsystem v4.18 ready.");
    }

    window.DNFL.Popups = {
        init: init,
        openPlayerPopup: openPlayerPopup,
        openFranchisePopup: openFranchisePopup,
        switchPlayerTab: switchPlayerTab,
        switchFranchiseTab: switchFranchiseTab,
        toggleCheckboxes: toggleCheckboxes,
        saveFranchiseSetup: saveFranchiseSetup,
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
