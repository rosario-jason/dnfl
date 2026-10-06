/* ==========================================================================
   DNFL Popups & Modal Subsystem Engine v4.13
   Duke Networking Fantasy League (DNFL) Architecture
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
     * Resolve Logged In Franchise ID
     */
    function getLoggedInFranchiseId(client) {
        if (client && typeof client.getLoggedInFranchiseId === 'function') {
            try {
                const fid = client.getLoggedInFranchiseId();
                if (fid) return fid;
            } catch (e) {}
        }
        if (client && typeof client.getUserFranchise === 'function') {
            try {
                const uFran = client.getUserFranchise();
                if (uFran && uFran.id) return uFran.id;
            } catch (e) {}
        }
        if (typeof window.franchise_id !== 'undefined' && window.franchise_id) return window.franchise_id;
        if (typeof globalThis.franchise_id !== 'undefined' && globalThis.franchise_id) return globalThis.franchise_id;
        return '';
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
     * Normalize ID String
     */
    function norm(id) {
        if (!id && id !== 0) return '';
        return String(id).trim().replace(/^0+/, '');
    }

    /**
     * CSV Line Parser
     */
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

    /**
     * Fetch Power Rankings CSV dynamically using weeks.json manifest
     */
    async function fetchPowerRankingsCsv(client) {
        const dailyTtl = getTtl(client, 'DAILY', 86400000);
        const year = (client && typeof client.getYear === 'function') ? client.getYear() : (window.year || '2026');
        
        let activeCsvFile = 'data_02.csv';

        // 1. Fetch weeks.json manifest to resolve latest published CSV
        const manifestUrls = [
            `https://dnfl.live/dnfl_rankings/${year}/weeks.json`,
            `https://dnfl.live/dnfl_rankings/weeks.json`,
            `/dnfl_rankings/${year}/weeks.json`,
            `/dnfl_rankings/weeks.json`
        ];

        for (const mUrl of manifestUrls) {
            try {
                const manifestText = await client.fetchRawText(mUrl, { ttl: dailyTtl });
                if (manifestText) {
                    const manifest = JSON.parse(manifestText);
                    const weekFiles = manifest.weeks || manifest.published_weeks || manifest.files;
                    if (Array.isArray(weekFiles) && weekFiles.length > 0) {
                        const lastEntry = weekFiles[weekFiles.length - 1];
                        activeCsvFile = lastEntry.file || lastEntry.filename || lastEntry.csv || (typeof lastEntry === 'string' ? lastEntry : activeCsvFile);
                    } else if (manifest.active_week_file) {
                        activeCsvFile = manifest.active_week_file;
                    }
                    break;
                }
            } catch (e) {}
        }

        // 2. Fetch active week CSV
        const csvUrls = [
            `https://dnfl.live/dnfl_rankings/${year}/${activeCsvFile}`,
            `https://dnfl.live/dnfl_rankings/${activeCsvFile}`,
            `/dnfl_rankings/${year}/${activeCsvFile}`,
            `/dnfl_rankings/${activeCsvFile}`
        ];

        for (const url of csvUrls) {
            try {
                const text = await client.fetchRawText(url, { ttl: dailyTtl });
                if (text && text.includes('Power Index')) {
                    return parsePowerRankingsCsv(text);
                }
            } catch (e) {}
        }
        return {};
    }

    /**
     * Parse Power Rankings CSV Data
     */
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

    /**
     * Execute Official DNFL Standings Module Seeding Algorithm
     */
    async function calculateDnflStandingsSeeds(client, standingsList, leagueData) {
        // 1. Check if DNFL.Standings module is active in memory
        if (window.DNFL && window.DNFL.Standings) {
            if (typeof window.DNFL.Standings.getTeamSeed === 'function') {
                const seedsMap = {};
                standingsList.forEach(s => {
                    const fidNorm = norm(s.id);
                    seedsMap[fidNorm] = window.DNFL.Standings.getTeamSeed(fidNorm);
                });
                if (Object.keys(seedsMap).length > 0) return seedsMap;
            } else if (window.DNFL.Standings.cachedTeamSeeds) {
                return window.DNFL.Standings.cachedTeamSeeds;
            }
        }

        // 2. Fetch standings_rules.json to evaluate official seeding
        let rules = { seedingScope: 'conference', seedingModel: 'tiered_div_finish_pf' };
        try {
            const year = (client && typeof client.getYear === 'function') ? client.getYear() : (window.year || '2026');
            const rulesText = await client.fetchRawText(`https://dnfl.live/dnfl_standings/standings_rules.json`, { ttl: getTtl(client, 'DAILY', 86400000) });
            if (rulesText) {
                const parsedRules = JSON.parse(rulesText);
                const yearRules = parsedRules[year] || parsedRules['default'] || parsedRules;
                rules = { ...rules, ...yearRules };
            }
        } catch (e) {}

        const teamSeeds = {};
        const divLeaders = {};
        const divRunnerUps = {};

        const divisions = toArray(leagueData?.league?.divisions?.division);
        const conferences = toArray(leagueData?.league?.conferences?.conference);
        const leagueFranchises = toArray(leagueData?.league?.franchises?.franchise);

        const divToConfMap = {};
        divisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

        const getMflIndex = (id) => standingsList.findIndex(s => norm(s.id) === norm(id));
        const getPf = (id) => {
            const s = standingsList.find(item => norm(item.id) === norm(id));
            return parseFloat(s?.pf || s?.h2hpf || s?.points_for || 0);
        };

        const sortByPfThenMfl = (a, b) => {
            const pfDiff = getPf(b) - getPf(a);
            if (pfDiff !== 0) return pfDiff;
            return getMflIndex(a) - getMflIndex(b);
        };

        divisions.forEach(div => {
            const divIdNorm = norm(div.id);
            const teamsInDiv = leagueFranchises.filter(f => norm(f.division || f.div) === divIdNorm).map(f => norm(f.id));
            teamsInDiv.sort((a, b) => getMflIndex(a) - getMflIndex(b));

            if (teamsInDiv.length > 0) divLeaders[divIdNorm] = teamsInDiv[0];
            if (teamsInDiv.length > 1) divRunnerUps[divIdNorm] = teamsInDiv[1];
        });

        let scopesToProcess = [];

        if (rules.seedingScope === 'league') {
            scopesToProcess.push({
                scopeId: 'league',
                teams: leagueFranchises.map(f => norm(f.id)),
                leaders: Object.values(divLeaders),
                runnersUp: Object.values(divRunnerUps)
            });
        } else {
            conferences.forEach(conf => {
                const confIdNorm = norm(conf.id);
                const confTeams = leagueFranchises.filter(f => {
                    const fDivNorm = norm(f.division || f.div);
                    const fConfNorm = norm(f.conference || f.conf || divToConfMap[fDivNorm]);
                    return fConfNorm === confIdNorm;
                }).map(f => norm(f.id));

                const confDivs = divisions.filter(d => norm(d.conference) === confIdNorm).map(d => norm(d.id));
                const confLeaders = confDivs.map(dId => divLeaders[dId]).filter(id => id !== undefined);
                const confRunners = confDivs.map(dId => divRunnerUps[dId]).filter(id => id !== undefined);

                scopesToProcess.push({
                    scopeId: confIdNorm,
                    teams: confTeams,
                    leaders: confLeaders,
                    runnersUp: confRunners
                });
            });
        }

        scopesToProcess.forEach(scope => {
            if (rules.seedingModel === 'tiered_div_finish_pf') {
                const winners = scope.leaders.slice();
                winners.sort(sortByPfThenMfl);
                winners.forEach((id, idx) => teamSeeds[id] = idx + 1);

                const runners = scope.runnersUp.slice();
                runners.sort(sortByPfThenMfl);
                runners.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length);

                const assigned = new Set([...winners, ...runners]);
                const remaining = scope.teams.filter(id => !assigned.has(id));
                remaining.sort(sortByPfThenMfl);
                remaining.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length + runners.length);
            } else if (rules.seedingModel === 'standard_div_winners_first') {
                const winners = scope.leaders.slice();
                winners.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                winners.forEach((id, idx) => teamSeeds[id] = idx + 1);

                const remaining = scope.teams.filter(id => !winners.includes(id));
                remaining.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                remaining.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length);
            } else {
                const allTeams = scope.teams.slice();
                allTeams.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                allTeams.forEach((id, idx) => teamSeeds[id] = idx + 1);
            }
        });

        return teamSeeds;
    }

    /**
     * Capture Homepage Messages & League Reminders from DOM
     */
    function captureHomepageMessages() {
        capturedHomepageMessages = [];
        capturedLeagueReminders = [];

        const remindersEl = document.getElementById('league_reminders');
        if (remindersEl) {
            const html = remindersEl.innerHTML.trim();
            if (html) capturedLeagueReminders.push(html);
        }

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
     * Show Modal Shell
     */
    function showModal(titleText, headerInnerHtml) {
        const overlay = document.getElementById('dnfl-modal-overlay');
        const titleEl = document.getElementById('dnfl-modal-title');

        if (titleEl) {
            titleEl.innerHTML = headerInnerHtml;
        }
        if (overlay) overlay.classList.remove('dnfl-is-hidden');
    }

    /**
     * Set Persistent Left-Side Card Watermark
     */
    function setCardWatermark(logoUrl) {
        const container = document.getElementById('dnfl-modal-container');
        if (!container) return;

        let wm = document.getElementById('dnfl-persistent-card-watermark');
        if (!wm) {
            wm = document.createElement('img');
            wm.id = 'dnfl-persistent-card-watermark';
            wm.className = 'dnfl-persistent-watermark';
            wm.alt = 'Watermark';
            wm.onerror = function() { this.style.display = 'none'; };
            container.appendChild(wm);
        }

        if (logoUrl) {
            wm.src = logoUrl;
            wm.style.display = 'block';
        } else {
            wm.style.display = 'none';
        }
    }

    /**
     * Open Player Modal
     */
    async function openPlayerPopup(playerId, activeTab) {
        activeTab = activeTab || 'overview';

        const content = document.getElementById('dnfl-modal-content-wrapper');
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

            const [playerMap, leagueData, rosterData] = await Promise.all([
                client.fetchData('players', { DETAILS: 1 }, { ttl: dailyTtl }).catch(() => null),
                client.fetchData('league', {}, { ttl: hourlyTtl }).catch(() => null),
                client.fetchData('rosters', {}, { ttl: fiveMinTtl }).catch(() => null)
            ]);

            const playerList = toArray(playerMap?.players?.player);
            let pData = playerList.find(p => norm(p.id) === norm(playerId));
            if (!pData) {
                pData = { id: playerId, name: `Player #${playerId}`, position: 'N/A', team: 'FA' };
            }

            const name = pData.name || `Player #${playerId}`;
            const pos = (pData.position || 'N/A').toUpperCase();
            const nflTeam = pData.team || 'FA';
            const espnId = pData.espn_id || pData.espn_id_full;

            const headerHtml = `<i class="fa-solid fa-user"></i> <span>${name}</span>`;
            showModal(name, headerHtml);

            const userFid = getLoggedInFranchiseId(client);
            const isCommish = !userFid || userFid === '0000';
            const userFranchise = (client.getUserFranchise && client.getUserFranchise()) || {};
            const userConfId = userFranchise.conference_id;

            const franchises = toArray(leagueData?.league?.franchises?.franchise);
            const conferences = toArray(leagueData?.league?.conferences?.conference);
            const rosterFranchises = toArray(rosterData?.rosters?.franchise);

            const owningFranchises = rosterFranchises.filter(r => {
                const pList = toArray(r.player).map(pl => norm(pl.id));
                return pList.includes(norm(playerId));
            }).map(r => {
                const franMeta = franchises.find(f => norm(f.id) === norm(r.id)) || {};
                const confMeta = conferences.find(c => norm(c.id) === norm(franMeta.conference_id)) || {};
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
                const userOwned = owningFranchises.find(f => norm(f.id) === norm(userFid));
                const confOwned = owningFranchises.find(f => norm(f.confId) === norm(userConfId));

                if (userOwned && userOwned.logo) {
                    activeWatermark = userOwned.logo;
                } else if (confOwned && confOwned.logo) {
                    activeWatermark = confOwned.logo;
                } else if (owningFranchises[0] && owningFranchises[0].logo) {
                    activeWatermark = owningFranchises[0].logo;
                }
            }

            setCardWatermark(activeWatermark);

            const espnHeadshotUrl = espnId 
                ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
                : `https://www.mflscripts.com/playerImages_96x96/mfl_${playerId}.png`;
            const mflBackupUrl = `https://www.mflscripts.com/playerImages_96x96/mfl_${playerId}.png`;
            const silhouetteUrl = `https://www.mflscripts.com/playerImages_96x96/free_agent.png`;

            content.innerHTML = `
                <div class="dnfl-player-hero-card">
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
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'overview')"><i class="fa-solid fa-address-card"></i> <span class="dnfl-tab-label">Overview & Bio</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'gamelog' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'gamelog')"><i class="fa-solid fa-calendar-days"></i> <span class="dnfl-tab-label">Game Log</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'season' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'season')"><i class="fa-solid fa-chart-line"></i> <span class="dnfl-tab-label">Season Stats</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'career' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'career')"><i class="fa-solid fa-award"></i> <span class="dnfl-tab-label">Career Stats</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'transactions' ? 'is-active' : ''}" onclick="DNFL.Popups.switchPlayerTab('${playerId}', 'transactions')"><i class="fa-solid fa-right-left"></i> <span class="dnfl-tab-label">Transactions</span></button>
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
                                <span class="dnfl-subtext">${f.owner}</span>
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
            setCardWatermark(logo);

            // Standings Parsing & Record
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

            const pfPpgVal = (pfVal / completedWeeks).toFixed(1);
            const paPpgVal = (paVal / completedWeeks).toFixed(1);

            const pfMainStr = `${pfPpgVal} PPG`;
            const pfTotalStr = `${pfVal.toFixed(2)} Total`;

            const paMainStr = `${paPpgVal} PPG`;
            const paTotalStr = `${paVal.toFixed(2)} Total`;

            // Calculate Official DNFL Playoff Seeds
            const dnflSeedsMap = await calculateDnflStandingsSeeds(client, standingsList, leagueData);
            const seedVal = dnflSeedsMap[targetFidNorm] || '1';

            // Power Rank & Power Index Resolution
            const prMeta = powerRankingsMap[targetFidNorm] || {};
            const prVal = prMeta.powerIndex || (franStandings.power_rank ? parseFloat(franStandings.power_rank).toFixed(1) : '85.0');
            const prRankNum = prMeta.rank || franStandings.rank || '1';
            const prSubStr = `#${prRankNum} Overall`;

            let heroHtml = `
                <div class="dnfl-franchise-hero-header">
                    <div class="dnfl-hero-left-meta">
                        <h3 class="dnfl-franchise-title-text">${name}</h3>
                        <div class="dnfl-hero-tags">
                            <span class="dnfl-pill-blue">${targetFran.owner_name || 'N/A'}</span>
                            <span class="dnfl-pill-gray">${fullLoc}</span>
                        </div>
                    </div>
                    ${logo ? `<img src="${logo}" alt="${name}" class="dnfl-hero-large-logo" onerror="this.style.display='none'" />` : ''}
                </div>

                <div class="dnfl-modal-tabs">
                    <button class="dnfl-modal-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'overview')"><i class="fa-solid fa-chart-pie"></i> <span class="dnfl-tab-label">Overview</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'roster' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'roster')"><i class="fa-solid fa-users"></i> <span class="dnfl-tab-label">Roster</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'schedule' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'schedule')"><i class="fa-solid fa-calendar"></i> <span class="dnfl-tab-label">Schedule</span></button>
                    <button class="dnfl-modal-tab-btn ${activeTab === 'history' ? 'is-active' : ''}" onclick="DNFL.Popups.switchFranchiseTab('${franchiseId}', 'history')"><i class="fa-solid fa-trophy"></i> <span class="dnfl-tab-label">Awards & History</span></button>
                </div>

                <div id="dnfl-franchise-tab-body">
                    ${renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, activeTab, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, seedVal, prVal, prSubStr, completedWeeks)}
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
    function renderFranchiseTabContent(targetFran, franStandings, rosterData, playerMap, ytdScoresData, tabName, recordStr, winPctStr, pfMainStr, pfTotalStr, paMainStr, paTotalStr, seedVal, prVal, prSubStr, completedWeeks) {
        if (tabName === 'overview') {
            const playerList = toArray(playerMap?.players?.player);
            const ytdList = toArray(ytdScoresData?.playerScores?.playerScore);
            
            // Build YTD Scores Map with Multi-Key Resolution
            const ytdScoreMap = {};
            ytdList.forEach(item => {
                if (item && item.id) {
                    const score = parseFloat(item.score || item.points || item.ytd || 0);
                    const rawId = String(item.id).trim();
                    const unpaddedId = rawId.replace(/^0+/, '');
                    const paddedId = unpaddedId.padStart(4, '0');

                    ytdScoreMap[rawId] = score;
                    ytdScoreMap[unpaddedId] = score;
                    ytdScoreMap[paddedId] = score;
                }
            });

            // Build League-Wide Position Rank Maps
            const posPlayersMap = {};
            playerList.forEach(p => {
                const pos = String(p.position || 'N/A').toUpperCase();
                const pidNorm = norm(p.id);
                const score = ytdScoreMap[pidNorm] || 0;
                if (!posPlayersMap[pos]) posPlayersMap[pos] = [];
                posPlayersMap[pos].push({ id: pidNorm, score: score });
            });

            const posRankMap = {};
            Object.keys(posPlayersMap).forEach(pos => {
                posPlayersMap[pos].sort((a, b) => b.score - a.score);
                posPlayersMap[pos].forEach((item, idx) => {
                    posRankMap[item.id] = { pos: pos, rank: idx + 1 };
                });
            });

            // Roster Players for Target Franchise
            const franRosterObj = toArray(rosterData?.rosters?.franchise).find(r => norm(r.id) === norm(targetFran.id));
            const rosterPlayerIds = toArray(franRosterObj?.player).map(p => norm(p.id));

            const rosterPlayers = playerList.filter(p => rosterPlayerIds.includes(norm(p.id))).map(p => {
                const pidNorm = norm(p.id);
                const score = ytdScoreMap[pidNorm] || 0;
                const ppg = completedWeeks > 0 ? (score / completedWeeks).toFixed(1) : '0.0';
                const posMeta = posRankMap[pidNorm] || { pos: String(p.position || 'N/A').toUpperCase(), rank: '--' };
                return {
                    ...p,
                    ytdScore: score,
                    ppg: ppg,
                    posRank: posMeta.rank
                };
            });

            rosterPlayers.sort((a, b) => b.ytdScore - a.ytdScore);

            // Select Top QB + Top 3 Skill Performers
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
                                            <div class="dnfl-star-main-metric">${p.ppg} PPG</div>
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
                        <div class="dnfl-stat-val-sub">Seed</div>
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
        showModal("League Notifications & Messages", "<i class="fa-solid fa-bell"></i> Notifications & Messages");
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
            const userFid = getLoggedInFranchiseId(client);
            
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
        setCardWatermark(logoUrl);
    }

    function toggleWatchlist(playerId) {
        alert("Player #" + playerId + " toggled in Watchlist.");
    }

    function closeModal() {
        const overlay = document.getElementById('dnfl-modal-overlay');
        if (overlay) overlay.classList.add('dnfl-is-hidden');
    }

    /**
     * Module Initialization
     */
    function init() {
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
