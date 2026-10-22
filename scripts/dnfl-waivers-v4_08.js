/**
 * Duke Networking Fantasy League (DNFL) - Waiver Target & Player Matrix Module v4.08
 * File: scripts/dnfl-waivers-v4_08.js
 * 
 * Baseline: Built on v4.04 infrastructure.
 * Key Features v4.08:
 * 1. Static Market Value Feed: Fetches strictly from https://dnfl.live/dnfl_market/${year}/fantasycalc_values_current.json.
 *    No synthetic fallback. Explicit UI alert if file is missing/invalid.
 * 2. Default Sort Order: Sorted by Market Value Descending (mktVal desc) across all views.
 * 3. Clean Currency & Delta Badges:
 *    - Val: Clean formatted dollar amount ($850).
 *    - Delta: Houses all comparison badges (Red ⚠️, Amber ↗️, Green +$X, Muted -$X).
 * 4. Keeper-Compliant Standalone Acquired Column:
 *    - Drafted / Traded: Preserves original draft slot (10.05) across trades for keeper cost accuracy.
 *    - Waived & Claimed: Invalidates draft pick if player was waived (explicit DROP/CUT), displaying waiver origin (BB $12.50 / FCFS).
 *    - Free Agents: Displays '-'.
 * 5. Authentic Franchise Status: Displays official MFL Franchise Names in Status column.
 * 6. Strict 6-Position Filtering: Strictly limits player database to QB, RB, WR, TE, PK, DEF.
 * 7. Pure Design Tokens: Uses official CSS custom properties for position chips, row highlights, and sticky hovers.
 */

(function (window, document) {
    'use strict';

    if (window.DNFLWaiversLoaded_v4_08) return;
    window.DNFLWaiversLoaded_v4_08 = true;

    // Namespace initialization
    window.DNFL = window.DNFL || {};

    const ALLOWED_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'PK', 'DEF'];

    let cachedLeagueInfo = null;
    let cachedPlayersMap = null;
    let cachedRosters = null;
    let cachedYtdScoresMap = {};
    let cachedAvgScoresMap = {};
    let cachedWeeklyScoresMap = {};
    let cachedFcMap = null;
    let cachedFcError = false;
    let cachedDraftPickMap = {};
    let cachedWasWaivedSet = new Set();
    let cachedTransAcqMap = {};

    let activeUserFid = '0000';
    let activeConfId = '1';
    let currentViewMode = 'waiverTargets'; // 'waiverTargets', 'allPlayers', 'freeAgents', 'rostered'
    let currentPosFilter = 'ALL';          // 'ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'PK', 'DEF'
    let currentSearchTerm = '';
    let currentSortColumn = 'mktVal';      // Default sort column (Market Value)
    let currentSortDir = 'desc';

    let initRetries = 0;
    const MAX_RETRIES = 10;
    const RETRY_INTERVAL = 250;

    function getApiClient() {
        return window.DNFL && window.DNFL.Client ? window.DNFL.Client : null;
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function normFranchiseId(fid) {
        if (!fid) return '0000';
        const str = String(fid).trim();
        return str.padStart(4, '0');
    }

    function formatPlayerName(rawName) {
        if (!rawName) return 'Unknown Player';
        if (rawName.includes(',')) {
            const parts = rawName.split(',');
            const lastName = parts[0].trim();
            const firstName = parts.slice(1).join(',').trim();
            return `${firstName} ${lastName}`.trim();
        }
        return rawName.trim();
    }

    function resolveActiveUser() {
        if (window.franchise_id) return normFranchiseId(window.franchise_id);
        const urlParams = new URLSearchParams(window.location.search);
        const fidParam = urlParams.get('FRANCHISE') || urlParams.get('F') || urlParams.get('fid');
        if (fidParam) return normFranchiseId(fidParam);
        return '0000';
    }

    function buildConferenceMap(leagueInfo) {
        const divToConfMap = {};
        const rawDivisions = toArray(leagueInfo?.divisions?.division);
        rawDivisions.forEach(d => {
            if (d && d.id) {
                divToConfMap[String(d.id)] = String(d.conference || '');
            }
        });

        const franchiseMap = {};
        const franchiseConfMap = {};
        const rawFranchises = toArray(leagueInfo?.franchises?.franchise);
        rawFranchises.forEach(f => {
            if (f && f.id) {
                const fid = normFranchiseId(f.id);
                franchiseMap[fid] = f.name || `Franchise ${fid}`;
                const divId = String(f.division || '');
                const confId = String(f.conference || f.conf || divToConfMap[divId] || '1');
                franchiseConfMap[fid] = confId;
            }
        });

        return { franchiseMap, franchiseConfMap };
    }

    function getFranchiseName(fid) {
        if (!cachedLeagueInfo) return `Franchise ${fid}`;
        const { franchiseMap } = buildConferenceMap(cachedLeagueInfo);
        return franchiseMap[fid] || `Franchise ${fid}`;
    }

    // Static FantasyCalc API Fetcher
    async function fetchFantasyCalcMap() {
        const client = getApiClient();
        const year = cachedLeagueInfo?.year || '2026';
        const targetUrl = `https://dnfl.live/dnfl_market/${year}/fantasycalc_values_current.json`;

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
                const playerArray = Array.isArray(arr) ? arr : (arr.players || []);
                if (playerArray.length > 0) {
                    playerArray.forEach(item => {
                        const pObj = item.player || item;
                        const mflId = item.mflId || item.mfl_id || pObj.mflId || pObj.mfl_id || item.id || pObj.id;
                        if (mflId !== undefined && mflId !== null && mflId !== '') {
                            const val = parseFloat(item.value || item.tradeValue || pObj.value || pObj.tradeValue || 0);
                            const rawId = String(mflId).trim();
                            const unpaddedId = rawId.replace(/^0+/, '') || '0';
                            const paddedId = unpaddedId.padStart(4, '0');

                            fcMap[rawId] = val;
                            fcMap[unpaddedId] = val;
                            fcMap[paddedId] = val;
                        }
                    });
                    cachedFcError = false;
                    return fcMap;
                }
            } catch (err) {
                console.error('[DNFL Waivers] ERROR parsing FantasyCalc JSON from fantasycalc_values_current.json:', err);
            }
        }

        // If fetch failed or invalid JSON or 0 players: mark error state
        console.error('[DNFL Waivers] ERROR: Unable to load FantasyCalc values from fantasycalc_values_current.json');
        cachedFcError = true;
        return null;
    }

    // Load all data endpoints concurrently
    async function loadData() {
        const client = getApiClient();
        if (!client) throw new Error('DNFL.Client middleware not found.');

        activeUserFid = resolveActiveUser();

        const [leagueRes, playersRes, rostersRes, ytdRes, avgRes, transRes, draftRes] = await Promise.all([
            client.fetchData('league', { COLUMN_NAMES: 1 }),
            client.fetchData('players', { DETAILS: 1 }),
            client.fetchData('rosters', {}),
            client.fetchData('playerScores', { W: 'YTD' }),
            client.fetchData('playerScores', { W: 'AVG' }),
            client.fetchData('transactions', { TRANS_TYPE: 'DEFAULT' }).catch(() => null),
            client.fetchData('draftResults', {}).catch(() => null)
        ]);

        cachedLeagueInfo = leagueRes?.league || {};
        const currentWk = parseInt(cachedLeagueInfo.currentWk || 1, 10);

        // Map Conference IDs
        const { franchiseConfMap } = buildConferenceMap(cachedLeagueInfo);
        activeConfId = (activeUserFid !== '0000' && franchiseConfMap[activeUserFid]) ? franchiseConfMap[activeUserFid] : '1';

        // Map players - strictly filter for ALLOWED_POSITIONS
        cachedPlayersMap = {};
        const playerList = toArray(playersRes?.players?.player);
        playerList.forEach(p => {
            const pos = (p.position || p.pos || 'N/A').toUpperCase();
            if (!ALLOWED_POSITIONS.includes(pos)) return; // Exclude non-active positions

            const pid = String(p.id).trim();
            const unpadded = pid.replace(/^0+/, '');
            const padded = unpadded.padStart(4, '0');
            const rawName = String(p.name || `Player ${pid}`).trim();
            const formattedName = formatPlayerName(rawName);

            // Read native bye_week parameter directly from MFL player object
            const rawBye = p.bye_week || p.byeWeek || p.bye;
            const byeStr = rawBye ? `W${rawBye}` : '-';

            const pObj = {
                id: pid,
                rawName: rawName,
                name: formattedName,
                pos: pos,
                team: (p.team || p.nflTeam || 'FA').toUpperCase(),
                bye: byeStr
            };
            cachedPlayersMap[pid] = pObj;
            cachedPlayersMap[unpadded] = pObj;
            cachedPlayersMap[padded] = pObj;
        });

        cachedRosters = rostersRes?.rosters || {};

        // YTD & AVG Scores Map
        cachedYtdScoresMap = {};
        const ytdScoreList = toArray(ytdRes?.playerScores?.playerScore);
        ytdScoreList.forEach(ps => {
            const pid = String(ps.id).trim();
            const unpadded = pid.replace(/^0+/, '');
            const pts = parseFloat(ps.score || 0);
            cachedYtdScoresMap[pid] = pts;
            cachedYtdScoresMap[unpadded] = pts;
        });

        cachedAvgScoresMap = {};
        const avgScoreList = toArray(avgRes?.playerScores?.playerScore);
        avgScoreList.forEach(ps => {
            const pid = String(ps.id).trim();
            const unpadded = pid.replace(/^0+/, '');
            const ppg = parseFloat(ps.score || 0);
            cachedAvgScoresMap[pid] = ppg;
            cachedAvgScoresMap[unpadded] = ppg;
        });

        // Fetch Weekly Results (W1 .. W_currentWk)
        cachedWeeklyScoresMap = {};
        const weeklyPromises = [];
        for (let w = 1; w <= currentWk; w++) {
            weeklyPromises.push(client.fetchData('playerScores', { W: w }).catch(() => null));
        }
        const weeklyResultsArr = await Promise.all(weeklyPromises);
        weeklyResultsArr.forEach((wRes, idx) => {
            const weekNum = idx + 1;
            const psList = toArray(wRes?.playerScores?.playerScore);
            psList.forEach(ps => {
                const pid = String(ps.id || '').trim();
                const unpadded = pid.replace(/^0+/, '');
                const pts = parseFloat(ps.score || 0);
                if (!cachedWeeklyScoresMap[pid]) cachedWeeklyScoresMap[pid] = {};
                if (!cachedWeeklyScoresMap[unpadded]) cachedWeeklyScoresMap[unpadded] = {};
                cachedWeeklyScoresMap[pid][weekNum] = pts;
                cachedWeeklyScoresMap[unpadded][weekNum] = pts;
            });
        });

        // Parse Draft Pick Results for Active Conference
        cachedDraftPickMap = {};
        const draftPicks = toArray(draftRes?.draftResults?.draftPick);
        draftPicks.forEach(pickObj => {
            const pickFid = normFranchiseId(pickObj.franchise);
            if (franchiseConfMap[pickFid] === activeConfId && pickObj.player) {
                const pid = String(pickObj.player).trim();
                const unpadded = pid.replace(/^0+/, '');
                const round = parseInt(pickObj.round || 0, 10);
                const pick = parseInt(pickObj.pick || 0, 10);
                if (round > 0 && pick > 0) {
                    const formattedSlot = `${round}.${pick.toString().padStart(2, '0')}`;
                    cachedDraftPickMap[pid] = formattedSlot;
                    cachedDraftPickMap[unpadded] = formattedSlot;
                }
            }
        });

        // Transactions Map & Waived Players tracking in Active Conference
        cachedTransAcqMap = {};
        cachedWasWaivedSet = new Set();
        if (transRes?.transactions?.transaction) {
            const tList = toArray(transRes.transactions.transaction);
            tList.forEach(t => {
                const fid = normFranchiseId(t.franchise);
                if (franchiseConfMap[fid] === activeConfId) {
                    const type = (t.type || '').toUpperCase();
                    const rawTx = String(t.transaction || t.description || '');

                    // Track if player was ever explicitly dropped or cut
                    if (type.includes('DROP') || type.includes('CUT') || type.includes('WAIVER_DROP')) {
                        const droppedPids = rawTx.match(/\b\d{4,5}\b/g) || [];
                        droppedPids.forEach(pid => {
                            const cleanPid = String(pid).trim();
                            const unpadded = cleanPid.replace(/^0+/, '');
                            cachedWasWaivedSet.add(cleanPid);
                            cachedWasWaivedSet.add(unpadded);
                        });
                    }

                    const pids = rawTx.match(/\b\d{4,5}\b/g) || [];
                    pids.forEach(pid => {
                        const cleanPid = String(pid).trim();
                        const unpadded = cleanPid.replace(/^0+/, '');

                        if (!cachedTransAcqMap[cleanPid]) {
                            let acqText = 'FCFS';
                            if (type.includes('BBID') || type.includes('WAIVER') || t.bid || t.bbidAmount) {
                                // Extract bid dollar amount
                                let bidAmt = 0;
                                if (t.bbidAmount !== undefined && t.bbidAmount !== '') bidAmt = parseFloat(t.bbidAmount);
                                else if (t.bid !== undefined && t.bid !== '') bidAmt = parseFloat(t.bid);
                                else if (t.amount !== undefined && t.amount !== '') bidAmt = parseFloat(t.amount);
                                else {
                                    const match = rawTx.match(/\$(\d+(\.\d+)?)/);
                                    if (match) bidAmt = parseFloat(match[1]);
                                }
                                acqText = `BB $${bidAmt.toFixed(2)}`;
                            } else if (type.includes('TRADE')) {
                                acqText = 'Trade';
                            } else if (type.includes('FREE_AGENT') || type.includes('ADD')) {
                                acqText = 'FCFS';
                            }
                            cachedTransAcqMap[cleanPid] = acqText;
                            cachedTransAcqMap[unpadded] = acqText;
                        }
                    });
                }
            });
        }

        // Load Market Values
        cachedFcMap = await fetchFantasyCalcMap();
    }

    // Build Master Dataset (Scoped to Active Conference Pool)
    function buildMasterPlayerList() {
        const masterList = [];
        const { franchiseConfMap } = buildConferenceMap(cachedLeagueInfo);

        // 1. Build Conference Roster Ownership Map
        const ownershipMap = {}; // pid -> { fid, ownerName, teamName, status }
        const rosterFranchises = toArray(cachedRosters?.franchise);
        rosterFranchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            // Scope rosters strictly to active conference
            if (franchiseConfMap[fid] === activeConfId) {
                const teamName = getFranchiseName(fid);
                const players = toArray(f.player);
                players.forEach(p => {
                    const pid = String(p.id || p).trim();
                    const unpadded = pid.replace(/^0+/, '');
                    ownershipMap[pid] = { fid, teamName, status: p.status || 'ROSTER' };
                    ownershipMap[unpadded] = ownershipMap[pid];
                });
            }
        });

        // 2. Iterate all players in map (Only allowed positions)
        const processedPids = new Set();
        Object.keys(cachedPlayersMap).forEach(key => {
            const pInfo = cachedPlayersMap[key];
            if (!pInfo || processedPids.has(pInfo.id)) return;
            processedPids.add(pInfo.id);

            const pid = pInfo.id;
            const unpadded = pid.replace(/^0+/, '');
            const owner = ownershipMap[pid] || ownershipMap[unpadded] || { fid: '0000', teamName: 'Free Agent', status: 'FA' };
            const isFA = owner.fid === '0000';
            const isMyTeam = owner.fid === activeUserFid && activeUserFid !== '0000';

            const mktVal = cachedFcMap ? (cachedFcMap[pid] || cachedFcMap[unpadded] || 0) : 0;
            const ytdPts = cachedYtdScoresMap[pid] || cachedYtdScoresMap[unpadded] || 0;
            const ppg = cachedAvgScoresMap[pid] || cachedAvgScoresMap[unpadded] || 0;
            const weeklyScores = cachedWeeklyScoresMap[pid] || cachedWeeklyScoresMap[unpadded] || {};

            // Acquisition info (Keeper-aware):
            // 1. If drafted in active conf AND never dropped -> Keep draft pick slot (10.05) even if traded!
            // 2. If dropped and claimed -> Use waiver acquisition (BB $12.50 / FCFS)
            // 3. Free Agents -> '-'
            let acqInfo = '-';
            const draftSlot = cachedDraftPickMap[pid] || cachedDraftPickMap[unpadded];
            const wasDropped = cachedWasWaivedSet.has(pid) || cachedWasWaivedSet.has(unpadded);
            const transAcq = cachedTransAcqMap[pid] || cachedTransAcqMap[unpadded];

            if (draftSlot && !wasDropped) {
                acqInfo = draftSlot;
            } else if (transAcq) {
                acqInfo = transAcq;
            } else if (!isFA) {
                acqInfo = 'FCFS';
            } else {
                acqInfo = '-';
            }

            masterList.push({
                id: pid,
                rawName: pInfo.rawName,
                name: pInfo.name,
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
                valDelta: 0
            });
        });

        return masterList;
    }

    // Calculate Active User Position Floor Benchmarks & Top FA Values
    function calculateActiveUserFloors(masterList) {
        const posFloors = {
            QB: { lowestVal: 0, topFaVal: 0 },
            RB: { lowestVal: 0, topFaVal: 0 },
            WR: { lowestVal: 0, topFaVal: 0 },
            TE: { lowestVal: 0, topFaVal: 0 },
            FLEX: { lowestVal: 0, topFaVal: 0 },
            PK: { lowestVal: 0, topFaVal: 0 },
            DEF: { lowestVal: 0, topFaVal: 0 }
        };

        const myRosterValByPos = { QB: [], RB: [], WR: [], TE: [], PK: [], DEF: [] };

        masterList.forEach(p => {
            const pos = p.pos;
            if (p.isMyTeam && myRosterValByPos[pos]) {
                myRosterValByPos[pos].push(p.mktVal);
            }
            if (p.isFA) {
                if (posFloors[pos] && p.mktVal > posFloors[pos].topFaVal) {
                    posFloors[pos].topFaVal = p.mktVal;
                }
                if (['RB', 'WR', 'TE'].includes(pos) && p.mktVal > posFloors.FLEX.topFaVal) {
                    posFloors.FLEX.topFaVal = p.mktVal;
                }
            }
        });

        // Calculate lowest roster value (Floor)
        Object.keys(myRosterValByPos).forEach(pos => {
            const vals = myRosterValByPos[pos];
            if (vals.length > 0) {
                posFloors[pos].lowestVal = Math.min(...vals);
            }
        });

        const flexVals = [...myRosterValByPos.RB, ...myRosterValByPos.WR, ...myRosterValByPos.TE];
        if (flexVals.length > 0) {
            posFloors.FLEX.lowestVal = Math.min(...flexVals);
        }

        return posFloors;
    }

    // Annotate Master List with ValDeltas and Badges
    function annotateMasterList(masterList, posFloors) {
        masterList.forEach(p => {
            const pos = p.pos;
            const myFloor = posFloors[pos]?.lowestVal || 0;

            if (p.isFA) {
                p.valDelta = p.mktVal - myFloor;
            } else if (p.isMyTeam) {
                const topFaVal = posFloors[pos]?.topFaVal || 0;
                p.valDelta = p.mktVal - topFaVal;
            } else {
                p.valDelta = 0;
            }
        });
    }

    // Render Summary Banner & Floor Pills
    function renderSummaryBanner(posFloors) {
        const container = document.getElementById('dnfl-waivers-banner');
        if (!container) return;

        const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'PK', 'DEF'];
        let html = '<div class="dnfl-banner-pills-wrapper">';

        positions.forEach(pos => {
            const floorObj = posFloors[pos] || { lowestVal: 0, topFaVal: 0 };
            const isUpgradeable = floorObj.topFaVal > floorObj.lowestVal && floorObj.topFaVal > 0;
            const activeClass = (currentPosFilter === pos) ? 'dnfl-floor-pill--active' : '';
            const statusClass = isUpgradeable ? 'dnfl-floor-pill--upgrade' : 'dnfl-floor-pill--secure';

            const valStr = cachedFcError ? '--' : `$${floorObj.lowestVal.toLocaleString()}`;

            html += `
                <div class="dnfl-floor-pill ${statusClass} ${activeClass}" data-pos="${pos}">
                    <span class="dnfl-floor-pill__label">${pos}:</span>
                    <span class="dnfl-floor-pill__value">${valStr}</span>
                    ${isUpgradeable ? '<i class="fa-solid fa-arrow-trend-up dnfl-pill-icon-amber"></i>' : ''}
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Bind click on pills
        const pills = container.querySelectorAll('.dnfl-floor-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                const clickedPos = pill.getAttribute('data-pos');
                currentPosFilter = (currentPosFilter === clickedPos) ? 'ALL' : clickedPos;
                const posSelect = document.getElementById('dnfl-waivers-pos-filter');
                if (posSelect) posSelect.value = currentPosFilter;
                renderSummaryBanner(posFloors);
                renderTable();
            });
        });
    }

    // Render Master Data Table
    function renderTable() {
        const tableBody = document.getElementById('dnfl-waivers-tbody');
        const tableHead = document.getElementById('dnfl-waivers-thead');
        if (!tableBody || !tableHead) return;

        let masterList = window.DNFL_WAIVERS_MASTER_DATA || [];
        const currentWk = parseInt(cachedLeagueInfo?.currentWk || 1, 10);

        // Filter View Mode
        if (currentViewMode === 'waiverTargets') {
            masterList = masterList.filter(p => p.isFA || p.isMyTeam);
        } else if (currentViewMode === 'freeAgents') {
            masterList = masterList.filter(p => p.isFA);
        } else if (currentViewMode === 'rostered') {
            masterList = masterList.filter(p => !p.isFA);
        }

        // Filter Position
        if (currentPosFilter !== 'ALL') {
            if (currentPosFilter === 'FLEX') {
                masterList = masterList.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
            } else {
                masterList = masterList.filter(p => p.pos === currentPosFilter);
            }
        }

        // Filter Search Term
        if (currentSearchTerm.trim() !== '') {
            const query = currentSearchTerm.toLowerCase().trim();
            masterList = masterList.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.pos.toLowerCase().includes(query) ||
                p.nflTeam.toLowerCase().includes(query) ||
                p.statusText.toLowerCase().includes(query)
            );
        }

        // Sort Master List
        masterList.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
            return 0;
        });

        // Determine Columns to Show
        const showDelta = (currentViewMode === 'waiverTargets' || currentViewMode === 'freeAgents');
        const showStatus = (currentViewMode === 'waiverTargets' || currentViewMode === 'allPlayers' || currentViewMode === 'rostered');
        const showAcquired = (currentViewMode === 'waiverTargets' || currentViewMode === 'allPlayers' || currentViewMode === 'rostered');

        // Build Table Header
        let headHtml = `
            <tr>
                <th class="dnfl-th-index dnfl-sticky-col-1">#</th>
                <th class="dnfl-th-player dnfl-sticky-col-2 dnfl-sortable" data-sort="name">Player ${getSortIcon('name')}</th>
                <th class="dnfl-th-pos dnfl-sortable" data-sort="pos">Pos ${getSortIcon('pos')}</th>
                <th class="dnfl-th-nfl dnfl-sortable" data-sort="nflTeam">NFL ${getSortIcon('nflTeam')}</th>
                <th class="dnfl-th-val dnfl-sortable" data-sort="mktVal">Val ${getSortIcon('mktVal')}</th>
        `;

        if (showDelta) {
            headHtml += `<th class="dnfl-th-delta dnfl-sortable" data-sort="valDelta">Delta ${getSortIcon('valDelta')}</th>`;
        }

        headHtml += `
            <th class="dnfl-th-pts dnfl-sortable" data-sort="ytdPts">Pts ${getSortIcon('ytdPts')}</th>
            <th class="dnfl-th-ppg dnfl-sortable" data-sort="ppg">PPG ${getSortIcon('ppg')}</th>
            <th class="dnfl-th-bye dnfl-sortable" data-sort="bye">Bye ${getSortIcon('bye')}</th>
        `;

        if (showStatus) {
            headHtml += `<th class="dnfl-th-status dnfl-sortable" data-sort="statusText">Status ${getSortIcon('statusText')}</th>`;
        }

        if (showAcquired) {
            headHtml += `<th class="dnfl-th-acq dnfl-sortable" data-sort="acqInfo">Acquired ${getSortIcon('acqInfo')}</th>`;
        }

        for (let w = 1; w <= currentWk; w++) {
            headHtml += `<th class="dnfl-th-wk dnfl-sortable" data-sort="w${w}">W${w} ${getSortIcon(`w${w}`)}</th>`;
        }

        headHtml += '</tr>';
        tableHead.innerHTML = headHtml;

        // Build Table Body
        if (masterList.length === 0) {
            let colSpan = 8 + (showDelta ? 1 : 0) + (showStatus ? 1 : 0) + (showAcquired ? 1 : 0) + currentWk;
            tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="dnfl-td-empty"><i class="fa-solid fa-circle-info"></i> No matching player records found.</td></tr>`;
            return;
        }

        let bodyHtml = '';
        masterList.forEach((p, idx) => {
            let rowClass = (idx % 2 === 0) ? 'dnfl-row-even' : 'dnfl-row-odd';
            if (p.isMyTeam) rowClass = 'dnfl-row-my-team';
            else if (p.isFA && currentViewMode === 'allPlayers') rowClass = 'dnfl-row-fa';

            const posClass = `dnfl-pos-${p.pos.toLowerCase()}`;
            let valDisplay = cachedFcError ? '--' : `$${p.mktVal.toLocaleString()}`;
            let deltaDisplay = '--';

            if (cachedFcError) {
                deltaDisplay = '--';
            } else if (p.isMyTeam) {
                if (p.valDelta < 0) {
                    deltaDisplay = `<span class="dnfl-badge-replace-red">-$${Math.abs(p.valDelta).toLocaleString()} <i class="fa-solid fa-triangle-exclamation"></i></span>`;
                } else if (p.valDelta === 0) {
                    deltaDisplay = `<span class="dnfl-badge-replace-amber">-$0 <i class="fa-solid fa-arrow-trend-up"></i></span>`;
                } else {
                    deltaDisplay = `<span class="dnfl-badge-green">+$${p.valDelta.toLocaleString()}</span>`;
                }
            } else if (p.isFA) {
                if (p.valDelta > 0) {
                    deltaDisplay = `<span class="dnfl-badge-green">+$${p.valDelta.toLocaleString()}</span>`;
                } else {
                    deltaDisplay = `<span class="dnfl-text-muted">-$${Math.abs(p.valDelta).toLocaleString()}</span>`;
                }
            } else {
                deltaDisplay = `<span class="dnfl-badge-green">+$${p.mktVal.toLocaleString()}</span>`;
            }

            bodyHtml += `
                <tr class="${rowClass}">
                    <td class="dnfl-td-index dnfl-sticky-col-1">${idx + 1}</td>
                    <td class="dnfl-td-player dnfl-sticky-col-2">${p.name}</td>
                    <td class="dnfl-td-pos"><span class="dnfl-pos-badge ${posClass}">${p.pos}</span></td>
                    <td class="dnfl-td-nfl">${p.nflTeam}</td>
                    <td class="dnfl-td-val">${valDisplay}</td>
            `;

            if (showDelta) {
                bodyHtml += `<td class="dnfl-td-delta">${deltaDisplay}</td>`;
            }

            bodyHtml += `
                <td class="dnfl-td-pts">${p.ytdPts.toFixed(1)}</td>
                <td class="dnfl-td-ppg">${p.ppg.toFixed(1)}</td>
                <td class="dnfl-td-bye">${p.bye}</td>
            `;

            if (showStatus) {
                bodyHtml += `<td class="dnfl-td-status">${p.statusText}</td>`;
            }

            if (showAcquired) {
                bodyHtml += `<td class="dnfl-td-acq">${p.acqInfo}</td>`;
            }

            for (let w = 1; w <= currentWk; w++) {
                const wScore = p.weeklyScores[w] !== undefined ? p.weeklyScores[w].toFixed(2) : '-';
                bodyHtml += `<td class="dnfl-td-wk">${wScore}</td>`;
            }

            bodyHtml += '</tr>';
        });

        tableBody.innerHTML = bodyHtml;
        bindSortEvents();
    }

    // Bind Sorting Events
    function bindSortEvents() {
        const tableHead = document.getElementById('dnfl-waivers-thead');
        if (!tableHead) return;

        const sortables = tableHead.querySelectorAll('.dnfl-sortable');
        sortables.forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (!col) return;

                if (col.startsWith('w')) {
                    const wkNum = parseInt(col.replace('w', ''), 10);
                    if (currentSortColumn === col) {
                        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSortColumn = col;
                        currentSortDir = 'desc';
                    }
                    let masterList = window.DNFL_WAIVERS_MASTER_DATA || [];
                    masterList.forEach(p => p[col] = p.weeklyScores[wkNum] || 0);
                } else {
                    if (currentSortColumn === col) {
                        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSortColumn = col;
                        currentSortDir = 'desc';
                    }
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
        const viewSelect = document.getElementById('dnfl-waivers-view-filter');
        if (viewSelect) {
            viewSelect.addEventListener('change', () => {
                currentViewMode = viewSelect.value;
                currentSortColumn = 'mktVal';
                currentSortDir = 'desc';
                renderTable();
            });
        }

        const posSelect = document.getElementById('dnfl-waivers-pos-filter');
        if (posSelect) {
            posSelect.addEventListener('change', () => {
                currentPosFilter = posSelect.value;
                renderTable();
            });
        }

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

            if (cachedFcError) {
                const statusEl = document.getElementById('dnfl-waivers-count-summary');
                if (statusEl) {
                    statusEl.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Error: FantasyCalc market values unavailable (fantasycalc_values_current.json missing or invalid).</div>`;
                }
            }

            renderTable();

            console.log('[DNFL Waivers] Module v4.08 initialized successfully.');
        } catch (err) {
            console.error('[DNFL Waivers Error]:', err);
            const statusEl = document.getElementById('dnfl-waivers-count-summary');
            if (statusEl) {
                statusEl.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Error loading waivers module: ${err.message}</div>`;
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

})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
