/* ==========================================================================
   DNFL Last Team Standing (LTS) Module Logic Engine (v8)
   Duke Networking Fantasy League (DNFL)
   Fully aligned with DNFL Master SCSS/CSS Design System & Standard Modules
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
     * Standard framework normalization helpers
     */
    function norm(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    function normFranchiseId(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    /**
     * Resolves the active logged-in user's 4-digit franchise ID across 5 context layers
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
        return normFranchiseId(fid);
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

            // Year & League Context Resolution
            let yearVal = ctx.year || window.current_year || window.year;
            if (!yearVal && window.location && window.location.pathname) {
                const yearMatch = window.location.pathname.match(/\/(20\d{2})\//);
                if (yearMatch) yearVal = yearMatch[1];
            }
            moduleState.activeYear = String(yearVal || new Date().getFullYear());
            moduleState.leagueId = String(ctx.leagueId || window.league_id || '22883');

            // 1. Fetch League Structure (7 Days TTL)
            const leagueData = await client.fetchData('league', {
                L: moduleState.leagueId
            }, {
                ttl: client.TTL.WEEKLY
            });
            moduleState.leagueData = leagueData;

            // 2. Fetch Weekly Results (1 Hour TTL)
            let weeklyResultsData = null;
            try {
                weeklyResultsData = await client.fetchData('weeklyResults', {
                    W: 'ALL',
                    L: moduleState.leagueId
                }, {
                    ttl: client.TTL.HOURLY
                });
            } catch (err) {
                console.warn("[DNFL LTS] Fetching W=ALL failed, trying week-by-week fallback...", err);
            }

            // Fallback: If W=ALL returns no usable matchup data, query individual weeks
            let extractedWeeks = extractMatchupWeeks(weeklyResultsData);
            if (!extractedWeeks || extractedWeeks.length === 0) {
                const endWeek = parseInt(leagueData?.league?.lastRegularSeasonWeek || '14', 10);
                const weekPromises = [];
                for (let w = 1; w <= endWeek; w++) {
                    weekPromises.push(
                        client.fetchData('weeklyResults', { W: String(w), L: moduleState.leagueId }, { ttl: client.TTL.HOURLY })
                            .catch(() => null)
                    );
                }
                const results = await Promise.all(weekPromises);
                const compiledWeeks = [];
                results.forEach((res, idx) => {
                    if (res) {
                        const parsed = extractMatchupWeeks(res);
                        if (parsed.length > 0) {
                            compiledWeeks.push(...parsed);
                        } else if (res.weeklyResults) {
                            compiledWeeks.push({ week: String(idx + 1), ...res.weeklyResults });
                        }
                    }
                });
                weeklyResultsData = { weeklyResults: compiledWeeks };
            }
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

    /**
     * Builds Rules Configuration using 3-Tier Cascading Hierarchy
     */
    function buildRulesConfig(leagueData, rawRules) {
        const config = {};
        const confs = toArray(leagueData?.league?.conferences?.conference);

        confs.forEach(c => {
            const cid = norm(c.id);
            config[cid] = {
                ...DEFAULT_CONFERENCE_RULES,
                conference_name: c.name || ('Conference ' + cid)
            };
        });

        // If no conferences defined in league data, default conference 00
        if (Object.keys(config).length === 0) {
            config['00'] = {
                ...DEFAULT_CONFERENCE_RULES,
                conference_name: 'Main Conference'
            };
        }

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
                    const paddedCid = norm(cid);
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

    /**
     * Resolves default conference dropdown based on logged-in user's division/conference mapping
     */
    function setupConferenceSelection(client) {
        const userFranchiseId = getLoggedInFranchiseId();
        const league = moduleState.leagueData?.league;
        
        // Build Division -> Conference Map
        const divToConfMap = {};
        const divisions = toArray(league?.divisions?.division);
        divisions.forEach(d => {
            divToConfMap[norm(d.id)] = norm(d.conference);
        });

        // Get User Franchise
        const franchises = toArray(league?.franchises?.franchise);
        const userFranchise = userFranchiseId ? franchises.find(f => normFranchiseId(f.id) === userFranchiseId) : null;
        
        let defaultConf = '00';
        if (userFranchise) {
            const fDivNorm = norm(userFranchise.division || userFranchise.div);
            const fConfNorm = norm(userFranchise.conference || userFranchise.conf || divToConfMap[fDivNorm]);
            if (fConfNorm) defaultConf = fConfNorm;
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
                moduleState.selectedConference = norm(e.target.value);
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

    /**
     * Safely extracts matchup weeks from multi-format MFL weeklyResults responses
     * Handles: mw.matchup, mw.matchUp, mw.schedule.matchup, mw.franchise
     */
    function extractMatchupWeeks(weeklyResultsData) {
        if (!weeklyResultsData) return [];
        let weeksRaw = null;

        if (weeklyResultsData.allWeeklyResults?.weeklyResults) {
            weeksRaw = weeklyResultsData.allWeeklyResults.weeklyResults;
        } else if (weeklyResultsData.weeklyResults) {
            weeksRaw = weeklyResultsData.weeklyResults.matchupWeek || weeklyResultsData.weeklyResults.matchup || weeklyResultsData.weeklyResults.matchUp || weeklyResultsData.weeklyResults;
        } else if (weeklyResultsData.matchupWeek) {
            weeksRaw = weeklyResultsData.matchupWeek;
        } else if (Array.isArray(weeklyResultsData)) {
            weeksRaw = weeklyResultsData;
        }

        return toArray(weeksRaw).filter(mw => mw && mw.week !== undefined && mw.week !== null);
    }

    /**
     * Core Data Processing Engine
     */
    function calculateLTSData(confId) {
        const client = getApiClient();
        const league = moduleState.leagueData?.league;
        const confRules = moduleState.rulesConfig[confId] || DEFAULT_CONFERENCE_RULES;

        // Build Division -> Conference Map
        const divToConfMap = {};
        const divisions = toArray(league?.divisions?.division);
        divisions.forEach(d => {
            divToConfMap[norm(d.id)] = norm(d.conference);
        });

        // Get Franchises in Selected Conference with division fallback
        const allFranchises = toArray(league?.franchises?.franchise);
        const franchises = allFranchises.filter(f => {
            const fDivNorm = norm(f.division || f.div);
            const fConfNorm = norm(f.conference || f.conf || divToConfMap[fDivNorm]);
            return fConfNorm === norm(confId);
        });

        const totalTeams = franchises.length;
        const endWeek = parseInt(league?.lastRegularSeasonWeek || '14', 10);

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

        const matchWeeks = extractMatchupWeeks(moduleState.weeklyResultsData);
        if (matchWeeks && matchWeeks.length > 0) {
            matchWeeks.forEach(mw => {
                const w = parseInt(mw.week, 10);
                if (!w) return;
                scoresMap[w] = scoresMap[w] || {};

                const matchupsRaw = mw.matchup || mw.matchUp || mw.schedule?.matchup || mw.schedule?.matchUp;

                // Path A: Matchups Array
                if (matchupsRaw) {
                    if (w > maxCompletedWeek) maxCompletedWeek = w;
                    const matchups = toArray(matchupsRaw);
                    matchups.forEach(m => {
                        const frs = toArray(m.franchise);
                        frs.forEach(f => {
                            const fid = normFranchiseId(f.id);
                            if (fid) scoresMap[w][fid] = parseFloat(f.score || '0.00');
                        });
                    });
                }
                // Path B: Standalone Franchise Score List
                else if (mw.franchise) {
                    if (w > maxCompletedWeek) maxCompletedWeek = w;
                    const frs = toArray(mw.franchise);
                    frs.forEach(f => {
                        const fid = normFranchiseId(f.id);
                        if (fid) scoresMap[w][fid] = parseFloat(f.score || '0.00');
                    });
                }
            });
        }

        // Process Survival Eliminations and High Scores
        const activeTeams = new Set(franchises.map(f => normFranchiseId(f.id)));
        const eliminations = {}; // fid -> { week, score }
        const weeklySummaries = [];
        const highScorersMap = {}; // week -> fid

        for (let w = 1; w <= maxCompletedWeek; w++) {
            if (!scoresMap[w]) continue;
            const weekScores = scoresMap[w];
            const confTeamIds = franchises.map(f => normFranchiseId(f.id));

            // Identify Weekly High Scorer for the Conference
            let maxScore = -1;
            let maxScorerFid = null;
            confTeamIds.forEach(fid => {
                const score = weekScores[fid] !== undefined ? weekScores[fid] : -1;
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
                    // Primary Tiebreaker: Fewest Cumulative YTD Points up to week w
                    let lowestYTD = Infinity;
                    let ytdTiedScorers = [];

                    lowestScorers.forEach(fid => {
                        let cumulativeYTD = 0;
                        for (let k = 1; k <= w; k++) {
                            cumulativeYTD += (scoresMap[k] && scoresMap[k][fid] !== undefined) ? scoresMap[k][fid] : 0;
                        }
                        if (cumulativeYTD < lowestYTD) {
                            lowestYTD = cumulativeYTD;
                            ytdTiedScorers = [fid];
                        } else if (cumulativeYTD === lowestYTD) {
                            ytdTiedScorers.push(fid);
                        }
                    });

                    if (ytdTiedScorers.length === 1) {
                        eliminatedThisWeek = ytdTiedScorers[0];
                    } else {
                        // Secondary Tiebreaker: Prior week score comparison
                        let lowestPriorScore = Infinity;
                        let finalEliminated = ytdTiedScorers[0];

                        ytdTiedScorers.forEach(fid => {
                            const priorScore = (w > 1 && scoresMap[w - 1] && scoresMap[w - 1][fid] !== undefined) ? scoresMap[w - 1][fid] : 0;
                            if (priorScore < lowestPriorScore) {
                                lowestPriorScore = priorScore;
                                finalEliminated = fid;
                            }
                        });
                        eliminatedThisWeek = finalEliminated;
                    }
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
            endWeek,
            maxCompletedWeek,
            scoresMap,
            activeTeams,
            eliminations,
            highScorersMap,
            weeklySummaries
        };
    }

    /**
     * Renders Module Views with Preserved Card Architecture
     */
    function renderLTS(container) {
        const confId = moduleState.selectedConference;
        
        let contentEl = container.querySelector('#dnfl-lts-content');
        if (!contentEl) {
            contentEl = container;
        }

        // Auto-Mount Container Wrappers inside #dnfl-lts-content without wiping parent header
        let gridContainer = container.querySelector('#dnfl-lts-grid-container');
        let summaryContainer = container.querySelector('#dnfl-lts-summary-container');

        if (!gridContainer || !summaryContainer) {
            contentEl.innerHTML = `
                <div id="dnfl-lts-grid-container" class="dnfl-lts-view"></div>
                <div id="dnfl-lts-summary-container" class="dnfl-lts-view dnfl-mt-4"></div>
            `;
            gridContainer = container.querySelector('#dnfl-lts-grid-container');
            summaryContainer = container.querySelector('#dnfl-lts-summary-container');
        }

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

        // Offseason / Pre-Season Check
        if (data.maxCompletedWeek === 0) {
            const preSeasonHtml = `
                <div class="dnfl-status-loading dnfl-p-4 dnfl-text-center">
                    <i class="fa-solid fa-clock-rotate-left dnfl-icon-amber dnfl-mr-2"></i>
                    <span>Survival eliminations will activate once Week 1 scores are finalized.</span>
                </div>
            `;
            if (gridContainer) gridContainer.innerHTML = preSeasonHtml;
            if (summaryContainer) summaryContainer.innerHTML = '';
            return;
        }

        // Render View A: Cross-Grid Matrix (All Regular Season Weeks)
        renderScoresGrid(container, data);

        // Render View B: Summary Table
        renderSummaryTable(container, data);
    }

    /**
     * Renders View A: Survival Cross-Grid Matrix
     * Covers ALL regular season weeks (1 to endWeek)
     */
    function renderScoresGrid(container, data) {
        const client = getApiClient();
        const gridContainer = container.querySelector('#dnfl-lts-grid-container');
        if (!gridContainer) return;

        const userFid = getLoggedInFranchiseId();
        const activeFids = Array.from(data.activeTeams);
        const eliminatedFids = Object.keys(data.eliminations);

        // Sort Franchises by Team Name
        const activeFranchises = data.franchises.filter(f => activeFids.includes(normFranchiseId(f.id)));
        const eliminatedFranchises = data.franchises.filter(f => eliminatedFids.includes(normFranchiseId(f.id)));

        // Base Dynamic URL
        const baseURLDynamic = window.baseURLDynamic || (window.location ? window.location.origin : 'https://www22.myfantasyleague.com');

        let html = `
            <div class="dnfl-section-header dnfl-mb-2">
                <h4 class="dnfl-card-title"><i class="fa-solid fa-table-cells dnfl-icon-blue"></i> Survival Cross-Grid Matrix</h4>
            </div>
            <div class="dnfl-table-wrapper">
                <table class="dnfl-table dnfl-lts-grid-table">
                    <thead>
                        <tr>
                            <th class="dnfl-col-franchise dnfl-sticky-col">Franchise</th>
        `;

        // Render Column Headers for ALL Regular Season Weeks (1 to endWeek)
        for (let w = 1; w <= data.endWeek; w++) {
            const isLTSWeek = data.confRules.lts_isEnabled && w >= data.startWeek;
            html += `<th class="dnfl-text-center">W${w}${isLTSWeek ? ' 💀' : ''}</th>`;
        }
        html += `</tr></thead><tbody>`;

        // Helper to render team row matching Standings / Rankings typography
        function buildRow(f, isEliminated) {
            const fid = normFranchiseId(f.id);
            const isMyTeam = (fid === userFid) ? 'dnfl-my-team' : '';
            const franchise = client.getFranchise ? client.getFranchise(fid) : null;
            const teamName = f.name || (franchise ? franchise.name : ('Franchise ' + fid));
            const ownerName = f.owner_name || (franchise ? franchise.owner_name : '');
            const iconUrl = f.icon || (franchise ? franchise.icon : '') || 'https://dnfl.live/images/ficon-dnfl.png';
            const teamUrl = `${baseURLDynamic}/${moduleState.activeYear}/options?L=${moduleState.leagueId}&F=${fid}&O=01`;

            let rowHtml = `<tr class="${isMyTeam} ${isEliminated ? 'dnfl-row-muted' : ''}">`;
            rowHtml += `
                <td class="dnfl-col-franchise dnfl-sticky-col">
                    <div class="dnfl-franchise-cell">
                        <img src="${iconUrl}" class="franchiseicon" alt="icon" onError="this.onerror=null;this.src='https://dnfl.live/images/ficon-dnfl.png';">
                        <div class="dnfl-franchise-info">
                            <a class="dnfl-team-name" href="${teamUrl}" target="_blank">${teamName}</a>
                            <span class="dnfl-owner-name">${ownerName}</span>
                        </div>
                    </div>
                </td>
            `;

            const elimInfo = data.eliminations[fid];

            // Render Scores for ALL Regular Season Weeks (1 to endWeek)
            for (let w = 1; w <= data.endWeek; w++) {
                rowHtml += `<td class="dnfl-text-center">`;

                if (w <= data.maxCompletedWeek) {
                    const scoreVal = (data.scoresMap[w] && data.scoresMap[w][fid] !== undefined) ? data.scoresMap[w][fid] : null;
                    const scoreStr = (scoreVal !== null) ? scoreVal.toFixed(2) : '—';
                    const isHighScore = (data.highScorersMap[w] === fid);
                    const isKnockout = elimInfo && (elimInfo.week === w);
                    const isPostElim = elimInfo && (w > elimInfo.week);

                    if (isHighScore && data.confRules.highScore_isEnabled) {
                        rowHtml += `<span class="dnfl-pill dnfl-pill-green" title="Weekly High Score">${scoreStr} <i class="fa-solid fa-star"></i></span>`;
                    } else if (isKnockout && data.confRules.lts_isEnabled) {
                        rowHtml += `<span class="dnfl-pill dnfl-pill-red" title="LTS Knockout Score">${scoreStr} <i class="fa-solid fa-skull"></i></span>`;
                    } else if (isPostElim) {
                        rowHtml += `<span class="dnfl-text-muted" title="Post-Elimination Score">${scoreStr} <i class="fa-solid fa-skull"></i></span>`;
                    } else {
                        rowHtml += scoreStr;
                    }
                } else {
                    // Future / Unplayed Weeks
                    rowHtml += `<span class="dnfl-text-muted">—</span>`;
                }

                rowHtml += `</td>`;
            }
            rowHtml += `</tr>`;
            return rowHtml;
        }

        // Active Survival Teams
        activeFranchises.forEach(f => {
            html += buildRow(f, false);
        });

        // LTS Eliminated Teams Divider & Rows
        if (eliminatedFranchises.length > 0) {
            const totalCols = data.endWeek + 1;
            html += `<tr class="dnfl-divider-row"><td colspan="${totalCols}">LTS Eliminated Teams</td></tr>`;
            eliminatedFranchises.forEach(f => {
                html += buildRow(f, true);
            });
        }

        html += `</tbody></table></div>`;
        gridContainer.innerHTML = html;
    }

    /**
     * Renders View B: Weekly Survival Summary Table
     */
    function renderSummaryTable(container, data) {
        const client = getApiClient();
        const summaryContainer = container.querySelector('#dnfl-lts-summary-container');
        if (!summaryContainer) return;

        const baseURLDynamic = window.baseURLDynamic || (window.location ? window.location.origin : 'https://www22.myfantasyleague.com');

        let html = `
            <div class="dnfl-section-header dnfl-mt-4 dnfl-mb-2">
                <h4 class="dnfl-card-title"><i class="fa-solid fa-list-check dnfl-icon-blue"></i> Weekly Survival Summary</h4>
            </div>
            <div class="dnfl-table-wrapper">
                <table class="dnfl-table dnfl-lts-summary-table">
                    <thead>
                        <tr>
                            <th>Week</th>
                            <th>Eliminated Franchise</th>
                            <th class="dnfl-text-center">Knockout Score</th>
                            <th>Weekly High Scorer</th>
                            <th class="dnfl-text-center">High Score</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.weeklySummaries.forEach(s => {
            html += `<tr>`;
            html += `<td class="dnfl-font-bold">Week ${s.week}</td>`;

            // 1. Eliminated Franchise
            if (s.eliminatedFid) {
                const fid = s.eliminatedFid;
                const f = client.getFranchise ? client.getFranchise(fid) : null;
                const tName = f ? f.name : ('Franchise ' + fid);
                const ownerName = f ? (f.owner_name || '') : '';
                const iconUrl = (f && f.icon) ? f.icon : 'https://dnfl.live/images/ficon-dnfl.png';
                const teamUrl = `${baseURLDynamic}/${moduleState.activeYear}/options?L=${moduleState.leagueId}&F=${fid}&O=01`;

                html += `
                    <td class="dnfl-col-franchise">
                        <div class="dnfl-franchise-cell">
                            <img src="${iconUrl}" class="franchiseicon" alt="icon" onError="this.onerror=null;this.src='https://dnfl.live/images/ficon-dnfl.png';">
                            <div class="dnfl-franchise-info">
                                <a class="dnfl-team-name" href="${teamUrl}" target="_blank">${tName}</a>
                                <span class="dnfl-owner-name">${ownerName}</span>
                            </div>
                        </div>
                    </td>
                    <td class="dnfl-text-center">
                        <span class="dnfl-pill dnfl-pill-red" title="LTS Knockout Score">${s.eliminatedScore.toFixed(2)} <i class="fa-solid fa-skull"></i></span>
                    </td>
                `;
            } else {
                html += `<td class="dnfl-text-muted">—</td><td class="dnfl-text-center dnfl-text-muted">—</td>`;
            }

            // 2. Weekly High Scorer
            if (s.highScoreFid) {
                const fid = s.highScoreFid;
                const f = client.getFranchise ? client.getFranchise(fid) : null;
                const tName = f ? f.name : ('Franchise ' + fid);
                const ownerName = f ? (f.owner_name || '') : '';
                const iconUrl = (f && f.icon) ? f.icon : 'https://dnfl.live/images/ficon-dnfl.png';
                const teamUrl = `${baseURLDynamic}/${moduleState.activeYear}/options?L=${moduleState.leagueId}&F=${fid}&O=01`;

                html += `
                    <td class="dnfl-col-franchise">
                        <div class="dnfl-franchise-cell">
                            <img src="${iconUrl}" class="franchiseicon" alt="icon" onError="this.onerror=null;this.src='https://dnfl.live/images/ficon-dnfl.png';">
                            <div class="dnfl-franchise-info">
                                <a class="dnfl-team-name" href="${teamUrl}" target="_blank">${tName}</a>
                                <span class="dnfl-owner-name">${ownerName}</span>
                            </div>
                        </div>
                    </td>
                    <td class="dnfl-text-center">
                        <span class="dnfl-pill dnfl-pill-green" title="Weekly High Score">${s.highScore.toFixed(2)} <i class="fa-solid fa-star"></i></span>
                    </td>
                `;
            } else {
                html += `<td class="dnfl-text-muted">—</td><td class="dnfl-text-center dnfl-text-muted">—</td>`;
            }

            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        summaryContainer.innerHTML = html;
    }

    function renderErrorState(container, err) {
        const content = container.querySelector('#dnfl-lts-content') || container;
        if (content) {
            content.innerHTML = '<div class="dnfl-status-error dnfl-p-4 dnfl-text-center"><i class="fa-solid fa-triangle-exclamation dnfl-mr-2"></i> Failed to load Last Team Standing data.</div>';
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
