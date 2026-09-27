/* ==========================================================================
   DNFL Last Team Standing (LTS) Module Logic Engine (v2)
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */
(function(window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};

    let retryCount = 0;
    const maxRetries = 50;
    let moduleState = {
        leagueData: null,
        weeklyResultsData: null,
        rulesConfig: {},
        selectedConference: null,
        activeYear: null,
        leagueId: null
    };

    const DEFAULT_CONFERENCE_RULES = {
        lts_isEnabled: true,
        highScore_isEnabled: true,
        startWeek: 'auto'
    };

    function getApiClient() {
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("[DNFL LTS] DNFL.Client API middleware is unavailable.");
        }
        return client;
    }

    /**
     * Resolves the active logged-in user's 4-digit franchise ID
     */
    function getLoggedInFranchiseId() {
        let fid = (window.DNFL && window.DNFL.currentFranchiseId) || window.franchise_id || window.mflFranchiseId || window.login_franchise_id || window.current_franchise_id;
        if (!fid && window.DNFLClient && typeof window.DNFLClient.getFranchiseId === 'function') {
            fid = window.DNFLClient.getFranchiseId();
        }
        if (!fid && window.location && window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            fid = urlParams.get('F') || urlParams.get('FRANCHISE_ID') || urlParams.get('f');
        }
        if (!fid && document.cookie) {
            const cookieMatch = document.cookie.match(/(?:MFL_USER_ID|MFL_FRANCHISE_ID|franchise_id)=([^;]+)/i);
            if (cookieMatch && cookieMatch[1]) {
                const rawCookieVal = decodeURIComponent(cookieMatch[1]);
                const idMatch = rawCookieVal.match(/(?:u%3D|u=)?(\d{4})/i);
                if (idMatch && idMatch[1]) fid = idMatch[1];
            }
        }
        if (!fid) {
            const myTeamLink = document.querySelector('a[href*="O=01"], a[href*="O=02"], a[href*="F="]');
            if (myTeamLink && myTeamLink.href) {
                const hrefMatch = myTeamLink.href.match(/[?&]F=(\d{4})/i);
                if (hrefMatch && hrefMatch[1]) fid = hrefMatch[1];
            }
        }
        if (!fid) {
            const inputEl = document.querySelector('input[name="FRANCHISE_ID"], select[name="FRANCHISE_ID"]');
            if (inputEl) fid = inputEl.value;
        }
        if (!fid) return null;
        const normalized = String(fid).trim().padStart(4, '0');
        return (normalized && normalized !== '0000') ? normalized : null;
    }

    async function init() {
        const container = document.getElementById('dnfl-lts-container');
        if (!container) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        try {
            const client = getApiClient();
            const ctx = (client.getContext && typeof client.getContext === 'function') ? client.getContext() : {};
            moduleState.leagueId = ctx.leagueId || (window.league_id || '22883');
            moduleState.activeYear = ctx.year || (window.current_year || new Date().getFullYear().toString());

            // 1. Fetch League Structure (7 Days TTL)
            const leagueData = await client.fetchData('league', {
                L: moduleState.leagueId
            }, {
                ttl: client.TTL.WEEKLY
            });
            moduleState.leagueData = leagueData;

            // 2. Fetch Weekly Results (1 Hour TTL)
            const weeklyResultsData = await client.fetchData('weeklyResults', {
                W: 'ALL',
                L: moduleState.leagueId
            }, {
                ttl: client.TTL.HOURLY
            });
            moduleState.weeklyResultsData = weeklyResultsData;

            // 3. Fetch Sparse Exception Overrides (24 Hours TTL, with Catch Fallback)
            let rawRules = {};
            try {
                const jsonText = await client.fetchRawText('dnfl_lts/' + moduleState.activeYear + '/lts_rules.json', {
                    ttl: client.TTL.DAILY
                });
                if (jsonText && typeof jsonText === 'string') {
                    rawRules = JSON.parse(jsonText);
                }
            } catch (jsonErr) {
                console.info("[DNFL LTS] No sparse rules JSON override found for " + moduleState.activeYear + ". Operating on built-in default rules.");
            }
            moduleState.rulesConfig = buildRulesConfig(leagueData, rawRules);

            // 4. Resolve Initial Conference Selection
            setupConferenceSelection(client);

            // 5. Setup Action Toolbar Listeners
            setupToolbarListeners(container);

            // 6. Render Module Views
            renderLTS(container);

        } catch (err) {
            console.error("[DNFL LTS] Initialization error:", err);
            renderErrorState(container, err);
        }
    }

    function buildRulesConfig(leagueData, rawRules) {
        const config = {};
        let confList = [];

        if (leagueData && leagueData.league && leagueData.league.conferences && leagueData.league.conferences.conference) {
            const confs = leagueData.league.conferences.conference;
            confList = Array.isArray(confs) ? confs : [confs];
        }

        // Apply Default Configuration to All Discovered Conferences
        confList.forEach(c => {
            const cid = String(c.id).padStart(2, '0');
            config[cid] = {
                ...DEFAULT_CONFERENCE_RULES,
                conference_name: c.name || ('Conference ' + cid)
            };
        });

        // Top-Level League Overrides from JSON
        if (rawRules) {
            if (typeof rawRules.lts_isEnabled === 'boolean') {
                Object.keys(config).forEach(k => config[k].lts_isEnabled = rawRules.lts_isEnabled);
            }
            if (typeof rawRules.highScore_isEnabled === 'boolean') {
                Object.keys(config).forEach(k => config[k].highScore_isEnabled = rawRules.highScore_isEnabled);
            }
            if (rawRules.startWeek !== undefined) {
                Object.keys(config).forEach(k => config[k].startWeek = rawRules.startWeek);
            }

            // Sparse Specific Exceptions from JSON
            if (rawRules.exceptions && typeof rawRules.exceptions === 'object') {
                Object.keys(rawRules.exceptions).forEach(cid => {
                    const paddedCid = String(cid).padStart(2, '0');
                    if (config[paddedCid]) {
                        config[paddedCid] = {
                            ...config[paddedCid],
                            ...rawRules.exceptions[cid]
                        };
                    }
                });
            }
        }
        return config;
    }

    function setupConferenceSelection(client) {
        const userFranchiseId = getLoggedInFranchiseId();
        const userFranchise = (client.getFranchise && userFranchiseId) ? client.getFranchise(userFranchiseId) : null;
        let defaultConf = '00';

        if (userFranchise && userFranchise.conference) {
            defaultConf = String(userFranchise.conference).padStart(2, '0');
        }

        const confKeys = Object.keys(moduleState.rulesConfig);
        if (confKeys.length > 0 && !confKeys.includes(defaultConf)) {
            defaultConf = confKeys[0];
        }
        moduleState.selectedConference = defaultConf;
    }

    function setupToolbarListeners(container) {
        const confSelect = container.querySelector('#dnfl-lts-conference-select');
        if (confSelect) {
            confSelect.addEventListener('change', function(e) {
                moduleState.selectedConference = e.target.value;
                renderLTS(container);
            });
        }

        const toggleGridBtn = container.querySelector('#dnfl-lts-toggle-grid');
        if (toggleGridBtn) {
            toggleGridBtn.addEventListener('click', function() {
                const gridWrapper = container.querySelector('#dnfl-lts-grid-container');
                if (gridWrapper) {
                    gridWrapper.classList.toggle('dnfl-is-hidden');
                }
            });
        }

        const toggleSummaryBtn = container.querySelector('#dnfl-lts-toggle-summary');
        if (toggleSummaryBtn) {
            toggleSummaryBtn.addEventListener('click', function() {
                const summaryWrapper = container.querySelector('#dnfl-lts-summary-container');
                if (summaryWrapper) {
                    summaryWrapper.classList.toggle('dnfl-is-hidden');
                }
            });
        }
    }

    function calculateLTSData(confId) {
        const client = getApiClient();
        const league = moduleState.leagueData.league;
        const confRules = moduleState.rulesConfig[confId] || DEFAULT_CONFERENCE_RULES;

        // Get Franchises in Selected Conference
        let franchises = [];
        if (league && league.franchises && league.franchises.franchise) {
            const rawList = Array.isArray(league.franchises.franchise) ? league.franchises.franchise : [league.franchises.franchise];
            franchises = rawList.filter(f => String(f.conference).padStart(2, '0') === confId);
        }

        const totalTeams = franchises.length;
        const endWeek = parseInt(league.lastRegularSeasonWeek || '14', 10);

        // Determine startWeek
        let startWeek = confRules.startWeek;
        if (startWeek === 'auto' || !startWeek) {
            startWeek = Math.max(1, endWeek - (totalTeams - 1) + 1);
        } else {
            startWeek = parseInt(startWeek, 10);
        }

        // Map weekly scores: scoresMap[week][franchiseId] = score
        const scoresMap = {};
        let maxCompletedWeek = 0;

        const weeklyResults = moduleState.weeklyResultsData.weeklyResults;
        if (weeklyResults) {
            const matchWeeks = Array.isArray(weeklyResults.matchupWeek) ? weeklyResults.matchupWeek : [weeklyResults.matchupWeek];
            matchWeeks.forEach(mw => {
                const w = parseInt(mw.week, 10);
                if (mw.matchup) {
                    if (w > maxCompletedWeek) maxCompletedWeek = w;
                    scoresMap[w] = scoresMap[w] || {};
                    const matchups = Array.isArray(mw.matchup) ? mw.matchup : [mw.matchup];
                    matchups.forEach(m => {
                        if (m.franchise) {
                            const frs = Array.isArray(m.franchise) ? m.franchise : [m.franchise];
                            frs.forEach(f => {
                                const fid = String(f.id).padStart(4, '0');
                                scoresMap[w][fid] = parseFloat(f.score || '0.00');
                            });
                        }
                    });
                }
            });
        }

        // Process Survival Eliminations and High Scores
        const activeTeams = new Set(franchises.map(f => String(f.id).padStart(4, '0')));
        const eliminations = {}; // fid -> { week, score }
        const weeklySummaries = [];
        const highScorersMap = {}; // week -> fid

        for (let w = 1; w <= maxCompletedWeek; w++) {
            if (!scoresMap[w]) continue;
            const weekScores = scoresMap[w];
            const confTeamIds = franchises.map(f => String(f.id).padStart(4, '0'));

            // Identify Weekly High Scorer for the Conference
            let maxScore = -1;
            let maxScorerFid = null;
            confTeamIds.forEach(fid => {
                const score = weekScores[fid] || 0;
                if (score > maxScore) {
                    maxScore = score;
                    maxScorerFid = fid;
                }
            });
            if (maxScorerFid) {
                highScorersMap[w] = maxScorerFid;
            }

            // Perform LTS Elimination if w >= startWeek
            let eliminatedThisWeek = null;
            let eliminatedScore = 0;

            if (confRules.lts_isEnabled && w >= startWeek && activeTeams.size > 1) {
                let minScore = Infinity;
                let lowestScorers = [];

                activeTeams.forEach(fid => {
                    const score = weekScores[fid] !== undefined ? weekScores[fid] : 0;
                    if (score < minScore) {
                        minScore = score;
                        lowestScorers = [fid];
                    } else if (score === minScore) {
                        lowestScorers.push(fid);
                    }
                });

                if (lowestScorers.length === 1) {
                    eliminatedThisWeek = lowestScorers[0];
                    eliminatedScore = minScore;
                } else if (lowestScorers.length > 1) {
                    // Tiebreaker: Fewest Cumulative YTD Points up to week w
                    let lowestYTD = Infinity;
                    let tiebreakerWinner = lowestScorers[0];

                    lowestScorers.forEach(fid => {
                        let cumulativeYTD = 0;
                        for (let k = 1; k <= w; k++) {
                            cumulativeYTD += (scoresMap[k] && scoresMap[k][fid]) ? scoresMap[k][fid] : 0;
                        }
                        if (cumulativeYTD < lowestYTD) {
                            lowestYTD = cumulativeYTD;
                            tiebreakerWinner = fid;
                        }
                    });
                    eliminatedThisWeek = tiebreakerWinner;
                    eliminatedScore = minScore;
                }

                if (eliminatedThisWeek) {
                    activeTeams.delete(eliminatedThisWeek);
                    eliminations[eliminatedThisWeek] = {
                        week: w,
                        score: eliminatedScore
                    };
                }
            }

            weeklySummaries.push({
                week: w,
                eliminatedFid: eliminatedThisWeek,
                eliminatedScore: eliminatedScore,
                highScoreFid: maxScorerFid,
                highScore: maxScore
            });
        }

        return {
            franchises,
            confRules,
            startWeek,
            maxCompletedWeek,
            scoresMap,
            activeTeams,
            eliminations,
            highScorersMap,
            weeklySummaries
        };
    }

    function renderLTS(container) {
        const confId = moduleState.selectedConference;
        const data = calculateLTSData(confId);

        // Render Conference Select Dropdown
        const confSelect = container.querySelector('#dnfl-lts-conference-select');
        if (confSelect) {
            let optionsHtml = '';
            Object.keys(moduleState.rulesConfig).forEach(cid => {
                const cfg = moduleState.rulesConfig[cid];
                const isSelected = cid === confId ? 'selected' : '';
                optionsHtml += `<option value="${cid}" ${isSelected}>${cfg.conference_name}</option>`;
            });
            confSelect.innerHTML = optionsHtml;
        }

        // Render View A: Cross-Grid Matrix
        renderScoresGrid(container, data);

        // Render View B: Summary Table
        renderSummaryTable(container, data);
    }

    function renderScoresGrid(container, data) {
        const client = getApiClient();
        const gridContainer = container.querySelector('#dnfl-lts-grid-container');
        if (!gridContainer) return;

        const userFid = getLoggedInFranchiseId();
        const activeFids = Array.from(data.activeTeams);
        const eliminatedFids = Object.keys(data.eliminations);

        // Sort Active Franchises by Team Name
        const activeFranchises = data.franchises.filter(f => activeFids.includes(String(f.id).padStart(4, '0')));
        const eliminatedFranchises = data.franchises.filter(f => eliminatedFids.includes(String(f.id).padStart(4, '0')));

        let tableHtml = `<div class="dnfl-table-wrapper"><table class="dnfl-table dnfl-lts-grid-table"><thead><tr>`;
        tableHtml += `<th class="dnfl-sticky-col">Franchise</th>`;

        for (let w = 1; w <= data.maxCompletedWeek; w++) {
            const isLTSWeek = data.confRules.lts_isEnabled && w >= data.startWeek;
            tableHtml += `<th class="dnfl-text-center">W${w}${isLTSWeek ? ' 💀' : ''}</th>`;
        }
        tableHtml += `</tr></thead><tbody>`;

        // Helper to render team row
        function buildRow(f, isEliminated) {
            const fid = String(f.id).padStart(4, '0');
            const isMyTeam = (fid === userFid) ? 'dnfl-my-team' : '';
            const franchise = client.getFranchise ? client.getFranchise(fid) : null;
            const teamName = f.name || (franchise ? franchise.name : ('Franchise ' + fid));
            const ownerName = f.owner_name || (franchise ? franchise.owner_name : '');
            const iconUrl = f.icon || (franchise ? franchise.icon : '');

            let rowHtml = `<tr class="${isMyTeam} ${isEliminated ? 'dnfl-row-muted' : ''}">`;
            rowHtml += `<td class="dnfl-sticky-col"><div class="dnfl-team-cell">`;
            if (iconUrl) {
                rowHtml += `<img src="${iconUrl}" class="franchiseicon" alt="icon">`;
            }
            rowHtml += `<div><div class="dnfl-team-name">${teamName}</div><div class="dnfl-owner-name">${ownerName}</div></div></div></td>`;

            const elimInfo = data.eliminations[fid];

            for (let w = 1; w <= data.maxCompletedWeek; w++) {
                const score = (data.scoresMap[w] && data.scoresMap[w][fid] !== undefined) ? data.scoresMap[w][fid].toFixed(2) : '—';
                const isHighScore = (data.highScorersMap[w] === fid);
                const isKnockout = elimInfo && (elimInfo.week === w);
                const isPostElim = elimInfo && (w > elimInfo.week);

                rowHtml += `<td class="dnfl-text-center">`;
                if (isHighScore && data.confRules.highScore_isEnabled) {
                    rowHtml += `<span class="dnfl-pill-green" title="Weekly High Score">⭐ ${score}</span>`;
                } else if (isKnockout && data.confRules.lts_isEnabled) {
                    rowHtml += `<span class="dnfl-pill-red" title="LTS Knockout Score">💀 ${score}</span>`;
                } else if (isPostElim) {
                    rowHtml += `<span class="dnfl-text-muted" title="Post-Elimination Score">💀 ${score}</span>`;
                } else {
                    rowHtml += `${score}`;
                }
                rowHtml += `</td>`;
            }
            rowHtml += `</tr>`;
            return rowHtml;
        }

        // Active Teams
        activeFranchises.forEach(f => {
            tableHtml += buildRow(f, false);
        });

        // LTS Eliminated Teams Divider & Rows
        if (eliminatedFranchises.length > 0) {
            const totalCols = data.maxCompletedWeek + 1;
            tableHtml += `<tr class="dnfl-divider-row"><td colspan="${totalCols}">LTS Eliminated Teams</td></tr>`;
            eliminatedFranchises.forEach(f => {
                tableHtml += buildRow(f, true);
            });
        }

        tableHtml += `</tbody></table></div>`;
        gridContainer.innerHTML = tableHtml;
    }

    function renderSummaryTable(container, data) {
        const client = getApiClient();
        const summaryContainer = container.querySelector('#dnfl-lts-summary-container');
        if (!summaryContainer) return;

        let tableHtml = `<div class="dnfl-table-wrapper"><table class="dnfl-table dnfl-lts-summary-table"><thead><tr>`;
        tableHtml += `<th>Week</th><th>Eliminated Franchise</th><th class="dnfl-text-center">Knockout Score</th><th>Weekly High Scorer</th><th class="dnfl-text-center">High Score</th>`;
        tableHtml += `</tr></thead><tbody>`;

        data.weeklySummaries.forEach(s => {
            tableHtml += `<tr>`;
            tableHtml += `<td class="dnfl-font-bold">Week ${s.week}</td>`;

            // Eliminated Franchise
            if (s.eliminatedFid) {
                const f = client.getFranchise ? client.getFranchise(s.eliminatedFid) : null;
                const tName = f ? f.name : ('Franchise ' + s.eliminatedFid);
                const iconHtml = f && f.icon ? `<img src="${f.icon}" class="franchiseicon" alt="icon">` : '';
                tableHtml += `<td><div class="dnfl-team-cell">${iconHtml}<span>${tName}</span></div></td>`;
                tableHtml += `<td class="dnfl-text-center"><span class="dnfl-pill-red">💀 ${s.eliminatedScore.toFixed(2)}</span></td>`;
            } else {
                tableHtml += `<td class="dnfl-text-muted">—</td><td class="dnfl-text-center dnfl-text-muted">—</td>`;
            }

            // Weekly High Scorer
            if (s.highScoreFid) {
                const f = client.getFranchise ? client.getFranchise(s.highScoreFid) : null;
                const tName = f ? f.name : ('Franchise ' + s.highScoreFid);
                const iconHtml = f && f.icon ? `<img src="${f.icon}" class="franchiseicon" alt="icon">` : '';
                tableHtml += `<td><div class="dnfl-team-cell">${iconHtml}<span>${tName}</span></div></td>`;
                tableHtml += `<td class="dnfl-text-center"><span class="dnfl-pill-green">⭐ ${s.highScore.toFixed(2)}</span></td>`;
            } else {
                tableHtml += `<td class="dnfl-text-muted">—</td><td class="dnfl-text-center dnfl-text-muted">—</td>`;
            }
            tableHtml += `</tr>`;
        });

        tableHtml += `</tbody></table></div>`;
        summaryContainer.innerHTML = tableHtml;
    }

    function renderErrorState(container, err) {
        const content = container.querySelector('#dnfl-lts-content');
        if (content) {
            content.innerHTML = '<div class="dnfl-status-error">Failed to load Last Team Standing data.</div>';
        }
    }

    // Public API
    window.DNFL.LTS = {
        init: init,
        updateView: function() {
            const container = document.getElementById('dnfl-lts-container');
            if (container) renderLTS(container);
        },
        toggleGrid: function() {
            const container = document.getElementById('dnfl-lts-container');
            if (container) {
                const g = container.querySelector('#dnfl-lts-grid-container');
                if (g) g.classList.toggle('dnfl-is-hidden');
            }
        },
        toggleSummary: function() {
            const container = document.getElementById('dnfl-lts-container');
            if (container) {
                const s = container.querySelector('#dnfl-lts-summary-container');
                if (s) s.classList.toggle('dnfl-is-hidden');
            }
        }
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
