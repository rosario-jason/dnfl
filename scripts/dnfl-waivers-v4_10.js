/**
 * Duke Networking Fantasy League (DNFL) - Waiver Target & Player Matrix Module v4.10
 * File: scripts/dnfl-waivers-v4_10.js
 */
(function (window, document) {
    'use strict';

    if (window.DNFLWaiversLoaded_v4_10) return;
    window.DNFLWaiversLoaded_v4_10 = true;

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
    let cachedTransAcqMap = {};
    let cachedDroppedSet = new Set();

    let activeUserFid = '0000';
    let activeConfId = '1';

    let currentViewMode = 'waiverTargets';
    let currentPosFilter = 'ALL';
    let currentSearchTerm = '';
    let currentSortColumn = 'mktVal';
    let currentSortDir = 'desc';

    let initRetries = 0;
    const MAX_RETRIES = 20;
    const RETRY_INTERVAL = 250;

    function getApiClient() { return window.DNFL && window.DNFL.Client ? window.DNFL.Client : null; }
    function toArray(val) { if (!val) return []; return Array.isArray(val) ? val : [val]; }
    function normFranchiseId(fid) { if (!fid) return '0000'; return String(fid).padStart(4, '0'); }

    function formatPlayerName(raw) {
        if (!raw) return 'Unknown Player';
        if (raw.includes(',')) {
            const parts = raw.split(',');
            const last = parts[0].trim();
            const first = parts.slice(1).join(',').trim();
            return `${first} ${last}`;
        }
        return raw.trim();
    }

    function resolveActiveUser() {
        let fid = '0000';
        if (typeof window.franchise_id !== 'undefined' && window.franchise_id) {
            fid = String(window.franchise_id);
        } else {
            const params = new URLSearchParams(window.location.search);
            if (params.has('FRANCHISE')) fid = params.get('FRANCHISE');
            else if (params.has('F')) fid = params.get('F');
        }
        return normFranchiseId(fid);
    }

    function getFranchiseName(fid) {
        const cleanFid = normFranchiseId(fid);
        if (cleanFid === '0000') return 'Free Agent';
        const franchises = toArray(cachedLeagueInfo?.franchises?.franchise);
        const match = franchises.find(f => normFranchiseId(f.id) === cleanFid);
        return match?.name || `Franchise ${cleanFid}`;
    }

    function buildConferenceMap(leagueInfo) {
        const franchiseConfMap = {};
        const franchises = toArray(leagueInfo?.franchises?.franchise);
        const divisions = toArray(leagueInfo?.divisions?.division);

        const divToConf = {};
        divisions.forEach(d => {
            if (d.id && d.conference) divToConf[String(d.id)] = String(d.conference);
        });

        franchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            const divId = String(f.division || '');
            const confId = String(f.conference || f.conf || divToConf[divId] || '1');
            franchiseConfMap[fid] = confId;
        });

        return { franchiseConfMap };
    }
    async function fetchFantasyCalcMap() {
        const client = getApiClient();
        const year = cachedLeagueInfo?.year || window.year || '2026';
        const host = 'dnfl' + '.' + 'live';
        const targetUrl = 'https://' + host + '/dnfl_market/' + year + '/fantasycalc_values_current.json';

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
                console.error('[DNFL Waivers] ERROR parsing FantasyCalc JSON:', err);
            }
        }

        console.error('[DNFL Waivers] ERROR: Unable to load FantasyCalc values from fantasycalc_values_current.json');
        cachedFcError = true;
        return null;
    }
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
        
        const currentWk = parseInt(window.liveScoringWeek || window.completedWeek || cachedLeagueInfo.currentWk || cachedLeagueInfo.current_week || 6, 10);
        cachedLeagueInfo.resolvedCurrentWk = currentWk;

        const { franchiseConfMap } = buildConferenceMap(cachedLeagueInfo);
        activeConfId = (activeUserFid !== '0000' && franchiseConfMap[activeUserFid]) ? franchiseConfMap[activeUserFid] : '1';

        cachedPlayersMap = {};
        const playerList = toArray(playersRes?.players?.player);
        playerList.forEach(p => {
            const pos = (p.position || p.pos || 'N/A').toUpperCase();
            if (!ALLOWED_POSITIONS.includes(pos)) return;

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
                bye: p.bye_week ? `W${p.bye_week}` : (p.byeWeek ? `W${p.byeWeek}` : '-')
            };
            cachedPlayersMap[pid] = pObj;
            cachedPlayersMap[unpadded] = pObj;
            cachedPlayersMap[padded] = pObj;
        });

        cachedRosters = rostersRes?.rosters || {};

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

        cachedWeeklyScoresMap = {};
        const weeklyPromises = [];
        for (let w = 1; w <= currentWk; w++) {
            weeklyPromises.push(client.fetchData('playerScores', { W: w }).catch(() => null));
        }
        const weeklyResultsArr = await Promise.all(weeklyPromises);
        weeklyResultsArr.forEach((wRes, idx) => {
            const weekNum = idx + 1;
            const psArr = toArray(wRes?.playerScores?.playerScore);
            psArr.forEach(ps => {
                const pid = String(ps.id || '').trim();
                if (!pid) return;
                const unpadded = pid.replace(/^0+/, '');
                const pts = parseFloat(ps.score || 0);
                if (!cachedWeeklyScoresMap[pid]) cachedWeeklyScoresMap[pid] = {};
                if (!cachedWeeklyScoresMap[unpadded]) cachedWeeklyScoresMap[unpadded] = {};
                cachedWeeklyScoresMap[pid][weekNum] = pts;
                cachedWeeklyScoresMap[unpadded][weekNum] = pts;
            });
        });

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

        cachedTransAcqMap = {};
        cachedDroppedSet = new Set();
        if (transRes?.transactions?.transaction) {
            const tList = toArray(transRes.transactions.transaction);
            tList.forEach(t => {
                const fid = normFranchiseId(t.franchise);
                if (franchiseConfMap[fid] === activeConfId) {
                    const type = (t.type || '').toUpperCase();
                    const rawTx = String(t.transaction || '');
                    const pids = rawTx.split(',');
                    
                    if (type.includes('DROP') || type.includes('WAIVER') || type.includes('CUT')) {
                        pids.forEach(pStr => {
                            const pid = pStr.trim();
                            if (pid) {
                                cachedDroppedSet.add(pid);
                                cachedDroppedSet.add(pid.replace(/^0+/, ''));
                            }
                        });
                    }

                    pids.forEach(pStr => {
                        const cleanPid = pStr.trim();
                        if (!cleanPid) return;
                        const unpadded = cleanPid.replace(/^0+/, '');

                        if (!cachedTransAcqMap[cleanPid]) {
                            let acqText = 'FCFS';
                            if (type.includes('BBID') || type.includes('WAIVER') || t.bbidAmount || t.bid) {
                                const bidAmt = parseFloat(t.bbidAmount || t.bid || t.amount || 0);
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

        cachedFcMap = await fetchFantasyCalcMap();
    }
    function buildMasterPlayerList() {
        const masterList = [];
        const { franchiseConfMap } = buildConferenceMap(cachedLeagueInfo);

        const ownershipMap = {};
        const rosterFranchises = toArray(cachedRosters?.franchise);
        rosterFranchises.forEach(f => {
            const fid = normFranchiseId(f.id);
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

            let acqInfo = '-';
            const draftSlot = cachedDraftPickMap[pid] || cachedDraftPickMap[unpadded];
            const wasDropped = cachedDroppedSet.has(pid) || cachedDroppedSet.has(unpadded);
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
                valDelta: 0,
                isLowestFloor: false
            });
        });

        return masterList;
    }

    function calculateActiveUserFloors(masterList) {
        const posFloors = {
            QB: { lowestVal: Infinity, topFaVal: 0 },
            RB: { lowestVal: Infinity, topFaVal: 0 },
            WR: { lowestVal: Infinity, topFaVal: 0 },
            TE: { lowestVal: Infinity, topFaVal: 0 },
            PK: { lowestVal: Infinity, topFaVal: 0 },
            DEF: { lowestVal: Infinity, topFaVal: 0 },
            FLEX: { lowestVal: Infinity, topFaVal: 0 }
        };

        if (activeUserFid !== '0000') {
            masterList.forEach(p => {
                if (p.isMyTeam) {
                    const pos = p.pos;
                    if (posFloors[pos] && p.mktVal < posFloors[pos].lowestVal) {
                        posFloors[pos].lowestVal = p.mktVal;
                    }
                    if (['RB', 'WR', 'TE'].includes(pos)) {
                        if (p.mktVal < posFloors.FLEX.lowestVal) {
                            posFloors.FLEX.lowestVal = p.mktVal;
                        }
                    }
                }
            });
        }

        masterList.forEach(p => {
            if (p.isFA) {
                const pos = p.pos;
                if (posFloors[pos] && p.mktVal > posFloors[pos].topFaVal) {
                    posFloors[pos].topFaVal = p.mktVal;
                }
                if (['RB', 'WR', 'TE'].includes(pos) && p.mktVal > posFloors.FLEX.topFaVal) {
                    posFloors.FLEX.topFaVal = p.mktVal;
                }
            }
        });

        Object.keys(posFloors).forEach(k => {
            if (posFloors[k].lowestVal === Infinity) posFloors[k].lowestVal = 0;
        });

        return posFloors;
    }

    function annotateMasterList(masterList, posFloors) {
        masterList.forEach(p => {
            const pos = p.pos;
            const myFloor = posFloors[pos]?.lowestVal || 0;
            const topFaVal = posFloors[pos]?.topFaVal || 0;

            if (p.isFA) {
                p.valDelta = p.mktVal - myFloor;
            } else if (p.isMyTeam) {
                p.valDelta = p.mktVal - topFaVal;
                if (myFloor > 0 && p.mktVal === myFloor) {
                    p.isLowestFloor = true;
                }
            } else {
                p.valDelta = 0;
            }
        });
    }

    function renderSummaryBanner(posFloors) {
        const wrapper = document.getElementById('dnfl-waivers-pills-wrapper');
        if (!wrapper) return;

        let html = '';
        const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'PK', 'DEF'];
        positions.forEach(pos => {
            const floorObj = posFloors[pos] || { lowestVal: 0, topFaVal: 0 };
            const isActive = currentPosFilter === pos;
            const activeClass = isActive ? 'dnfl-floor-pill--active' : '';
            const isSecure = floorObj.topFaVal <= floorObj.lowestVal;
            const statusClass = isSecure ? 'dnfl-floor-pill--secure' : '';

            const valStr = cachedFcError ? '--' : `$${floorObj.lowestVal.toLocaleString()}`;

            html += `
                <div class="dnfl-floor-pill ${activeClass} ${statusClass}" data-pos="${pos}">
                    <span class="dnfl-floor-pill__label">${pos}:</span>
                    <span class="dnfl-floor-pill__value">${valStr}</span>
                </div>
            `;
        });

        wrapper.innerHTML = html;

        wrapper.querySelectorAll('.dnfl-floor-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const pos = pill.getAttribute('data-pos');
                currentPosFilter = currentPosFilter === pos ? 'ALL' : pos;
                const posSelect = document.getElementById('dnfl-waivers-pos-filter');
                if (posSelect) posSelect.value = currentPosFilter;
                renderSummaryBanner(posFloors);
                renderTable();
            });
        });
    }

    function getFilteredPlayerList() {
        let list = window.DNFL_WAIVERS_MASTER_DATA || [];

        if (currentViewMode === 'waiverTargets') {
            list = list.filter(p => (p.isFA && p.valDelta > 0) || p.isMyTeam);
        } else if (currentViewMode === 'freeAgents') {
            list = list.filter(p => p.isFA);
        } else if (currentViewMode === 'rostered') {
            list = list.filter(p => !p.isFA);
        }

        if (currentPosFilter !== 'ALL') {
            if (currentPosFilter === 'FLEX') {
                list = list.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
            } else {
                list = list.filter(p => p.pos === currentPosFilter);
            }
        }

        if (currentSearchTerm.trim() !== '') {
            const term = currentSearchTerm.toLowerCase();
            list = list.filter(p => 
                p.name.toLowerCase().includes(term) ||
                p.pos.toLowerCase().includes(term) ||
                p.nflTeam.toLowerCase().includes(term) ||
                p.statusText.toLowerCase().includes(term)
            );
        }

        list = [...list].sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            if (currentSortColumn.startsWith('wk_')) {
                const wkNum = parseInt(currentSortColumn.replace('wk_', ''), 10);
                valA = a.weeklyScores[wkNum] || 0;
                valB = b.weeklyScores[wkNum] || 0;
            }

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }
    function renderTable() {
        const currentWk = cachedLeagueInfo?.resolvedCurrentWk || 6;
        const filteredList = getFilteredPlayerList();

        const countSummaryEl = document.getElementById('dnfl-waivers-count-summary');
        if (countSummaryEl && !cachedFcError) {
            countSummaryEl.innerHTML = `Showing <strong>${filteredList.length}</strong> Players`;
        }

        const showDelta = (currentViewMode === 'waiverTargets' || currentViewMode === 'freeAgents');
        const showAcquired = (currentViewMode === 'allPlayers' || currentViewMode === 'rostered');
        const showStatus = (currentViewMode === 'allPlayers' || currentViewMode === 'freeAgents');

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

        if (showAcquired) {
            headHtml += `<th class="dnfl-th-acq dnfl-sortable" data-sort="acqInfo">Acquired ${getSortIcon('acqInfo')}</th>`;
        }

        if (showStatus) {
            headHtml += `<th class="dnfl-th-status dnfl-sortable" data-sort="statusText">Status ${getSortIcon('statusText')}</th>`;
        }

        for (let w = 1; w <= currentWk; w++) {
            headHtml += `<th class="dnfl-th-wk dnfl-sortable" data-sort="wk_${w}">W${w} ${getSortIcon(`wk_${w}`)}</th>`;
        }

        headHtml += `</tr>`;

        const theadEl = document.getElementById('dnfl-waivers-thead');
        if (theadEl) theadEl.innerHTML = headHtml;

        let bodyHtml = '';
        if (filteredList.length === 0) {
            let colSpan = 8 + (showDelta ? 1 : 0) + (showStatus ? 1 : 0) + (showAcquired ? 1 : 0) + currentWk;
            bodyHtml = `<tr><td colspan="${colSpan}" class="dnfl-td-empty">No matching players found.</td></tr>`;
        } else {
            filteredList.forEach((p, idx) => {
                let rowClass = (idx % 2 === 0) ? 'dnfl-row-even' : 'dnfl-row-odd';
                
                if (currentViewMode === 'waiverTargets') {
                    if (p.isMyTeam) rowClass += ' dnfl-row-my-team-subtle';
                    else rowClass += ' dnfl-row-fa-white';
                } else if (currentViewMode === 'allPlayers' || currentViewMode === 'rostered') {
                    if (p.isMyTeam) rowClass += ' dnfl-row-my-team';
                    else if (!p.isFA) rowClass += ' dnfl-row-rostered-gray';
                    else rowClass += ' dnfl-row-fa-white';
                } else {
                    rowClass += ' dnfl-row-fa-white';
                }

                let valDisplay = cachedFcError ? '--' : `$${p.mktVal.toLocaleString()}`;
                
                let deltaDisplay = '--';
                if (cachedFcError) {
                    deltaDisplay = '--';
                } else if (p.isMyTeam) {
                    if (p.valDelta >= 0) {
                        deltaDisplay = `+$${p.valDelta.toLocaleString()}`;
                    } else if (p.isLowestFloor) {
                        deltaDisplay = `<span class="dnfl-badge-replace-red">-$${Math.abs(p.valDelta).toLocaleString()} <i class="fa-solid fa-arrow-trend-down"></i></span>`;
                    } else {
                        deltaDisplay = `<span class="dnfl-badge-replace-amber">-$${Math.abs(p.valDelta).toLocaleString()} <i class="fa-solid fa-arrow-trend-down"></i></span>`;
                    }
                } else if (p.isFA) {
                    if (p.valDelta > 0) {
                        deltaDisplay = `<span class="dnfl-badge-green">+$${p.valDelta.toLocaleString()}</span>`;
                    } else {
                        deltaDisplay = `<span class="dnfl-text-muted">-$${Math.abs(p.valDelta).toLocaleString()}</span>`;
                    }
                }

                const mflHost = ['www48', 'myfantasyleague', 'com'].join('.');
                const mflUrl = 'https://' + mflHost + '/' + (cachedLeagueInfo?.year || 2026) + '/player?L=' + (cachedLeagueInfo?.id || '') + '&P=' + p.id;

                bodyHtml += `
                    <tr class="${rowClass}">
                        <td class="dnfl-td-index dnfl-sticky-col-1">${idx + 1}</td>
                        <td class="dnfl-td-player dnfl-sticky-col-2">
                            <a href="${mflUrl}" target="_blank" class="dnfl-player-link">
                                ${p.name}
                            </a>
                        </td>
                        <td class="dnfl-td-pos"><span class="dnfl-pos-badge dnfl-pos-${p.pos.toLowerCase()}">${p.pos}</span></td>
                        <td class="dnfl-td-nfl">${p.nflTeam}</td>
                        <td class="dnfl-td-val">${valDisplay}</td>
                `;

                if (showDelta) {
                    bodyHtml += `<td class="dnfl-td-delta">${deltaDisplay}</td>`;
                }

                bodyHtml += `
                    <td class="dnfl-td-pts">${p.ytdPts.toFixed(2)}</td>
                    <td class="dnfl-td-ppg">${p.ppg.toFixed(2)}</td>
                    <td class="dnfl-td-bye">${p.bye}</td>
                `;

                if (showAcquired) {
                    bodyHtml += `<td class="dnfl-td-acq">${p.acqInfo}</td>`;
                }

                if (showStatus) {
                    bodyHtml += `<td class="dnfl-td-status">${p.statusText}</td>`;
                }

                for (let w = 1; w <= currentWk; w++) {
                    const wkPts = p.weeklyScores[w];
                    let scoreDisplay = '0.00';
                    if (wkPts !== undefined && wkPts !== null) {
                        scoreDisplay = parseFloat(wkPts).toFixed(2);
                    } else if (p.bye === `W${w}`) {
                        scoreDisplay = 'BYE';
                    } else {
                        scoreDisplay = '0.00';
                    }
                    bodyHtml += `<td class="dnfl-td-wk">${scoreDisplay}</td>`;
                }

                bodyHtml += `</tr>`;
            });
        }

        const tbodyEl = document.getElementById('dnfl-waivers-tbody');
        if (tbodyEl) tbodyEl.innerHTML = bodyHtml;

        bindHeaderSortEvents();
    }

    function bindHeaderSortEvents() {
        const theadEl = document.getElementById('dnfl-waivers-thead');
        if (!theadEl) return;

        theadEl.querySelectorAll('.dnfl-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (currentSortColumn === col) {
                    currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortColumn = col;
                    currentSortDir = col === 'name' ? 'asc' : 'desc';
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

            console.log('[DNFL Waivers] Module v4.10 initialized successfully.');
        } catch (err) {
            console.error('[DNFL Waivers Error]:', err);
            const statusEl = document.getElementById('dnfl-waivers-count-summary');
            if (statusEl) {
                statusEl.innerHTML = `<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Error loading waivers module: ${err.message}</div>`;
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

})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
