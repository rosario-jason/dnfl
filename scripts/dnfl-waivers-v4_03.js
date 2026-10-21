/**
 * Duke Networking Fantasy League (DNFL) - Waiver Target & Player Matrix Module v4.03
 * File: scripts/dnfl-waivers-v4_03.js
 * 
 * Features:
 * 1. Single Parent Card Structure: Standardized .dnfl-card / .dnfl-card-header / .dnfl-card-body layout.
 * 2. Multi-Conference Pool Isolation: Scopes rosters, Free Agents, and floors to activeConfId via divToConfMap.
 * 3. Commissioner Support (FID 0000): Dropdown selector allows Commish to toggle between conference pools.
 * 4. Native MFL AVG PPG: Concurrently fetches MFL AVG points (W: 'AVG') and YTD points (W: 'YTD').
 * 5. Weekly Score Matrix: Parallel-fetches weeklyResults and renders sortable W1..WN columns.
 * 6. Inline Controls: Inline Position dropdown selector (#dnfl-waivers-pos-filter) and search bar.
 * 7. Punctuation-Agnostic Search: Normalizes search terms across first name, last name, team, and status.
 */

(function () {
    'use strict';

    if (window.DNFLWaiversLoaded_v4_03) return;
    window.DNFLWaiversLoaded_v4_03 = true;

    // Namespace initialization
    window.DNFL = window.DNFL || {};

    let cachedLeagueInfo = null;
    let cachedPlayersMap = null;
    let cachedRosters = null;
    let cachedYtdScores = null;
    let cachedAvgScores = null;
    let cachedWeeklyScoresMap = {};
    let cachedFcMap = null;
    let cachedTransactionsMap = {};
    let cachedDivToConfMap = {};
    let cachedConfMap = {};

    let activeUserFid = null;
    let activeConfId = null;

    let currentViewMode = 'waiverTargets'; // 'waiverTargets' | 'myRoster' | 'allPlayers'
    let currentPosFilter = 'ALL';          // 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'PK' | 'DEF'
    let currentStatusFilter = 'ALL';       // 'ALL' | 'FA' | 'MY_ROSTER' | 'RIVAL_ROSTER'
    let currentSearchTerm = '';
    let currentSortColumn = 'valDelta';    // Default sort column
    let currentSortDir = 'desc';           // 'asc' | 'desc'

    // Retry configuration
    let initRetries = 0;
    const MAX_RETRIES = 50;
    const RETRY_INTERVAL = 100;

    function getApiClient() {
        return window.DNFLClient || window.DNFL?.Client || null;
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function norm(val) {
        return String(val || '').trim().toLowerCase();
    }

    function cleanSearchStr(val) {
        return String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function normFranchiseId(id) {
        if (!id) return '';
        const clean = String(id).trim().replace(/^0+/, '');
        return clean ? clean.padStart(4, '0') : '0000';
    }

    function formatPlayerName(nameStr) {
        if (!nameStr) return 'Unknown Player';
        let clean = String(nameStr).trim();
        if (clean.includes(',')) {
            const parts = clean.split(',').map(s => s.trim());
            if (parts.length >= 2) {
                return `${parts[1]} ${parts[0]}`;
            }
        }
        return clean;
    }

    function resolveActiveUser() {
        // Check URL query parameters
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const queryFid = urlParams.get('FRANCHISE') || urlParams.get('F') || urlParams.get('franchise');
            if (queryFid) return normFranchiseId(queryFid);
        } catch (e) {}

        // Check global MFL franchise variables
        if (typeof window.franchise_id !== 'undefined' && window.franchise_id) return normFranchiseId(window.franchise_id);
        if (typeof window.mfl_franchise_id !== 'undefined' && window.mfl_franchise_id) return normFranchiseId(window.mfl_franchise_id);
        if (typeof window.mflFranchiseId !== 'undefined' && window.mflFranchiseId) return normFranchiseId(window.mflFranchiseId);
        if (window.DNFL?.currentFranchiseId) return normFranchiseId(window.DNFL.currentFranchiseId);

        // Check cookies
        if (typeof window.mflCookie !== 'undefined' && window.mflCookie.franchise_id) {
            return normFranchiseId(window.mflCookie.franchise_id);
        }

        return '0001'; // Default fallback
    }

    function getFranchiseName(fid) {
        const normFid = normFranchiseId(fid);
        const fList = toArray(cachedLeagueInfo?.franchises?.franchise);
        const fObj = fList.find(f => normFranchiseId(f.id) === normFid);
        return fObj ? (fObj.name || `Franchise ${normFid}`) : (normFid === '0000' ? 'Free Agent' : `Franchise ${normFid}`);
    }

    function getFranchiseConference(fid) {
        const normFid = normFranchiseId(fid);
        const fList = toArray(cachedLeagueInfo?.franchises?.franchise);
        const fObj = fList.find(f => normFranchiseId(f.id) === normFid);
        if (!fObj) return null;

        const directConf = fObj.conference || fObj.conf;
        if (directConf) return String(directConf).trim();

        const divId = fObj.division || fObj.div;
        if (divId && cachedDivToConfMap[norm(divId)]) {
            return cachedDivToConfMap[norm(divId)];
        }

        return null;
    }

    // Load FantasyCalc market values for current week
    async function fetchFantasyCalcMap(weekNum) {
        const client = getApiClient();
        const year = cachedLeagueInfo?.year || '2026';
        const weekStr = String(weekNum !== undefined && weekNum !== null ? weekNum : 0).padStart(2, '0');
        const targetUrl = `https://dnfl.live/dnfl_market/${year}/fantasycalc_values_w${weekStr}.json`;

        let rawJson = null;
        try {
            if (client && typeof client.fetchRawText === 'function') {
                rawJson = await client.fetchRawText(targetUrl, { ttl: client.TTL ? client.TTL.DAILY : 86400000 }).catch(() => null);
            }
            if (!rawJson) {
                const resp = await fetch(`${targetUrl}?v=${Date.now()}`);
                if (resp.ok) rawJson = await resp.text();
            }
        } catch (e) {
            rawJson = null;
        }

        const fcMap = {};
        if (rawJson) {
            try {
                const data = JSON.parse(rawJson);
                const arr = Array.isArray(data) ? data : (data.players || []);
                arr.forEach(item => {
                    const pObj = item.player || item;
                    const mflId = pObj.mflId || pObj.mfl_id || item.mflId || item.mfl_id;
                    if (mflId !== undefined && mflId !== null && mflId !== '') {
                        const rawId = String(mflId).trim();
                        const unpadded = rawId.replace(/^0+/, '') || '0';
                        const padded = unpadded.padStart(4, '0');
                        const val = parseFloat(pObj.value || pObj.tradeValue || item.value || item.tradeValue || 0);

                        fcMap[rawId] = val;
                        fcMap[unpadded] = val;
                        fcMap[padded] = val;
                    }
                });
            } catch (err) {
                console.warn('[DNFL Waivers v4.03] Failed to parse FantasyCalc JSON:', err);
            }
        }
        return fcMap;
    }

    // Load all data endpoints concurrently
    async function loadData() {
        const client = getApiClient();
        if (!client) throw new Error('DNFL.Client middleware not found.');

        activeUserFid = resolveActiveUser();

        const [leagueRes, playersRes, rostersRes, ytdRes, avgRes, transRes] = await Promise.all([
            client.fetchData('league', { COLUMN_NAMES: 1 }),
            client.fetchData('players', { DETAILS: 1 }),
            client.fetchData('rosters', {}),
            client.fetchData('playerScores', { W: 'YTD' }),
            client.fetchData('playerScores', { W: 'AVG' }).catch(() => null),
            client.fetchData('transactions', { TRANS_TYPE: 'DEFAULT' }).catch(() => null)
        ]);

        cachedLeagueInfo = leagueRes?.league || {};
        const currentWk = parseInt(cachedLeagueInfo.currentWk || 1, 10);

        // Build Conference & Division Lookup Maps
        cachedDivToConfMap = {};
        cachedConfMap = {};
        const confList = toArray(cachedLeagueInfo?.conferences?.conference);
        confList.forEach(c => {
            const cid = String(c.id).trim();
            cachedConfMap[norm(cid)] = c.name || `Conference ${cid}`;
        });

        const divList = toArray(cachedLeagueInfo?.divisions?.division);
        divList.forEach(d => {
            const did = String(d.id).trim();
            const cid = String(d.conference).trim();
            if (did && cid) cachedDivToConfMap[norm(did)] = cid;
        });

        // Resolve Active Conference ID
        if (activeUserFid === '0000') { // Commissioner
            activeConfId = confList.length > 0 ? String(confList[0].id).trim() : '1';
        } else {
            activeConfId = getFranchiseConference(activeUserFid) || (confList.length > 0 ? String(confList[0].id).trim() : '1');
        }

        // Map players
        cachedPlayersMap = {};
        const playerList = toArray(playersRes?.players?.player);
        playerList.forEach(p => {
            const pid = String(p.id).trim();
            const unpadded = pid.replace(/^0+/, '');
            const padded = unpadded.padStart(4, '0');
            const rawName = String(p.name || `Player ${pid}`).trim();
            const formattedName = formatPlayerName(rawName);

            const pObj = {
                id: pid,
                rawName: rawName,
                name: formattedName,
                pos: (p.position || p.pos || 'N/A').toUpperCase(),
                team: (p.team || p.nflTeam || 'FA').toUpperCase(),
                bye: p.bye_week ? `W${p.bye_week}` : 'N/A'
            };
            cachedPlayersMap[pid] = pObj;
            cachedPlayersMap[unpadded] = pObj;
            cachedPlayersMap[padded] = pObj;
        });

        cachedRosters = rostersRes?.rosters || {};

        // YTD Scores Map
        cachedYtdScores = {};
        const ytdList = toArray(ytdRes?.playerScores?.playerScore);
        ytdList.forEach(ps => {
            const pid = String(ps.id).trim();
            const unpadded = pid.replace(/^0+/, '');
            const pts = parseFloat(ps.score || 0);
            cachedYtdScores[pid] = pts;
            cachedYtdScores[unpadded] = pts;
        });

        // Native AVG PPG Scores Map
        cachedAvgScores = {};
        if (avgRes?.playerScores?.playerScore) {
            const avgList = toArray(avgRes.playerScores.playerScore);
            avgList.forEach(ps => {
                const pid = String(ps.id).trim();
                const unpadded = pid.replace(/^0+/, '');
                const avgPts = parseFloat(ps.score || 0);
                cachedAvgScores[pid] = avgPts;
                cachedAvgScores[unpadded] = avgPts;
            });
        }

        // Transactions Map (for Acquisition origin)
        cachedTransactionsMap = {};
        if (transRes?.transactions?.transaction) {
            const tList = toArray(transRes.transactions.transaction);
            tList.forEach(t => {
                const type = (t.type || '').toUpperCase();
                const fid = normFranchiseId(t.franchise);
                const rawTx = String(t.transaction || t.description || '');
                const pids = rawTx.match(/\b\d{4,5}\b/g) || [];
                pids.forEach(pid => {
                    const cleanPid = String(pid).trim().replace(/^0+/, '');
                    if (!cachedTransactionsMap[cleanPid]) {
                        let acqText = 'Free Agent';
                        if (type.includes('BBID') || t.bid) {
                            acqText = `Waiver ($${parseFloat(t.bid || 0).toFixed(0)})`;
                        } else if (type.includes('TRADE')) {
                            acqText = 'Trade';
                        } else if (type.includes('DRAFT')) {
                            acqText = 'Draft';
                        }
                        cachedTransactionsMap[cleanPid] = { fid, type: acqText };
                    }
                });
            });
        }

        // Fetch Weekly Scores
        cachedWeeklyScoresMap = {};
        const weekPromises = [];
        for (let w = 1; w <= currentWk; w++) {
            weekPromises.push(client.fetchData('weeklyResults', { W: w }).catch(() => null));
        }
        const weeklyResultsList = await Promise.all(weekPromises);
        weeklyResultsList.forEach((wData, idx) => {
            const wNum = idx + 1;
            if (!wData?.weeklyResults) return;
            const matchups = toArray(wData.weeklyResults.matchup || wData.weeklyResults.matchUp);
            matchups.forEach(m => {
                const franchises = toArray(m.franchise);
                franchises.forEach(f => {
                    const players = toArray(f.player);
                    players.forEach(p => {
                        const pid = String(p.id || p).trim();
                        const unpadded = pid.replace(/^0+/, '');
                        const score = parseFloat(p.score || 0);
                        if (!cachedWeeklyScoresMap[unpadded]) cachedWeeklyScoresMap[unpadded] = {};
                        cachedWeeklyScoresMap[unpadded][`W${wNum}`] = score;
                    });
                });
            });
        });

        // Load Market Values
        cachedFcMap = await fetchFantasyCalcMap(currentWk);
    }

    // Build Master Player List Scoped to Active Conference
    function buildMasterPlayerList() {
        const masterList = [];

        // Build Roster Ownership Map for active conference
        const ownershipMap = {}; // pid -> { fid, teamName, confId }
        const rosterFranchises = toArray(cachedRosters?.franchise);

        rosterFranchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            const fConf = getFranchiseConference(fid);

            // Strictly process franchises within activeConfId
            if (String(fConf).trim() === String(activeConfId).trim()) {
                const teamName = getFranchiseName(fid);
                const players = toArray(f.player);

                players.forEach(p => {
                    const pid = String(p.id || p).trim();
                    const unpadded = pid.replace(/^0+/, '');
                    ownershipMap[pid] = { fid, teamName, confId: fConf };
                    ownershipMap[unpadded] = ownershipMap[pid];
                });
            }
        });

        // Iterate all players in database
        const processedPids = new Set();
        Object.keys(cachedPlayersMap).forEach(key => {
            const pInfo = cachedPlayersMap[key];
            if (!pInfo || processedPids.has(pInfo.id)) return;
            processedPids.add(pInfo.id);

            const pid = pInfo.id;
            const unpadded = pid.replace(/^0+/, '');
            const owner = ownershipMap[pid] || ownershipMap[unpadded] || { fid: '0000', teamName: 'Free Agent', confId: activeConfId };
            const isFA = owner.fid === '0000';
            const isMyTeam = owner.fid === activeUserFid;

            const mktVal = cachedFcMap[pid] || cachedFcMap[unpadded] || 0;
            const ytdPts = cachedYtdScores[pid] || cachedYtdScores[unpadded] || 0;
            const ppg = cachedAvgScores[pid] || cachedAvgScores[unpadded] || (ytdPts > 0 ? ytdPts / 1 : 0);

            // Weekly Scores History
            const weeklyScores = cachedWeeklyScoresMap[unpadded] || {};

            // Acquisition info
            let acqInfo = 'FA';
            if (!isFA) {
                const txInfo = cachedTransactionsMap[unpadded] || cachedTransactionsMap[pid];
                acqInfo = txInfo ? txInfo.type : 'Rostered';
            }

            masterList.push({
                id: pid,
                name: pInfo.name,
                rawName: pInfo.rawName,
                pos: pInfo.pos,
                nflTeam: pInfo.team,
                bye: pInfo.bye,
                mktVal: mktVal,
                ytdPts: ytdPts,
                ppg: ppg,
                weeklyScores: weeklyScores,
                fid: owner.fid,
                statusText: isFA ? 'Free Agent' : owner.teamName,
                isFA: isFA,
                isMyTeam: isMyTeam,
                acqInfo: acqInfo,
                valDelta: 0,
                badgeType: null // 'lowestFloor' | 'upgradeable' | null
            });
        });

        return masterList;
    }

    // Compute Positional Roster Floors for Active User
    function calculateActiveUserFloors(masterList) {
        const myPlayers = masterList.filter(p => p.isMyTeam);

        const posFloors = {
            QB: { lowestVal: Infinity, lowestPlayer: null, hasFAUpgrade: false, topFaVal: 0 },
            RB: { lowestVal: Infinity, lowestPlayer: null, hasFAUpgrade: false, topFaVal: 0 },
            WR: { lowestVal: Infinity, lowestPlayer: null, hasFAUpgrade: false, topFaVal: 0 },
            TE: { lowestVal: Infinity, lowestPlayer: null, hasFAUpgrade: false, topFaVal: 0 },
            FLEX: { lowestVal: Infinity, lowestPlayer: null, hasFAUpgrade: false, topFaVal: 0 },
            PK: { lowestVal: Infinity, lowestPlayer: null, hasFAUpgrade: false, topFaVal: 0 },
            DEF: { lowestVal: Infinity, lowestPlayer: null, hasFAUpgrade: false, topFaVal: 0 }
        };

        // Find lowest rostered market value per position
        myPlayers.forEach(p => {
            const pos = p.pos;
            if (posFloors[pos]) {
                if (p.mktVal < posFloors[pos].lowestVal) {
                    posFloors[pos].lowestVal = p.mktVal;
                    posFloors[pos].lowestPlayer = p;
                }
            }
            if (['RB', 'WR', 'TE'].includes(pos)) {
                if (p.mktVal < posFloors.FLEX.lowestVal) {
                    posFloors.FLEX.lowestVal = p.mktVal;
                    posFloors.FLEX.lowestPlayer = p;
                }
            }
        });

        Object.keys(posFloors).forEach(pos => {
            if (posFloors[pos].lowestVal === Infinity) {
                posFloors[pos].lowestVal = 0;
            }
        });

        // Find top Free Agent value per position in active conference
        const faPlayers = masterList.filter(p => p.isFA);
        faPlayers.forEach(p => {
            const pos = p.pos;
            if (posFloors[pos] && p.mktVal > posFloors[pos].topFaVal) {
                posFloors[pos].topFaVal = p.mktVal;
            }
            if (['RB', 'WR', 'TE'].includes(pos) && p.mktVal > posFloors.FLEX.topFaVal) {
                posFloors.FLEX.topFaVal = p.mktVal;
            }
        });

        // Evaluate if FAs exceed roster floor ($1+)
        Object.keys(posFloors).forEach(pos => {
            posFloors[pos].hasFAUpgrade = posFloors[pos].topFaVal > posFloors[pos].lowestVal;
        });

        return posFloors;
    }

    // Apply Deltas and Badges
    function annotateMasterList(masterList, posFloors) {
        const faPlayers = masterList.filter(p => p.isFA);

        faPlayers.forEach(p => {
            const pos = p.pos;
            const floorObj = posFloors[pos] || posFloors.FLEX;
            const myFloor = floorObj ? floorObj.lowestVal : 0;
            p.valDelta = p.mktVal - myFloor;
        });

        const myPlayers = masterList.filter(p => p.isMyTeam);
        const posGroups = {};
        myPlayers.forEach(p => {
            if (!posGroups[p.pos]) posGroups[p.pos] = [];
            posGroups[p.pos].push(p);
        });

        Object.keys(posGroups).forEach(pos => {
            const group = posGroups[pos];
            group.sort((a, b) => a.mktVal - b.mktVal);

            const topFaVal = posFloors[pos] ? posFloors[pos].topFaVal : 0;

            group.forEach((p, idx) => {
                const isLowestInGroup = (idx === 0);
                if (topFaVal > p.mktVal) {
                    p.badgeType = isLowestInGroup ? 'lowestFloor' : 'upgradeable';
                } else {
                    p.badgeType = null;
                }
            });
        });
    }

    // Render Conference Selector in Toolbar
    function renderConferenceSelector() {
        const wrapper = document.getElementById('dnfl-waivers-conf-wrapper');
        if (!wrapper) return;

        const confList = toArray(cachedLeagueInfo?.conferences?.conference);
        if (confList.length <= 1) {
            wrapper.innerHTML = '';
            return;
        }

        let optionsHtml = '';
        confList.forEach(c => {
            const cid = String(c.id).trim();
            const cName = c.name || `Conference ${cid}`;
            const selected = String(cid) === String(activeConfId) ? 'selected' : '';
            optionsHtml += `<option value="${cid}" ${selected}>${cName}</option>`;
        });

        wrapper.innerHTML = `
            <label for="dnfl-waivers-conf-select" class="dnfl-label">Conf:</label>
            <select id="dnfl-waivers-conf-select" class="dnfl-select">
                ${optionsHtml}
            </select>
        `;

        const selectEl = document.getElementById('dnfl-waivers-conf-select');
        if (selectEl) {
            selectEl.addEventListener('change', () => {
                activeConfId = selectEl.value;
                rebuildAndRender();
            });
        }
    }

    // Render Banner Floor Pills
    function renderSummaryBanner(posFloors) {
        const bannerEl = document.getElementById('dnfl-waivers-banner-pills');
        if (!bannerEl) return;

        const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'PK', 'DEF'];
        let html = '';

        positions.forEach(pos => {
            const floorObj = posFloors[pos];
            if (!floorObj) return;

            const isSecure = !floorObj.hasFAUpgrade;
            const valStr = `$${floorObj.lowestVal.toLocaleString()}`;
            const statusClass = isSecure ? 'dnfl-floor-pill--secure' : 'dnfl-floor-pill--active';
            const secureTag = isSecure ? ' ✓' : '';

            html += `
                <button type="button" class="dnfl-floor-pill ${statusClass}" data-pos="${pos}">
                    <span class="dnfl-floor-pill__label">${pos}:</span>
                    <span class="dnfl-floor-pill__value">${valStr}${secureTag}</span>
                </button>
            `;
        });

        bannerEl.innerHTML = html;

        bannerEl.querySelectorAll('.dnfl-floor-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const pos = btn.getAttribute('data-pos');
                currentViewMode = 'waiverTargets';
                currentPosFilter = pos;

                const posSelect = document.getElementById('dnfl-waivers-pos-filter');
                if (posSelect) posSelect.value = pos;

                updateViewToggleButtons();
                renderTable();
            });
        });
    }

    // Update Toolbar Buttons State
    function updateViewToggleButtons() {
        document.querySelectorAll('.dnfl-toolbar-view-btn').forEach(btn => {
            const mode = btn.getAttribute('data-mode');
            if (mode === currentViewMode) {
                btn.classList.add('dnfl-btn-primary');
                btn.classList.remove('dnfl-btn-secondary');
            } else {
                btn.classList.add('dnfl-btn-secondary');
                btn.classList.remove('dnfl-btn-primary');
            }
        });
    }

    // Render Main Table Data
    function renderTable() {
        const tableHeadEl = document.getElementById('dnfl-waivers-thead');
        const tableBodyEl = document.getElementById('dnfl-waivers-tbody');
        const countSummaryEl = document.getElementById('dnfl-waivers-count-summary');
        if (!tableBodyEl || !tableHeadEl) return;

        const masterList = window.DNFL_WAIVERS_MASTER_DATA || [];
        const currentWk = parseInt(cachedLeagueInfo?.currentWk || 1, 10);

        // 1. Filter Data
        let filtered = masterList.slice();

        if (currentViewMode === 'waiverTargets') {
            filtered = filtered.filter(p => p.isFA && p.valDelta > 0);
        } else if (currentViewMode === 'myRoster') {
            filtered = filtered.filter(p => p.isMyTeam);
        }

        if (currentPosFilter !== 'ALL') {
            if (currentPosFilter === 'FLEX') {
                filtered = filtered.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
            } else {
                filtered = filtered.filter(p => p.pos === currentPosFilter);
            }
        }

        if (currentStatusFilter === 'FA') {
            filtered = filtered.filter(p => p.isFA);
        } else if (currentStatusFilter === 'MY_ROSTER') {
            filtered = filtered.filter(p => p.isMyTeam);
        } else if (currentStatusFilter === 'RIVAL_ROSTER') {
            filtered = filtered.filter(p => !p.isFA && !p.isMyTeam);
        }

        if (currentSearchTerm) {
            const term = cleanSearchStr(currentSearchTerm);
            filtered = filtered.filter(p => {
                return cleanSearchStr(p.name).includes(term) ||
                       cleanSearchStr(p.rawName).includes(term) ||
                       cleanSearchStr(p.nflTeam).includes(term) ||
                       cleanSearchStr(p.pos).includes(term) ||
                       cleanSearchStr(p.statusText).includes(term);
            });
        }

        // 2. Sort Data
        filtered.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
            return 0;
        });

        // 3. Render Header
        let headHtml = `
            <tr>
                <th class="dnfl-th-index dnfl-sticky-col-1">#</th>
                <th class="dnfl-th-player dnfl-sticky-col-2 dnfl-sortable" data-sort="name">Player ${getSortIcon('name')}</th>
                <th class="dnfl-th-pos dnfl-sortable" data-sort="pos">Pos ${getSortIcon('pos')}</th>
                <th class="dnfl-th-nfl dnfl-sortable" data-sort="nflTeam">NFL ${getSortIcon('nflTeam')}</th>
                <th class="dnfl-th-val dnfl-sortable" data-sort="mktVal">Val ${getSortIcon('mktVal')}</th>
        `;

        if (currentViewMode === 'waiverTargets' || currentViewMode === 'allPlayers') {
            headHtml += `<th class="dnfl-th-delta dnfl-sortable" data-sort="valDelta">Delta ${getSortIcon('valDelta')}</th>`;
        }

        headHtml += `
                <th class="dnfl-th-pts dnfl-sortable" data-sort="ytdPts">Pts ${getSortIcon('ytdPts')}</th>
                <th class="dnfl-th-ppg dnfl-sortable" data-sort="ppg">PPG ${getSortIcon('ppg')}</th>
        `;

        // Weekly columns
        for (let w = 1; w <= currentWk; w++) {
            headHtml += `<th class="dnfl-th-wk dnfl-sortable" data-sort="W${w}">W${w}</th>`;
        }

        headHtml += `<th class="dnfl-th-bye dnfl-sortable" data-sort="bye">Bye ${getSortIcon('bye')}</th>`;

        if (currentViewMode === 'myRoster') {
            headHtml += `<th class="dnfl-th-acq dnfl-sortable" data-sort="acqInfo">Acquired ${getSortIcon('acqInfo')}</th>`;
        } else {
            headHtml += `<th class="dnfl-th-status dnfl-sortable" data-sort="statusText">Status ${getSortIcon('statusText')}</th>`;
        }

        headHtml += `</tr>`;
        tableHeadEl.innerHTML = headHtml;

        // 4. Render Rows
        if (filtered.length === 0) {
            const colSpan = 8 + currentWk + (currentViewMode === 'myRoster' ? 0 : 1);
            tableBodyEl.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" class="dnfl-td-empty">
                        <i class="fa-solid fa-circle-info"></i> No players found matching the selected criteria.
                    </td>
                </tr>
            `;
            if (countSummaryEl) countSummaryEl.textContent = `Showing 0 players`;
            return;
        }

        let bodyHtml = '';
        filtered.forEach((p, idx) => {
            const rankIndex = idx + 1;
            const rowClass = p.isMyTeam ? 'dnfl-row-my-team' : (idx % 2 === 0 ? 'dnfl-row-even' : 'dnfl-row-odd');
            const posBadgeClass = `dnfl-pos-badge dnfl-pos-${p.pos.toLowerCase()}`;

            let valDisplay = `$${p.mktVal.toLocaleString()}`;
            if (currentViewMode === 'myRoster' && p.badgeType) {
                if (p.badgeType === 'lowestFloor') {
                    valDisplay += ` <span class="dnfl-badge-replace-red">Lowest Floor</span>`;
                } else if (p.badgeType === 'upgradeable') {
                    valDisplay += ` <span class="dnfl-badge-replace-amber">Upgradeable</span>`;
                }
            }

            let deltaDisplay = '--';
            if (p.valDelta > 0) {
                deltaDisplay = `<span class="dnfl-badge-green">+$${p.valDelta.toLocaleString()}</span>`;
            }

            bodyHtml += `
                <tr class="${rowClass}">
                    <td class="dnfl-td-index dnfl-sticky-col-1">${rankIndex}</td>
                    <td class="dnfl-td-player dnfl-sticky-col-2">${p.name}</td>
                    <td class="dnfl-td-pos"><span class="${posBadgeClass}">${p.pos}</span></td>
                    <td class="dnfl-td-nfl">${p.nflTeam}</td>
                    <td class="dnfl-td-val">${valDisplay}</td>
            `;

            if (currentViewMode === 'waiverTargets' || currentViewMode === 'allPlayers') {
                bodyHtml += `<td class="dnfl-td-delta">${deltaDisplay}</td>`;
            }

            bodyHtml += `
                    <td class="dnfl-td-pts">${p.ytdPts.toFixed(1)}</td>
                    <td class="dnfl-td-ppg">${p.ppg.toFixed(1)}</td>
            `;

            // Render Weekly Scores
            for (let w = 1; w <= currentWk; w++) {
                const wPts = p.weeklyScores[`W${w}`];
                const wDisplay = (wPts !== undefined && wPts !== null) ? wPts.toFixed(1) : '--';
                bodyHtml += `<td class="dnfl-td-wk">${wDisplay}</td>`;
            }

            bodyHtml += `<td class="dnfl-td-bye">${p.bye}</td>`;

            if (currentViewMode === 'myRoster') {
                bodyHtml += `<td class="dnfl-td-acq">${p.acqInfo}</td>`;
            } else {
                const statusBadge = p.isFA ? `<span class="dnfl-badge-fa">Free Agent</span>` : p.statusText;
                bodyHtml += `<td class="dnfl-td-status">${statusBadge}</td>`;
            }

            bodyHtml += `</tr>`;
        });

        tableBodyEl.innerHTML = bodyHtml;

        if (countSummaryEl) {
            const confName = cachedConfMap[norm(activeConfId)] || `Conference ${activeConfId}`;
            countSummaryEl.textContent = `Showing ${filtered.length} players (${confName})`;
        }

        // Bind Sort Events
        tableHeadEl.querySelectorAll('.dnfl-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (currentSortColumn === col) {
                    currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortColumn = col;
                    currentSortDir = 'desc';
                }
                renderTable();
            });
        });
    }

    function getSortIcon(col) {
        if (currentSortColumn !== col) return '<i class="fa-solid fa-sort dnfl-sort-icon-muted"></i>';
        return currentSortDir === 'asc' ? '<i class="fa-solid fa-sort-up"></i>' : '<i class="fa-solid fa-sort-down"></i>';
    }

    function bindToolbarEvents() {
        // Mode toggle
        document.querySelectorAll('.dnfl-toolbar-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentViewMode = btn.getAttribute('data-mode');
                if (currentViewMode === 'waiverTargets') {
                    currentSortColumn = 'valDelta';
                    currentSortDir = 'desc';
                } else if (currentViewMode === 'myRoster') {
                    currentSortColumn = 'mktVal';
                    currentSortDir = 'asc';
                } else {
                    currentSortColumn = 'mktVal';
                    currentSortDir = 'desc';
                }
                updateViewToggleButtons();
                renderTable();
            });
        });

        // Position dropdown
        const posSelect = document.getElementById('dnfl-waivers-pos-filter');
        if (posSelect) {
            posSelect.addEventListener('change', () => {
                currentPosFilter = posSelect.value;
                renderTable();
            });
        }

        // Status dropdown
        const statusSelect = document.getElementById('dnfl-waivers-status-filter');
        if (statusSelect) {
            statusSelect.addEventListener('change', () => {
                currentStatusFilter = statusSelect.value;
                renderTable();
            });
        }

        // Search input
        const searchInput = document.getElementById('dnfl-waivers-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                currentSearchTerm = searchInput.value;
                renderTable();
            });
        }
    }

    function rebuildAndRender() {
        const masterList = buildMasterPlayerList();
        const posFloors = calculateActiveUserFloors(masterList);
        annotateMasterList(masterList, posFloors);

        window.DNFL_WAIVERS_MASTER_DATA = masterList;
        window.DNFL_WAIVERS_FLOORS = posFloors;

        renderSummaryBanner(posFloors);
        renderTable();
    }

    async function init() {
        const container = document.getElementById('dnfl-waivers-container');
        if (!container) {
            if (initRetries < MAX_RETRIES) {
                initRetries++;
                setTimeout(init, RETRY_INTERVAL);
            }
            return;
        }

        try {
            await loadData();
            renderConferenceSelector();
            rebuildAndRender();
            bindToolbarEvents();
            updateViewToggleButtons();

            console.log('[DNFL Waivers v4.03] Module initialized successfully.');
        } catch (err) {
            console.error('[DNFL Waivers v4.03 Error]:', err);
            const summaryEl = document.getElementById('dnfl-waivers-count-summary');
            if (summaryEl) {
                summaryEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error loading waivers module: ${err.message}`;
            }
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
    window.addEventListener('dnfl:ready', init);

    window.DNFL.Waivers = {
        init: init,
        renderTable: renderTable,
        getFloors: () => window.DNFL_WAIVERS_FLOORS,
        getMasterData: () => window.DNFL_WAIVERS_MASTER_DATA
    };

})();
