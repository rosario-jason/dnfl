/**
 * Duke Networking Fantasy League (DNFL) - Waiver Target & Player Matrix Module v4.11
 * File: scripts/dnfl-waivers-v4_11.js
 */
(function (window, document) {
    'use strict';

    if (window.DNFLWaiversLoaded_v4_11) return;
    window.DNFLWaiversLoaded_v4_11 = true;

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
    let cachedFranchisesMap = {};
    let cachedFranchiseConfMap = {};

    let activeUserFid = '0000';
    let activeConfId = '1';

    let currentViewMode = 'waiverTargets'; // 'waiverTargets' | 'allPlayers' | 'freeAgents' | 'rostered'
    let currentPosFilter = 'ALL';          // 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'PK' | 'DEF'
    let currentSearchTerm = '';
    let currentSortColumn = 'mktVal';      // Default sort column
    let currentSortDir = 'desc';           // 'asc' | 'desc'

    let initRetries = 0;
    const MAX_RETRIES = 20;
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
        return String(fid).padStart(4, '0');
    }

    function formatPlayerName(raw) {
        if (!raw) return '';
        let str = String(raw).trim();
        if (str.includes(',')) {
            const parts = str.split(',');
            const last = parts[0].trim();
            const first = parts.slice(1).join(',').trim();
            str = `${first} ${last}`.trim();
        }
        return str;
    }

    function resolveActiveUser() {
        let fid = window.franchise_id || window.current_franchise_id || window.login_franchise_id;
        if (!fid) {
            const params = new URLSearchParams(window.location.search);
            fid = params.get('FRANCHISE') || params.get('F') || '0000';
        }
        return normFranchiseId(fid);
    }

    function getFranchiseName(fid) {
        const normFid = normFranchiseId(fid);
        if (normFid === '0000') return 'Free Agent';
        return cachedFranchisesMap[normFid] || `Franchise ${normFid}`;
    }

    function buildConferenceMap(leagueInfo) {
        const rawFranchises = toArray(leagueInfo?.franchises?.franchise);
        const rawDivisions = toArray(leagueInfo?.divisions?.division);

        const divToConfMap = {};
        rawDivisions.forEach(d => {
            divToConfMap[String(d.id)] = String(d.conference || '');
        });

        const fMap = {};
        const confMap = {};
        rawFranchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            fMap[fid] = f.name || `Franchise ${fid}`;
            const divId = String(f.division || '');
            const confId = String(f.conference || f.conf || divToConfMap[divId] || '1');
            confMap[fid] = confId;
        });

        cachedFranchisesMap = fMap;
        cachedFranchiseConfMap = confMap;
    }

    async function fetchFantasyCalcMap() {
        const client = getApiClient();
        if (!client) return {};
        const year = cachedLeagueInfo?.year || window.year || '2026';
        const url = `https://dnfl.live/dnfl_market/${year}/fantasycalc_values_current.json`;

        try {
            const rawText = await client.fetchRawText(url, { ttl: client.TTL.DAILY });
            if (!rawText) {
                cachedFcError = true;
                return {};
            }

            const arr = JSON.parse(rawText);
            const items = Array.isArray(arr) ? arr : (arr.players || []);
            const map = {};

            items.forEach(item => {
                const pObj = item.player || item;
                const mflId = item.mflId || item.mfl_id || pObj.mflId || pObj.mfl_id;
                if (mflId) {
                    const val = parseFloat(item.value || item.tradeValue || pObj.value || pObj.tradeValue || 0);
                    const rawId = String(mflId).trim();
                    const unpadded = rawId.replace(/^0+/, '');
                    const padded = unpadded.padStart(4, '0');

                    map[rawId] = val;
                    map[unpadded] = val;
                    map[padded] = val;
                }
            });

            cachedFcError = false;
            return map;
        } catch (e) {
            console.error('[DNFL Waivers] ERROR: Unable to load market values from fantasycalc_values_current.json:', e);
            cachedFcError = true;
            return {};
        }
    }

    async function loadData() {
        const client = getApiClient();
        if (!client) return;

        try {
            // Native concurrent fetch across required MFL endpoints
            const [
                leagueData,
                weeklyData,
                playersData,
                rostersData,
                scoresYTDData,
                scoresAVGData,
                transData,
                draftData
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

            cachedLeagueInfo = leagueData?.league || {};
            buildConferenceMap(cachedLeagueInfo);

            activeUserFid = resolveActiveUser();
            if (activeUserFid !== '0000' && cachedFranchiseConfMap[activeUserFid]) {
                activeConfId = cachedFranchiseConfMap[activeUserFid];
            } else {
                activeConfId = '1';
            }

            // Current Week Resolution from Native MFL API
            const curWk = weeklyData?.weeklyResults?.week || weeklyData?.weeklyResults?.currentWk || cachedLeagueInfo?.currentWk || '1';
            const currentWk = parseInt(curWk, 10);
            cachedLeagueInfo.currentWk = currentWk;

            // Fetch playerScores API for Weeks 1..currentWk for ALL players (starters, bench & FAs)
            cachedWeeklyScoresMap = {};
            const weekNumbers = Array.from({ length: currentWk }, (_, i) => i + 1);
            const weekPromises = weekNumbers.map(w => client.fetchData('playerScores', { W: w }).catch(() => ({})));
            const weekResults = await Promise.all(weekPromises);

            weekResults.forEach((wData, index) => {
                const wkNum = index + 1;
                const psList = toArray(wData?.playerScores?.playerScore);
                psList.forEach(ps => {
                    const pid = String(ps.id).trim();
                    const unpadded = pid.replace(/^0+/, '');
                    const padded = unpadded.padStart(4, '0');
                    const score = parseFloat(ps.score || 0);

                    if (!cachedWeeklyScoresMap[padded]) cachedWeeklyScoresMap[padded] = {};
                    cachedWeeklyScoresMap[padded][wkNum] = score;
                    if (!cachedWeeklyScoresMap[unpadded]) cachedWeeklyScoresMap[unpadded] = {};
                    cachedWeeklyScoresMap[unpadded][wkNum] = score;
                });
            });

            // Map Rosters using normalized Franchise IDs
            const rosteredPidsMap = {};
            const rawRosters = toArray(rostersData?.rosters?.franchise);
            rawRosters.forEach(r => {
                const fid = normFranchiseId(r.id);
                const conf = cachedFranchiseConfMap[fid] || '1';
                if (conf === activeConfId) {
                    const playerList = toArray(r.player);
                    playerList.forEach(pObj => {
                        const pid = String(pObj.id || pObj).trim();
                        if (pid) {
                            const unpadded = pid.replace(/^0+/, '');
                            const padded = unpadded.padStart(4, '0');
                            rosteredPidsMap[padded] = fid;
                            rosteredPidsMap[unpadded] = fid;
                        }
                    });
                }
            });
            cachedRosters = rosteredPidsMap;

            // Map Draft Results for Keeper Pick Tracking
            cachedDraftPickMap = {};
            const rawDraft = toArray(draftData?.draftResults?.draftPick);
            rawDraft.forEach(dp => {
                const pid = String(dp.player || '').trim();
                if (pid) {
                    const round = parseInt(dp.round || 0, 10);
                    const pick = parseInt(dp.pick || 0, 10);
                    if (round > 0 && pick > 0) {
                        const slot = `${round}.${pick.toString().padStart(2, '0')}`;
                        const unpadded = pid.replace(/^0+/, '');
                        const padded = unpadded.padStart(4, '0');
                        cachedDraftPickMap[padded] = slot;
                        cachedDraftPickMap[unpadded] = slot;
                    }
                }
            });

            // Map Drops and Transaction Acquisition Types
            cachedDroppedSet = new Set();
            cachedTransAcqMap = {};
            const rawTrans = toArray(transData?.transactions?.transaction);

            rawTrans.forEach(t => {
                const type = String(t.type || '').toUpperCase();
                const pids = String(t.transaction || '').split(',');

                pids.forEach(pStr => {
                    const pid = pStr.trim();
                    if (pid) {
                        const unpadded = pid.replace(/^0+/, '');
                        const padded = unpadded.padStart(4, '0');

                        if (type.includes('DROP') || type.includes('CUT') || type.includes('WAIVER')) {
                            cachedDroppedSet.add(padded);
                            cachedDroppedSet.add(unpadded);
                        }

                        if (type.includes('BBID') || type.includes('WAIVER')) {
                            const amt = parseFloat(t.bbidAmount || t.amount || t.bid || 0);
                            const formattedAmt = amt > 0 ? `BB $${amt.toFixed(2).replace(/\.00$/, '')}` : 'BB $0';
                            cachedTransAcqMap[padded] = formattedAmt;
                            cachedTransAcqMap[unpadded] = formattedAmt;
                        } else if (type.includes('FREE_AGENT') || type.includes('ADD')) {
                            cachedTransAcqMap[padded] = 'FCFS';
                            cachedTransAcqMap[unpadded] = 'FCFS';
                        } else if (type.includes('TRADE')) {
                            cachedTransAcqMap[padded] = 'Trade';
                            cachedTransAcqMap[unpadded] = 'Trade';
                        }
                    }
                });
            });

            // YTD and AVG Scores Mapping
            cachedYtdScoresMap = {};
            toArray(scoresYTDData?.playerScores?.playerScore).forEach(ps => {
                const pid = String(ps.id).trim();
                const unpadded = pid.replace(/^0+/, '');
                const padded = unpadded.padStart(4, '0');
                const val = parseFloat(ps.score || 0);
                cachedYtdScoresMap[padded] = val;
                cachedYtdScoresMap[unpadded] = val;
            });

            cachedAvgScoresMap = {};
            toArray(scoresAVGData?.playerScores?.playerScore).forEach(ps => {
                const pid = String(ps.id).trim();
                const unpadded = pid.replace(/^0+/, '');
                const padded = unpadded.padStart(4, '0');
                const val = parseFloat(ps.score || 0);
                cachedAvgScoresMap[padded] = val;
                cachedAvgScoresMap[unpadded] = val;
            });

            // FantasyCalc Market Values
            cachedFcMap = await fetchFantasyCalcMap();
            cachedPlayersMap = toArray(playersData?.players?.player);

            const masterList = buildMasterPlayerList();
            const posFloors = calculateActiveUserFloors(masterList);
            annotateMasterList(masterList, posFloors);

            window.DNFLWaiverMasterList = masterList;
            window.DNFLWaiverPosFloors = posFloors;

            renderSummaryBanner(posFloors);
            renderTable();
        } catch (err) {
            console.error('[DNFL Waivers Error in loadData]:', err);
        }
    }

    function buildMasterPlayerList() {
        if (!cachedPlayersMap) return [];

        const filtered = cachedPlayersMap.filter(p => {
            const pos = String(p.position || p.pos || '').toUpperCase();
            return ALLOWED_POSITIONS.includes(pos);
        });

        return filtered.map(p => {
            const pid = String(p.id).trim();
            const unpadded = pid.replace(/^0+/, '');
            const padded = unpadded.padStart(4, '0');

            const fid = cachedRosters[padded] || cachedRosters[unpadded] || '0000';
            const isFA = fid === '0000';
            const isMyTeam = fid === activeUserFid;
            const ownerName = isFA ? 'Free Agent' : getFranchiseName(fid);

            // Shorthand Status
            const rawStatus = String(p.status || p.injury_status || p.status_code || '').toUpperCase();
            let statusShorthand = '-';
            let statusTitle = 'Active';

            if (rawStatus.includes('Q') || rawStatus.includes('QUESTIONABLE')) {
                statusShorthand = 'Q'; statusTitle = 'Questionable';
            } else if (rawStatus.includes('D') || rawStatus.includes('DOUBTFUL')) {
                statusShorthand = 'D'; statusTitle = 'Doubtful';
            } else if (rawStatus.includes('O') || rawStatus.includes('OUT')) {
                statusShorthand = 'O'; statusTitle = 'Out';
            } else if (rawStatus.includes('IR') || rawStatus.includes('INJURED')) {
                statusShorthand = 'IR'; statusTitle = 'Injured Reserve';
            } else if (rawStatus.includes('PUP')) {
                statusShorthand = 'PUP'; statusTitle = 'PUP List';
            } else if (rawStatus.includes('SUSP')) {
                statusShorthand = 'SUSP'; statusTitle = 'Suspended';
            }

            // Native Bye Week from players API
            const byeWeek = (p.bye_week && String(p.bye_week) !== '0') ? `W${p.bye_week}` : '-';

            // Market Value
            const mktVal = cachedFcMap[padded] !== undefined ? cachedFcMap[padded] : (cachedFcMap[unpadded] || 0);

            // Keeper Acquired Info
            const draftSlot = cachedDraftPickMap[padded] || cachedDraftPickMap[unpadded];
            const wasDropped = cachedDroppedSet.has(padded) || cachedDroppedSet.has(unpadded);
            const transAcq = cachedTransAcqMap[padded] || cachedTransAcqMap[unpadded];

            let acqInfo = '-';
            if (draftSlot && !wasDropped) {
                acqInfo = draftSlot;
            } else if (transAcq) {
                acqInfo = transAcq;
            } else if (!isFA) {
                acqInfo = 'FCFS';
            }

            const pts = cachedYtdScoresMap[padded] || cachedYtdScoresMap[unpadded] || 0;
            const ppg = cachedAvgScoresMap[padded] || cachedAvgScoresMap[unpadded] || 0;
            const wScores = cachedWeeklyScoresMap[padded] || cachedWeeklyScoresMap[unpadded] || {};

            return {
                id: pid,
                paddedId: padded,
                name: p.name || `Player ${pid}`,
                pos: String(p.position || p.pos).toUpperCase(),
                team: String(p.team || p.nflTeam || 'FA').toUpperCase(),
                bye: byeWeek,
                mktVal: mktVal,
                pts: pts,
                ppg: ppg,
                weeklyScores: wScores,
                fid: fid,
                ownerName: ownerName,
                statusShorthand: statusShorthand,
                statusTitle: statusTitle,
                isFA: isFA,
                isMyTeam: isMyTeam,
                acqInfo: acqInfo,
                valDelta: 0,
                badgeType: 'none'
            };
        });
    }

    function calculateActiveUserFloors(masterList) {
        const myPlayers = masterList.filter(p => p.isMyTeam);
        const faPlayers = masterList.filter(p => p.isFA);

        const floors = {
            QB: { lowestVal: Infinity, topFaVal: 0, lowestPid: null },
            RB: { lowestVal: Infinity, topFaVal: 0, lowestPid: null },
            WR: { lowestVal: Infinity, topFaVal: 0, lowestPid: null },
            TE: { lowestVal: Infinity, topFaVal: 0, lowestPid: null },
            PK: { lowestVal: Infinity, topFaVal: 0, lowestPid: null },
            DEF: { lowestVal: Infinity, topFaVal: 0, lowestPid: null },
            FLEX: { lowestVal: Infinity, topFaVal: 0, lowestPid: null }
        };

        // My Roster Floors
        myPlayers.forEach(p => {
            const pos = p.pos;
            if (floors[pos]) {
                if (p.mktVal < floors[pos].lowestVal) {
                    floors[pos].lowestVal = p.mktVal;
                    floors[pos].lowestPid = p.id;
                }
            }
            if (['RB', 'WR', 'TE'].includes(pos)) {
                if (p.mktVal < floors.FLEX.lowestVal) {
                    floors.FLEX.lowestVal = p.mktVal;
                    floors.FLEX.lowestPid = p.id;
                }
            }
        });

        // Top Available Free Agents
        faPlayers.forEach(p => {
            const pos = p.pos;
            if (floors[pos]) {
                if (p.mktVal > floors[pos].topFaVal) {
                    floors[pos].topFaVal = p.mktVal;
                }
            }
            if (['RB', 'WR', 'TE'].includes(pos)) {
                if (p.mktVal > floors.FLEX.topFaVal) {
                    floors.FLEX.topFaVal = p.mktVal;
                }
            }
        });

        // Clean up Infinities
        Object.keys(floors).forEach(pos => {
            if (floors[pos].lowestVal === Infinity) {
                floors[pos].lowestVal = 0;
            }
        });

        return floors;
    }

    function annotateMasterList(masterList, posFloors) {
        masterList.forEach(p => {
            const pos = p.pos;
            const floorObj = posFloors[pos] || { lowestVal: 0, topFaVal: 0, lowestPid: null };

            if (p.isMyTeam) {
                // My Team Delta = mktVal - topFaVal (dollar lead over top FA target)
                p.valDelta = p.mktVal - floorObj.topFaVal;
                if (p.valDelta >= 0) {
                    p.badgeType = 'secure';
                } else if (p.id === floorObj.lowestPid) {
                    p.badgeType = 'lowestFloor';
                } else {
                    p.badgeType = 'upgradeable';
                }
            } else if (p.isFA) {
                // Free Agent Delta = mktVal - myFloor (value advantage over lowest rostered player)
                p.valDelta = p.mktVal - floorObj.lowestVal;
                if (p.valDelta > 0) {
                    p.badgeType = 'waiverTarget';
                } else {
                    p.badgeType = 'belowFloor';
                }
            } else {
                p.valDelta = 0;
                p.badgeType = 'none';
            }
        });
    }

    function renderSummaryBanner(posFloors) {
        const pillsWrapper = document.getElementById('dnfl-waivers-banner-pills');
        if (!pillsWrapper) return;

        const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'PK', 'DEF'];
        const html = positions.map(pos => {
            const val = posFloors[pos] ? posFloors[pos].lowestVal : 0;
            const isActive = currentPosFilter === pos ? ' dnfl-floor-pill--active' : '';
            return `<span class="dnfl-floor-pill${isActive}" data-pos="${pos}">
                <span class="dnfl-floor-pill__label">${pos}:</span>
                <span class="dnfl-floor-pill__value">$${val}</span>
            </span>`;
        }).join('');

        pillsWrapper.innerHTML = html;

        // Bind click events on benchmark pills to auto-filter position
        const pills = pillsWrapper.querySelectorAll('.dnfl-floor-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', function () {
                const pos = this.getAttribute('data-pos');
                currentPosFilter = (currentPosFilter === pos) ? 'ALL' : pos;

                const posSelect = document.getElementById('dnfl-waivers-pos-filter');
                if (posSelect) posSelect.value = currentPosFilter;

                renderTable();
            });
        });
    }

    function getFilteredPlayerList() {
        const master = window.DNFLWaiverMasterList || [];

        let filtered = master.filter(p => {
            // View mode filtering
            if (currentViewMode === 'waiverTargets') {
                return (p.isFA && p.valDelta > 0) || p.isMyTeam;
            } else if (currentViewMode === 'freeAgents') {
                return p.isFA;
            } else if (currentViewMode === 'rostered') {
                return !p.isFA;
            }
            return true; // allPlayers
        });

        // Position filtering
        if (currentPosFilter !== 'ALL') {
            if (currentPosFilter === 'FLEX') {
                filtered = filtered.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
            } else {
                filtered = filtered.filter(p => p.pos === currentPosFilter);
            }
        }

        // Punctuation-agnostic search
        if (currentSearchTerm) {
            const term = currentSearchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
            filtered = filtered.filter(p => {
                const nameStr = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const teamStr = p.team.toLowerCase();
                const posStr = p.pos.toLowerCase();
                const ownerStr = p.ownerName.toLowerCase().replace(/[^a-z0-9]/g, '');
                return nameStr.includes(term) || teamStr.includes(term) || posStr.includes(term) || ownerStr.includes(term);
            });
        }

        // Sort execution
        filtered.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }

    function renderTable() {
        const tbody = document.getElementById('dnfl-waivers-tbody');
        const theadRow = document.getElementById('dnfl-waivers-thead-row');
        const summaryDiv = document.getElementById('dnfl-waivers-count-summary');
        if (!tbody || !theadRow) return;

        const currentWk = cachedLeagueInfo?.currentWk || 1;
        const weekCols = Array.from({ length: currentWk }, (_, i) => i + 1);

        // Append week headers to table header row
        const existingWkThs = theadRow.querySelectorAll('.dnfl-th-wk');
        existingWkThs.forEach(th => th.remove());

        weekCols.forEach(wk => {
            const th = document.createElement('th');
            th.className = 'dnfl-th-wk';
            th.setAttribute('data-col', `w_${wk}`);
            th.innerHTML = `W${wk} ${getSortIcon(`w_${wk}`)}`;
            theadRow.appendChild(th);
        });

        bindHeaderSortEvents();

        const players = getFilteredPlayerList();

        if (summaryDiv) {
            let label = 'Players';
            if (currentViewMode === 'waiverTargets') label = 'Waiver Targets & Roster';
            else if (currentViewMode === 'freeAgents') label = 'Free Agents';
            else if (currentViewMode === 'rostered') label = 'Rostered Players';

            let errMessage = '';
            if (cachedFcError) {
                errMessage = '<div class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Warning: Market values currently unavailable from dnfl.live</div>';
            }

            summaryDiv.innerHTML = `${errMessage}Showing <strong>${players.length}</strong> ${label}`;
        }

        if (players.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${12 + weekCols.length}" class="dnfl-td-empty">No players found matching current view and filters.</td></tr>`;
            return;
        }

        const year = cachedLeagueInfo?.year || window.year || '2026';
        const leagueId = cachedLeagueInfo?.id || window.league_id || '';

        const rowsHtml = players.map((p, idx) => {
            // Row background class hierarchy
            let rowClass = 'dnfl-row-fa-white';
            if (currentViewMode === 'waiverTargets') {
                rowClass = p.isMyTeam ? 'dnfl-row-my-team-subtle' : 'dnfl-row-fa-white';
            } else {
                if (p.isMyTeam) rowClass = 'dnfl-row-my-team';
                else if (!p.isFA) rowClass = 'dnfl-row-rostered-gray';
            }

            // Market Value Display
            const valDisplay = cachedFcError ? '--' : `$${p.mktVal}`;

            // Delta Badge Display
            let deltaDisplay = '--';
            if (!cachedFcError) {
                if (p.badgeType === 'lowestFloor') {
                    deltaDisplay = `<span class="dnfl-badge-replace-red">-$${Math.abs(p.valDelta)} <i class="fa-solid fa-arrow-trend-down"></i></span>`;
                } else if (p.badgeType === 'upgradeable') {
                    deltaDisplay = `<span class="dnfl-badge-replace-amber">-$${Math.abs(p.valDelta)} <i class="fa-solid fa-arrow-trend-down"></i></span>`;
                } else if (p.badgeType === 'secure') {
                    deltaDisplay = `+$${p.valDelta}`;
                } else if (p.badgeType === 'waiverTarget') {
                    deltaDisplay = `<span class="dnfl-badge-green">+$${p.valDelta}</span>`;
                } else if (p.badgeType === 'belowFloor') {
                    deltaDisplay = `-$${Math.abs(p.valDelta)}`;
                }
            }

            // Status Shorthand Badge Display
            let statusDisplay = '-';
            if (p.statusShorthand === 'Q' || p.statusShorthand === 'D') {
                statusDisplay = `<span class="dnfl-badge-replace-amber" title="${p.statusTitle}">${p.statusShorthand}</span>`;
            } else if (['O', 'IR', 'PUP', 'SUSP'].includes(p.statusShorthand)) {
                statusDisplay = `<span class="dnfl-badge-replace-red" title="${p.statusTitle}">${p.statusShorthand}</span>`;
            }

            // Weekly Scores Columns
            const wkCellsHtml = weekCols.map(wk => {
                const score = p.weeklyScores[wk];
                if (score !== undefined) {
                    return `<td class="dnfl-td-wk">${score.toFixed(2)}</td>`;
                } else if (p.bye === `W${wk}`) {
                    return `<td class="dnfl-td-wk" style="color:#94a3b8;font-weight:600;">BYE</td>`;
                } else {
                    return `<td class="dnfl-td-wk">0.00</td>`;
                }
            }).join('');

            // MFL Player Link
            const playerLinkHtml = `<a href="${window.baseURLDynamic || ''}/${year}/options?L=${leagueId}&O=07&P=${p.id}" class="position_${p.pos.toLowerCase()}">${formatPlayerName(p.name)}</a>`;

            return `<tr class="${rowClass}">
                <td class="dnfl-sticky-col-1 dnfl-td-index">${idx + 1}</td>
                <td class="dnfl-sticky-col-2 dnfl-td-player">${playerLinkHtml}</td>
                <td class="dnfl-td-pos"><span class="dnfl-pos-badge dnfl-pos-${p.pos.toLowerCase()}">${p.pos}</span></td>
                <td class="dnfl-td-nfl">${p.team}</td>
                <td class="dnfl-td-val">${valDisplay}</td>
                <td class="dnfl-td-delta">${deltaDisplay}</td>
                <td class="dnfl-td-pts">${p.pts.toFixed(2)}</td>
                <td class="dnfl-td-ppg">${p.ppg.toFixed(2)}</td>
                <td class="dnfl-td-bye">${p.bye}</td>
                <td class="dnfl-td-owner">${p.ownerName}</td>
                <td class="dnfl-td-status">${statusDisplay}</td>
                <td class="dnfl-td-acq">${p.acqInfo}</td>
                ${wkCellsHtml}
            </tr>`;
        }).join('');

        tbody.innerHTML = rowsHtml;
    }

    function bindHeaderSortEvents() {
        const theadRow = document.getElementById('dnfl-waivers-thead-row');
        if (!theadRow) return;

        const ths = theadRow.querySelectorAll('th');
        ths.forEach(th => {
            th.onclick = function () {
                const col = this.getAttribute('data-col');
                if (!col || col === 'index') return;

                if (col.startsWith('w_')) {
                    const wkNum = parseInt(col.replace('w_', ''), 10);
                    currentSortColumn = `wk_${wkNum}`;
                } else {
                    currentSortColumn = col;
                }

                currentSortDir = (currentSortColumn === col && currentSortDir === 'desc') ? 'asc' : 'desc';
                renderTable();
            };
        });
    }

    function getSortIcon(col) {
        if (currentSortColumn === col || (col.startsWith('w_') && currentSortColumn === `wk_${col.replace('w_', '')}`)) {
            return currentSortDir === 'desc' ? '<i class="fa-solid fa-sort-down"></i>' : '<i class="fa-solid fa-sort-up"></i>';
        }
        return '<i class="fa-solid fa-sort" style="opacity:0.3;"></i>';
    }

    function bindToolbarEvents() {
        const viewSelect = document.getElementById('dnfl-waivers-view-filter');
        if (viewSelect) {
            viewSelect.addEventListener('change', function (e) {
                currentViewMode = e.target.value;
                renderTable();
            });
        }

        const posSelect = document.getElementById('dnfl-waivers-pos-filter');
        if (posSelect) {
            posSelect.addEventListener('change', function (e) {
                currentPosFilter = e.target.value;
                renderSummaryBanner(window.DNFLWaiverPosFloors || {});
                renderTable();
            });
        }

        const searchInput = document.getElementById('dnfl-waivers-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function (e) {
                currentSearchTerm = e.target.value || '';
                renderTable();
            });
        }
    }

    async function init() {
        const container = document.getElementById('dnfl-waivers-container');
        if (!container && initRetries < MAX_RETRIES) {
            initRetries++;
            setTimeout(init, RETRY_INTERVAL);
            return;
        }

        bindToolbarEvents();
        await loadData();
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
        loadData: loadData,
        renderTable: renderTable
    };

})(window, document);
