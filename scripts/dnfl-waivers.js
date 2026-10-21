/**
 * Duke Networking Fantasy League (DNFL) - Waiver Target & Player Matrix Module v1.0
 * File: scripts/dnfl-waivers.js
 * 
 * Provides:
 * 1. Waiver Target Engine: Identifies FA market value upgrades ($1+) over your roster floor.
 * 2. My Roster View: Shows team valuation, replaceability badges (Red = Floor, Amber = Upgradeable), and acquisition info.
 * 3. All Players Matrix: Full league player database with weekly scoring history and status.
 * 4. Full PK and DEF support across all views.
 */

(function () {
    'use strict';

    if (window.DNFLWaiversLoaded) return;
    window.DNFLWaiversLoaded = true;

    // Namespace initialization
    window.DNFL = window.DNFL || {};

    let cachedLeagueInfo = null;
    let cachedPlayersMap = null;
    let cachedRosters = null;
    let cachedYtdScores = null;
    let cachedWeeklyScoresMap = {};
    let cachedFcMap = null;
    let cachedTransactionsMap = {};
    let activeUserFid = null;

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

    function norm(val) {
        return String(val || '').trim().toLowerCase();
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
            const parts = clean.split(',');
            const last = parts[0].trim();
            const first = parts.slice(1).join(',').trim();
            return `${first} ${last}`;
        }
        return clean;
    }

    function resolveActiveUser() {
        if (window.DNFL?.currentFranchiseId) return normFranchiseId(window.DNFL.currentFranchiseId);
        if (window.mflFranchiseId || window.mfl_franchise_id) return normFranchiseId(window.mflFranchiseId || window.mfl_franchise_id);
        if (typeof window.mflCookie !== 'undefined' && window.mflCookie.franchise_id) {
            return normFranchiseId(window.mflCookie.franchise_id);
        }
        return '0001'; // Fallback to 0001
    }

    function getFranchiseName(fid) {
        const normFid = normFranchiseId(fid);
        const fList = cachedLeagueInfo?.franchises?.franchise || [];
        const fObj = fList.find(f => normFranchiseId(f.id) === normFid);
        return fObj ? (fObj.name || `Franchise ${normFid}`) : (normFid === '0000' ? 'Free Agent' : `Franchise ${normFid}`);
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
                const arr = JSON.parse(rawJson);
                if (Array.isArray(arr)) {
                    arr.forEach(item => {
                        const pid = String(item.mflId || item.id || item.mfl_id || '').trim();
                        const unpadded = pid.replace(/^0+/, '');
                        const padded = unpadded.padStart(4, '0');
                        const val = parseFloat(item.value || item.tradeValue || item.trade_value || 0);
                        if (pid) {
                            fcMap[pid] = val;
                            fcMap[unpadded] = val;
                            fcMap[padded] = val;
                        }
                    });
                }
            } catch (err) {
                console.warn('[DNFL Waivers] Failed to parse FantasyCalc JSON:', err);
            }
        }
        return fcMap;
    }

    // Load all data endpoints concurrently
    async function loadData() {
        const client = getApiClient();
        if (!client) throw new Error('DNFL.Client middleware not found.');

        activeUserFid = resolveActiveUser();

        const [leagueRes, playersRes, rostersRes, ytdRes, transRes] = await Promise.all([
            client.fetchData('league', { COLUMN_NAMES: 1 }),
            client.fetchData('players', { DETAILS: 1 }),
            client.fetchData('rosters', {}),
            client.fetchData('playerScores', { W: 'YTD' }),
            client.fetchData('transactions', { TRANS_TYPE: 'DEFAULT' }).catch(() => null)
        ]);

        cachedLeagueInfo = leagueRes?.league || {};
        const currentWk = parseInt(cachedLeagueInfo.currentWk || 1, 10);

        // Map players
        cachedPlayersMap = {};
        const playerList = Array.isArray(playersRes?.players?.player) ? playersRes.players.player : [];
        playerList.forEach(p => {
            const pid = String(p.id).trim();
            const unpadded = pid.replace(/^0+/, '');
            const padded = unpadded.padStart(4, '0');
            const pObj = {
                id: pid,
                name: formatPlayerName(p.name || `Player ${pid}`),
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
        const scoreList = Array.isArray(ytdRes?.playerScores?.playerScore) ? ytdRes.playerScores.playerScore : [];
        scoreList.forEach(ps => {
            const pid = String(ps.id).trim();
            const unpadded = pid.replace(/^0+/, '');
            const pts = parseFloat(ps.score || 0);
            cachedYtdScores[pid] = pts;
            cachedYtdScores[unpadded] = pts;
        });

        // Transactions Map (for Acquisition origin: Draft / BBID / FCFS)
        cachedTransactionsMap = {};
        if (transRes?.transactions?.transaction) {
            const tList = Array.isArray(transRes.transactions.transaction) ? transRes.transactions.transaction : [transRes.transactions.transaction];
            tList.forEach(t => {
                const type = (t.type || '').toUpperCase();
                const fid = normFranchiseId(t.franchise);
                const rawTx = String(t.transaction || t.description || '');
                // Match player IDs in transaction details
                const pids = rawTx.match(/\b\d{4,5}\b/g) || [];
                pids.forEach(pid => {
                    const cleanPid = String(pid).trim().replace(/^0+/, '');
                    if (!cachedTransactionsMap[cleanPid]) {
                        let acqText = 'Free Agent Add';
                        if (type.includes('BBID') || t.bid) {
                            acqText = `Waiver ($${parseFloat(t.bid || 0).toFixed(0)})`;
                        } else if (type.includes('TRADE')) {
                            acqText = 'Trade';
                        } else if (type.includes('DRAFT')) {
                            acqText = 'Drafted';
                        } else {
                            acqText = 'Free Agent';
                        }
                        cachedTransactionsMap[cleanPid] = { fid, type: acqText };
                    }
                });
            });
        }

        // Load Market Values
        cachedFcMap = await fetchFantasyCalcMap(currentWk);
    }

    // Build Master Dataset
    function buildMasterPlayerList() {
        const masterList = [];
        const currentWk = parseInt(cachedLeagueInfo?.currentWk || 1, 10);

        // 1. Build Roster Ownership Map
        const ownershipMap = {}; // pid -> { fid, ownerName, teamName, status }
        const rosterFranchises = Array.isArray(cachedRosters?.franchise) ? cachedRosters.franchise : [];
        rosterFranchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            const teamName = getFranchiseName(fid);
            const players = Array.isArray(f.player) ? f.player : (f.player ? [f.player] : []);
            players.forEach(p => {
                const pid = String(p.id).trim();
                const unpadded = pid.replace(/^0+/, '');
                ownershipMap[pid] = { fid, teamName, status: p.status || 'ROSTER' };
                ownershipMap[unpadded] = ownershipMap[pid];
            });
        });

        // 2. Iterate all players in map
        const processedPids = new Set();
        Object.keys(cachedPlayersMap).forEach(key => {
            const pInfo = cachedPlayersMap[key];
            if (!pInfo || processedPids.has(pInfo.id)) return;
            processedPids.add(pInfo.id);

            const pid = pInfo.id;
            const unpadded = pid.replace(/^0+/, '');
            const owner = ownershipMap[pid] || ownershipMap[unpadded] || { fid: '0000', teamName: 'Free Agent', status: 'FA' };
            const isFA = owner.fid === '0000';
            const isMyTeam = owner.fid === activeUserFid;

            const mktVal = cachedFcMap[pid] || cachedFcMap[unpadded] || 0;
            const ytdPts = cachedYtdScores[pid] || cachedYtdScores[unpadded] || 0;
            const ppg = currentWk > 0 ? (ytdPts / currentWk) : 0;

            // Acquisition info
            let acqInfo = 'FA';
            if (!isFA) {
                const txInfo = cachedTransactionsMap[unpadded] || cachedTransactionsMap[pid];
                acqInfo = txInfo ? txInfo.type : 'Rostered';
            }

            masterList.push({
                id: pid,
                name: pInfo.name,
                pos: pInfo.pos,
                nflTeam: pInfo.team,
                bye: pInfo.bye,
                mktVal: mktVal,
                ytdPts: ytdPts,
                ppg: ppg,
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
            // FLEX evaluation for RB, WR, TE
            if (['RB', 'WR', 'TE'].includes(pos)) {
                if (p.mktVal < posFloors.FLEX.lowestVal) {
                    posFloors.FLEX.lowestVal = p.mktVal;
                    posFloors.FLEX.lowestPlayer = p;
                }
            }
        });

        // Fix Infinity if position has no rostered players
        Object.keys(posFloors).forEach(pos => {
            if (posFloors[pos].lowestVal === Infinity) {
                posFloors[pos].lowestVal = 0;
            }
        });

        // Find top Free Agent value per position
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

    // Apply Deltas and Badges to Master Dataset
    function annotateMasterList(masterList, posFloors) {
        const faPlayers = masterList.filter(p => p.isFA);

        // Annotate Free Agents with Value Delta vs lowest rostered player at position
        faPlayers.forEach(p => {
            const pos = p.pos;
            const floorObj = posFloors[pos] || posFloors.FLEX;
            const myFloor = floorObj ? floorObj.lowestVal : 0;
            const delta = p.mktVal - myFloor;
            p.valDelta = delta;
        });

        // Annotate My Roster players with Replaceability Badges
        const myPlayers = masterList.filter(p => p.isMyTeam);

        // Group my players by position to find lowest and upgradeable
        const posGroups = {};
        myPlayers.forEach(p => {
            if (!posGroups[p.pos]) posGroups[p.pos] = [];
            posGroups[p.pos].push(p);
        });

        Object.keys(posGroups).forEach(pos => {
            const group = posGroups[pos];
            group.sort((a, b) => a.mktVal - b.mktVal); // Lowest market value first

            const topFaVal = posFloors[pos] ? posFloors[pos].topFaVal : 0;

            group.forEach((p, idx) => {
                const isLowestInGroup = (idx === 0);
                if (topFaVal > p.mktVal) { // FA is worth $1+ more
                    if (isLowestInGroup) {
                        p.badgeType = 'lowestFloor'; // 🔴 Red
                    } else {
                        p.badgeType = 'upgradeable';  // 🟠 Amber
                    }
                } else {
                    p.badgeType = null; // Position secure
                }
            });
        });
    }

    // Render Banner
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

        // Bind click events to pills to set position filter & view
        bannerEl.querySelectorAll('.dnfl-floor-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const pos = btn.getAttribute('data-pos');
                currentViewMode = 'waiverTargets';
                currentPosFilter = pos;

                updateViewToggleButtons();
                updatePosFilterButtons();
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

    function updatePosFilterButtons() {
        document.querySelectorAll('.dnfl-toolbar-pos-btn').forEach(btn => {
            const pos = btn.getAttribute('data-pos');
            if (pos === currentPosFilter) {
                btn.classList.add('dnfl-btn-active');
            } else {
                btn.classList.remove('dnfl-btn-active');
            }
        });
    }

    // Render Table Body & Columns
    function renderTable() {
        const tableHeadEl = document.getElementById('dnfl-waivers-thead');
        const tableBodyEl = document.getElementById('dnfl-waivers-tbody');
        const countSummaryEl = document.getElementById('dnfl-waivers-count-summary');
        if (!tableBodyEl || !tableHeadEl) return;

        const masterList = window.DNFL_WAIVERS_MASTER_DATA || [];
        const posFloors = window.DNFL_WAIVERS_FLOORS || {};

        // 1. Filter Data based on Active Mode & Controls
        let filtered = masterList.slice();

        // Mode filter
        if (currentViewMode === 'waiverTargets') {
            filtered = filtered.filter(p => p.isFA && p.valDelta > 0);
        } else if (currentViewMode === 'myRoster') {
            filtered = filtered.filter(p => p.isMyTeam);
        }

        // Position filter
        if (currentPosFilter !== 'ALL') {
            if (currentPosFilter === 'FLEX') {
                filtered = filtered.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
            } else {
                filtered = filtered.filter(p => p.pos === currentPosFilter);
            }
        }

        // Status dropdown filter
        if (currentStatusFilter === 'FA') {
            filtered = filtered.filter(p => p.isFA);
        } else if (currentStatusFilter === 'MY_ROSTER') {
            filtered = filtered.filter(p => p.isMyTeam);
        } else if (currentStatusFilter === 'RIVAL_ROSTER') {
            filtered = filtered.filter(p => !p.isFA && !p.isMyTeam);
        }

        // Search term filter
        if (currentSearchTerm) {
            const term = norm(currentSearchTerm);
            filtered = filtered.filter(p => norm(p.name).includes(term) || norm(p.nflTeam).includes(term) || norm(p.statusText).includes(term));
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
                <th class="dnfl-th-bye dnfl-sortable" data-sort="bye">Bye ${getSortIcon('bye')}</th>
        `;

        if (currentViewMode === 'myRoster') {
            headHtml += `<th class="dnfl-th-acq dnfl-sortable" data-sort="acqInfo">Acquired ${getSortIcon('acqInfo')}</th>`;
        } else {
            headHtml += `<th class="dnfl-th-status dnfl-sortable" data-sort="statusText">Status ${getSortIcon('statusText')}</th>`;
        }

        headHtml += `</tr>`;
        tableHeadEl.innerHTML = headHtml;

        // 4. Render Rows
        if (filtered.length === 0) {
            const colSpan = (currentViewMode === 'myRoster') ? 9 : 10;
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
            const rankIndex = idx + 1; // Always dynamic 1..N
            const rowClass = p.isMyTeam ? 'dnfl-row-my-team' : (idx % 2 === 0 ? 'dnfl-row-even' : 'dnfl-row-odd');

            // Pos badge
            const posBadgeClass = `dnfl-pos-badge dnfl-pos-${p.pos.toLowerCase()}`;

            // Val badge for My Roster
            let valDisplay = `$${p.mktVal.toLocaleString()}`;
            if (currentViewMode === 'myRoster' && p.badgeType) {
                if (p.badgeType === 'lowestFloor') {
                    valDisplay += ` <span class="dnfl-badge-replace-red">Lowest Floor</span>`;
                } else if (p.badgeType === 'upgradeable') {
                    valDisplay += ` <span class="dnfl-badge-replace-amber">Upgradeable</span>`;
                }
            }

            // Delta badge for Waiver Targets / All
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
                    <td class="dnfl-td-bye">${p.bye}</td>
            `;

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
            countSummaryEl.textContent = `Showing ${filtered.length} players`;
        }

        // Bind Header Sorting Click Events
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

    // Bind Control Bar Events
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

        // Position filter
        document.querySelectorAll('.dnfl-toolbar-pos-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPosFilter = btn.getAttribute('data-pos');
                updatePosFilterButtons();
                renderTable();
            });
        });

        // Status dropdown filter
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

    // Main Init Flow
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
            const masterList = buildMasterPlayerList();
            const posFloors = calculateActiveUserFloors(masterList);
            annotateMasterList(masterList, posFloors);

            window.DNFL_WAIVERS_MASTER_DATA = masterList;
            window.DNFL_WAIVERS_FLOORS = posFloors;

            renderSummaryBanner(posFloors);
            bindToolbarEvents();
            updateViewToggleButtons();
            updatePosFilterButtons();
            renderTable();

            console.log('[DNFL Waivers] Module initialized successfully.');
        } catch (err) {
            console.error('[DNFL Waivers Error]:', err);
            const statusEl = document.getElementById('dnfl-waivers-status');
            if (statusEl) {
                statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error loading waivers module: ${err.message}`;
            }
        }
    }

    // Bind Lifecycle Event
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
    window.addEventListener('dnfl:ready', init);

    // Export Public API
    window.DNFL.Waivers = {
        init: init,
        renderTable: renderTable,
        getFloors: () => window.DNFL_WAIVERS_FLOORS,
        getMasterData: () => window.DNFL_WAIVERS_MASTER_DATA
    };

})();
