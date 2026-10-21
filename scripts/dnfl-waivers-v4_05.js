/**
 * Duke Networking Fantasy League (DNFL) - Waiver Target & Player Matrix v4.05
 * File: dnfl-waivers-v4_05.js
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

            const posSelect = document.getElementById('dnfl-waivers-pos-filter');
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
            return String(val).toLowerCase().replace(/[^a-z0-9]/g, '');
        },

        toArray: function (val) {
            if (!val) return [];
            return Array.isArray(val) ? val : [val];
        },

        loadData: async function () {
            const client = window.DNFL.Client;
            const self = this;

            try {
                const leagueData = await client.fetchData('league');
                const league = leagueData?.league || {};
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
                        playerList.forEach(pObj => {
                            const pid = String(pObj.id || pObj).trim();
                            if (pid) {
                                rosteredPidsMap[pid] = fid;
                                if (fid === self.state.userFid) {
                                    myRosterPids.push(pid);
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

                const transData = await client.fetchData('transactions');
                const rawTrans = self.toArray(transData?.transactions?.transaction);

                const acquiredMap = {};
                rawTrans.forEach(t => {
                    const type = String(t.type || '').toUpperCase();
                    const pids = String(t.transaction || '').split(',');
                    pids.forEach(pStr => {
                        const pid = pStr.trim();
                        if (pid) {
                            if (type.includes('BBID') || type.includes('WAIVER')) {
                                const bbidAmt = t.bbidAmount || t.amount || '0';
                                acquiredMap[pid] = 'BBID ($' + bbidAmt + ')';
                            } else if (type.includes('FREE_AGENT') || type.includes('ADD')) {
                                acquiredMap[pid] = 'FCFS';
                            } else if (type.includes('TRADE')) {
                                acquiredMap[pid] = 'Trade';
                            }
                        }
                    });
                });

                const fcValuesMap = {};
                filteredPlayers.forEach(p => {
                    const pid = String(p.id);
                    const pos = String(p.position).toUpperCase();
                    const ppg = ppgMap[pid] || 0;
                    const pts = ptsMap[pid] || 0;
                    let base = Math.round(ppg * 35 + pts * 1.5);
                    if (pos === 'QB') base = Math.round(base * 1.35);
                    if (pos === 'RB') base = Math.round(base * 1.25);
                    if (pos === 'WR') base = Math.round(base * 1.20);
                    if (pos === 'TE') base = Math.round(base * 1.10);
                    if (base < 10) base = 10;
                    fcValuesMap[pid] = base;
                });

                const floors = { QB: 0, RB: 0, WR: 0, TE: 0, PK: 0, DEF: 0 };
                const posRosterCounts = { QB: 0, RB: 0, WR: 0, TE: 0, PK: 0, DEF: 0 };
                const posRosterValues = { QB: [], RB: [], WR: [], TE: [], PK: [], DEF: [] };

                myRosterPids.forEach(pid => {
                    const p = filteredPlayers.find(pl => String(pl.id) === pid);
                    if (p) {
                        const pos = String(p.position).toUpperCase();
                        const val = fcValuesMap[pid] || 0;
                        if (posRosterValues[pos]) {
                            posRosterValues[pos].push(val);
                            posRosterCounts[pos]++;
                        }
                    }
                });

                ALLOWED_POSITIONS.forEach(pos => {
                    const vals = posRosterValues[pos];
                    if (vals && vals.length > 0) {
                        floors[pos] = Math.min(...vals);
                    } else {
                        floors[pos] = 0;
                    }
                });
                self.state.floors = floors;

                const topFAPosVal = { QB: 0, RB: 0, WR: 0, TE: 0, PK: 0, DEF: 0 };
                filteredPlayers.forEach(p => {
                    const pid = String(p.id);
                    const fid = rosteredPidsMap[pid];
                    if (!fid) {
                        const pos = String(p.position).toUpperCase();
                        const val = fcValuesMap[pid] || 0;
                        if (val > topFAPosVal[pos]) {
                            topFAPosVal[pos] = val;
                        }
                    }
                });

                const masterPlayers = filteredPlayers.map(p => {
                    const pid = String(p.id);
                    const pos = String(p.position).toUpperCase();
                    const fid = rosteredPidsMap[pid] || null;
                    const isMine = (fid === self.state.userFid);
                    const isFA = (!fid);
                    const isRival = (fid && !isMine);

                    const mktVal = fcValuesMap[pid] || 0;
                    const pts = ptsMap[pid] || 0;
                    const ppg = ppgMap[pid] || 0;
                    const byeWeekStr = p.bye_week ? ('W' + p.bye_week) : 'N/A';

                    const statusName = fid ? (franchiseMap[fid] || ('Franchise ' + fid)) : 'Free Agent';
                    const acquired = fid ? (acquiredMap[pid] || 'Draft') : 'N/A';

                    const topFAVal = topFAPosVal[pos] || 0;
                    const myFloor = floors[pos] || 0;

                    let delta = 0;
                    let badgeType = 'none';

                    if (isMine) {
                        delta = mktVal - topFAVal;
                        if (mktVal < topFAVal && mktVal === myFloor) {
                            badgeType = 'replaceRed';
                        } else if (mktVal < topFAVal) {
                            badgeType = 'replaceAmber';
                        } else {
                            badgeType = 'green';
                        }
                    } else if (isFA) {
                        delta = mktVal - myFloor;
                        if (delta > 0) {
                            badgeType = 'green';
                        } else {
                            badgeType = 'muted';
                        }
                    }

                    return {
                        id: pid,
                        name: p.name || 'Unknown Player',
                        pos: pos,
                        team: p.team || 'FA',
                        mktVal: mktVal,
                        pts: pts,
                        ppg: ppg,
                        bye: byeWeekStr,
                        fid: fid,
                        isMine: isMine,
                        isFA: isFA,
                        isRival: isRival,
                        statusName: statusName,
                        acquired: acquired,
                        delta: delta,
                        badgeType: badgeType,
                        weeklyScores: weeklyScoresMap[pid] || {}
                    };
                });

                self.state.players = masterPlayers;

                self.renderBanner(posRosterCounts);
                self.renderTable();

            } catch (err) {
                console.error(err);
            }
        },

        renderBanner: function (posRosterCounts) {
            const container = document.getElementById('dnfl-waivers-banner-pills');
            if (!container) return;

            const self = this;
            const floors = self.state.floors;

            let html = '';
            ALLOWED_POSITIONS.forEach(pos => {
                const floorVal = floors[pos] || 0;
                const count = posRosterCounts[pos] || 0;
                const isActive = (self.state.activePos === pos);
                const activeClass = isActive ? 'dnfl-floor-pill--active' : '';

                html += '<button type="button" class="dnfl-floor-pill ' + activeClass + '" data-pos="' + pos + '">';
                html += '<span>' + pos + ':</span><strong>$' + floorVal + '</strong>';
                html += '<span style="font-weight:400; font-size:0.75rem; opacity:0.8;">(' + count + ')</span></button>';
            });

            container.innerHTML = html;

            const pillBtns = container.querySelectorAll('.dnfl-floor-pill');
            pillBtns.forEach(btn => {
                btn.addEventListener('click', function () {
                    const pos = btn.getAttribute('data-pos');
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

        renderTable: function () {
            const self = this;
            const state = self.state;

            let list = state.players.filter(p => {
                if (state.activeView === 'waiverTargets') {
                    if (!p.isMine && !p.isFA) return false;
                    if (p.isFA && p.delta <= 0 && state.activePos === 'ALL' && !state.searchQuery) {
                        return false;
                    }
                } else if (state.activeView === 'freeAgents') {
                    if (!p.isFA) return false;
                } else if (state.activeView === 'rostered') {
                    if (p.isFA) return false;
                }

                if (state.activePos !== 'ALL') {
                    if (state.activePos === 'FLEX') {
                        if (!['RB', 'WR', 'TE'].includes(p.pos)) return false;
                    } else {
                        if (p.pos !== state.activePos) return false;
                    }
                }

                if (state.searchQuery) {
                    const normQ = self.norm(state.searchQuery);
                    const normName = self.norm(p.name);
                    const normTeam = self.norm(p.team);
                    const normStatus = self.norm(p.statusName);
                    if (!normName.includes(normQ) && !normTeam.includes(normQ) && !normStatus.includes(normQ)) {
                        return false;
                    }
                }

                return true;
            });

            list.sort((a, b) => {
                let valA = a[state.sortCol];
                let valB = b[state.sortCol];

                if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = String(valB || '').toLowerCase();
                }

                if (valA < valB) return state.sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return state.sortDir === 'asc' ? 1 : -1;
                return 0;
            });

            const countSummary = document.getElementById('dnfl-waivers-count-summary');
            if (countSummary) {
                countSummary.textContent = 'Displaying ' + list.length + ' players (' + state.activeView + ' view)';
            }

            const thead = document.getElementById('dnfl-waivers-thead');
            if (thead) {
                let headHtml = '<tr>';
                headHtml += '<th class="dnfl-sticky-col-1" data-col="id">#</th>';
                headHtml += '<th class="dnfl-sticky-col-2" data-col="name">Player</th>';
                headHtml += '<th data-col="pos">Pos</th>';
                headHtml += '<th data-col="team">NFL</th>';
                headHtml += '<th data-col="mktVal">Val</th>';

                const showDelta = (state.activeView === 'waiverTargets' || state.activeView === 'freeAgents');
                if (showDelta) {
                    headHtml += '<th data-col="delta">Delta</th>';
                }

                headHtml += '<th data-col="pts">Pts</th>';
                headHtml += '<th data-col="ppg">PPG</th>';
                headHtml += '<th data-col="bye">Bye</th>';

                const showStatus = (state.activeView !== 'freeAgents');
                if (showStatus) {
                    headHtml += '<th data-col="statusName">Status</th>';
                }

                const showAcquired = (state.activeView !== 'freeAgents');
                if (showAcquired) {
                    headHtml += '<th data-col="acquired">Acquired</th>';
                }

                state.weeklyCols.forEach(wk => {
                    headHtml += '<th data-col="w' + wk + '">W' + wk + '</th>';
                });

                headHtml += '</tr>';
                thead.innerHTML = headHtml;

                const ths = thead.querySelectorAll('th');
                ths.forEach(th => {
                    th.addEventListener('click', function () {
                        const col = th.getAttribute('data-col');
                        if (!col) return;
                        if (state.sortCol === col) {
                            state.sortDir = (state.sortDir === 'asc') ? 'desc' : 'asc';
                        } else {
                            state.sortCol = col;
                            state.sortDir = (col === 'name' || col === 'team' || col === 'pos' || col === 'statusName') ? 'asc' : 'desc';
                        }
                        self.renderTable();
                    });
                });
            }

            const tbody = document.getElementById('dnfl-waivers-tbody');
            if (tbody) {
                if (list.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="20" style="text-align:center; padding:2rem; color:#64748b;">No matching players found.</td></tr>';
                    return;
                }

                let bodyHtml = '';
                list.forEach((p, idx) => {
                    let rowClass = '';
                    if (state.activeView === 'allPlayers' && p.isFA) {
                        rowClass = 'dnfl-row-fa';
                    } else if (p.isMine) {
                        rowClass = 'dnfl-row-my-team';
                    }

                    bodyHtml += '<tr class="' + rowClass + '">';
                    bodyHtml += '<td class="dnfl-sticky-col-1">' + (idx + 1) + '</td>';

                    bodyHtml += '<td class="dnfl-sticky-col-2"><a href="#" style="font-weight:700; color:#0f172a; text-decoration:none;">' + p.name + '</a></td>';

                    const posLower = p.pos.toLowerCase();
                    bodyHtml += '<td><span class="dnfl-pos-chip dnfl-pos-chip--' + posLower + '">' + p.pos + '</span></td>';
                    bodyHtml += '<td>' + p.team + '</td>';

                    bodyHtml += '<td style="font-weight:700;">$' + p.mktVal + '</td>';

                    const showDelta = (state.activeView === 'waiverTargets' || state.activeView === 'freeAgents');
                    if (showDelta) {
                        let deltaHtml = '';
                        const formattedDelta = (p.delta > 0) ? ('+$' + p.delta) : ('-$' + Math.abs(p.delta));

                        if (p.badgeType === 'replaceRed') {
                            deltaHtml = '<span class="dnfl-badge-replace-red">' + formattedDelta + ' <i class="fa-solid fa-triangle-exclamation"></i></span>';
                        } else if (p.badgeType === 'replaceAmber') {
                            deltaHtml = '<span class="dnfl-badge-replace-amber">' + formattedDelta + ' <i class="fa-solid fa-arrow-trend-up"></i></span>';
                        } else if (p.badgeType === 'green') {
                            deltaHtml = '<span class="dnfl-badge-green">' + formattedDelta + '</span>';
                        } else {
                            deltaHtml = '<span class="dnfl-text-muted" style="color:#94a3b8; font-size:0.8125rem;">' + formattedDelta + '</span>';
                        }
                        bodyHtml += '<td>' + deltaHtml + '</td>';
                    }

                    bodyHtml += '<td>' + p.pts.toFixed(2) + '</td>';
                    bodyHtml += '<td>' + p.ppg.toFixed(2) + '</td>';
                    bodyHtml += '<td>' + p.bye + '</td>';

                    const showStatus = (state.activeView !== 'freeAgents');
                    if (showStatus) {
                        bodyHtml += '<td>' + p.statusName + '</td>';
                    }

                    const showAcquired = (state.activeView !== 'freeAgents');
                    if (showAcquired) {
                        bodyHtml += '<td>' + p.acquired + '</td>';
                    }

                    state.weeklyCols.forEach(wk => {
                        const wkScore = p.weeklyScores[wk];
                        const wkStr = (typeof wkScore === 'number') ? wkScore.toFixed(2) : '--';
                        bodyHtml += '<td>' + wkStr + '</td>';
                    });

                    bodyHtml += '</tr>';
                });

                tbody.innerHTML = bodyHtml;
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            Waivers.init();
        });
    } else {
        Waivers.init();
    }

    window.DNFL.Waivers = Waivers;

})(window, document);