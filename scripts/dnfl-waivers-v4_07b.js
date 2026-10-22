/**
 * Duke Networking Fantasy League (DNFL) - Waiver Target & Player Matrix Module v4.07
 * File: scripts/dnfl-waivers-v4_07.js
 * 
 * Baseline: Built on v4.04 infrastructure.
 * Key Features v4.07:
 * 1. Static Market Value Feed: Fetches strictly from https://dnfl.live/dnfl_market/fantasycalc_values_current.json.
 *    No synthetic fallback. Explicit UI alert if file is missing/invalid.
 * 2. Default Sort Order: Sorted by Market Value Descending (mktVal desc) across all views.
 * 3. Clean Currency & Delta Badges:
 *    - Val: Clean formatted dollar amount ($850).
 *    - Delta: Houses all comparison badges (Red ⚠️, Amber ↗️, Green +$X, Muted -$X).
 * 4. Keeper-Compliant Standalone Acquired Column:
 *    - Drafted / Traded: Preserves original draft slot (10.05) across trades for keeper cost accuracy.
 *    - Waived & Claimed: Invalidates draft pick if player was waived, displaying waiver origin (BB $8.00 / FCFS).
 *    - Free Agents: Displays '-'.
 * 5. Authentic Franchise Status: Displays official MFL Franchise Names in Status column.
 * 6. Strict 6-Position Filtering: Strictly limits player database to QB, RB, WR, TE, PK, DEF.
 * 7. Pure Design Tokens: Uses official CSS custom properties for position chips, row highlights, and sticky hovers.
 */

(function (window, document) {
    'use strict';

    if (window.DNFLWaiversLoaded_v4_07) return;
    window.DNFLWaiversLoaded_v4_07 = true;

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

    let currentViewMode = 'waiverTargets'; // 'waiverTargets' | 'allPlayers' | 'freeAgents' | 'rostered'
    let currentPosFilter = 'ALL';          // 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'PK' | 'DEF'
    let currentSearchTerm = '';
    let currentSortColumn = 'mktVal';      // Default sort column (Market Value)
    let currentSortDir = 'desc';           // Default sort direction (Descending)

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

    function normClean(val) {
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
            const parts = clean.split(',');
            const last = parts[0].trim();
            const first = parts.slice(1).join(',').trim();
            return `${first} ${last}`;
        }
        return clean;
    }

    function resolveActiveUser() {
        if (window.DNFL?.currentFranchiseId) return normFranchiseId(window.DNFL.currentFranchiseId);
        if (window.franchise_id || window.mflFranchiseId || window.mfl_franchise_id) {
            return normFranchiseId(window.franchise_id || window.mflFranchiseId || window.mfl_franchise_id);
        }
        if (typeof window.mflCookie !== 'undefined' && window.mflCookie.franchise_id) {
            return normFranchiseId(window.mflCookie.franchise_id);
        }
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const f = urlParams.get('FRANCHISE') || urlParams.get('F');
            if (f) return normFranchiseId(f);
        } catch (e) {}
        return '0000'; // Default to 0000 (Commissioner / Unassigned)
    }

    function buildConferenceMap(leagueInfo) {
        const divToConfMap = {};
        const divisions = toArray(leagueInfo?.divisions?.division);
        divisions.forEach(d => {
            if (d.id && d.conference) {
                divToConfMap[normFranchiseId(d.id)] = String(d.conference).trim();
            }
        });

        const franchiseConfMap = {};
        const franchises = toArray(leagueInfo?.franchises?.franchise);
        franchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            const div = normFranchiseId(f.division);
            const conf = f.conference ? String(f.conference).trim() : (divToConfMap[div] || '1');
            franchiseConfMap[fid] = conf;
        });

        return { divToConfMap, franchiseConfMap };
    }

    function getFranchiseName(fid) {
        const normFid = normFranchiseId(fid);
        const fList = toArray(cachedLeagueInfo?.franchises?.franchise);
        const fObj = fList.find(f => normFranchiseId(f.id) === normFid);
        return fObj ? (fObj.name || `Franchise ${normFid}`) : (normFid === '0000' ? 'Free Agent' : `Franchise ${normFid}`);
    }

    // Load FantasyCalc market values from static endpoint. NO fallback calculations.
    async function fetchFantasyCalcMap() {
        const client = getApiClient();
        const targetUrl = 'https://dnfl.live/dnfl_market/fantasycalc_values_current.json';

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
            const pObj = {
                id: pid,
                rawName: rawName,
                name: formattedName,
                pos: pos,
                team: (p.team || p.nflTeam || 'FA').toUpperCase(),
                bye: p.bye_week ? `W${p.bye_week}` : 'N/A'
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

        // Parallel Fetch Weekly Results (W1 .. W_currentWk)
        cachedWeeklyScoresMap = {};
        const weeklyPromises = [];
        for (let w = 1; w <= currentWk; w++) {
            weeklyPromises.push(client.fetchData('weeklyResults', { W: w }).catch(() => null));
        }
        const weeklyResultsArr = await Promise.all(weeklyPromises);
        weeklyResultsArr.forEach((wRes, idx) => {
            const weekNum = idx + 1;
            const matchArr = toArray(wRes?.weeklyResults?.matchup || wRes?.weeklyResults?.schedule?.matchup);
            matchArr.forEach(m => {
                const franchiseArr = toArray(m.franchise);
                franchiseArr.forEach(f => {
                    const playerArr = toArray(f.player);
                    playerArr.forEach(p => {
                        const pid = String(p.id || p).trim();
                        const unpadded = pid.replace(/^0+/, '');
                        const pts = parseFloat(p.score || 0);
                        if (!cachedWeeklyScoresMap[pid]) cachedWeeklyScoresMap[pid] = {};
                        if (!cachedWeeklyScoresMap[unpadded]) cachedWeeklyScoresMap[unpadded] = {};
                        cachedWeeklyScoresMap[pid][weekNum] = pts;
                        cachedWeeklyScoresMap[unpadded][weekNum] = pts;
                    });
                });
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
                    const pids = rawTx.match(/\b\d{4,5}\b/g) || [];
                    pids.forEach(pid => {
                        const cleanPid = String(pid).trim();
                        const unpadded = cleanPid.replace(/^0+/, '');

                        // Track if player was ever claimed off waivers or dropped & added
                        if (type.includes('BBID') || type.includes('WAIVER') || type.includes('FREE_AGENT') || type.includes('ADD')) {
                            cachedWasWaivedSet.add(cleanPid);
                            cachedWasWaivedSet.add(unpadded);
                        }

                        if (!cachedTransAcqMap[cleanPid]) {
                            let acqText = 'FCFS';
                            if (type.includes('BBID') || type.includes('WAIVER') || t.bid || t.bbidAmount) {
                                const bidAmt = parseFloat(t.bid || t.bbidAmount || t.amount || 0);
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
            // 1. If drafted in active conf AND never waived -> Keep draft pick slot (10.05) even if traded!
            // 2. If waived and claimed -> Use waiver acquisition (BB $8.00 / FCFS)
            // 3. Free Agents -> '-'
            let acqInfo = '-';
            const draftSlot = cachedDraftPickMap[pid] || cachedDraftPickMap[unpadded];
            const wasWaived = cachedWasWaivedSet.has(pid) || cachedWasWaivedSet.has(unpadded);
            const transAcq = cachedTransAcqMap[pid] || cachedTransAcqMap[unpadded];

            if (draftSlot && !wasWaived) {
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

        // Annotate Free Agents with Value Delta vs lowest rostered player
        faPlayers.forEach(p => {
            const pos = p.pos;
            const floorObj = posFloors[pos] || posFloors.FLEX;
            const myFloor = floorObj ? floorObj.lowestVal : 0;
            p.valDelta = p.mktVal - myFloor;
        });

        // Annotate My Roster players with Replaceability Badges
        const myPlayers = masterList.filter(p => p.isMyTeam);
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

        if (activeUserFid === '0000') {
            bannerEl.innerHTML = `<span class="dnfl-text-muted"><i class="fa-solid fa-user-shield"></i> Commissioner View: Displaying full league player database and roster assignments.</span>`;
            return;
        }

        const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'PK', 'DEF'];
        let html = '';

        positions.forEach(pos => {
            const floorObj = posFloors[pos];
            if (!floorObj) return;

            const isSecure = !floorObj.hasFAUpgrade;
            const valStr = cachedFcError ? '--' : `$${floorObj.lowestVal.toLocaleString()}`;
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

        // Bind click events to pills
        bannerEl.querySelectorAll('.dnfl-floor-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const pos = btn.getAttribute('data-pos');
                currentViewMode = 'waiverTargets';
                currentPosFilter = pos;

                const viewSelect = document.getElementById('dnfl-waivers-view-filter');
                const posSelect = document.getElementById('dnfl-waivers-pos-filter');
                if (viewSelect) viewSelect.value = 'waiverTargets';
                if (posSelect) posSelect.value = pos;

                renderTable();
            });
        });
    }

    // Render Table
    function renderTable() {
        const tableHeadEl = document.getElementById('dnfl-waivers-thead');
        const tableBodyEl = document.getElementById('dnfl-waivers-tbody');
        const countSummaryEl = document.getElementById('dnfl-waivers-count-summary');
        if (!tableBodyEl || !tableHeadEl) return;

        const masterList = window.DNFL_WAIVERS_MASTER_DATA || [];
        const currentWk = parseInt(cachedLeagueInfo?.currentWk || 1, 10);

        // 1. Filter Data based on Active View & Controls
        let filtered = masterList.slice();

        // View Mode filter
        if (currentViewMode === 'waiverTargets') {
            filtered = filtered.filter(p => (p.isFA && p.valDelta > 0) || p.isMyTeam);
        } else if (currentViewMode === 'freeAgents') {
            filtered = filtered.filter(p => p.isFA);
        } else if (currentViewMode === 'rostered') {
            filtered = filtered.filter(p => !p.isFA);
        } // 'allPlayers' shows all

        // Position filter
        if (currentPosFilter !== 'ALL') {
            if (currentPosFilter === 'FLEX') {
                filtered = filtered.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
            } else {
                filtered = filtered.filter(p => p.pos === currentPosFilter);
            }
        }

        // Search term filter (Punctuation-Agnostic)
        if (currentSearchTerm) {
            const cleanTerm = normClean(currentSearchTerm);
            filtered = filtered.filter(p => 
                normClean(p.name).includes(cleanTerm) || 
                normClean(p.rawName).includes(cleanTerm) || 
                normClean(p.nflTeam).includes(cleanTerm) || 
                normClean(p.pos).includes(cleanTerm) || 
                normClean(p.statusText).includes(cleanTerm) ||
                normClean(p.acqInfo).includes(cleanTerm)
            );
        }

        // 2. Sort Data
        filtered.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
            return 0;
        });

        // 3. Determine Column Visibility
        const showDelta = (currentViewMode === 'waiverTargets' || currentViewMode === 'freeAgents');
        const showStatus = (currentViewMode !== 'freeAgents');
        const showAcquired = (currentViewMode !== 'freeAgents');

        // 4. Render Header
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

        // Render Weekly Columns (W1 .. W_currentWk)
        for (let w = 1; w <= currentWk; w++) {
            headHtml += `<th class="dnfl-th-wk dnfl-sortable" data-sort="wk_${w}">W${w} ${getSortIcon(`wk_${w}`)}</th>`;
        }

        headHtml += `</tr>`;
        tableHeadEl.innerHTML = headHtml;

        // 5. Render Rows
        if (filtered.length === 0) {
            let colSpan = 8 + (showDelta ? 1 : 0) + (showStatus ? 1 : 0) + (showAcquired ? 1 : 0) + currentWk;
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
            let rowClass = idx % 2 === 0 ? 'dnfl-row-even' : 'dnfl-row-odd';

            if (p.isMyTeam) {
                rowClass = 'dnfl-row-my-team'; // Canary Yellow
            } else if (currentViewMode === 'allPlayers' && p.isFA) {
                rowClass = 'dnfl-row-fa'; // Mint Green Tint
            }

            // Pos badge
            const posBadgeClass = `dnfl-pos-badge dnfl-pos-${p.pos.toLowerCase()}`;

            // Clean Currency in Val column
            let valDisplay = cachedFcError ? '--' : `$${p.mktVal.toLocaleString()}`;

            // Delta Column Badges
            let deltaDisplay = '--';
            if (cachedFcError) {
                deltaDisplay = '--';
            } else if (p.isMyTeam && p.badgeType) {
                if (p.badgeType === 'lowestFloor') {
                    deltaDisplay = `<span class="dnfl-badge-replace-red">-$${Math.abs(p.valDelta).toLocaleString()} <i class="fa-solid fa-triangle-exclamation"></i></span>`;
                } else if (p.badgeType === 'upgradeable') {
                    deltaDisplay = `<span class="dnfl-badge-replace-amber">-$${Math.abs(p.valDelta).toLocaleString()} <i class="fa-solid fa-arrow-trend-up"></i></span>`;
                }
            } else if (p.isFA) {
                if (p.valDelta > 0) {
                    deltaDisplay = `<span class="dnfl-badge-green">+$${p.valDelta.toLocaleString()}</span>`;
                } else {
                    deltaDisplay = `<span class="dnfl-text-muted">-$${Math.abs(p.valDelta).toLocaleString()}</span>`;
                }
            } else if (p.isMyTeam) {
                deltaDisplay = `<span class="dnfl-badge-green">+$${p.mktVal.toLocaleString()}</span>`;
            }

            bodyHtml += `
                <tr class="${rowClass}">
                    <td class="dnfl-td-index dnfl-sticky-col-1">${rankIndex}</td>
                    <td class="dnfl-td-player dnfl-sticky-col-2">${p.name}</td>
                    <td class="dnfl-td-pos"><span class="${posBadgeClass}">${p.pos}</span></td>
                    <td class="dnfl-td-nfl">${p.nflTeam}</td>
                    <td class="dnfl-td-val">${valDisplay}</td>
            `;

            if (showDelta) {
                bodyHtml += `<td class="dnfl-td-delta">${deltaDisplay}</td>`;
            }

            bodyHtml += `
                    <td class="dnfl-td-pts">${parseFloat(p.ytdPts || 0).toFixed(2)}</td>
                    <td class="dnfl-td-ppg">${parseFloat(p.ppg || 0).toFixed(2)}</td>
                    <td class="dnfl-td-bye">${p.bye}</td>
            `;

            if (showStatus) {
                let statusDisplay = p.isFA ? `<span class="dnfl-badge-fa">Free Agent</span>` : p.statusText;
                bodyHtml += `<td class="dnfl-td-status">${statusDisplay}</td>`;
            }

            if (showAcquired) {
                let acqDisplay = p.isFA ? (currentViewMode === 'allPlayers' ? 'N/A' : '-') : p.acqInfo;
                bodyHtml += `<td class="dnfl-td-acq">${acqDisplay}</td>`;
            }

            // Render Weekly Scores
            for (let w = 1; w <= currentWk; w++) {
                const wkPts = p.weeklyScores[w] !== undefined ? parseFloat(p.weeklyScores[w]).toFixed(2) : '--';
                bodyHtml += `<td class="dnfl-td-wk">${wkPts}</td>`;
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
                if (col.startsWith('wk_')) {
                    const wkNum = parseInt(col.replace('wk_', ''), 10);
                    if (currentSortColumn === col) {
                        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSortColumn = col;
                        currentSortDir = 'desc';
                    }
                    // Sort by specific weekly score
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
        // View Select
        const viewSelect = document.getElementById('dnfl-waivers-view-filter');
        if (viewSelect) {
            viewSelect.addEventListener('change', () => {
                currentViewMode = viewSelect.value;
                currentSortColumn = 'mktVal';
                currentSortDir = 'desc';
                renderTable();
            });
        }

        // Position Select
        const posSelect = document.getElementById('dnfl-waivers-pos-filter');
        if (posSelect) {
            posSelect.addEventListener('change', () => {
                currentPosFilter = posSelect.value;
                renderTable();
            });
        }

        // Search Input
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

            console.log('[DNFL Waivers] Module v4.07 initialized successfully.');
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

})(typeof window !== "undefined" ? window : this, typeof document !== "undefined" ? document : null);
