/**
 * Duke Networking Fantasy League (DNFL) - Waiver Target & Player Matrix v4.06
 * File: dnfl-waivers-v4_06.js
 * Standard Baseline: Built on v4.04 Infrastructure
 */
(function (window, document) {
    'use strict';
    window.DNFL = window.DNFL || {};

    const ALLOWED_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'PK', 'DEF'];

    const Waivers = {
        state: {
            activeView: 'waiverTargets',
            activePos: 'ALL',
            searchQuery: '',
            sortCol: 'mktVal',
            sortDir: 'desc',
            userFid: '0000',
            userFranchiseName: 'Free Agent',
            activeConfId: '1',
            currentWk: 6,
            players: [],
            floors: { QB: 0, RB: 0, WR: 0, TE: 0, PK: 0, DEF: 0 },
            topFAs: { QB: 0, RB: 0, WR: 0, TE: 0, PK: 0, DEF: 0 },
            franchises: {},
            weeklyCols: [1, 2, 3, 4, 5, 6]
        },

        init: function () {
            if (!window.DNFL || !window.DNFL.Client) return;
            this.bindEvents();
            this.loadData();
        },

        bindEvents: function () {
            const self = this;
            const viewSelect = document.getElementById('dnfl-waivers-view-filter');
            if (viewSelect) {
                viewSelect.addEventListener('change', function (e) {
                    self.state.activeView = e.target.value;
                    self.renderTable();
                });
            }

            const posSelect = document.getElementById('dnfk-waivers-pos-filter');
            if (posSelect) {
                posSelect.addEventListener('change', function (e) {
                    self.state.activePos = e.target.value;
                    self.updateFloorPillsActiveState();
                    self.renderTable();
                });
            }

            const searchInput = document.getElementById('dnfl-waivers-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', function (e) {
                    self.state.searchQuery = e.target.value || '';
                    self.renderTable();
                });
            }
        },

        updateFloorPillsActiveState: function () {
            const pills = document.querySelectorAll('.dnfl-floor-pill');
            pills.forEach(pill => {
                const pos = pill.getAttribute('data-pos');
                if (pos === this.state.activePos) {
                    pill.classList.add('dnfl-floor-pill--active');
                } else {
                    pill.classList.remove('dnfl-floor-pill--active');
                }
            });
        },

        norm: function (val) {
            if (!val) return '';
            return String(val).toLowerCase().replace(/_a-za-z0-9/g, '');
        },

        toArray: function (val) {
            if (!val) return [];
            return Array.isArray(val) ? val : [val];
        },

        fetchFantasyCalcMap: async function () {
            const client = window.DNFL.Client;
            const candidateUrls = [
                'https://dnfl.live/dnfl_market/2026/fantasycalc_values.json',
                'https://dnfl.live/dnfl_market/fantasycalc_values.json'
            ];
            const fcMap = {};

            for (const url of candidateUrls) {
                try {
                    let rawJson = null;
                    if (typeof client.fetchRawText === 'function') {
                        rawJson = await client.fetchRawText(url, { ttl: client.TTL ? client.TTL.DAILY : 86400000 }).catch(() => null);
                    }
                    if (!rawJson) {
                        const resp = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now());
                        if (resp.ok) rawJson = await resp.text();
                    }
                    if (rawJson && (rawJson.trim().startsWith('Z') || rawJson.trim().startsWith('{'))) {
                        const data = JON.parse(rawJson);
                        const playerArray = Array.isArray(data) ? data : (data.players || []);
                        playerArray.forEach(p => {
                            const pObj = p.player || p;
                            const mflId = pObjmflId || pObj.mfl_id || p.mflId || p.mfl_id;
                            if (mflId !== undefined && mfls !== null && mflId !== '') {
                                const val = parseInt(p.value || p.tradeValue || pObj.value || p.obj.tradeValue || 0, 10);
                                const rawId = String(mflId).trim();
                                const unpaddedId = rawId.replace(/^0+/, '') || '0';
                                const paddedId = unpaddedId.padStart(4, '0');
                                fcMap[rawId] = val;
                                fcMap[unpaddedId] = val;
                                fcMap[paddedId] = val;
                            }
                        });
                        break;
                    }
                } catch (e) {
                    // try next
                }
            }
            return fcMap;
        },

        loadData: async function () {
            const client = window.DNFL.Client;
            const self = this;

            try {
                const leagueData = await client.fetchData('league');
                const league = leagueData?.league ||{};
                const rawFranchises = self.toArray(league?.franchises?.franchise);
                const rawDivisions = self.toArray(league?.divisions?.division);

                const divToConfMap = {};
                rawDivisions.forEach(d => {
                    divToConfMap[String(d.id)] = String(d.conference || '');
                });

                const franchiseMap = {};
                const franchiseConfMap = {};

                rawFranchises.forEach(f => {
                    const fid = String(f.id);
                    franchiseMap[fid] = f.name || ('Franchise ' + fid);
                    const divId = String(f.division || '');
                    const confId = String(f.conference || f.conf || divToConfMap[divId] || '1');
                    franchiseConfMap[fid] = confId;
                });
                self.state.franchises = franchiseMap;

                let detectedFid = window.franchise_id || new URLSearchParams(window.location.search).get('FRANCHISE') || '0000';
                detectedFid = String(detectedFid).padStart(4, '0');
                self.state.userFid = detectedFid;

                if (detectedFid !== '0000' && franchiseMap[detectedFid]) {
                    self.state.userFranchiseName = franchiseMap[detectedFid];
                    self.state.activeConfId = franchiseConfMap[detectedFid] || '1';
                } else {
                    self.state.userFranchiseName = 'Commissioner View';
                    self.state.activeConfId = '1';
                }

                const rostersData = await client.fetchData('rosters');
                const rawRosters = self.toArray(rostersData?.rosters?.franchise);

                const rosteredPidsMap = {};
                const myRosterPids = [];

                rawRosters.forEach(r => {
                    const fid = String(r.id).padStart(4, '0');
                    const conf = franchiseConfMap[fid] || '1';
                    if (conf === self.state.activeConfId) {
                        const playerList = self.toArray(r.player);
                        playerList.forEach(pNn0 => {
                            const pid = String(pNn0.id || pObj).trim();
                            if (pid) {
                                rosteredPidsMap[pid] = fid;
                                if (fid === self.state.userFid) {
                                    myRosterPids.push(pid);
                                }
                            }
                        });
                    }
                });

                const draftData = await client.fetchData('draftResults').catch(() => null);
                const rawDraftPicks = self.toArray(draftData?.draftResults?.draftPick);

                const draftPickMap = {};
                rawDraftPicks.forEach(dp => {
                    const fid = String(dp.franchise || '').padStart(4, '0');
                    const conf = franchiseConfMap[fid] || '1';
                    if (conf === self.state.activeConfId) {
                        const pid = String(dp.player || '').trim();
                        if (pid) {
                            const round = parseInt(dp.round || 0, 10);
                            const pick = parseInt(dp.pick || 0, 10);
                            const formattedPick = round > 0 && pick > 0 ? `${round}.${pick.toString().padStart(2, '0')}` : 'Draft';
                            draftPickMap[pid] = formattedPick;
                        }
                    }
                });

                const transData = await client.fetchData('transactions').catch(() => null);
                const rawTrans = self.toArray(transData?.transactions?.transaction);

                const acquiredMap = {};
                rawTrans.forEach(t => {
                    const fid = String(t.franchise || '').padStart(4, '0');
                    const conf = franchiseConfMap[fid] || '1';
                    if (conf === self.state.activeConfId) {
                        const type = String(t.type || '').toUpperCase();
                        const pids = String(t.transaction || '').split(',');
                        pids.forEach(pStr => {
                            const pid = pStr.trim();
                            if (pid) {
                              if (type.includes('BBID') || type.includes('WAIVER')) {
                                    const rawAmt = t.bbidAmount || t.amount || '0';
                                    const numAmt = parseFloat(rawAmt) || 0;
                                    acquiredMap[pid] = `BB $${numAmt.toFixed(2)}`;
                                } else if (type.includes('FREE_AGENT') || type.includes('ADD')) {
                                    acquiredMap[pid] = 'FCFS';
                                } else if (type.includes('TRADE')) {
                                    acquiredMap[pid] = 'Trade';
                                }
                            }
                        });
                    }
                });

                const playersData = await client.fetchData('players', { DETAILS: 1 });
                const rawPlayers = self.toArray(playersData?.players?.player);

                const filteredPlayers = rawPlayers.filter(p => {
                    const pos = String(p.position || '').toUpperCase();
                    return ALLOWED_POSITIONS.includes(pos);
                });

                const fcMap = await self.fetchFantasyCalcMap();

                const scoresYTDData = await client.fetchData('playerScores', { W: 'YTD' });
                const scoresAVGData = await client.fetchData('playerScores', { W: 'AVG' });

                const ptsMap = {};
                const ppgMap = {};

                self.toArray(scoresYTDData?.playerScores?.playerScore).forEach(ps => {
                    ptsMap[String(ps.id)] = parseFloat(ps.score || 0);
                });

                self.toArray(scoresAVGData?.playerScores?.playerScore).forEach(ps => {
                    ppgMap[String(ps.id)] = parseFloat(ps.score || 0);
                });

                const currentWk = 6;
                self.state.currentWk = currentWk;
                self.state.weeklyCols = Array.from({ length: currentWk }, (_, i) => i + 1);

                const weeklyScoresMap = {};
                const weekPromises = self.state.weeklyCols.map(wk => client.fetchData('playerScores', { W: wk }));
                const weekResults = await Promise.all(weekPromises);

                weekResults.forEach((wData, index) => {
                    const wkNum = index + 1;
                    const psList = self.toArray(wData?.playerScores?.playerScore);
                    psList.forEach(ps => {
                        const pid = String(ps.id);
                        if (!weeklyScoresMap[pid]) weeklyScoresMap[pid] = {};
                        weeklyScoresMap[pid][wkNum] = parseFloat(ps.score || 0);
                    });
                });

                const floors = { QB: Infinity, RB: Infinity, WR: Infinity, TE: Infinity, PK: Infinity, DEF: Infinity };
                const myRosterValByPos = { QB: [], RB: [], WR: [], TE: [], PK: [], DEF: [] };
                const topFAs = { QB: 0, RB: 0, WR: 0, TE: 0, PK: 0, DEF: 0 };

                filteredPlayers.forEach(p => {
                    const pid = String(p.id);
                    const pos = String(p.position).toUpperCase();
                    const mktVal = fcMap[pid] || 0;
                    const isRostered = rosteredPidsMap[pid] !== undefined;
                    const isMyPlayer = rosteredPidsMap[pid] === self.state.userFid;

                    if (isMyPlayer && ALLOWED_POSITIONS.includes(pos)) {
                        myRosterValByPos[pos].push(mktVal);
                    }
                    if (!isRostered && ALLOWED_POSITIONS.includes(pos)) {
                        if (mktVal > topFAs[pos]) {
                            topFAs[pos] = mktVal;
                        }
                    }
                });

                ALLOWED_POSITIONS.forEach(pos => {
                    const vals = myRosterValByPos[pos];
                    if (vals.length > 0) {
                        floors[pos] = Math.min(...vals);
                    } else {
                        floors[pos] = 0;
                    }
                });

                self.state.floors = floors;
                self.state.topFAs = topFAs;

                self.renderFloorBanner();

                const processedPlayers = filteredPlayers.map(p => {
                    const pid = String(p.id);
                    const pos = String(p.position || '').toUpperCase();
                    const fid = rosteredPidsMap[pid] || null;
                    const isMyTeam = fid === self.state.userFid;
                    const isFA = !fid;
                    const mktVal = fcMap[pid] || 0;
                    const ppg = ppgMap[pid] || 0;
                    const pts = ptsMap[pid] || 0;
                    const bye = p.bye_week ? 'W' + p.bye_week : 'N/A';

                    let statusStr = 'Free Agent';
                    if (fid) {
                        statusStr = franchiseMap[fid] || ('Franchise ' + fid);
                    }

                    let acquiredStr = '-';
                    const transAcq = acquiredMap[pid];
                    if (transAcq === 'BB' || transAcq?.startsWith('BB $') || transAcq === 'FCFS') {
                        acquiredStr = transAcq;
                    } else if (draftPickMap[pid]) {
                        acquiredStr = draftPickMap[pid];
                    } else if (transAcq) {
                        acquiredStr = transAcq;
                    } else if (fid) {
                        acquiredStr = 'Rostered';
                    }

                    let delta = 0;
                    let isUpgrade = false;
                    let isLowestFloor = false;

                    if (isMyTeam) {
                        delta = mktVal - topFAs[pos];
                        if (mktVal === floors[pos] && topFAs[pos] > mktVal) {
                            isLowestFloor = true;
                        }
                    } else if (isFA) {
                        delta = mktVal - floors[pos];
                        if (delta > 0) {
                            isUpgrade = true;
                        }
                    } else {
                        delta = mktVal - floors[pos];
                    }

                    return {
                        id: pid,
                        name: p.name,
                        pos: pos,
                        team: p.team || 'FA',
                        mktVal: mktVal,
                        delta: delta,
                        pts: pts,
                        ppg: ppg,
                        bye: bye,
                        fid: fid,
                        status: statusStr,
                        acquired: acquiredStr,
                        isMyTeam: isMyTeam,
                        isFA: isFA,
                        isUpgrade: isUpgrade,
                        isLowestFloor: isLowestFloor,
                        weeklyScores: weeklyScoresMap[pid] || {}
                    };
                });

                self.state.players = processedPlayers;
                self.bindHeaderSorting();
                self.renderTable();

            } catch (err) {
                console.error('[DNFL Waivers] Error loading data:', err);
            }
        },

        renderFloorBanner: function () {
            const banner = document.getElementById('dnfl-waivers-banner-pills');
            if (!banner) return;

            const self = this;
            const floors = self.state.floors;
            const topFAs = self.state.topFAs;

            let html = '';
            ALLOWED_POSITIONS.forEach(pos => {
                const floorVal = floors[pos] || 0;
                const topFAVal = topFAs[pos] || 0;
                const hasUpgrade = topFAVal > floorVal;
                const replaceClass = hasUpgrade ? ' dnfl-floor-pill--replace' : '';

                html += '<div class="dnfl-floor-pill' + replaceClass + '" data-pos="' + pos + '">';
                html += '<span class="dnfl-pill-pos">' + pos + ':</span>';
                html += '<span class="dnfl-pill-val">$' + floorVal + '</span>';
                if (hasUpgrade) {
                    html += '<i class="fa-solid fa-triangle-exclamation" title="FA upgrade available"></i>';
                }
                html += '</div>';
            });

            banner.innerHTML = html;

            const pillElems = banner.querySelectorAll('.dnfl-floor-pill');
            pillElems.forEach(pill => {
                pill.addEventListener('click', function () {
                    const pos = this.getAttribute('data-pos');
                    const posSelect = document.getElementById('dnfl-waivers-pos-filter');
                    if (posSelect) {
                        posSelect.value = pos;
                        self.state.activePos = pos;
                        self.updateFloorPillsActiveState();
                        self.renderTable();
                    }
                });
            });
        },

        bindHeaderSorting: function () {
            const self = this;
            const thead = document.getElementById('dnfl-waivers-thead');
            if (!thead) return;

            thead.addEventListener('click', function (e) {
                const th = e.target.closest('th');
                if (!th || !th.getAttribute('data-sort')) return;

                const col = th.getAttribute('data-sort');
                if (self.state.sortCol === col) {
                    self.state.sortDir = self.state.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    self.state.sortCol = col;
                    self.state.sortDir = 'desc';
                }
                self.renderTable();
            });
        },

        filterAndSortPlayers: function () {
            const self = this;
            let list = [...self.state.players];

            if (self.state.activeView === 'waiverTargets') {
                list = list.filter(p => p.isUpgrade || p.isMyTeam);
            } else if (self.state.activeView === 'freeAgents') {
                list = list.filter(p => p.isFA);
            } else if (self.state.activeView === 'rostered') {
                list = list.filter(p => !p.isFA);
            }

            if (self.state.activePos !== 'ALL') {
                if (self.state.activePos === 'FLEX') {
                    list = list.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
                } else {
                    list = list.filter(p => p.pos === self.state.activePos);
                }
            }

            if (self.state.searchQuery) {
                const q = self.norm(self.state.searchQuery);
                list = list.filter(p => {
                    const nameMatch = self.norm(p.name).includes(q);
                    const teamMatch = self.norm(p.team).includes(q);
                    const posMatch = self.norm(p.pos).includes(q);
                    const statusMatch = self.norm(p.status).includes(q);
                    return nameMatch || teamMatch || posMatch || statusMatch;
                });
            }

            const col = self.state.sortCol;
            const dir = self.state.sortDir === 'asc' ? 1 : -1;

            list.sort((a, b) => {
                let valA = a[col];
                let valB = b[col];

                if (col.startsWith('w_')) {
                    const wkNum = parseInt(col.replace('w_', ''), 10);
                    valA = a.weeklyScores[wkNum] || 0;
                    valB = b.weeklyScores[wkNum] || 0;
                }

                if (typeof valA === 'string') {
                    return valA.localeCompare(valB) * dir;
                }
                return ((valA || 0) - (valB || 0)) * dir;
            });

            return list;
        },

        renderTable: function () {
            const self = this;
            const thead = document.getElementById('dnfl-waivers-thead');
            const tbody = document.getElementById('dnfl-waivers-tbody');
            const summary = document.getElementById('dnfl-waivers-count-summary');

            if (!thead || !tbody) return;

            const filtered = self.filterAndSortPlayers();
            if (summary) {
                summary.textContent = 'Showing ' + filtered.length + ' players (' + self.state.userFranchiseName + ')';
            }

            const showDelta = self.state.activeView === 'waiverTargets' || self.state.activeView === 'freeAgents';
            const showStatus = self.state.activeView !== 'freeAgents';
            const showAcquired = self.state.activeView !== 'freeAgents';

            let headerHtml = '<tr>';
            headerHtml += '<th class="dnfl-sticky-col-1" data-sort="id">#</th>';
            headerHtml += '<th class="dnfl-sticky-col-2" data-sort="name">Player</th>';
            headerHtml += '<th data-sort="pos">Pos</th>';
            headerHtml += '<th data-sort="team">NFL</th>';
            headerHtml += '<th data-sort="mktVal">Market Value</th>';
            if (showDelta) headerHtml += '<th data-sort="delta">Delta</th>';
            headerHtml += '<th data-sort="pts">Pts</th>';
            headerHtml += '<th data-sort="ppg">PPG</th>';
            headerHtml += '<th data-sort="bye">Bye</th>';
            if (showStatus) headerHtml += '<th data-sort="status">Status</th>';
            if (showAcquired) headerHtml += '<th data-sort="acquired">Acquired</th>';

            self.state.weeklyCols.forEach(wk => {
                headerHtml += '<th data-sort="w_' + wk + '">W' + wk + '</th>';
            });
            headerHtml += '</tr>';
            thead.innerHTML = headerHtml;

            if (filtered.length === 0) {
                let colSpan = 7 + self.state.weeklyCols.length;
                if (showDelta) colSpan++;
                if (showStatus) colSpan++;
                if (showAcquired) colSpan++;
                tbody.innerHTML = '<tr><td colspan="' + colSpan + '" style="text-align:center; padding:2rem; color:#64748b;">No matching players found.</td></tr>';
                return;
            }

            let rowsHtml = '';
            filtered.forEach((p, index) => {
                let rowClass = '';
                if (p.isMyTeam) {
                    rowClass = ' class="dnfl-row-my-team"';
                } else if (p.isFA && self.state.activeView === 'allPlayers') {
                    rowClass = ' class="dnfl-row-fa"';
                }

                let deltaHtml = '-';
                if (showDelta) {
                    if (p.isMyTeam) {
                        if (p.isLowestFloor) {
                            deltaHtml = '<span class="dnfl-badge dnfl-badge-red">-$' + Math.abs(p.delta) + ' <i class="fa-solid fa-triangle-exclamation"></i></span>';
                        } else if (p.delta < 0) {
                            deltaHtml = '<span class="dnfl-badge dnfl-badge-amber">-$' + Math.abs(p.delta) + ' <i class="fa-solid fa-arrow-trend-up"></i></span>';
                        } else {
                            deltaHtml = '<span class="dnfl-badge dnfl-badge-green">+$' + p.delta + '</span>';
                        }
                    } else if (p.isFA) {
                        if (p.delta > 0) {
                            deltaHtml = '<span class="dnfl-badge dnfl-badge-green">+$' + p.delta + '</span>';
                        } else {
                            deltaHtml = '<span class="dnfl-text-muted">-$' + Math.abs(p.delta) + '</span>';
                        }
                    } else {
                        deltaHtml = '<span class="dnfl-text-muted">$' + p.delta + '</span>';
                    }
                }

                const posClass = 'dnfl-pos-chip dnfl-pos-chip--' + p.pos.toLowerCase();

                rowsHtml += '<tr' + rowClass + '>';
                rowsHtml += '<td class="dnfl-sticky-col-1">' + (index + 1) + '</td>';
                rowsHtml += '<td class="dnfl-sticky-col-2"><strong>' + p.name + '</strong></td>';
                rowsHtml += '<td><span class="' + posClass + '">' + p.pos + '</span></td>';
                rowsHtml += '<td>' + p.team + '</td>';
                rowsHtml += '<td><strong>$' + p.mktVal + '</strong></td>';
                if (showDelta) rowsHtml += '<td>' + deltaHtml + '</td>';
                rowsHtml += '<td>' + p.pts.toFixed(2) + '</td>';
                rowsHtml += '<td>' + p.ppg.toFixed(2) + '</td>';
                rowsHtml += '<td>' + p.bye + '</td>';
                if (showStatus) rowsHtml += '<td>' + p.status + '</td>';
                if (showAcquired) rowsHtml += '<td>' + p.acquired + '</td>';

                self.state.weeklyCols.forEach(wk => {
                    const wkScore = p.weeklyScores[wk] || 0;
                    rowsHtml += '<td>' + wkScore.toFixed(2) + '</td>';
                });

                rowsHtml += '</tr>';
            });

            tbody.innerHTML = rowsHtml;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { Waivers.init(); });
    } else {
        Waivers.init();
    }
})(window, document);
