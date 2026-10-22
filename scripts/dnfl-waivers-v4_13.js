/**
 * Duke Networking Fantasy League (DNFL) - Waiver Target & Player Matrix Module v4.13
 * File: scripts/dnfl-waivers-v4_13.js
 */
(function (window, document) {
    'use strict';

    if (window.DNFLWaiversLoaded_v4_13) return;
    window.DNFLWaiversLoaded_v4_13 = true;

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

    let currentWkGlobal = 1;
    let masterListGlobal = [];
    let posFloorsGlobal = {};

    let initRetries = 0;
    const MAX_RETRIES = 50;
    const RETRY_INTERVAL = 100;

    function getApiClient() {
        return window.DNFL && window.DNFL.Client ? window.DNFL.Client : null;
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function normFranchiseId(fid) {
        if (!fid) return '0000';
        return String(fid).padStart(4, '0');
    }

    function formatPlayerName(raw) {
        if (!raw) return 'Unknown Player';
        const str = String(raw).trim();
        if (str.includes(',')) {
            const parts = str.split(',');
            const last = parts[0].trim();
            const first = parts.slice(1).join(',').trim();
            return `${first} ${last}`.trim();
        }
        return str;
    }

    function resolveActiveUser() {
        let fid = window.franchise_id || window.current_franchise_id || window.login_franchise_id || null;
        if (!fid && typeof window.location !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search || '');
            fid = urlParams.get('FRANCHISE') || urlParams.get('F') || null;
        }
        return normFranchiseId(fid || '0000');
    }

    function getFranchiseName(fid) {
        const normFid = normFranchiseId(fid);
        if (cachedLeagueInfo && cachedLeagueInfo.franchises && cachedLeagueInfo.franchises.franchise) {
            const fList = toArray(cachedLeagueInfo.franchises.franchise);
            const found = fList.find(f => normFranchiseId(f.id) === normFid);
            if (found && found.name) return found.name;
        }
        return normFid === '0000' ? 'Free Agent' : `Franchise ${normFid}`;
    }

    function buildConferenceMap(leagueInfo) {
        const map = {};
        if (!leagueInfo) return map;
        const fList = toArray(leagueInfo.franchises?.franchise);
        const divList = toArray(leagueInfo.divisions?.division);

        const divConfMap = {};
        divList.forEach(d => {
            if (d.id && d.conference) {
                divConfMap[String(d.id)] = String(d.conference);
            }
        });

        fList.forEach(f => {
            const fid = normFranchiseId(f.id);
            if (f.conference) {
                map[fid] = String(f.conference);
            } else if (f.division && divConfMap[String(f.division)]) {
                map[fid] = divConfMap[String(f.division)];
            } else {
                map[fid] = '1';
            }
        });
        return map;
    }

    async function fetchFantasyCalcMap() {
        if (cachedFcMap !== null) return cachedFcMap;

        const year = window.year || '2026';
        const targetUrl = `https://dnfl.live/dnfl_market/${year}/fantasycalc_values_current.json`;
        cachedFcMap = {};

        const client = getApiClient();
        let rawText = null;

        if (client && typeof client.fetchRawText === 'function') {
            try {
                rawText = await client.fetchRawText(targetUrl, { ttl: client.TTL ? client.TTL.HOURLY : 3600 });
            } catch (e) {
                rawText = null;
            }
        }

        if (!rawText) {
            try {
                const resp = await fetch(`${targetUrl}?v=${Date.now()}`);
                if (resp.ok) rawText = await resp.text();
            } catch (e) {
                rawText = null;
            }
        }

        if (rawText) {
            try {
                const data = JSON.parse(rawText);
                const list = Array.isArray(data) ? data : (data.players || []);
                list.forEach(p => {
                    const pid = String(p.mflId || p.mfl_id || p.id || '').trim();
                    const unp = pid.replace(/^0+/, '');
                    const pad = unp.padStart(4, '0');
                    const val = parseInt(p.value || p.mktVal || p.tradeValue || 0, 10);

                    if (pid) {
                        cachedFcMap[pid] = val;
                        cachedFcMap[unp] = val;
                        cachedFcMap[pad] = val;
                    }
                });
                cachedFcError = false;
            } catch (err) {
                console.warn('[DNFL Waivers] Error parsing market values JSON:', err);
                cachedFcError = true;
            }
        } else {
            console.warn('[DNFL Waivers] Unable to fetch live market values.');
            cachedFcError = true;
        }

        return cachedFcMap;
    }

    async function loadData() {
        const client = getApiClient();
        if (!client) throw new Error('DNFL API Client unavailable');

        activeUserFid = resolveActiveUser();

        const [
            leagueRes,
            weeklyRes,
            playersRes,
            rostersRes,
            ytdRes,
            avgRes,
            transRes,
            draftRes
        ] = await Promise.all([
            client.fetchData('league').catch(() => ({})),
            client.fetchData('weeklyResults').catch(() => ({})),
            client.fetchData('players', { DETAILS: 1 }).catch(() => ({})),
            client.fetchData('rosters').catch(() => ({})),
            client.fetchData('playerScores', { W: 'YTD' }).catch(() => ({})),
            client.fetchData('playerScores', { W: 'AVG' }).catch(() => ({})),
            client.fetchData('transactions').catch(() => ({})),
            client.fetchData('draftResults').catch(() => ({}))
        ]);

        await fetchFantasyCalcMap();

        cachedLeagueInfo = leagueRes?.league || {};
        const franchiseConfMap = buildConferenceMap(cachedLeagueInfo);
        activeConfId = franchiseConfMap[activeUserFid] || '1';

        // Current Week Resolution
        const curWkRaw = weeklyRes?.weeklyResults?.week || weeklyRes?.weeklyResults?.currentWk || cachedLeagueInfo?.currentWk || '1';
        currentWkGlobal = parseInt(curWkRaw, 10) || 1;

        // Players Map
        cachedPlayersMap = {};
        const pArray = toArray(playersRes?.players?.player);
        pArray.forEach(p => {
            const rawId = String(p.id).trim();
            const unp = rawId.replace(/^0+/, '');
            const pad = unp.padStart(4, '0');

            const pObj = {
                id: rawId,
                name: formatPlayerName(p.name),
                position: String(p.position || p.pos || '').toUpperCase(),
                team: p.team || p.nflTeam || 'FA',
                bye_week: p.bye_week || p.byeWeek || '0',
                status: p.status || p.injury_status || ''
            };

            cachedPlayersMap[rawId] = pObj;
            cachedPlayersMap[unp] = pObj;
            cachedPlayersMap[pad] = pObj;
        });

        // Rosters
        cachedRosters = toArray(rostersRes?.rosters?.franchise);

        // Scores
        cachedYtdScoresMap = {};
        const ytdList = toArray(ytdRes?.playerScores?.playerScore || ytdRes?.playerScores?.player);
        ytdList.forEach(ps => {
            const pid = String(ps.id).trim();
            const unp = pid.replace(/^0+/, '');
            const pad = unp.padStart(4, '0');
            const score = parseFloat(ps.score || 0);
            cachedYtdScoresMap[pid] = score;
            cachedYtdScoresMap[unp] = score;
            cachedYtdScoresMap[pad] = score;
        });

        cachedAvgScoresMap = {};
        const avgList = toArray(avgRes?.playerScores?.playerScore || avgRes?.playerScores?.player);
        avgList.forEach(ps => {
            const pid = String(ps.id).trim();
            const unp = pid.replace(/^0+/, '');
            const pad = unp.padStart(4, '0');
            const score = parseFloat(ps.score || 0);
            cachedAvgScoresMap[pid] = score;
            cachedAvgScoresMap[unp] = score;
            cachedAvgScoresMap[pad] = score;
        });

        // Weekly Scores Parallel Fetch (W1..WcurrentWk)
        cachedWeeklyScoresMap = {};
        const wkPromises = [];
        for (let w = 1; w <= currentWkGlobal; w++) {
            wkPromises.push(client.fetchData('playerScores', { W: w }).catch(() => ({})));
        }
        const wkResults = await Promise.all(wkPromises);
        wkResults.forEach((res, idx) => {
            const w = idx + 1;
            cachedWeeklyScoresMap[w] = {};
            const wkList = toArray(res?.playerScores?.playerScore || res?.playerScores?.player);
            wkList.forEach(ps => {
                const pid = String(ps.id).trim();
                const unp = pid.replace(/^0+/, '');
                const pad = unp.padStart(4, '0');
                const score = parseFloat(ps.score || 0);
                cachedWeeklyScoresMap[w][pid] = score;
                cachedWeeklyScoresMap[w][unp] = score;
                cachedWeeklyScoresMap[w][pad] = score;
            });
        });

        // Transactions Map (BBID / Waiver / Drops)
        cachedTransAcqMap = {};
        cachedDroppedSet = new Set();
        const rawTrans = toArray(transRes?.transactions?.transaction);
        rawTrans.forEach(t => {
            const type = String(t.type || '').toUpperCase();
            const pids = String(t.transaction || '').split(',');
            pids.forEach(pStr => {
                const pid = pStr.trim();
                if (pid) {
                    const unp = pid.replace(/^0+/, '');
                    const pad = unp.padStart(4, '0');
                    if (type.includes('BBID') || type.includes('WAIVER')) {
                        const amt = t.bbidAmount || t.amount || '0';
                        const label = `BB ($${parseFloat(amt).toFixed(2)})`;
                        cachedTransAcqMap[pid] = label;
                        cachedTransAcqMap[unp] = label;
                        cachedTransAcqMap[pad] = label;
                    } else if (type.includes('FREE_AGENT') || type.includes('ADD')) {
                        cachedTransAcqMap[pid] = 'FCFS';
                        cachedTransAcqMap[unp] = 'FCFS';
                        cachedTransAcqMap[pad] = 'FCFS';
                    }

                    if (type.includes('DROP') || type.includes('CUT')) {
                        cachedDroppedSet.add(pid);
                        cachedDroppedSet.add(unp);
                        cachedDroppedSet.add(pad);
                    }
                }
            });
        });

        // Draft Results Map
        cachedDraftPickMap = {};
        const rawDraft = toArray(draftRes?.draftResults?.draftPick);
        rawDraft.forEach(dp => {
            const pid = String(dp.player || '').trim();
            if (pid) {
                const round = parseInt(dp.round || 0, 10);
                const pick = parseInt(dp.pick || 0, 10);
                if (round > 0 && pick > 0) {
                    const unp = pid.replace(/^0+/, '');
                    const pad = unp.padStart(4, '0');
                    const slot = `${round}.${pick.toString().padStart(2, '0')}`;
                    cachedDraftPickMap[pid] = slot;
                    cachedDraftPickMap[unp] = slot;
                    cachedDraftPickMap[pad] = slot;
                }
            }
        });
    }

    function buildMasterPlayerList() {
        const franchiseConfMap = buildConferenceMap(cachedLeagueInfo);
        
        // Ownership Map
        const ownershipMap = {};
        if (cachedRosters) {
            cachedRosters.forEach(f => {
                const fid = normFranchiseId(f.id);
                if (franchiseConfMap[fid] === activeConfId) {
                    const rPlayers = toArray(f.player);
                    rPlayers.forEach(rp => {
                        const pid = String(rp.id).trim();
                        const unp = pid.replace(/^0+/, '');
                        const pad = unp.padStart(4, '0');
                        ownershipMap[pid] = fid;
                        ownershipMap[unp] = fid;
                        ownershipMap[pad] = fid;
                    });
                }
            });
        }

        const masterList = [];
        const seenPids = new Set();

        Object.keys(cachedPlayersMap).forEach(key => {
            const p = cachedPlayersMap[key];
            if (!p || seenPids.has(p.id)) return;

            if (!ALLOWED_POSITIONS.includes(p.position)) return;
            seenPids.add(p.id);

            const pid = String(p.id).trim();
            const unp = pid.replace(/^0+/, '');
            const pad = unp.padStart(4, '0');

            const rosterFid = ownershipMap[pid] || ownershipMap[unp] || ownershipMap[pad] || null;
            const isRostered = !!rosterFid;
            const isMyTeam = (rosterFid === activeUserFid);
            const isFA = !isRostered;

            const mktVal = cachedFcMap[pid] || cachedFcMap[unp] || cachedFcMap[pad] || 0;
            const ytdPts = cachedYtdScoresMap[pid] || cachedYtdScoresMap[unp] || cachedYtdScoresMap[pad] || 0;
            const avgPts = cachedAvgScoresMap[pid] || cachedAvgScoresMap[unp] || cachedAvgScoresMap[pad] || 0;

            const weeklyScores = {};
            for (let w = 1; w <= currentWkGlobal; w++) {
                const wMap = cachedWeeklyScoresMap[w] || {};
                weeklyScores[w] = wMap[pid] ?? wMap[unp] ?? wMap[pad] ?? null;
            }

            // Keeper-aware Acquired Info
            let acqInfo = '-';
            const draftSlot = cachedDraftPickMap[pid] || cachedDraftPickMap[unp] || cachedDraftPickMap[pad];
            const wasDropped = cachedDroppedSet.has(pid) || cachedDroppedSet.has(unp) || cachedDroppedSet.has(pad);
            const transAcq = cachedTransAcqMap[pid] || cachedTransAcqMap[unp] || cachedTransAcqMap[pad];

            if (draftSlot && !wasDropped) {
                acqInfo = draftSlot;
            } else if (transAcq) {
                acqInfo = transAcq;
            } else if (!isFA) {
                acqInfo = 'FCFS';
            } else {
                acqInfo = '-';
            }

            // Bye Week
            const byeStr = (p.bye_week && String(p.bye_week) !== '0') ? `W${p.bye_week}` : '-';

            // Health / Status Shorthand Mapping
            let healthStatus = '-';
            let statusBadgeClass = '';
            const rawStatus = String(p.status || '').toUpperCase();

            if (rawStatus.includes('QUESTIONABLE') || rawStatus === 'Q') {
                healthStatus = 'Q';
                statusBadgeClass = 'dnfl-badge-replace-amber';
            } else if (rawStatus.includes('DOUBTFUL') || rawStatus === 'D') {
                healthStatus = 'D';
                statusBadgeClass = 'dnfl-badge-replace-amber';
            } else if (rawStatus.includes('OUT') || rawStatus === 'O') {
                healthStatus = 'O';
                statusBadgeClass = 'dnfl-badge-replace-red';
            } else if (rawStatus.includes('INJURED') || rawStatus.includes('IR')) {
                healthStatus = 'IR';
                statusBadgeClass = 'dnfl-badge-replace-red';
            } else if (rawStatus.includes('PUP')) {
                healthStatus = 'PUP';
                statusBadgeClass = 'dnfl-badge-replace-red';
            } else if (rawStatus.includes('SUSPENDED') || rawStatus.includes('SUSP')) {
                healthStatus = 'SUSP';
                statusBadgeClass = 'dnfl-badge-replace-red';
            }

            masterList.push({
                id: p.id,
                name: p.name,
                position: p.position,
                team: p.team,
                bye: byeStr,
                mktVal: mktVal,
                pts: ytdPts,
                ppg: avgPts,
                weeklyScores: weeklyScores,
                acqInfo: acqInfo,
                isRostered: isRostered,
                rosterFid: rosterFid,
                ownerName: isFA ? 'Free Agent' : getFranchiseName(rosterFid),
                isMyTeam: isMyTeam,
                isFA: isFA,
                healthStatus: healthStatus,
                statusBadgeClass: statusBadgeClass
            });
        });

        return masterList;
    }

    function calculateActiveUserFloors(masterList) {
        const myRoster = masterList.filter(p => p.isMyTeam);
        const posKeys = ['QB', 'RB', 'WR', 'TE', 'PK', 'DEF'];
        const posFloors = {};

        posKeys.forEach(pos => {
            const posRoster = myRoster.filter(p => p.position === pos);
            const posFa = masterList.filter(p => p.isFA && p.position === pos);

            let lowestVal = 0;
            if (posRoster.length > 0) {
                const vals = posRoster.map(p => p.mktVal);
                lowestVal = Math.min(...vals);
            }

            let topFaVal = 0;
            if (posFa.length > 0) {
                const faVals = posFa.map(p => p.mktVal);
                topFaVal = Math.max(...faVals);
            }

            let targetCount = 0;
            if (lowestVal > 0) {
                targetCount = posFa.filter(p => p.mktVal > lowestVal).length;
            } else {
                targetCount = posFa.filter(p => p.mktVal > 0).length;
            }

            posFloors[pos] = { lowestVal, topFaVal, targetCount };
        });

        // FLEX Floor (Overall lowest among RBs, WRs, TEs)
        const flexRoster = myRoster.filter(p => ['RB', 'WR', 'TE'].includes(p.position));
        const flexFa = masterList.filter(p => p.isFA && ['RB', 'WR', 'TE'].includes(p.position));

        let lowestFlexVal = 0;
        if (flexRoster.length > 0) {
            lowestFlexVal = Math.min(...flexRoster.map(p => p.mktVal));
        }

        let topFaFlexVal = 0;
        if (flexFa.length > 0) {
            topFaFlexVal = Math.max(...flexFa.map(p => p.mktVal));
        }

        let flexTargetCount = 0;
        if (lowestFlexVal > 0) {
            flexTargetCount = flexFa.filter(p => p.mktVal > lowestFlexVal).length;
        } else {
            flexTargetCount = flexFa.filter(p => p.mktVal > 0).length;
        }

        posFloors['FLEX'] = {
            lowestVal: lowestFlexVal,
            topFaVal: topFaFlexVal,
            targetCount: flexTargetCount
        };

        return posFloors;
    }

    function annotateMasterList(masterList, posFloors) {
        masterList.forEach(p => {
            p.valDelta = 0;
            p.badgeType = null;

            if (p.isMyTeam) {
                const posInfo = posFloors[p.position] || { topFaVal: 0, lowestVal: 0 };
                const topFa = posInfo.topFaVal;
                p.valDelta = p.mktVal - topFa;

                if (p.valDelta >= 0) {
                    p.badgeType = 'secure'; // Plain text lead e.g. +$500
                } else if (p.mktVal === posInfo.lowestVal) {
                    p.badgeType = 'lowestFloor'; // Red badge -$150
                } else {
                    p.badgeType = 'upgradeable'; // Amber badge -$100
                }
            } else if (p.isFA) {
                const floorVal = posFloors[p.position] ? posFloors[p.position].lowestVal : 0;
                p.valDelta = p.mktVal - floorVal;

                if (p.valDelta > 0) {
                    p.badgeType = 'green'; // Green badge +$150
                }
            }
        });
    }

    function renderSummaryBanner(posFloors) {
        const container = document.getElementById('dnfl-waivers-banner-pills');
        if (!container) return;

        const posKeys = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'PK', 'DEF'];
        let html = '';

        posKeys.forEach(pos => {
            const floorInfo = posFloors[pos] || { lowestVal: 0, targetCount: 0 };
            const floorVal = floorInfo.lowestVal;
            const targetCount = floorInfo.targetCount || 0;
            const hasTargets = targetCount > 0;

            const pillClass = hasTargets ? 'dnfl-floor-pill--active' : 'dnfl-floor-pill--secure';
            const valDisplay = floorVal > 0 ? `$${floorVal}` : '--';

            let pillContent = '';
            if (hasTargets) {
                pillContent = `
                    <span class="dnfl-floor-pill__label">${pos}</span>
                    <span class="dnfl-floor-pill__value">${valDisplay}</span>
                    <span>(${targetCount})</span>
                `;
            } else {
                pillContent = `
                    <span class="dnfl-floor-pill__label">${pos}</span>
                    <span class="dnfl-floor-pill__value">${valDisplay}</span>
                    <i class="fa-solid fa-circle-check"></i>
                `;
            }

            html += `
                <button class="dnfl-floor-pill ${pillClass}" data-pos="${pos}">
                    ${pillContent}
                </button>
            `;
        });

        container.innerHTML = html;

        // Bind Pill Click Events
        const pills = container.querySelectorAll('.dnfl-floor-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', function () {
                const pos = this.getAttribute('data-pos');
                currentViewMode = 'waiverTargets';
                currentPosFilter = pos;

                const viewSelect = document.getElementById('dnfl-waivers-view-filter');
                if (viewSelect) viewSelect.value = 'waiverTargets';

                const posSelect = document.getElementById('dnfl-waivers-pos-filter');
                if (posSelect) posSelect.value = pos;

                renderTable();
            });
        });
    }

    function getFilteredPlayerList(masterList) {
        let filtered = [...masterList];

        // 1. View Filter
        if (currentViewMode === 'waiverTargets') {
            filtered = filtered.filter(p => {
                if (p.isMyTeam) return true;
                if (!p.isFA) return false;
                if (currentPosFilter === 'FLEX') {
                    const flexFloor = posFloorsGlobal['FLEX'] ? posFloorsGlobal['FLEX'].lowestVal : 0;
                    return p.mktVal > flexFloor;
                }
                return p.valDelta > 0;
            });
        } else if (currentViewMode === 'freeAgents') {
            filtered = filtered.filter(p => p.isFA);
        } else if (currentViewMode === 'rostered') {
            filtered = filtered.filter(p => !p.isFA);
        }

        // 2. Position Filter
        if (currentPosFilter === 'FLEX') {
            filtered = filtered.filter(p => ['RB', 'WR', 'TE'].includes(p.position));
        } else if (currentPosFilter !== 'ALL') {
            filtered = filtered.filter(p => p.position === currentPosFilter);
        }

        // 3. Search Term (Punctuation-Agnostic)
        if (currentSearchTerm.trim()) {
            const cleanQuery = currentSearchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
            filtered = filtered.filter(p => {
                const cleanName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanTeam = p.team.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanOwner = p.ownerName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanPos = p.position.toLowerCase();
                return cleanName.includes(cleanQuery) || cleanTeam.includes(cleanQuery) || cleanOwner.includes(cleanQuery) || cleanPos.includes(cleanQuery);
            });
        }

        // 4. Multi-Column Sorting
        filtered.sort((a, b) => {
            let valA, valB;

            if (currentSortColumn.startsWith('wk_')) {
                const wkNum = parseInt(currentSortColumn.replace('wk_', ''), 10);
                valA = a.weeklyScores[wkNum] ?? -1;
                valB = b.weeklyScores[wkNum] ?? -1;
            } else {
                valA = a[currentSortColumn];
                valB = b[currentSortColumn];
            }

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }

    function getSortIcon(col) {
        if (currentSortColumn !== col) {
            return '<i class="fa-solid fa-sort dnfl-sort-icon dnfl-sort-icon--inactive"></i>';
        }
        return currentSortDir === 'asc'
            ? '<i class="fa-solid fa-sort-up dnfl-sort-icon dnfl-sort-icon--active"></i>'
            : '<i class="fa-solid fa-sort-down dnfl-sort-icon dnfl-sort-icon--active"></i>';
    }

    function renderTable() {
        const thead = document.getElementById('dnfl-waivers-thead');
        const tbody = document.getElementById('dnfl-waivers-tbody');
        const summary = document.getElementById('dnfl-waivers-count-summary');
        if (!thead || !tbody) return;

        const showDelta = (currentViewMode === 'waiverTargets' || currentViewMode === 'freeAgents');
        const showOwner = (currentViewMode !== 'freeAgents');

        const weeklyCols = [];
        for (let w = 1; w <= currentWkGlobal; w++) {
            weeklyCols.push(w);
        }

        // Render Headers
        let headerHtml = `
            <tr>
                <th class="dnfl-sticky-col-1 dnfl-th-index">#</th>
                <th class="dnfl-sticky-col-2 dnfl-th-player dnfl-sortable" data-sort="name">Player ${getSortIcon('name')}</th>
                <th class="dnfl-th-pos dnfl-sortable" data-sort="position">Pos ${getSortIcon('position')}</th>
                <th class="dnfl-th-val dnfl-sortable" data-sort="mktVal">Val ${getSortIcon('mktVal')}</th>
                ${showDelta ? `<th class="dnfl-th-delta dnfl-sortable" data-sort="valDelta">Delta ${getSortIcon('valDelta')}</th>` : ''}
                <th class="dnfl-th-pts dnfl-sortable" data-sort="pts">Pts ${getSortIcon('pts')}</th>
                <th class="dnfl-th-ppg dnfl-sortable" data-sort="ppg">PPG ${getSortIcon('ppg')}</th>
                <th class="dnfl-th-bye dnfl-sortable" data-sort="bye">Bye ${getSortIcon('bye')}</th>
                <th class="dnfl-th-acq dnfl-sortable" data-sort="acqInfo">Acquired ${getSortIcon('acqInfo')}</th>
                ${showOwner ? `<th class="dnfl-th-owner dnfl-sortable" data-sort="ownerName">Owner ${getSortIcon('ownerName')}</th>` : ''}
                <th class="dnfl-th-status dnfl-sortable" data-sort="healthStatus">Status ${getSortIcon('healthStatus')}</th>
                ${weeklyCols.map(wk => `<th class="dnfl-th-wk dnfl-sortable" data-sort="wk_${wk}">W${wk} ${getSortIcon('wk_' + wk)}</th>`).join('')}
            </tr>
        `;
        thead.innerHTML = headerHtml;

        // Bind Sort Listener
        const sortableThs = thead.querySelectorAll('th.dnfl-sortable');
        sortableThs.forEach(th => {
            th.addEventListener('click', function () {
                const col = this.getAttribute('data-sort');
                if (currentSortColumn === col) {
                    currentSortDir = (currentSortDir === 'desc') ? 'asc' : 'desc';
                } else {
                    currentSortColumn = col;
                    currentSortDir = (col === 'name' || col === 'position' || col === 'ownerName') ? 'asc' : 'desc';
                }
                renderTable();
            });
        });

        // Filter Player List
        const displayList = getFilteredPlayerList(masterListGlobal);

        if (displayList.length === 0) {
            const totalCols = 10 + (showDelta ? 1 : 0) + (showOwner ? 1 : 0) + weeklyCols.length;
            tbody.innerHTML = `
                <tr>
                    <td colspan="${totalCols}" class="dnfl-td-empty">
                        <i class="fa-solid fa-circle-info"></i> No matching players found for selected criteria.
                    </td>
                </tr>
            `;
            if (summary) summary.innerHTML = 'Showing 0 players';
            return;
        }

        // Render Table Rows
        let tbodyHtml = '';
        displayList.forEach((p, idx) => {
            // Row Class Assignment
            let rowClass = 'dnfl-row-fa-white';
            if (p.isMyTeam) {
                rowClass = 'dnfl-row-my-team';
            } else if (p.isRostered) {
                rowClass = 'dnfl-row-rostered-gray';
            }

            // Value Formatting
            const valStr = (p.mktVal > 0) ? `$${p.mktVal}` : '--';

            // Delta Formatting
            let deltaHtml = '--';
            if (showDelta) {
                if (p.badgeType === 'lowestFloor') {
                    deltaHtml = `<span class="dnfl-badge-replace-red">-$${Math.abs(p.valDelta)} <i class="fa-solid fa-arrow-trend-down"></i></span>`;
                } else if (p.badgeType === 'upgradeable') {
                    deltaHtml = `<span class="dnfl-badge-replace-amber">-$${Math.abs(p.valDelta)} <i class="fa-solid fa-arrow-trend-down"></i></span>`;
                } else if (p.badgeType === 'green') {
                    deltaHtml = `<span class="dnfl-badge-green">+$${p.valDelta}</span>`;
                } else if (p.valDelta >= 0) {
                    deltaHtml = `+$${p.valDelta}`;
                } else {
                    deltaHtml = `-$${Math.abs(p.valDelta)}`;
                }
            }

            // Status Badge Formatting
            let statusHtml = '-';
            if (p.healthStatus !== '-') {
                statusHtml = `<span class="${p.statusBadgeClass}">${p.healthStatus}</span>`;
            }

            // Player Link with O=08 and data-player-id for native MFL Popups & News Icons
            const pLink = `<a href="${window.baseURLDynamic || ''}/${window.year || '2026'}/options?L=${window.league_id || ''}&O=08&PLAYER_ID=${p.id}" class="dnfl-player-link" data-player-id="${p.id}" target="_blank">${p.name}</a>`;

            // Weekly Scores Cells
            const wkCellsHtml = weeklyCols.map(wk => {
                const score = p.weeklyScores[wk];
                if (score === null || score === undefined) {
                    if (p.bye === `W${wk}`) return `<td class="dnfl-td-wk">BYE</td>`;
                    return `<td class="dnfl-td-wk">0.00</td>`;
                }
                return `<td class="dnfl-td-wk">${score.toFixed(2)}</td>`;
            }).join('');

            tbodyHtml += `
                <tr class="${rowClass}">
                    <td class="dnfl-sticky-col-1 dnfl-td-index">${idx + 1}</td>
                    <td class="dnfl-sticky-col-2 dnfl-td-player">${pLink}</td>
                    <td class="dnfl-td-pos"><span class="dnfl-pos-badge dnfl-pos-${p.position.toLowerCase()}">${p.position}</span></td>
                    <td class="dnfl-td-val">${valStr}</td>
                    ${showDelta ? `<td class="dnfl-td-delta">${deltaHtml}</td>` : ''}
                    <td class="dnfl-td-pts">${p.pts.toFixed(2)}</td>
                    <td class="dnfl-td-ppg">${p.ppg.toFixed(2)}</td>
                    <td class="dnfl-td-bye">${p.bye}</td>
                    <td class="dnfl-td-acq">${p.acqInfo}</td>
                    ${showOwner ? `<td class="dnfl-td-owner">${p.ownerName}</td>` : ''}
                    <td class="dnfl-td-status">${statusHtml}</td>
                    ${wkCellsHtml}
                </tr>
            `;
        });

        tbody.innerHTML = tbodyHtml;

        if (summary) {
            summary.innerHTML = `Showing ${displayList.length} player${displayList.length === 1 ? '' : 's'}`;
        }

        // Post-render MFL Re-binding Hooks
        if (typeof window.addNewsIcons === 'function') {
            try { window.addNewsIcons(); } catch (e) {}
        }
        if (typeof window.initPlayerPopups === 'function') {
            try { window.initPlayerPopups(); } catch (e) {}
        }

        // Intercept player link clicks for native MFL modal popup
        const pLinks = tbody.querySelectorAll('.dnfl-player-link');
        pLinks.forEach(link => {
            link.addEventListener('click', function (e) {
                if (typeof window.mfl_player_popup === 'function') {
                    e.preventDefault();
                    window.mfl_player_popup(this);
                }
            });
        });
    }

    function bindToolbarEvents() {
        const viewSelect = document.getElementById('dnfl-waivers-view-filter');
        if (viewSelect) {
            viewSelect.addEventListener('change', function () {
                currentViewMode = this.value;
                renderTable();
            });
        }

        const posSelect = document.getElementById('dnfl-waivers-pos-filter');
        if (posSelect) {
            posSelect.addEventListener('change', function () {
                currentPosFilter = this.value;
                renderTable();
            });
        }

        const searchInput = document.getElementById('dnfl-waivers-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                currentSearchTerm = this.value;
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
            masterListGlobal = buildMasterPlayerList();
            posFloorsGlobal = calculateActiveUserFloors(masterListGlobal);
            annotateMasterList(masterListGlobal, posFloorsGlobal);

            renderSummaryBanner(posFloorsGlobal);
            bindToolbarEvents();
            renderTable();

            console.log(`[DNFL Waivers] Module v4.13 initialized successfully (${masterListGlobal.length} players).`);
        } catch (err) {
            console.error('[DNFL Waivers] Initialization Error:', err);
            const tbody = document.getElementById('dnfl-waivers-tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="12" class="dnfl-td-empty">
                            <i class="fa-solid fa-triangle-exclamation"></i> Error loading Waiver Matrix module. Please refresh.
                        </td>
                    </tr>
                `;
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.addEventListener('dnfl:ready', init);

    window.DNFL = window.DNFL || {};
    window.DNFL.Waivers = {
        init: init,
        version: '4.13'
    };

})(window, document);
